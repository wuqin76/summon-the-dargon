import { db } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PoolClient } from 'pg';
import { format } from 'date-fns';

export class PayoutService {
    /**
     * 创建提现请求
     */
    async createPayoutRequest(
        userId: string,
        amount: number,
        toAddress: string
    ): Promise<{ requestId: string; netAmount: number; fee: number }> {
        return await db.transaction(async (client: PoolClient) => {
            // 1. 验证用户
            const userResult = await client.query(
                'SELECT game_balance, withdrawal_eligible, is_banned, requires_kyc FROM users WHERE id = $1 FOR UPDATE',
                [userId]
            );

            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const user = userResult.rows[0];

            if (user.is_banned) {
                throw new Error('User is banned');
            }

            // 2. 检查提现资格
            if (!user.withdrawal_eligible && amount >= config.withdrawal.threshold) {
                throw new Error('Withdrawal not eligible. Please contact support.');
            }

            // 3. 检查余额
            const gameBalance = parseFloat(user.game_balance);
            if (gameBalance < amount) {
                throw new Error(`Insufficient balance. Available: ${gameBalance}, Requested: ${amount}`);
            }

            // 4. 检查最小提现金额
            if (amount < config.withdrawal.threshold) {
                throw new Error(`Minimum withdrawal amount is ${config.withdrawal.threshold} USDT`);
            }

            // 5. 计算手续费
            const fee = this.calculateFee(amount);
            const netAmount = amount - fee;

            if (netAmount <= 0) {
                throw new Error('Net amount after fee must be positive');
            }

            // 6. 扣除余额
            const balanceBefore = gameBalance;
            const balanceAfter = gameBalance - amount;

            await client.query(
                'UPDATE users SET game_balance = $1 WHERE id = $2',
                [balanceAfter, userId]
            );

            // 7. 记录余额变动
            await client.query(
                `INSERT INTO balance_changes (
                    user_id, delta, balance_before, balance_after, change_type
                ) VALUES ($1, $2, $3, $4, $5)`,
                [userId, -amount, balanceBefore, balanceAfter, 'withdrawal']
            );

            // 8. 创建提现请求
            const requiresKyc = amount >= config.risk.kycRequiredForAmount || user.requires_kyc;

            const requestResult = await client.query(
                `INSERT INTO payout_requests (
                    user_id, amount, fee, net_amount, to_address, 
                    requires_kyc, status, source_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id`,
                [userId, amount, fee, netAmount, toAddress, requiresKyc, 'pending', 'withdrawal']
            );

            const requestId = requestResult.rows[0].id;

            // 9. 风控检查
            const riskScore = await this.calculateRiskScore(client, userId, amount);
            if (riskScore > 70) {
                await client.query(
                    'UPDATE payout_requests SET is_suspicious = true, risk_score = $1 WHERE id = $2',
                    [riskScore, requestId]
                );

                await this.createRiskEvent(client, userId, 'high_risk_withdrawal', {
                    requestId,
                    amount,
                    riskScore,
                });
            }

            // 10. 审计日志
            await client.query(
                `INSERT INTO audit_logs (actor_id, action, details)
                VALUES ($1, $2, $3)`,
                [userId, 'payout_requested', JSON.stringify({ requestId, amount, netAmount, fee })]
            );

            logger.info('Payout request created', { userId, requestId, amount, netAmount, fee });

            return { requestId, netAmount, fee };
        });
    }

    /**
     * 计算提现手续费
     */
    private calculateFee(amount: number): number {
        if (config.withdrawal.platformPaysFee) {
            return 0;
        }

        const percentFee = (amount * config.withdrawal.feePercent) / 100;
        const fixedFee = config.withdrawal.feeFixed;

        return percentFee + fixedFee;
    }

    /**
     * 计算风险分数
     */
    private async calculateRiskScore(
        client: PoolClient,
        userId: string,
        amount: number
    ): Promise<number> {
        let score = 0;

        // 账户年龄
        const userAge = await client.query(
            `SELECT EXTRACT(DAY FROM (NOW() - created_at)) as age_days FROM users WHERE id = $1`,
            [userId]
        );
        const ageDays = parseInt(userAge.rows[0]?.age_days || '0', 10);
        if (ageDays < 7) score += 30;
        else if (ageDays < 30) score += 15;

        // 提现/存款比
        const balanceHistory = await client.query(
            `SELECT 
                COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total_in,
                COALESCE(SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END), 0) as total_out
            FROM balance_changes
            WHERE user_id = $1`,
            [userId]
        );

        const totalIn = parseFloat(balanceHistory.rows[0]?.total_in || '0');
        const totalOut = parseFloat(balanceHistory.rows[0]?.total_out || '0');

        if (totalIn > 0 && totalOut / totalIn > 0.9) {
            score += 25;
        }

        // 大额提现
        if (amount > 1000) score += 20;
        else if (amount > 500) score += 10;

        return Math.min(score, 100);
    }

    /**
     * 创建风险事件
     */
    private async createRiskEvent(
        client: PoolClient,
        userId: string,
        eventType: string,
        metadata: any
    ): Promise<void> {
        await client.query(
            `INSERT INTO risk_events (user_id, event_type, severity, description, metadata)
            VALUES ($1, $2, $3, $4, $5)`,
            [userId, eventType, 'high', 'High risk withdrawal detected', JSON.stringify(metadata)]
        );
    }

