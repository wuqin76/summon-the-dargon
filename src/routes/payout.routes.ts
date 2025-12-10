import { Router, Request, Response } from 'express';
import { payoutService } from '../services/payout.service';
import { tronService } from '../services/tron.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/payout/request
 * 创建提现请求
 */
router.post('/request', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { amount, toAddress } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (!toAddress) {
            return res.status(400).json({ error: 'Withdrawal address is required' });
        }

        // 验证地址格式
        if (!tronService.isValidAddress(toAddress)) {
            return res.status(400).json({ error: 'Invalid TRON address' });
        }

        const result = await payoutService.createPayoutRequest(userId, amount, toAddress);

        res.json({
            success: true,
            data: result,
        });

    } catch (error: any) {
        logger.error('Create payout request error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/payout/history
 * 获取提现历史
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const limit = parseInt(req.query.limit as string) || 20;

        const history = await payoutService.getUserPayoutHistory(userId, limit);

        res.json({
            success: true,
            data: history,
        });

    } catch (error: any) {
        logger.error('Get payout history error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
