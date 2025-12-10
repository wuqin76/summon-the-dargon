import { db } from '../database';
import { logger } from '../utils/logger';
import { randomBytes } from 'crypto';
import { config } from '../config';

export class UserService {
    /**
     * 创建或获取用户（Telegram 登录）
     */
    async findOrCreateUser(telegramUser: {
        id: number;
        username?: string;
        first_name?: string;
        last_name?: string;
        language_code?: string;
    }, inviteCode?: string, ipAddress?: string): Promise<any> {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // 查找用户
            let userResult = await client.query(
                'SELECT * FROM users WHERE telegram_id = $1',
                [telegramUser.id]
            );

            if (userResult.rows.length > 0) {
                // 更新最后登录信息
                await client.query(
                    'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE telegram_id = $2',
                    [ipAddress, telegramUser.id]
                );
                await client.query('COMMIT');
                return userResult.rows[0];
            }

            // 创建新用户
            const userInviteCode = this.generateInviteCode();
            let inviterId = null;

            // 处理邀请码
            if (inviteCode) {
                const inviterResult = await client.query(
                    'SELECT id FROM users WHERE invite_code = $1',
                    [inviteCode]
                );

                if (inviterResult.rows.length > 0) {
                    inviterId = inviterResult.rows[0].id;
                }
            }

            const newUserResult = await client.query(
                `INSERT INTO users (
                    telegram_id, username, first_name, last_name, 
                    language_code, invite_code, invited_by, 
                    registration_ip, last_login_ip
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    telegramUser.id,
                    telegramUser.username || null,
                    telegramUser.first_name || null,
                    telegramUser.last_name || null,
                    telegramUser.language_code || 'en',
                    userInviteCode,
                    inviterId,
                    ipAddress,
                    ipAddress,
                ]
            );

            const newUser = newUserResult.rows[0];

            // 如果有邀请人，创建邀请记录
            if (inviterId) {
                await this.processInvitation(client, inviterId, newUser.id, inviteCode!, telegramUser.id, ipAddress);
            }

            await client.query('COMMIT');
            logger.info('New user created', { userId: newUser.id, telegramId: telegramUser.id });

            return newUser;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 处理邀请
     */
    private async processInvitation(
        client: any,
        inviterId: string,
        inviteeId: string,
        inviteCode: string,
        inviteeTelegramId: number,
        ipAddress?: string
    ): Promise<void> {
        // 创建邀请记录
        await client.query(
            `INSERT INTO invitations (
                inviter_id, invitee_id, invite_code, invitee_telegram_id, 
                status, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [inviterId, inviteeId, inviteCode, inviteeTelegramId, 'completed', ipAddress]
        );

        // 更新邀请人统计
        await client.query(
            'UPDATE users SET total_invites = total_invites + 1 WHERE id = $1',
            [inviterId]
        );

        // 检查是否是首次有效邀请
        const inviteCountResult = await client.query(
            'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = $1 AND status = $2',
            [inviterId, 'completed']
        );

        const inviteCount = parseInt(inviteCountResult.rows[0].count, 10);

        if (inviteCount === 1) {
            // 首次邀请，创建出款申请
            await this.createFirstInviteReward(client, inviterId);
        }

        logger.info('Invitation processed', { inviterId, inviteeId });
    }

    /**
     * 创建首次邀请奖励
     */
    private async createFirstInviteReward(client: any, userId: string): Promise<void> {
        const rewardAmount = config.invite.firstReward;

        // 创建出款申请
        const requestResult = await client.query(
            `INSERT INTO payout_requests (
                user_id, amount, fee, net_amount, to_address,
                status, source_type, requires_kyc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id`,
            [
                userId,
                rewardAmount,
                0,
                rewardAmount,
                '', // 待用户填写
                'pending',
                'invite_reward',
                false,
            ]
        );

        logger.info('First invite reward created', {
            userId,
            requestId: requestResult.rows[0].id,
            amount: rewardAmount,
        });
    }

    /**
     * 生成邀请码
     */
    private generateInviteCode(): string {
        return randomBytes(6).toString('hex').toUpperCase();
    }

    /**
     * 获取用户信息
     */
    async getUserById(userId: string): Promise<any> {
        const result = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return result.rows[0];
    }

    /**
     * 获取用户统计
     */
    async getUserStats(userId: string): Promise<any> {
        const result = await db.query(
            'SELECT * FROM user_stats WHERE id = $1',
            [userId]
        );

        return result.rows[0] || null;
    }

    /**
     * 设置提现资格
     */
    async setWithdrawalEligibility(userId: string, eligible: boolean, adminId: string): Promise<void> {
        await db.query(
            'UPDATE users SET withdrawal_eligible = $1 WHERE id = $2',
            [eligible, userId]
        );

        await db.query(
            `INSERT INTO audit_logs (actor_id, action, details)
            VALUES ($1, $2, $3)`,
            [adminId, 'withdrawal_eligibility_changed', JSON.stringify({ userId, eligible })]
        );

        logger.info('Withdrawal eligibility changed', { userId, eligible, adminId });
    }

    /**
     * 封禁用户
     */
    async banUser(userId: string, reason: string, adminId: string): Promise<void> {
        await db.query(
            'UPDATE users SET is_banned = true, ban_reason = $1 WHERE id = $2',
            [reason, userId]
        );

        await db.query(
            `INSERT INTO audit_logs (actor_id, action, details)
            VALUES ($1, $2, $3)`,
            [adminId, 'user_banned', JSON.stringify({ userId, reason })]
        );

        logger.info('User banned', { userId, reason, adminId });
    }
}

export const userService = new UserService();
