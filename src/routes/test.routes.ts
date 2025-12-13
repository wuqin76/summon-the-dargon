/**
 * 测试路由 - 模拟FendPay支付流程
 * 仅用于开发测试，生产环境应禁用
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authMiddleware } from '../middleware/auth.middleware';
import { fendPayService } from '../services/fendpay.service';
import { logger } from '../utils/logger';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * 模拟创建支付订单（用于测试）
 * POST /api/test/payment/create
 */
router.post('/payment/create', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { amount = 1000 } = req.body;

    try {
        // 生成测试订单号
        const outTradeNo = `TEST_${Date.now()}_${userId.substring(0, 8)}`;

        logger.info('[Test Payment] 创建测试支付订单', { userId, outTradeNo, amount });

        // 插入测试订单到数据库
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const sessionResult = await client.query(`
                INSERT INTO game_sessions (
                    user_id, game_mode, payment_status, external_order_id, created_at
                ) VALUES ($1, 'paid', 'pending', $2, NOW())
                RETURNING id
            `, [userId, outTradeNo]);

            const sessionId = sessionResult.rows[0].id;

            // 模拟FendPay订单号
            const mockOrderNo = `MOCK_${Date.now()}`;

            await client.query(`
                UPDATE game_sessions
                SET fendpay_order_no = $1
                WHERE id = $2
            `, [mockOrderNo, sessionId]);

            await client.query('COMMIT');

            // 返回模拟的支付URL（实际上是一个测试页面）
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const mockPayUrl = `${baseUrl}/api/test/payment/page?orderId=${outTradeNo}`;

            res.json({
                success: true,
                data: {
                    order_id: outTradeNo,
                    fendpay_order_no: mockOrderNo,
                    payment_url: mockPayUrl,
                    amount,
                    currency: 'INR',
                    expires_in: 1800,
                    test_mode: true
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error: any) {
        logger.error('[Test Payment] 创建测试订单失败', { error: error.message });
        res.status(500).json({
            success: false,
            message: '创建测试订单失败: ' + error.message
        });
    }
});

/**
 * 模拟支付页面（返回HTML）
 * GET /api/test/payment/page?orderId=xxx
 */
router.get('/payment/page', async (req: Request, res: Response) => {
    const { orderId } = req.query;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>模拟支付页面</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 14px;
        }
        .info-row:last-child {
            margin-bottom: 0;
        }
        .label {
            color: #666;
        }
        .value {
            color: #333;
            font-weight: bold;
        }
        .amount {
            font-size: 32px;
            color: #667eea;
            text-align: center;
            margin: 20px 0;
            font-weight: bold;
        }
        .buttons {
            display: flex;
            gap: 12px;
        }
        button {
            flex: 1;
            padding: 16px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .btn-success {
            background: linear-gradient(135deg, #11998e, #38ef7d);
            color: white;
        }
        .btn-fail {
            background: linear-gradient(135deg, #fa709a, #fee140);
            color: white;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
        button:active {
            transform: translateY(0);
        }
        .note {
            margin-top: 20px;
            padding: 15px;
            background: #fff3cd;
            border-radius: 8px;
            color: #856404;
            font-size: 13px;
            line-height: 1.6;
        }
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(102, 126, 234, 0.1);
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 模拟支付页面</h1>
        <p class="subtitle">测试环境 - 不会产生真实交易</p>
        
        <div class="amount">₹1000</div>
        
        <div class="info">
            <div class="info-row">
                <span class="label">订单号：</span>
                <span class="value" id="orderId">${orderId}</span>
            </div>
            <div class="info-row">
                <span class="label">商户：</span>
                <span class="value">Dragon Spin Game</span>
            </div>
            <div class="info-row">
                <span class="label">金额：</span>
                <span class="value">1000.00 INR</span>
            </div>
        </div>
        
        <div class="buttons">
            <button class="btn-success" onclick="simulateSuccess()">
                ✅ 模拟成功
            </button>
            <button class="btn-fail" onclick="simulateFail()">
                ❌ 模拟失败
            </button>
        </div>
        
        <div class="note">
            <strong>📝 说明：</strong><br>
            这是测试页面，点击按钮后会触发相应的webhook回调，模拟真实的支付流程。<br>
            • 成功：触发成功回调，玩家自动跳转游戏<br>
            • 失败：触发失败回调，显示支付失败提示
        </div>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>正在处理...</p>
        </div>
    </div>
    
    <script>
        const orderId = '${orderId}';
        const baseUrl = window.location.origin;
        
        async function simulateSuccess() {
            document.querySelector('.buttons').style.display = 'none';
            document.getElementById('loading').style.display = 'block';
            
            try {
                // 调用测试webhook触发成功回调
                const response = await fetch(baseUrl + '/api/test/payment/webhook/success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ 支付成功！\\n\\n' + data.message + '\\n\\n页面将返回游戏...');
                    // 模拟FendPay跳转回Telegram
                    window.location.href = 'https://t.me/summondragon_bot/dragongame';
                } else {
                    alert('❌ 测试失败：' + data.message);
                    document.querySelector('.buttons').style.display = 'flex';
                    document.getElementById('loading').style.display = 'none';
                }
            } catch (error) {
                alert('❌ 请求失败：' + error.message);
                document.querySelector('.buttons').style.display = 'flex';
                document.getElementById('loading').style.display = 'none';
            }
        }
        
        async function simulateFail() {
            document.querySelector('.buttons').style.display = 'none';
            document.getElementById('loading').style.display = 'block';
            
            try {
                // 调用测试webhook触发失败回调
                const response = await fetch(baseUrl + '/api/test/payment/webhook/fail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId })
                });
                
                const data = await response.json();
                
                alert('❌ 支付失败模拟完成\\n\\n' + data.message);
                window.location.href = 'https://t.me/summondragon_bot/dragongame';
            } catch (error) {
                alert('❌ 请求失败：' + error.message);
                document.querySelector('.buttons').style.display = 'flex';
                document.getElementById('loading').style.display = 'none';
            }
        }
    </script>
</body>
</html>
    `;

    res.send(html);
});

/**
 * 模拟支付成功webhook
 * POST /api/test/payment/webhook/success
 */
router.post('/payment/webhook/success', async (req: Request, res: Response) => {
    const { orderId } = req.body;

    try {
        // 查询订单信息
        const result = await pool.query(`
            SELECT id, user_id, external_order_id, fendpay_order_no
            FROM game_sessions
            WHERE external_order_id = $1
        `, [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        const session = result.rows[0];

        // 生成符合FendPay格式的回调数据
        const callbackData: Record<string, any> = {
            outTradeNo: session.external_order_id,
            orderNo: session.fendpay_order_no,
            amount: "1000.00",
            status: "1",  // 1 = 成功
            utr: `TEST_UTR_${Date.now()}`,
        };

        // 生成签名
        const sign = fendPayService['generateSign'](callbackData);
        callbackData['sign'] = sign;

        logger.info('[Test Webhook] 模拟支付成功回调', { orderId, callbackData });

        // 调用真实的webhook处理逻辑
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const webhookResponse = await fetch(`${baseUrl}/api/webhook/fendpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackData)
        });

        const webhookResult = await webhookResponse.text();

        logger.info('[Test Webhook] Webhook处理结果', { 
            result: webhookResult,
            status: webhookResponse.status 
        });

        res.json({
            success: true,
            message: '支付成功回调已触发，订单状态已更新',
            webhook_result: webhookResult
        });

    } catch (error: any) {
        logger.error('[Test Webhook] 模拟成功回调失败', { error: error.message });
        res.status(500).json({
            success: false,
            message: '触发回调失败: ' + error.message
        });
    }
});

