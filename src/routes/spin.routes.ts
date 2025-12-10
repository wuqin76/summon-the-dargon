import { Router, Request, Response } from 'express';
import { spinService } from '../services/spin.service';
import { paymentService } from '../services/payment.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/spin
 * 执行转盘抽奖
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { paymentId, idempotencyKey } = req.body;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        if (!idempotencyKey) {
            return res.status(400).json({ error: 'Idempotency key is required' });
        }

        // 检查用户是否有未使用的付费资格
        const unusedPayment = await paymentService.getUnusedPayment(userId);
        
        if (!unusedPayment) {
            return res.status(403).json({ 
                error: 'No unused payment found. Please make a payment first.' 
            });
        }

        if (unusedPayment.id !== paymentId) {
            return res.status(403).json({ 
                error: 'Invalid payment ID' 
            });
        }

        // 执行 spin
        const result = await spinService.executeSpin(userId, paymentId, idempotencyKey);

        res.json({
            success: true,
            data: result,
        });

    } catch (error: any) {
        logger.error('Spin error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/spin/history
 * 获取用户抽奖历史
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const limit = parseInt(req.query.limit as string) || 20;

        const history = await spinService.getUserSpinHistory(userId, limit);

        res.json({
            success: true,
            data: history,
        });

    } catch (error: any) {
        logger.error('Get spin history error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
