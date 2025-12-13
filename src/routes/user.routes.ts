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
        
        if (!userId) {
            logger.error('Play status: userId is null');
            return res.status(401).json({
                success: false,
                error: 'User ID not found'
            });
        }
        
        const user = await userService.getUserById(userId);
        
        if (!user) {
            logger.error('Play status: user not found', { userId });
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // 检查用户是否已经玩过（total_free_plays + total_paid_plays > 0）
        const hasPlayed = (user.total_free_plays || 0) + (user.total_paid_plays || 0) > 0;

        res.json({
            success: true,
            hasPlayed,
            totalPlays: (user.total_free_plays || 0) + (user.total_paid_plays || 0)
        });

    } catch (error: any) {
        logger.error('Check play status error', { error: error.message, stack: error.stack });
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

/**
 * POST /api/user/bank-info
 * 保存用户银行信息
 */
router.post('/bank-info', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { fullName, phoneNumber, accountNumber, ifscCode, bankName, branchName } = req.body;

        // 验证必填字段
        if (!fullName || !phoneNumber || !accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({
                success: false,
                error: '请填写所有必填字段',
            });
        }

        // 验证IFSC代码格式（印度银行IFSC代码格式：4位字母+0+6位字母或数字）
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(ifscCode)) {
            return res.status(400).json({
                success: false,
                error: 'IFSC代码格式不正确，请检查',
            });
        }

        // 验证账号格式（9-18位数字）
        const accountRegex = /^[0-9]{9,18}$/;
        if (!accountRegex.test(accountNumber)) {
            return res.status(400).json({
                success: false,
                error: '银行账号格式不正确，请检查',
            });
        }

        logger.info('💳 保存用户银行信息', { userId, fullName, bankName });

        // 保存到数据库
        const db = require('../database').db;
        await db.query(`
            INSERT INTO user_bank_info 
            (user_id, full_name, phone_number, account_number, ifsc_code, bank_name, branch_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                full_name = $2,
                phone_number = $3,
                account_number = $4,
                ifsc_code = $5,
                bank_name = $6,
                branch_name = $7,
                updated_at = NOW()
        `, [userId, fullName, phoneNumber, accountNumber, ifscCode, bankName, branchName || null]);

        logger.info('✅ 银行信息保存成功', { userId });

        res.json({
            success: true,
            message: '银行信息已保存',
        });

    } catch (error: any) {
        logger.error('❌ Save bank info error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