    /**
     * 获取待处理的提现请求
     */
    async getPendingPayoutRequests(limit: number = 100): Promise<any[]> {
        const result = await db.query(
            `SELECT pr.*, u.telegram_id, u.username
            FROM payout_requests pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.status = 'pending'
            ORDER BY pr.created_at ASC
            LIMIT $1`,
            [limit]
        );

        return result.rows;
    }

    /**
     * 批准提现请求
     */
    async approvePayoutRequest(requestId: string, adminId: string): Promise<void> {
        await db.transaction(async (client: PoolClient) => {
            await client.query(
                `UPDATE payout_requests
                SET status = 'approved', approved_by = $1, approved_at = NOW()
                WHERE id = $2 AND status = 'pending'`,
                [adminId, requestId]
            );

            await client.query(
                `INSERT INTO audit_logs (actor_id, action, details)
                VALUES ($1, $2, $3)`,
                [adminId, 'payout_approved', JSON.stringify({ requestId })]
            );

            logger.info('Payout request approved', { requestId, adminId });
        });
    }

    /**
     * 批量批准提现
     */
    async batchApprovePayoutRequests(requestIds: string[], adminId: string): Promise<void> {
        await db.transaction(async (client: PoolClient) => {
            for (const requestId of requestIds) {
                await client.query(
                    `UPDATE payout_requests
                    SET status = 'approved', approved_by = $1, approved_at = NOW()
                    WHERE id = $2 AND status = 'pending'`,
                    [adminId, requestId]
                );
            }

            await client.query(
                `INSERT INTO audit_logs (actor_id, action, details)
                VALUES ($1, $2, $3)`,
                [adminId, 'batch_payout_approved', JSON.stringify({ requestIds, count: requestIds.length })]
            );

            logger.info('Batch payout requests approved', { count: requestIds.length, adminId });
        });
    }

    /**
     * 创建导出批次
     */
    async createPayoutBatch(requestIds: string[], adminId: string): Promise<string> {
        return await db.transaction(async (client: PoolClient) => {
            // 1. 生成批次号
            const batchNumber = `BATCH-${format(new Date(), 'yyyyMMdd-HHmmss')}`;

            // 2. 计算批次总金额
            const summary = await client.query(
                `SELECT 
                    COUNT(*) as total_requests,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COALESCE(SUM(fee), 0) as total_fee,
                    COALESCE(SUM(net_amount), 0) as total_net_amount
                FROM payout_requests
                WHERE id = ANY($1) AND status = 'approved'`,
                [requestIds]
            );

            const stats = summary.rows[0];

            // 3. 创建批次
            const batchResult = await client.query(
                `INSERT INTO payout_batches (
                    batch_number, total_requests, total_amount, total_fee, 
                    total_net_amount, status, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id`,
                [
                    batchNumber,
                    stats.total_requests,
                    stats.total_amount,
                    stats.total_fee,
                    stats.total_net_amount,
                    'draft',
                    adminId,
                ]
            );

            const batchId = batchResult.rows[0].id;

            // 4. 更新请求状态并关联批次
            await client.query(
                `UPDATE payout_requests
                SET batch_id = $1, status = 'exported'
                WHERE id = ANY($2)`,
                [batchId, requestIds]
            );

            // 5. 审计日志
            await client.query(
                `INSERT INTO audit_logs (actor_id, action, details)
                VALUES ($1, $2, $3)`,
                [adminId, 'batch_created', JSON.stringify({ batchId, batchNumber, requestIds })]
            );

            logger.info('Payout batch created', { batchId, batchNumber, count: stats.total_requests });

            return batchId;
        });
    }

    /**
     * 标记提现已完成
     */
    async markPayoutPaid(
        requestId: string,
        chainTxId: string,
        adminId: string,
        feePaid?: number
    ): Promise<void> {
        await db.transaction(async (client: PoolClient) => {
            // 1. 获取请求信息
            const requestResult = await client.query(
                'SELECT net_amount, to_address FROM payout_requests WHERE id = $1',
                [requestId]
            );

            if (requestResult.rows.length === 0) {
                throw new Error('Payout request not found');
            }

            const request = requestResult.rows[0];

            // 2. 更新请求状态
            await client.query(
                `UPDATE payout_requests
                SET status = 'paid', chain_txid = $1, paid_at = NOW()
                WHERE id = $2`,
                [chainTxId, requestId]
            );

            // 3. 创建交易记录
            await client.query(
                `INSERT INTO payout_transactions (
                    payout_request_id, chain_txid, from_address, to_address, amount, fee_paid
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    requestId,
                    chainTxId,
                    config.platform.address,
                    request.to_address,
                    request.net_amount,
                    feePaid || 0,
                ]
            );

            // 4. 审计日志
            await client.query(
                `INSERT INTO audit_logs (actor_id, action, details)
                VALUES ($1, $2, $3)`,
                [adminId, 'payout_marked_paid', JSON.stringify({ requestId, chainTxId })]
            );

            logger.info('Payout marked as paid', { requestId, chainTxId });
        });
    }

    /**
     * 获取用户提现历史
     */
    async getUserPayoutHistory(userId: string, limit: number = 20): Promise<any[]> {
        const result = await db.query(
            `SELECT id, amount, fee, net_amount, to_address, status, 
                    chain_txid, requested_at, paid_at
            FROM payout_requests
            WHERE user_id = $1
            ORDER BY requested_at DESC
            LIMIT $2`,
            [userId, limit]
        );

        return result.rows;
    }
}

export const payoutService = new PayoutService();
