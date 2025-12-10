import { Router, Request, Response } from 'express';
import { payoutService } from '../services/payout.service';
import { spinService } from '../services/spin.service';
import { userService } from '../services/user.service';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// 所有管理路由都需要管理员权限
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/payouts/pending
 * 获取待处理的提现请求
 */
router.get('/payouts/pending', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const requests = await payoutService.getPendingPayoutRequests(limit);

        res.json({
            success: true,
            data: requests,
        });

    } catch (error: any) {
        logger.error('Get pending payouts error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/approve
 * 批准提现请求
 */
router.post('/payouts/approve', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestId } = req.body;

        if (!requestId) {
            return res.status(400).json({ error: 'Request ID is required' });
        }

        await payoutService.approvePayoutRequest(requestId, adminId);

        res.json({
            success: true,
            message: 'Payout request approved',
        });

    } catch (error: any) {
        logger.error('Approve payout error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/batch-approve
 * 批量批准提现请求
 */
router.post('/payouts/batch-approve', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestIds } = req.body;

        if (!requestIds || !Array.isArray(requestIds)) {
            return res.status(400).json({ error: 'Request IDs array is required' });
        }

        await payoutService.batchApprovePayoutRequests(requestIds, adminId);

        res.json({
            success: true,
            message: `${requestIds.length} payout requests approved`,
        });

    } catch (error: any) {
        logger.error('Batch approve payouts error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/create-batch
 * 创建提现批次
 */
router.post('/payouts/create-batch', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestIds } = req.body;

        if (!requestIds || !Array.isArray(requestIds)) {
            return res.status(400).json({ error: 'Request IDs array is required' });
        }

        const batchId = await payoutService.createPayoutBatch(requestIds, adminId);

        res.json({
            success: true,
            data: { batchId },
        });

    } catch (error: any) {
        logger.error('Create batch error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/mark-paid
 * 标记提现已完成
 */
router.post('/payouts/mark-paid', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestId, chainTxId, feePaid } = req.body;

        if (!requestId || !chainTxId) {
            return res.status(400).json({ error: 'Request ID and chain TX ID are required' });
        }

        await payoutService.markPayoutPaid(requestId, chainTxId, adminId, feePaid);

        res.json({
            success: true,
            message: 'Payout marked as paid',
        });

    } catch (error: any) {
        logger.error('Mark paid error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/spins/approve
 * 批准大奖 Spin
 */
router.post('/spins/approve', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { spinId, notes } = req.body;

        if (!spinId) {
            return res.status(400).json({ error: 'Spin ID is required' });
        }

        await spinService.approveSpin(spinId, adminId, notes);

        res.json({
            success: true,
            message: 'Spin approved',
        });

    } catch (error: any) {
        logger.error('Approve spin error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/spins/reject
 * 拒绝大奖 Spin
 */
router.post('/spins/reject', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { spinId, reason } = req.body;

        if (!spinId || !reason) {
            return res.status(400).json({ error: 'Spin ID and reason are required' });
        }

        await spinService.rejectSpin(spinId, adminId, reason);

        res.json({
            success: true,
            message: 'Spin rejected',
        });

    } catch (error: any) {
        logger.error('Reject spin error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/users/set-withdrawal-eligibility
 * 设置用户提现资格
 */
router.post('/users/set-withdrawal-eligibility', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { userId, eligible } = req.body;

        if (!userId || eligible === undefined) {
            return res.status(400).json({ error: 'User ID and eligible status are required' });
        }

        await userService.setWithdrawalEligibility(userId, eligible, adminId);

        res.json({
            success: true,
            message: 'Withdrawal eligibility updated',
        });

    } catch (error: any) {
        logger.error('Set withdrawal eligibility error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/users/ban
 * 封禁用户
 */
router.post('/users/ban', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { userId, reason } = req.body;

        if (!userId || !reason) {
            return res.status(400).json({ error: 'User ID and reason are required' });
        }

        await userService.banUser(userId, reason, adminId);

        res.json({
            success: true,
            message: 'User banned',
        });

    } catch (error: any) {
        logger.error('Ban user error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
