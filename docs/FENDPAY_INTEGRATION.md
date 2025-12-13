# FendPay 支付集成完整指南

## 🎯 集成完成状态

✅ 已完成所有代码实现，可直接使用！

## 📦 已实现的功能

### 1. FendPay服务类 (`src/services/fendpay.service.ts`)

- ✅ MD5签名生成算法
- ✅ 签名验证
- ✅ 创建代收订单
- ✅ 查询订单状态
- ✅ 金额格式化（两位小数）

### 2. Webhook回调处理 (`src/routes/webhook.routes.ts`)

- ✅ `/api/webhook/fendpay` - 接收FendPay支付回调
- ✅ 签名验证
- ✅ 幂等性处理（防止重复回调）
- ✅ 订单状态更新
- ✅ 审计日志记录
- ✅ 返回"success"（FendPay要求）

### 3. 支付API (`src/routes/payment_v2.routes.ts`)

- ✅ `POST /api/payment/v2/create` - 创建支付订单
- ✅ `GET /api/payment/v2/status/:orderId` - 查询订单状态
- ✅ `GET /api/payment/v2/history` - 获取支付历史
- ✅ 自动调用FendPay API
- ✅ 本地+远程双重查询

### 4. 前端集成 (`public/index.html`)

- ✅ 第一次免费游玩
- ✅ 第二次及以后需要支付
- ✅ 自动创建订单并跳转FendPay
- ✅ 支付等待界面
- ✅ 订单状态轮询（3秒/次）
- ✅ 支付成功自动进入游戏

## 🔧 配置步骤

### 步骤1：添加环境变量

在 `.env` 文件中添加：

```bash
# FendPay 配置
FENDPAY_MERCHANT_NUMBER=10086
FENDPAY_SECRET=your_secret_key_here
FENDPAY_API_URL=https://kspay.shop

# 应用基础URL
BASE_URL=https://dragon-spin-game-production.up.railway.app

# 支付金额（印度卢比）
PAYMENT_AMOUNT=1000
```

### 步骤2：执行数据库迁移

```bash
# 在Railway或本地数据库执行
psql $DATABASE_URL -f database/add_fendpay_fields.sql
```

或手动在数据库中执行：

```sql
ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS fendpay_order_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_game_sessions_external_order_id
ON game_sessions(external_order_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_fendpay_order_no
ON game_sessions(fendpay_order_no);
```

### 步骤3：配置FendPay回调地址

在FendPay后台配置回调地址：

```
https://your-domain.com/api/webhook/fendpay
```

### 步骤4：部署代码

```bash
git add .
git commit -m "集成FendPay支付"
git push
```

## 📋 支付流程图

```
用户点击游玩
    │
    ▼
检查是否第一次 ──Yes──→ 免费进入游戏
    │ No
    ▼
调用创建订单API
/api/payment/v2/create
    │
    ▼
生成商户订单号
GAME_1234567890_abc123
    │
    ▼
调用FendPay API
POST https://kspay.shop/pay/payment
    │
    ▼
返回支付链接
data.payUrl
    │
    ▼
用户跳转到FendPay支付页面
    │
    ▼
用户完成支付
    │
    ▼
FendPay回调我们的服务器
POST /api/webhook/fendpay
{
  "outTradeNo": "GAME_xxx",
  "orderNo": "S503xxx",
  "amount": "1000.00",
  "status": "1",
  "sign": "xxx"
}
    │
    ▼
验证签名 + 更新订单状态
    │
    ▼
返回 "success" 给FendPay
    │
    ▼
前端轮询查询订单状态
GET /api/payment/v2/status/:orderId
    │
    ▼
订单状态变为 confirmed
    │
    ▼
自动进入游戏
```

## 🧪 测试步骤

### 1. 测试订单创建

```bash
curl -X POST https://your-domain.com/api/payment/v2/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}'
```

预期响应：

