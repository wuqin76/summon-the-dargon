/**
 * Invite Routes - 邀请系统（邀请即获得抽奖）
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * 获取邀请信息（包含邀请码、统计等）
 * GET /api/invite/info
 */
router.get('/info', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    try {
        // 获取用户邀请码
        const userResult = await pool.query(
            'SELECT invite_code FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        const inviteCode = userResult.rows[0].invite_code;
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'YourBot';

        // 获取邀请统计
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_invites
            FROM invitations
            WHERE inviter_id = $1 AND registered = true
        `, [userId]);

        // 获取通过邀请获得的奖励次数
        const rewardsResult = await pool.query(`
            SELECT COUNT(*) as rewards
            FROM spin_entitlements
            WHERE user_id = $1 AND source_type = 'invite'
        `, [userId]);

        res.json({
            success: true,
            data: {
                invite_code: inviteCode,
                bot_username: botUsername,
                total_invites: parseInt(statsResult.rows[0].total_invites) || 0,
                invite_rewards: parseInt(rewardsResult.rows[0].rewards) || 0
            }
        });

    } catch (error: any) {
        console.error('[Invite] Get info error:', error);
        res.status(500).json({
            success: false,
            message: '获取邀请信息失败'
        });
    }
});

/**
 * 接受邀请码（新用户通过邀请链接进入）
 * POST /api/invite/accept
 */
router.post('/accept', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { inviteCode } = req.body;

    if (!inviteCode) {
        return res.status(400).json({
            success: false,
            message: '邀请码不能为空'
        });
    }

    try {
        // 查找邀请人
        const inviterResult = await pool.query(
            'SELECT id, telegram_id FROM users WHERE invite_code = $1',
            [inviteCode]
        );

        if (inviterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '无效的邀请码'
            });
        }

        const inviterId = inviterResult.rows[0].id;

        // 不能邀请自己
        if (inviterId === userId) {
            return res.status(400).json({
                success: false,
                message: '不能使用自己的邀请码'
            });
        }

        // 检查是否已经被邀请过
        const existingInvite = await pool.query(
            'SELECT id FROM invitations WHERE invitee_id = $1',
            [userId]
        );

        if (existingInvite.rows.length > 0) {
            return res.json({
                success: true,
                data: {
                    is_first_invite: false,
                    message: '你已经通过其他邀请加入了'
                }
            });
        }

        // 获取被邀请人信息
        const inviteeResult = await pool.query(
            'SELECT telegram_id, username, first_name FROM users WHERE id = $1',
            [userId]
        );

        const inviteeData = inviteeResult.rows[0];

        // 处理邀请
        await pool.query('BEGIN');
        
        try {
            await handleInviteRegistration(
                inviterId,
                userId,
                {
                    telegram_id: inviteeData.telegram_id,
                    username: inviteeData.username,
                    first_name: inviteeData.first_name
                },
                inviteCode,
                req.ip || 'unknown',
                pool
            );

            await pool.query('COMMIT');

            res.json({
                success: true,
                data: {
                    is_first_invite: true,
                    message: '邀请接受成功！邀请人获得了一次抽奖机会！'
                }
            });

        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }

    } catch (error: any) {
        console.error('[Invite] Accept invite error:', error);
        res.status(500).json({
            success: false,
            message: '接受邀请失败'
        });
    }
});

/**
 * 获取我的邀请码和邀请链接
 * GET /api/invite/mycode
 */
router.get('/mycode', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    try {
        const result = await pool.query(
            'SELECT invite_code FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }

        const inviteCode = result.rows[0].invite_code;
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'YourBot';
        
        // 使用传统 Bot 链接格式（兼容性最好）
        const inviteLink = `https://t.me/${botUsername}?start=${inviteCode}`;

        res.json({
            success: true,
            data: {
                invite_code: inviteCode,
                invite_link: inviteLink
            }
        });

    } catch (error: any) {
        console.error('[Invite] Get mycode error:', error);
        res.status(500).json({
            success: false,
            message: '获取邀请码失败'
        });
    }
});

