/**
 * Webhook Routes - 处理第三方支付回调
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * 验证第三方支付签名
 * @param payload 回调数据
 * @param signature 签名
 * @param secret 密钥
 */
function verifySignature(payload: any, signature: string, secret: string): boolean {
    try {
        // 根据实际第三方支付的签名算法调整
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return signature === expectedSignature;
    } catch (error) {
        console.error('[Webhook] Signature verification error:', error);
        return false;
    }
}

/**
 * 第三方支付回调接口（幂等）
 * POST /api/webhook/payment
 */
router.post('/payment', async (req: Request, res: Response) => {
    const client = await pool.connect();
    
    try {
        const {
            transaction_id,   // 第三方交易ID（唯一）
            order_id,         // 订单ID
            user_id,          // 用户ID
            amount,           // 金额
            currency,         // 货币
            status,           // 支付状态：success, failed
            timestamp,        // 时间戳
            signature         // 签名
        } = req.body;

        console.log('[Webhook] Payment callback received:', {
            transaction_id,
            order_id,
            user_id,
            amount,
            status
        });

        // 1. 验证签名
        const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'your_webhook_secret';
        const isValid = verifySignature(
            { transaction_id, order_id, user_id, amount, currency, status, timestamp },
            signature,
            secret
        );

        if (!isValid) {
            console.error('[Webhook] Invalid signature');
            return res.status(401).json({
                success: false,
                error: 'INVALID_SIGNATURE',
                message: '签名验证失败'
            });
        }

        // 2. 幂等性检查：查询是否已处理过此交易
        const existingPayment = await client.query(
            'SELECT id, status, used FROM payments WHERE provider_tx_id = $1',
            [transaction_id]
        );

        if (existingPayment.rows.length > 0) {
            console.log('[Webhook] Payment already processed:', transaction_id);
            return res.status(200).json({
                success: true,
                message: 'Already processed',
                payment_id: existingPayment.rows[0].id
            });
        }

        // 3. 开始事务
        await client.query('BEGIN');

        // 4. 插入支付记录
        const paymentResult = await client.query(`
            INSERT INTO payments (
                user_id, provider_name, provider_tx_id, provider_order_id,
                amount, currency, status, signature_verified, callback_payload,
                user_ip, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
            RETURNING id
        `, [
            user_id,
            'external_api',
            transaction_id,
            order_id,
            amount,
            currency || 'USDT',
            status,
            true,
            JSON.stringify(req.body),
            req.ip || req.headers['x-forwarded-for'] || 'unknown'
        ]);

        const paymentId = paymentResult.rows[0].id;

        // 5. 如果支付成功，发放抽奖资格
        if (status === 'success') {
            // 发放一次抽奖资格
            await client.query(`
                INSERT INTO spin_entitlements (
                    user_id, source_type, source_id, consumed, created_at
                ) VALUES ($1, 'paid_game', $2, false, NOW())
            `, [user_id, paymentId]);

            // 更新用户可用抽奖次数
            await client.query(`
                UPDATE users 
                SET available_spins = available_spins + 1,
                    updated_at = NOW()
                WHERE id = $1
            `, [user_id]);

            console.log('[Webhook] Spin entitlement granted to user:', user_id);
        }

        // 6. 记录审计日志
        await client.query(`
            INSERT INTO audit_logs (
                actor_id, actor_type, action, target_type, target_id,
                ip_address, details, success, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
            user_id,
            'system',
            'payment_webhook_received',
            'payment',
            paymentId,
            req.ip || 'unknown',
            JSON.stringify({ transaction_id, status, amount }),
            true
        ]);

        // 7. 提交事务
        await client.query('COMMIT');

        console.log('[Webhook] Payment processed successfully:', paymentId);

        res.json({
            success: true,
            message: 'Payment processed',
            payment_id: paymentId
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Webhook] Payment processing error:', error);

        res.status(500).json({
            success: false,
            error: 'PROCESSING_ERROR',
            message: '支付处理失败'
        });
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
