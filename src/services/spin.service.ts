import { randomInt, randomBytes } from 'crypto';
import { db } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PoolClient } from 'pg';

interface SpinResult {
    spinId: string;
    award: number;
    awardType: string;
    displaySectorIndex: number;
    status: string;
    requiresManualReview: boolean;
    message: string;
}

export interface SpinProbability {
    value: number;
    probability: number;
    label: string;
}

export class SpinService {
    /**
     * 执行转盘抽奖
     */
    async executeSpin(
        userId: string,
        paymentId: string,
        idempotencyKey: string
    ): Promise<SpinResult> {
        return await db.transaction(async (client: PoolClient) => {
            // 1. 检查幂等性
            const existingSpin = await client.query(
                'SELECT * FROM spins WHERE idempotency_key = $1',
                [idempotencyKey]
            );

            if (existingSpin.rows.length > 0) {
                const spin = existingSpin.rows[0];
                return this.formatSpinResult(spin);
            }

            // 2. 验证 payment 并锁定
            const paymentResult = await client.query(
                `SELECT * FROM payments 
                WHERE id = $1 AND user_id = $2 AND status = 'confirmed' 
                FOR UPDATE`,
                [paymentId, userId]
            );

            if (paymentResult.rows.length === 0) {
                throw new Error('Payment not found or not confirmed');
            }

            const payment = paymentResult.rows[0];

            if (payment.used_spin) {
                throw new Error('This payment has already been used for a spin');
            }

            // 3. 检查用户是否被封禁
            const userResult = await client.query(
                'SELECT is_banned FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows[0]?.is_banned) {
                throw new Error('User is banned');
            }

            // 4. 生成随机数并决定奖项
            const { award, sectorIndex, randomValue, serverNonce } = this.determineAward();

            logger.info('Spin award determined', {
                userId,
                paymentId,
                award,
                sectorIndex,
                randomValue,
            });

            // 5. 判断是否需要人工审核
            const requiresReview = award >= config.spin.largePrizeThreshold;

            // 6. 插入 spin 记录
            const spinResult = await client.query(
                `INSERT INTO spins (
                    user_id, payment_id, award, award_type, display_sector_index,
                    random_value, probability_snapshot, server_nonce,
                    status, requires_manual_review, idempotency_key
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    userId,
                    paymentId,
                    award,
                    'game_usdt',
                    sectorIndex,
                    randomValue,
                    JSON.stringify(config.spin.probabilities),
                    serverNonce,
                    requiresReview ? 'pending_review' : 'pending',
                    requiresReview,
                    idempotencyKey,
                ]
            );

            const spin = spinResult.rows[0];

            // 7. 标记 payment 已使用
            await client.query(
                'UPDATE payments SET used_spin = true WHERE id = $1',
                [paymentId]
            );

            // 8. 如果不需要审核，立即发放奖励
            if (!requiresReview) {
                await this.creditAward(client, userId, spin.id, award);
                
                await client.query(
                    'UPDATE spins SET status = $1 WHERE id = $2',
                    ['credited', spin.id]
                );

                spin.status = 'credited';

                // 9. 更新任务进度V2 - 完成抽奖任务
                try {
                    const { updateTaskProgressV2 } = await import('../routes/task.routes');
                    const taskResult = await updateTaskProgressV2(userId, 'spin', client);
                    if (taskResult.success && taskResult.reward) {
                        logger.info('Task completed after spin', {
                            userId,
                            reward: taskResult.reward,
                            newTaskIndex: taskResult.newTaskIndex
                        });
                    }
                } catch (taskError) {
                    logger.error('Task update error after spin', { error: taskError });
                    // 不影响抽奖主流程
                }
            } else {
                // 发送告警给管理员
                await this.notifyLargePrize(userId, award, spin.id);
            }

            // 9. 记录审计日志
            await this.logAudit(client, userId, 'spin_executed', {
                spinId: spin.id,
                paymentId,
                award,
                requiresReview,
            });

            return this.formatSpinResult(spin);
        });
    }

    /**
     * 确定奖项（核心概率算法）
     */
    private determineAward(): {
        award: number;
        sectorIndex: number;
        randomValue: number;
        serverNonce: string;
    } {
        const probabilities = config.spin.probabilities;

        // 生成随机数 (0-999999) 以获得百万级精度
        const randomValue = randomInt(0, 1_000_000);
        const normalizedRandom = randomValue / 1_000_000;

        // 生成服务器 nonce（用于审计）
        const serverNonce = randomBytes(16).toString('hex');

        // 根据累积概率选择奖项
        let cumulativeProbability = 0;
        let selectedIndex = 0;

        for (let i = 0; i < probabilities.length; i++) {
            cumulativeProbability += probabilities[i].probability;
            if (normalizedRandom < cumulativeProbability) {
                selectedIndex = i;
                break;
            }
        }

        const selectedPrize = probabilities[selectedIndex];

        logger.debug('Award determination', {
            randomValue,
            normalizedRandom,
            selectedIndex,
            award: selectedPrize.value,
        });

        return {
            award: selectedPrize.value,
            sectorIndex: selectedIndex,
            randomValue,
            serverNonce,
        };
    }

    /**
     * 发放奖励到用户余额
     */
    private async creditAward(
        client: PoolClient,
        userId: string,
        spinId: string,
        amount: number
    ): Promise<void> {
        // 获取当前余额并锁定
        const userResult = await client.query(
            'SELECT game_balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );

        const balanceBefore = parseFloat(userResult.rows[0].game_balance);
        const balanceAfter = balanceBefore + amount;

        // 更新余额
        await client.query(
            'UPDATE users SET game_balance = $1 WHERE id = $2',
            [balanceAfter, userId]
        );

        // 记录余额变动
        await client.query(
            `INSERT INTO balance_changes (
                user_id, delta, balance_before, balance_after,
                change_type, source_type, source_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, amount, balanceBefore, balanceAfter, 'spin_win', 'spin', spinId]
        );

        logger.info('Award credited', { userId, spinId, amount, balanceAfter });
    }

    /**
     * 发送大奖告警
     */
    private async notifyLargePrize(userId: string, award: number, spinId: string): Promise<void> {
        logger.warn('Large prize detected - requires manual review', {
            userId,
            award,
            spinId,
        });

        // TODO: 实现 Telegram 或邮件通知给管理员
        // await telegramBot.sendMessage(config.telegram.alertChatId, ...)
    }

    /**
     * 格式化返回结果
     */
    private formatSpinResult(spin: any): SpinResult {
        return {
            spinId: spin.id,
            award: parseFloat(spin.award),
            awardType: spin.award_type,
            displaySectorIndex: spin.display_sector_index,
            status: spin.status,
            requiresManualReview: spin.requires_manual_review,
            message: spin.requires_manual_review
                ? 'Congratulations! Your prize requires manual review.'
                : 'Congratulations! Your prize has been credited to your account.',
        };
    }

    /**
     * 管理员批准大奖
     */
    async approveSpin(
        spinId: string,
        adminId: string,
        notes?: string
    ): Promise<void> {
        await db.transaction(async (client: PoolClient) => {
            const spinResult = await client.query(
                'SELECT * FROM spins WHERE id = $1 FOR UPDATE',
                [spinId]
            );

            if (spinResult.rows.length === 0) {
                throw new Error('Spin not found');
            }

            const spin = spinResult.rows[0];

            if (spin.status !== 'pending_review') {
                throw new Error('Spin is not pending review');
            }

            // 发放奖励
            await this.creditAward(client, spin.user_id, spinId, parseFloat(spin.award));

            // 更新 spin 状态
            await client.query(
                `UPDATE spins 
                SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
                WHERE id = $3`,
                [adminId, notes, spinId]
            );

            // 审计日志
            await this.logAudit(client, adminId, 'spin_approved', {
                spinId,
                userId: spin.user_id,
                award: spin.award,
                notes,
            });

            logger.info('Spin approved', { spinId, adminId, award: spin.award });
        });
    }

    /**
     * 管理员拒绝大奖
     */
    async rejectSpin(
        spinId: string,
        adminId: string,
        reason: string
    ): Promise<void> {
        await db.transaction(async (client: PoolClient) => {
            await client.query(
                `UPDATE spins 
                SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
                WHERE id = $3`,
                [adminId, reason, spinId]
            );

            await this.logAudit(client, adminId, 'spin_rejected', {
                spinId,
                reason,
            });

            logger.info('Spin rejected', { spinId, adminId, reason });
        });
    }

    /**
     * 记录审计日志
     */
    private async logAudit(
        client: PoolClient,
        actorId: string,
        action: string,
        details: any
    ): Promise<void> {
        await client.query(
            `INSERT INTO audit_logs (actor_id, actor_type, action, details, success)
            VALUES ($1, $2, $3, $4, $5)`,
            [actorId, 'user', action, JSON.stringify(details), true]
        );
    }

    /**
     * 获取用户 spin 历史
     */
    async getUserSpinHistory(userId: string, limit: number = 20): Promise<any[]> {
        const result = await db.query(
            `SELECT s.*, p.amount as payment_amount 
            FROM spins s
            JOIN payments p ON s.payment_id = p.id
            WHERE s.user_id = $1
            ORDER BY s.created_at DESC
            LIMIT $2`,
            [userId, limit]
        );

        return result.rows;
    }
}

export const spinService = new SpinService();
