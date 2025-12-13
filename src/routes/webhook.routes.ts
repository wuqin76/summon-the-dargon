/**
 * Webhook Routes - 处理第三方支付回调
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import { fendPayService } from '../services/fendpay.service';
import { logger } from '../utils/logger';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * FendPay 支付回调接口（幂等）
 * POST /api/webhook/fendpay
 * 
 * 回调参数：
 * {
 *   "outTradeNo": "商户订单号",
 *   "orderNo": "平台订单号",
 *   "amount": "金额",
 *   "status": "1",  // 1=成功，其他=失败
 *   "utr": "流水号",  // 可选
 *   "sign": "签名"
 * }
 */
router.post('/fendpay', async (req: Request, res: Response) => {
    const client = await pool.connect();
    
    try {
        const {
            outTradeNo,   // 商户订单号
            orderNo,      // 平台订单号
            amount,       // 金额
            status,       // 1=成功，其他=失败
            utr           // 流水号（可选）
            // sign 签名已在verifySign中处理
        } = req.body;

        logger.info('[FendPay Webhook] 收到支付回调', {
            outTradeNo,
            orderNo,
            amount,
            status,
            utr,
        });

        // 1. 验证签名
        const isValid = fendPayService.verifySign(req.body);

        if (!isValid) {
            logger.error('[FendPay Webhook] 签名验证失败');
            // FendPay要求返回success，即使验证失败也返回，但记录错误
            return res.send('success');
        }

        // 2. 幂等性检查：查询是否已处理过此订单
        const existingPayment = await client.query(
            'SELECT id, status, used FROM payments WHERE provider_order_id = $1',
            [outTradeNo]
        );

        if (existingPayment.rows.length > 0) {
            logger.info('[FendPay Webhook] 订单已处理', { outTradeNo });
            // FendPay要求返回success
            return res.send('success');
        }

        // 3. 查询订单信息，获取user_id
        const orderInfo = await client.query(
            'SELECT user_id FROM game_sessions WHERE external_order_id = $1 OR id::text = $1',
            [outTradeNo]
        );

        if (orderInfo.rows.length === 0) {
            logger.error('[FendPay Webhook] 未找到订单信息', { outTradeNo });
            // 仍然返回success，避免重复回调
            return res.send('success');
        }

        const userId = orderInfo.rows[0].user_id;

        // 4. 判断支付是否成功（status = "1" 字符串）
        const paymentStatus = String(status) === '1' ? 'confirmed' : 'failed';

        if (paymentStatus !== 'confirmed') {
            logger.warn('[FendPay Webhook] 支付失败', { outTradeNo, status });
            return res.send('success');
        }

        // 5. 开始事务
        await client.query('BEGIN');

        // 6. 插入支付记录
        const paymentResult = await client.query(`
            INSERT INTO payments (
                user_id, provider_name, provider_tx_id, provider_order_id,
                amount, currency, status, signature_verified, callback_payload,
                created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING id
        `, [
            userId,
            'FendPay',
            orderNo,
            outTradeNo,
            parseFloat(amount),
            'INR',
            paymentStatus,
            true,
            JSON.stringify(req.body)
        ]);

        const paymentId = paymentResult.rows[0].id;

        logger.info('[FendPay Webhook] 支付记录已创建', { paymentId, outTradeNo });

        // 7. 更新订单状态为已支付
        await client.query(`
            UPDATE game_sessions
            SET 
                payment_id = $1,
                payment_status = 'paid',
                updated_at = NOW()
            WHERE external_order_id = $2
        `, [paymentId, outTradeNo]);

        // 8. 记录审计日志
        await client.query(`
            INSERT INTO audit_logs (
                actor_id, actor_type, action, target_type, target_id,
                ip_address, details, success, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
            userId,
            'system',
            'fendpay_webhook_received',
            'payment',
            paymentId,
            req.ip || 'unknown',
            JSON.stringify({ outTradeNo, orderNo, amount, status, utr }),
            true
        ]);

        // 7. 提交事务
        await client.query('COMMIT');

        logger.info('[FendPay Webhook] 支付处理成功', { paymentId, outTradeNo });

        // FendPay要求返回 "success" 字符串
        res.send('success');

    } catch (error: any) {
        await client.query('ROLLBACK');
        logger.error('[FendPay Webhook] 支付处理失败', {
            error: error.message,
            stack: error.stack,
        });

        // 即使出错也返回success，避免重复回调
        res.send('success');
    } finally {
        client.release();
    }
});

/**
 * 测试接口：模拟第三方支付回调（仅开发环境）
 * POST /api/webhook/payment/test
 */
if (process.env.NODE_ENV === 'development') {
    router.post('/payment/test', async (req: Request, res: Response) => {
        try {
            const { user_id, amount = 10 } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    message: 'user_id is required'
                });
            }

            // 生成测试数据
            const transaction_id = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const order_id = `ORDER_${Date.now()}`;
            const timestamp = new Date().toISOString();

            // 生成测试签名
            const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'your_webhook_secret';
            const payload = {
                transaction_id,
                order_id,
                user_id,
                amount,
                currency: 'USDT',
                status: 'success',
                timestamp
            };
            
            const signature = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(payload))
                .digest('hex');

            // 调用实际的 webhook 处理逻辑
            const testPayload = { ...payload, signature };
            
            console.log('[Test Webhook] Simulating payment callback:', testPayload);

            // 返回测试数据，让客户端手动调用真实接口
            res.json({
                success: true,
                message: 'Test payload generated. Call POST /api/webhook/payment with this data.',
                payload: testPayload,
                endpoint: '/api/webhook/payment'
            });

        } catch (error: any) {
            console.error('[Test Webhook] Error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
}

export default router;
