import { db } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { tronService } from './tron.service';
import { PoolClient } from 'pg';
import { addMinutes } from 'date-fns';

export class PaymentService {
    /**
     * 提交支付验证请求
     */
    async submitPaymentVerification(
        userId: string,
        txHash: string,
        ipAddress: string,
        deviceFingerprint?: string
    ): Promise<{ paymentId: string; status: string; message: string }> {
        return await db.transaction(async (client: PoolClient) => {
            // 1. 检查 txHash 是否已被使用
            const existingPayment = await client.query(
                'SELECT id, user_id, status FROM payments WHERE provider_tx = $1',
                [txHash]
            );

            if (existingPayment.rows.length > 0) {
                const existing = existingPayment.rows[0];
                if (existing.user_id !== userId) {
                    throw new Error('This transaction has already been claimed by another user');
                }
                return {
                    paymentId: existing.id,
                    status: existing.status,
                    message: 'Payment already submitted',
                };
            }

            // 2. 检查用户当日支付次数（风控）
            const todayPaymentsCount = await this.getTodayPaymentsCount(client, userId);
            if (todayPaymentsCount >= config.risk.maxPaymentsPerUserPerDay) {
                throw new Error('Maximum payments per day exceeded');
            }

            // 3. 创建待确认的支付记录
            const expiresAt = addMinutes(new Date(), config.payment.timeoutMinutes);

            const paymentResult = await client.query(
                `INSERT INTO payments (
                    user_id, amount, expected_amount, provider_tx, 
                    to_address, status, ip_address, device_fingerprint, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id`,
                [
                    userId,
                    0, // 初始为 0，验证后更新
                    config.payment.amount,
                    txHash,
                    config.platform.address,
                    'pending',
                    ipAddress,
                    deviceFingerprint,
                    expiresAt,
                ]
            );

            const paymentId = paymentResult.rows[0].id;

            // 4. 异步开始验证流程
            this.verifyPaymentAsync(paymentId, txHash).catch((error) => {
                logger.error('Async payment verification failed', { paymentId, error });
            });

            // 5. 记录审计日志
            await client.query(
                `INSERT INTO audit_logs (actor_id, action, details)
                VALUES ($1, $2, $3)`,
                [userId, 'payment_submitted', JSON.stringify({ paymentId, txHash })]
            );

            return {
                paymentId,
                status: 'pending',
                message: 'Payment verification in progress',
            };
        });
    }

    /**
     * 异步验证支付
     */
    private async verifyPaymentAsync(paymentId: string, txHash: string): Promise<void> {
        try {
            logger.info('Starting async payment verification', { paymentId, txHash });

            // 等待几秒让交易上链
            await this.sleep(3000);

            // 调用 TRON 服务验证
            const verification = await tronService.verifyPaymentTransaction(
                txHash,
                config.payment.amount,
                config.platform.address
            );

            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                if (verification.valid) {
                    // 验证成功
                    await client.query(
                        `UPDATE payments 
                        SET status = 'confirmed', 
                            amount = $1, 
                            from_address = $2, 
                            confirmations = $3,
                            confirmed_at = NOW()
                        WHERE id = $4`,
                        [verification.actualAmount, verification.fromAddress, verification.confirmations, paymentId]
                    );

                    logger.info('Payment verified and confirmed', {
                        paymentId,
                        amount: verification.actualAmount,
                        fromAddress: verification.fromAddress,
                    });

                    // 更新任务进度 V2 - 付费游玩
                    const paymentData = await client.query(
                        'SELECT user_id FROM payments WHERE id = $1',
                        [paymentId]
                    );
                    
                    if (paymentData.rows.length > 0) {
                        try {
                            const { updateTaskProgressV2 } = await import('../routes/task.routes');
                            const taskResult = await updateTaskProgressV2(
                                paymentData.rows[0].user_id,
                                'paid_game',
                                client
                            );
                            if (taskResult.success && taskResult.reward) {
                                logger.info('Task completed after payment', {
                                    userId: paymentData.rows[0].user_id,
                                    reward: taskResult.reward,
                                    newTaskIndex: taskResult.newTaskIndex
                                });
                            }
                        } catch (taskError) {
                            logger.error('Task update error after payment', { error: taskError });
                            // 不影响支付主流程
                        }
                    }
                } else {
                    // 验证失败
                    await client.query(
                        `UPDATE payments 
                        SET status = 'failed'
                        WHERE id = $1`,
                        [paymentId]
                    );

                    logger.warn('Payment verification failed', {
                        paymentId,
                        error: verification.error,
                    });
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error: any) {
            logger.error('Error in async payment verification', {
                paymentId,
                error: error.message,
            });
        }
    }

    /**
     * 获取支付状态
     */
    async getPaymentStatus(paymentId: string, userId: string): Promise<any> {
        const result = await db.query(
            `SELECT id, user_id, amount, expected_amount, status, 
                    confirmations, from_address, created_at, confirmed_at
            FROM payments
            WHERE id = $1 AND user_id = $2`,
            [paymentId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Payment not found');
        }

        return result.rows[0];
    }

    /**
     * 获取用户未使用的付费资格
     */
    async getUnusedPayment(userId: string): Promise<any | null> {
        const result = await db.query(
            `SELECT id, amount, created_at 
            FROM payments
            WHERE user_id = $1 AND status = 'confirmed' AND used_spin = false
            ORDER BY created_at DESC
            LIMIT 1`,
            [userId]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * 获取用户今日支付次数
     */
    private async getTodayPaymentsCount(client: PoolClient, userId: string): Promise<number> {
        const result = await client.query(
            `SELECT COUNT(*) as count
            FROM payments
            WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
            [userId]
        );

        return parseInt(result.rows[0].count, 10);
    }

    /**
     * 获取用户支付历史
     */
    async getUserPaymentHistory(userId: string, limit: number = 20): Promise<any[]> {
        const result = await db.query(
            `SELECT id, amount, status, provider_tx, used_spin, created_at, confirmed_at
            FROM payments
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2`,
            [userId, limit]
        );

        return result.rows;
    }

    /**
     * 清理过期的待确认支付
     */
    async cleanupExpiredPayments(): Promise<number> {
        const result = await db.query(
            `UPDATE payments
            SET status = 'expired'
            WHERE status = 'pending' AND expires_at < NOW()
            RETURNING id`
        );

        logger.info('Cleaned up expired payments', { count: result.rowCount });
        return result.rowCount || 0;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const paymentService = new PaymentService();
