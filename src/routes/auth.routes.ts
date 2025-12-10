import { Router, Request, Response } from 'express';
import { userService } from '../services/user.service';
import { verifyTelegramWebAppData, generateToken } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/auth/login
 * Telegram Web App 登录
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { initData, inviteCode } = req.body;

        if (!initData) {
            return res.status(400).json({ error: 'Init data is required' });
        }

        // 验证 Telegram 数据
        const telegramUser = verifyTelegramWebAppData(initData);
        
        if (!telegramUser) {
            return res.status(401).json({ error: 'Invalid Telegram data' });
        }

        // 获取 IP 地址
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

        // 查找或创建用户
        const user = await userService.findOrCreateUser(
            {
                id: telegramUser.id,
                username: telegramUser.username,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name,
            },
            inviteCode,
            ipAddress
        );

        // 生成 JWT Token
        const token = generateToken(user);

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    telegramId: user.telegram_id,
                    username: user.username,
                    firstName: user.first_name,
                    gameBalance: user.game_balance,
                    withdrawalEligible: user.withdrawal_eligible,
                    inviteCode: user.invite_code,
                },
            },
        });

    } catch (error: any) {
        logger.error('Login error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
