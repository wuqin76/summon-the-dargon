import { Router, Request, Response } from 'express';
import { userService } from '../services/user.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/user/profile
 * 获取用户信息
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const user = await userService.getUserById(userId);
        const stats = await userService.getUserStats(userId);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    telegramId: user.telegram_id,
                    username: user.username,
                    firstName: user.first_name,
                    gameBalance: user.game_balance,
                    withdrawalEligible: user.withdrawal_eligible,
                    inviteCode: user.invite_code,
                    totalInvites: user.total_invites,
                    validInvites: user.valid_invites,
                },
                stats: stats || {},
            },
        });

    } catch (error: any) {
        logger.error('Get user profile error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/user/balance
 * 获取用户余额
 */
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const user = await userService.getUserById(userId);

        res.json({
            success: true,
            data: {
                gameBalance: user.game_balance,
                lockedBalance: user.locked_balance,
                withdrawalEligible: user.withdrawal_eligible,
            },
        });

    } catch (error: any) {
        logger.error('Get user balance error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/user/play-status
 * 检查用户是否已经玩过游戏
 */
router.get('/play-status', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await userService.getUserById(userId);
        
        // 检查用户是否已经玩过（total_free_plays + total_paid_plays > 0）
        const hasPlayed = (user.total_free_plays || 0) + (user.total_paid_plays || 0) > 0;

        res.json({
            success: true,
            hasPlayed,
            totalPlays: (user.total_free_plays || 0) + (user.total_paid_plays || 0)
        });

    } catch (error: any) {
        logger.error('Check play status error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/user/game-reward
 * 每次游戏完成，赠送抽奖机会（不区分首次还是付费）
 */
router.post('/game-reward', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        logger.info('🎁 收到游戏完成奖励请求', { userId });
        
        const user = await userService.getUserById(userId);
        logger.info('📊 用户当前状态', { 
            userId, 
            total_free_plays: user.total_free_plays, 
            total_paid_plays: user.total_paid_plays,
            available_spins: user.available_spins
        });
        
        // 每次游戏完成都给予1次抽奖机会（使用paid_game类型）
        const { db } = await import('../database');
        
        logger.info('🔄 开始插入spin_entitlements记录', { userId, source_type: 'paid_game' });
        
        const insertResult = await db.query(`
            INSERT INTO spin_entitlements (user_id, source_type, created_at)
            VALUES ($1, 'paid_game', NOW())
            RETURNING id
        `, [userId]);
        
        logger.info('✅ spin_entitlements记录已插入', { 
            userId, 
            entitlementId: insertResult.rows[0].id 
        });
        
        logger.info('🔄 更新用户可抽奖次数 +1', { userId, current_spins: user.available_spins });
        
        const updateResult = await db.query(`
            UPDATE users 
            SET available_spins = available_spins + 1
            WHERE id = $1
            RETURNING available_spins
        `, [userId]);
        
        const newSpins = updateResult.rows[0].available_spins;
        logger.info('✅ 用户可抽奖次数已更新', { userId, new_spins: newSpins });
        
        logger.info('🎉 游戏完成奖励发放成功', { userId, granted_spins: 1, total_spins: newSpins });

        res.json({
            success: true,
            data: {
                spinsGranted: 1,
                message: '恭喜完成游戏，获得一次抽奖机会！'
            }
        });

    } catch (error: any) {
        logger.error('❌ Grant game reward error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