/**
 * 模拟支付失败webhook
 * POST /api/test/payment/webhook/fail
 */
router.post('/payment/webhook/fail', async (req: Request, res: Response) => {
    const { orderId } = req.body;

    try {
        const result = await pool.query(`
            SELECT id, user_id, external_order_id, fendpay_order_no
            FROM game_sessions
            WHERE external_order_id = $1
        `, [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        const session = result.rows[0];

        const callbackData: Record<string, any> = {
            outTradeNo: session.external_order_id,
            orderNo: session.fendpay_order_no,
            amount: "1000.00",
            status: "0",  // 0 = 失败
        };

        const sign = fendPayService['generateSign'](callbackData);
        callbackData['sign'] = sign;

        logger.info('[Test Webhook] 模拟支付失败回调', { orderId, callbackData });

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const webhookResponse = await fetch(`${baseUrl}/api/webhook/fendpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callbackData)
        });

        const webhookResult = await webhookResponse.text();

        res.json({
            success: true,
            message: '支付失败回调已触发',
            webhook_result: webhookResult
        });

    } catch (error: any) {
        logger.error('[Test Webhook] 模拟失败回调失败', { error: error.message });
        res.status(500).json({
            success: false,
            message: '触发回调失败: ' + error.message
        });
    }
});

export default router;