```json
{
  "success": true,
  "data": {
    "order_id": "GAME_1234567890_abc123",
    "fendpay_order_no": "S503xxx",
    "payment_url": "https://kspay.shop/pay/xxx",
    "amount": 1000,
    "currency": "INR"
  }
}
```

### 2. 测试签名生成

```javascript
// 在Node.js环境测试
const crypto = require("crypto");

const params = {
  merchantNumber: "10086",
  outTradeNo: "TEST123",
  amount: "1000.00",
  notifyUrl: "https://api.xxx.com",
  callbackUrl: "https://xxx.com",
};

// 按key排序
const keys = Object.keys(params).sort();
const str = keys.map((k) => `${k}=${params[k]}`).join("&") + "&key=your_secret";
const sign = crypto.createHash("md5").update(str).digest("hex").toLowerCase();

console.log("签名:", sign);
```

### 3. 测试Webhook回调

```bash
curl -X POST https://your-domain.com/api/webhook/fendpay \
  -H "Content-Type: application/json" \
  -d '{
    "outTradeNo": "GAME_1234567890_abc123",
    "orderNo": "S503xxx",
    "amount": "1000.00",
    "status": "1",
    "utr": "12345678",
    "sign": "calculated_sign_here"
  }'
```

预期响应：

```
success
```

## 🔍 调试技巧

### 1. 查看日志

在服务器上查看日志：

```bash
# Railway
railway logs

# 本地
npm run dev
```

### 2. 常见问题

#### Q: 签名验证失败

A: 检查以下内容：

- 密钥是否正确
- 参数是否按ASCII排序
- 金额是否保留两位小数
- sign字段是否从参数中排除
- 空值是否已过滤

#### Q: Webhook没有收到回调

A:

- 确认回调URL配置正确
- 确认服务器可以从外网访问
- 检查FendPay后台配置
- 查看服务器日志

#### Q: 订单状态一直pending

A:

- 检查用户是否实际完成支付
- 查看Webhook是否收到回调
- 使用查询接口手动查询订单状态
- 检查数据库game_sessions表

### 3. 数据库查询

```sql
-- 查看最近的订单
SELECT * FROM game_sessions
WHERE external_order_id LIKE 'GAME_%'
ORDER BY created_at DESC
LIMIT 10;

-- 查看支付记录
SELECT * FROM payments
WHERE provider_name = 'FendPay'
ORDER BY created_at DESC
LIMIT 10;

-- 查看审计日志
SELECT * FROM audit_logs
WHERE action = 'fendpay_webhook_received'
ORDER BY created_at DESC
LIMIT 10;
```

## 📊 监控指标

建议监控以下指标：

1. **订单创建成功率**

   ```sql
   SELECT
     DATE(created_at) as date,
     COUNT(*) as total_orders
   FROM game_sessions
   WHERE game_mode = 'paid'
   GROUP BY DATE(created_at);
   ```

2. **支付成功率**

   ```sql
   SELECT
     DATE(created_at) as date,
     COUNT(*) FILTER (WHERE status = 'confirmed') as success,
     COUNT(*) as total,
     ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'confirmed') / COUNT(*), 2) as success_rate
   FROM payments
   WHERE provider_name = 'FendPay'
   GROUP BY DATE(created_at);
   ```

3. **Webhook响应时间**
   - 在日志中记录处理时间
   - 确保在3秒内返回success

## 🚀 上线清单

- [ ] 配置生产环境变量
- [ ] 执行数据库迁移
- [ ] 配置FendPay回调地址
- [ ] 测试完整支付流程
- [ ] 验证Webhook能正常接收
- [ ] 设置监控告警
- [ ] 准备回滚方案

## 📞 技术支持

如遇到问题，请检查：

1. 服务器日志 (`railway logs`)
2. 数据库记录
3. FendPay后台订单状态
4. 浏览器控制台错误

## 🔄 更新记录

- 2024-12-13: 完成FendPay支付集成
  - 实现签名算法
  - 创建订单API
  - Webhook回调处理
  - 订单状态查询
  - 前端支付流程
