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
 * POST /api/user/first-play-reward
 * 首次游玩完成，赠送抽奖机会
 */
router.post('/first-play-reward', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        logger.info('🎁 收到首次游玩奖励请求', { userId });
        
        const user = await userService.getUserById(userId);
        logger.info('📊 用户当前状态', { 
            userId, 
            total_free_plays: user.total_free_plays, 
            total_paid_plays: user.total_paid_plays,
            available_spins: user.available_spins
        });
        
        // 检查是否真的是首次游玩
        const totalPlays = (user.total_free_plays || 0) + (user.total_paid_plays || 0);
        if (totalPlays > 0) {
            logger.warn('⚠️ 用户已经玩过游戏，拒绝重复发放奖励', { userId, totalPlays });
            return res.status(400).json({
                success: false,
                error: '您已经玩过游戏了',
                debug: { totalPlays, total_free_plays: user.total_free_plays, total_paid_plays: user.total_paid_plays }
            });
        }

        // 使用事务处理
        logger.info('✅ 开始发放首次游玩奖励', { userId });
        await userService.grantFirstPlayReward(userId);
        logger.info('🎉 首次游玩奖励发放成功', { userId });

        res.json({
            success: true,
            data: {
                spinsGranted: 1,
                message: '恭喜获得一次抽奖机会！'
            }
        });

    } catch (error: any) {
        logger.error('❌ Grant first play reward error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
