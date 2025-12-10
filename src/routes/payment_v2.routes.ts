/**
 * Payment Routes V2 - 第三方支付（无链上验证）
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * 获取支付信息（第三方支付URL等）
 * GET /api/payment/info
 */
router.get('/info', authMiddleware, async (_req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                amount: parseFloat(process.env.PAYMENT_AMOUNT || '10'),
                currency: 'USDT',
                payment_methods: ['third_party_api'],
                // 实际使用时这里应该是第三方支付的URL
                payment_url: process.env.PAYMENT_URL || 'https://payment-provider.com/pay',
                description: '游戏门票支付'
            }
        });
    } catch (error: any) {
        console.error('[Payment] Get info error:', error);
        res.status(500).json({
            success: false,
            message: '获取支付信息失败'
        });
    }
});

/**
 * 创建支付订单（可选，如果需要先创建订单再跳转支付）
 * POST /api/payment/create
 */
router.post('/create', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    try {
        const { amount = 10 } = req.body;

        // 生成订单ID
        const order_id = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;

        // 这里应该调用第三方支付API创建订单
        // const paymentUrl = await thirdPartyAPI.createOrder({ order_id, amount, user_id: userId, return_url });

        // 临时返回模拟数据
        const paymentUrl = `${process.env.PAYMENT_URL}?order_id=${order_id}&amount=${amount}&user_id=${userId}`;

        res.json({
            success: true,
            data: {
                order_id,
                payment_url: paymentUrl,
                amount,
                currency: 'USDT',
                expires_in: 1800  // 30分钟
            }
        });

    } catch (error: any) {
        console.error('[Payment] Create order error:', error);
        res.status(500).json({
            success: false,
            message: '创建支付订单失败'
        });
    }
});

/**
 * 获取支付历史
 * GET /api/payment/history
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
        const result = await pool.query(`
            SELECT 
                id,
                provider_tx_id,
                provider_order_id,
                amount,
                currency,
                status,
                used,
                used_at,
                created_at
            FROM payments
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, limit]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error: any) {
        console.error('[Payment] Get history error:', error);
        res.status(500).json({
            success: false,
            message: '获取支付历史失败'
        });
    }
});

/**
 * 获取未使用的支付（用于付费游玩验证）
 * GET /api/payment/unused
 */
router.get('/unused', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    try {
        const result = await pool.query(`
            SELECT 
                id,
                provider_tx_id,
                amount,
                currency,
                created_at
            FROM payments
            WHERE user_id = $1 
                AND status = 'success'
                AND used = false
            ORDER BY created_at DESC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error: any) {
        console.error('[Payment] Get unused payment error:', error);
        res.status(500).json({
            success: false,
            message: '获取支付状态失败'
        });
    }
});

/**
 * 使用支付（付费游玩时调用）
 * POST /api/payment/use
 */
router.post('/use', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. 获取未使用的支付
        const paymentResult = await client.query(`
            SELECT id, amount
            FROM payments
            WHERE user_id = $1 
                AND status = 'success'
                AND used = false
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE
        `, [userId]);

        if (paymentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '没有可用的支付记录'
            });
        }

        const payment = paymentResult.rows[0];

        // 2. 标记支付为已使用
        await client.query(`
            UPDATE payments
            SET used = true,
                used_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [payment.id]);

        // 3. 创建游戏会话记录
        const sessionResult = await client.query(`
            INSERT INTO game_sessions (
                user_id, payment_id, game_mode, created_at
            ) VALUES ($1, $2, 'paid', NOW())
            RETURNING id
        `, [userId, payment.id]);

        // 4. 更新用户统计
        await client.query(`
            UPDATE users
            SET total_paid_plays = total_paid_plays + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                session_id: sessionResult.rows[0].id,
                payment_id: payment.id,
                message: '支付已使用，可以开始游戏'
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Payment] Use payment error:', error);
        res.status(500).json({
            success: false,
            message: '使用支付失败'
        });
    } finally {
        client.release();
    }
});

/**
 * 查询支付状态（通过订单ID）
 * GET /api/payment/status/:orderId
 */
router.get('/status/:orderId', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { orderId } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                id,
                provider_tx_id,
                provider_order_id,
                amount,
                currency,
                status,
                used,
                created_at
            FROM payments
            WHERE user_id = $1 
                AND (provider_order_id = $2 OR provider_tx_id = $2)
            LIMIT 1
        `, [userId, orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '支付记录不存在'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error: any) {
        console.error('[Payment] Get status error:', error);
        res.status(500).json({
            success: false,
            message: '查询支付状态失败'
        });
    }
});

export default router;
