import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/payment/info
 * 获取支付信息
 */
router.get('/info', authMiddleware, async (_req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                platformAddress: config.platform.address,
                amount: config.payment.amount,
                currency: 'USDT (TRC20)',
                confirmations: config.payment.confirmations,
                timeoutMinutes: config.payment.timeoutMinutes,
            },
        });
    } catch (error: any) {
        logger.error('Get payment info error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/payment/verify
 * 提交支付验证
 */
router.post('/verify', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { txHash } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

        if (!txHash) {
            return res.status(400).json({ error: 'Transaction hash is required' });
        }

        // 验证 txHash 格式
        if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
            return res.status(400).json({ error: 'Invalid transaction hash format' });
        }

        const result = await paymentService.submitPaymentVerification(
            userId,
            txHash,
            ipAddress
        );

        res.json({
            success: true,
            data: result,
        });

    } catch (error: any) {
        logger.error('Payment verification error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/payment/status/:paymentId
 * 获取支付状态
 */
router.get('/status/:paymentId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { paymentId } = req.params;

        const payment = await paymentService.getPaymentStatus(paymentId, userId);

        res.json({
            success: true,
            data: payment,
        });

    } catch (error: any) {
        logger.error('Get payment status error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/payment/history
 * 获取支付历史
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const limit = parseInt(req.query.limit as string) || 20;

        const history = await paymentService.getUserPaymentHistory(userId, limit);

        res.json({
            success: true,
            data: history,
        });

    } catch (error: any) {
        logger.error('Get payment history error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/payment/unused
 * 获取未使用的支付
 */
router.get('/unused', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const payment = await paymentService.getUnusedPayment(userId);

        res.json({
            success: true,
            data: payment,
        });

    } catch (error: any) {
        logger.error('Get unused payment error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
