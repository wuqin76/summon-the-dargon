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
 * 创建支付订单（FendPay代收）
 * POST /api/payment/v2/create
 */
router.post('/create', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const client = await pool.connect();

    try {
        const { amount = 10 } = req.body;

        // 生成商户订单号（唯一）
        const outTradeNo = `GAME_${Date.now()}_${userId.substring(0, 8)}`;

        console.log('[Payment] 创建FendPay订单', { userId, outTradeNo, amount });

        // 开始事务
        await client.query('BEGIN');

        // 1. 创建游戏会话记录（用于关联订单和用户）
        const sessionResult = await client.query(`
            INSERT INTO game_sessions (
                user_id, game_mode, payment_status, external_order_id, created_at
            ) VALUES ($1, 'paid', 'pending', $2, NOW())
            RETURNING id
        `, [userId, outTradeNo]);

        const sessionId = sessionResult.rows[0].id;

        // 2. 调用FendPay API创建订单
        const { fendPayService } = await import('../services/fendpay.service');
        
        const baseUrl = process.env.BASE_URL || 'https://dragon-spin-game-production.up.railway.app';
        const notifyUrl = `${baseUrl}/api/webhook/fendpay`;
        
        // Telegram WebApp URL - 用户支付成功后返回的地址
        // 格式: https://t.me/你的机器人名/你的游戏名
        const telegramWebAppUrl = process.env.TELEGRAM_WEBAPP_URL || `${baseUrl}/`;
        const callbackUrl = telegramWebAppUrl;

        const fendPayResult = await fendPayService.createOrder({
            outTradeNo,
            amount: fendPayService.formatAmount(amount),
            notifyUrl,
            callbackUrl,
        });

        if (fendPayResult.code !== '200' || !fendPayResult.data) {
            await client.query('ROLLBACK');
            throw new Error(fendPayResult.msg || '创建支付订单失败');
        }

        // 3. 更新会话记录
        await client.query(`
            UPDATE game_sessions
            SET 
                fendpay_order_no = $1,
                updated_at = NOW()
            WHERE id = $2
        `, [fendPayResult.data.orderNo, sessionId]);

        await client.query('COMMIT');

        console.log('[Payment] FendPay订单创建成功', {
            outTradeNo,
            orderNo: fendPayResult.data.orderNo,
            payUrl: fendPayResult.data.payUrl,
        });

        res.json({
            success: true,
            data: {
                order_id: outTradeNo,
                fendpay_order_no: fendPayResult.data.orderNo,
                payment_url: fendPayResult.data.payUrl,
                amount,
                currency: 'INR',
                expires_in: 1800  // 30分钟
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Payment] Create order error:', error);
        res.status(500).json({
            success: false,
            message: '创建支付订单失败: ' + error.message
        });
    } finally {
        client.release();
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
 * 查询支付状态（通过商户订单ID）
 * GET /api/payment/v2/status/:orderId
 */
router.get('/status/:orderId', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { orderId } = req.params;

    try {
        // 1. 先查询本地数据库
        const localResult = await pool.query(`
            SELECT 
                p.id,
                p.provider_tx_id,
                p.provider_order_id,
                p.amount,
                p.currency,
                p.status,
                p.used,
                p.created_at,
                gs.payment_status,
                gs.fendpay_order_no
            FROM payments p
            LEFT JOIN game_sessions gs ON p.id = gs.payment_id
            WHERE p.user_id = $1 
                AND (p.provider_order_id = $2 OR gs.external_order_id = $2)
            LIMIT 1
        `, [userId, orderId]);

        // 如果本地已经有支付成功的记录，直接返回
        if (localResult.rows.length > 0 && localResult.rows[0].status === 'confirmed') {
            console.log('[Payment] 本地查询：支付已成功', { orderId });
            return res.json({
                success: true,
                data: localResult.rows[0]
            });
        }

        // 2. 如果本地没有或状态pending，调用FendPay查询接口
        console.log('[Payment] 调用FendPay查询订单状态', { orderId });
        
        const { fendPayService } = await import('../services/fendpay.service');
        const fendPayResult = await fendPayService.queryOrder({
            outTradeNo: orderId
        });

        if (fendPayResult.code === '200' && fendPayResult.data) {
            const paymentData = fendPayResult.data;
            
            // 如果FendPay显示支付成功但本地还没记录，更新本地状态
            if (paymentData.status === 1 && localResult.rows.length === 0) {
                console.log('[Payment] FendPay显示成功但本地无记录，可能webhook延迟');
                // 可以选择在这里触发webhook处理逻辑，或等待webhook到达
            }

            return res.json({
                success: true,
                data: {
                    order_id: orderId,
                    fendpay_order_no: paymentData.orderNo,
                    amount: paymentData.amount,
                    status: Number(paymentData.status) === 1 ? 'confirmed' : 'pending',
                    utr: paymentData.utr,
                }
            });
        }

        // 3. 如果FendPay查询失败，返回本地状态或pending
        if (localResult.rows.length > 0) {
            return res.json({
                success: true,
                data: localResult.rows[0]
            });
        }

        return res.json({
            success: true,
            data: {
                order_id: orderId,
                status: 'pending',
                message: '订单处理中'
            }
        });

    } catch (error: any) {
        console.error('[Payment] Get status error:', error);
        res.status(500).json({
            success: false,
            message: '查询支付状态失败: ' + error.message
        });
    }
});

export default router;