/**
 * 获取我的邀请统计
 * GET /api/invite/stats
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_invites,
                COUNT(*) FILTER (WHERE registered = true) as registered_count,
                COUNT(*) FILTER (WHERE played_free = true) as played_free_count,
                COUNT(*) FILTER (WHERE played_paid = true) as played_paid_count,
                COUNT(*) FILTER (WHERE has_invited_others = true) as recursive_invites,
                COUNT(*) FILTER (WHERE has_spun = true) as spun_count
            FROM invitations
            WHERE inviter_id = $1
        `, [userId]);

        const stats = result.rows[0];

        res.json({
            success: true,
            data: {
                total: parseInt(stats.total_invites),
                registered: parseInt(stats.registered_count),
                played_free: parseInt(stats.played_free_count),
                played_paid: parseInt(stats.played_paid_count),
                recursive: parseInt(stats.recursive_invites),
                spun: parseInt(stats.spun_count)
            }
        });

    } catch (error: any) {
        console.error('[Invite] Get stats error:', error);
        res.status(500).json({
            success: false,
            message: '获取邀请统计失败'
        });
    }
});

/**
 * 获取我邀请的用户列表
 * GET /api/invite/list
 */
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
        const result = await pool.query(`
            SELECT 
                i.id,
                i.invitee_username,
                i.invitee_first_name,
                i.registered,
                i.registered_at,
                i.played_free,
                i.first_free_play_at,
                i.played_paid,
                i.first_paid_play_at,
                i.has_invited_others,
                i.has_spun,
                i.created_at
            FROM invitations i
            WHERE i.inviter_id = $1
            ORDER BY i.created_at DESC
            LIMIT $2
        `, [userId, limit]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error: any) {
        console.error('[Invite] Get list error:', error);
        res.status(500).json({
            success: false,
            message: '获取邀请列表失败'
        });
    }
});

/**
 * 处理新用户通过邀请码注册（内部调用）
 * 由 auth 服务在用户注册时调用
 */
export async function handleInviteRegistration(
    inviterUserId: string,
    inviteeUserId: string,
    inviteeData: {
        telegram_id: number;
        username?: string;
        first_name?: string;
    },
    inviteCode: string,
    ipAddress: string,
    client?: any
): Promise<void> {
    const db = client || pool;

    try {
        // 1. 创建邀请记录
        const invitationResult = await db.query(`
            INSERT INTO invitations (
                inviter_id,
                invitee_id,
                invitee_telegram_id,
                invitee_username,
                invitee_first_name,
                invite_code,
                registered,
                registered_at,
                invitee_ip,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), $7, NOW())
            RETURNING id
        `, [
            inviterUserId,
            inviteeUserId,
            inviteeData.telegram_id,
            inviteeData.username || null,
            inviteeData.first_name || null,
            inviteCode,
            ipAddress
        ]);

        const invitationId = invitationResult.rows[0].id;

        // 2. 更新邀请人的邀请统计
        await db.query(`
            UPDATE users
            SET total_invited = total_invited + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [inviterUserId]);

        // 3. 发放抽奖资格给邀请人
        await db.query(`
            INSERT INTO spin_entitlements (
                user_id, source_type, source_id, consumed, created_at
            ) VALUES ($1, 'invite', $2, false, NOW())
        `, [inviterUserId, invitationId]);

        // 4. 更新邀请人可用抽奖次数
        await db.query(`
            UPDATE users
            SET available_spins = available_spins + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [inviterUserId]);

        // 5. 更新任务进度 V2
        try {
            const { updateTaskProgressV2 } = await import('./task.routes');
            const taskResult = await updateTaskProgressV2(inviterUserId, 'invite', db);
            if (taskResult.success && taskResult.reward) {
                console.log(`[Invite] Task completed after invite. Reward: ${taskResult.reward}`);
            }
        } catch (taskError) {
            console.error('[Invite] Task update error:', taskError);
            // 不影响邀请主流程
        }

        console.log(`[Invite] User ${inviterUserId} earned spin from invite ${invitationId}`);

    } catch (error) {
        console.error('[Invite] Handle registration error:', error);
        throw error;
    }
}

/**
 * 更新被邀请人的行为（内部调用）
 */
export async function updateInviteeAction(
    inviteeUserId: string,
    action: 'played_free' | 'played_paid' | 'invited_others' | 'spun',
    client?: any
): Promise<void> {
    const db = client || pool;

    try {
        const updateField = action === 'played_free' ? 'played_free, first_free_play_at' :
                          action === 'played_paid' ? 'played_paid, first_paid_play_at' :
                          action === 'invited_others' ? 'has_invited_others, first_invite_at' :
                          'has_spun, first_spin_at';

        await db.query(`
            UPDATE invitations
            SET ${action.split('_')[0] === 'played' ? action : 'has_' + action.replace('_others', '')} = true,
                ${updateField.split(',')[1].trim()} = NOW()
            WHERE invitee_id = $1 AND ${action.split('_')[0] === 'played' ? action : 'has_' + action.replace('_others', '')} = false
        `, [inviteeUserId]);

        console.log(`[Invite] Updated invitee ${inviteeUserId} action: ${action}`);

    } catch (error) {
        console.error('[Invite] Update invitee action error:', error);
    }
}

export default router;
