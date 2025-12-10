# Dragon Spin Game - 重构完成文档

## 🎯 项目重构概述

本次重构完全移除了区块链链上支付逻辑，改为使用第三方支付API，并实现了全新的邀请抽奖和任务解锁系统。

---

## 📊 核心变更

### 1. 支付系统重构

- ❌ **移除**：TronWeb、链上交易验证、钱包地址等所有区块链相关逻辑
- ✅ **新增**：第三方支付 Webhook 接口
- ✅ **新增**：支付幂等性验证（基于 `provider_tx_id`）
- ✅ **新增**：支付回调签名验证机制

### 2. 抽奖系统改造

- ❌ **移除**：多档位概率抽奖
- ✅ **固定奖金**：每次抽奖固定获得 **88 USDT**
- ✅ **新增**：抽奖资格来源
  - 邀请 1 位好友注册 = 1 次抽奖
  - 完成 1 次付费游戏 = 1 次抽奖
- ✅ **新增**：奖金锁定机制（需完成任务才能提现）

### 3. 任务系统

- ✅ **阶段 1**：邀请 3 人进入游戏
- ✅ **阶段 2**：完成 1 次付费游玩
- ✅ **阶段 3**：邀请 20 人进入游戏
- ✅ 任务进度自动追踪
- ✅ 所有任务完成后才能解锁奖金提现

### 4. 邀请系统增强

- ✅ 记录被邀请者详细行为（注册、游玩、付费、抽奖等）
- ✅ IP 地址追踪（防刷单）
- ✅ 后台可查看完整邀请关系链
- ✅ 邀请即获得抽奖资格（不需要通关）

---

## 🗄️ 数据库架构 (V2)

### 新增/修改的主要表

#### `payments` - 支付记录表（重构）

```sql
- provider_name: 第三方支付商名称
- provider_tx_id: 第三方交易ID（唯一，用于幂等）
- provider_order_id: 订单ID
- status: pending/success/failed
- used: 是否已使用
- callback_payload: 原始回调数据
- signature_verified: 签名是否验证通过
```

#### `spin_entitlements` - 抽奖资格表（新增）

```sql
- user_id: 用户ID
- source_type: invite/paid_game/manual/bonus
- source_id: 来源关联ID
- consumed: 是否已消耗
```

#### `spins` - 抽奖记录表（修改）

```sql
- prize_amount: 固定 88.000000
- status: pending/locked/unlocked
- requires_tasks: 是否需要完成任务
- tasks_completed: 任务是否完成
```

#### `invitations` - 邀请表（增强）

```sql
- registered: 被邀请者是否注册
- played_free: 是否玩过免费模式
- played_paid: 是否玩过付费模式
- has_invited_others: 是否也邀请了他人
- has_spun: 是否抽过奖
- invitee_ip: IP地址（风控）
```

#### `tasks` - 任务定义表（新增）

```sql
- task_key: 任务唯一标识
- stage: 任务阶段 (1/2/3)
- target_type: invite_count/paid_play_count
- target_value: 目标值
```

#### `user_task_progress` - 用户任务进度表（新增）

```sql
- user_id: 用户ID
- task_id: 任务ID
- progress: 当前进度
- completed: 是否完成
```

#### `game_sessions` - 游戏会话表（新增）

```sql
- game_mode: free/paid
- completed: 是否完成
- earned_spin: 是否获得抽奖资格
```

---

## 🔌 API 接口

### Webhook 接口

#### `POST /api/webhook/payment`

第三方支付回调接口（幂等）

**请求体：**

```json
{
  "transaction_id": "TX_123456",
  "order_id": "ORDER_789",
  "user_id": "uuid",
  "amount": 10,
  "currency": "USDT",
  "status": "success",
  "timestamp": "2025-12-09T12:00:00Z",
  "signature": "hmac_sha256_signature"
}
```

**签名验证：**

```javascript
HMAC - SHA256(payload, webhook_secret);
```

#### `POST /api/webhook/payment/test` (仅开发环境)

模拟支付回调，用于测试

---

### 支付接口 (V2)

#### `GET /api/payment/info`

获取支付信息

#### `POST /api/payment/create`

创建支付订单（可选）

#### `GET /api/payment/unused`

获取未使用的支付记录

#### `POST /api/payment/use`

使用支付记录（付费游玩时调用）

---

### 抽奖接口 (V2)

#### `GET /api/spin/available`

获取可用抽奖次数

#### `POST /api/spin/execute`

执行抽奖（固定返回 88 USDT）

#### `POST /api/spin/unlock`

解锁奖金（完成所有任务后）

---

### 任务接口

#### `GET /api/tasks`

获取用户任务列表和进度

#### `GET /api/tasks/stats`

获取任务完成统计

---

### 邀请接口

#### `GET /api/invite/mycode`

获取我的邀请码和链接

#### `GET /api/invite/stats`

获取邀请统计数据

#### `GET /api/invite/list`

获取邀请用户列表

---

## 🎨 前端页面

### 新增/更新页面

1. **`/tasks.html`** - 任务中心
   - 显示 3 个阶段的任务进度
   - 任务完成后可解锁奖金

2. **`/spin_v2.html`** - 抽奖页面（新版）
   - 显示固定 88 USDT 奖金
   - 中奖后提示完成任务才能提现

3. **`/invite_v2.html`** - 邀请页面（新版）
   - 显示邀请码和链接
   - 邀请统计和列表
   - 一键分享功能

4. **`/game.html`** - 游戏模式选择（保留）
   - 免费模式：无限游玩，无奖励
   - 付费模式：10 USDT，获得抽奖

5. **`/index.html`** - 首页（更新）
   - 更新菜单链接
   - 更新游戏规则说明

---

## ⚙️ 配置文件

### `.env` 配置

```env
# 第三方支付配置
PAYMENT_AMOUNT=10
PAYMENT_URL=https://payment-provider.com/pay
PAYMENT_WEBHOOK_SECRET=your_webhook_secret_here

# 转盘配置（固定奖金）
FIXED_PRIZE_AMOUNT=88

# Telegram 配置（开发模式可使用默认值）
TELEGRAM_BOT_TOKEN=dev_mode_token
TELEGRAM_BOT_USERNAME=dragon_game_bot
```

---

## 🔄 业务流程

### 1. 邀请获得抽奖流程

```
用户A分享邀请链接
→ 用户B通过链接注册
→ 系统创建邀请记录
→ 用户A获得1次抽奖资格
→ 更新用户A的任务进度（邀请数+1）
```

### 2. 付费游玩流程

```
用户访问游戏
→ 选择付费模式
→ 跳转第三方支付
→ 支付成功，webhook回调
→ 系统创建支付记录并发放抽奖资格
→ 用户进入游戏
→ 游戏通关
→ 消耗支付记录
→ 更新任务进度（付费游玩+1）
```

### 3. 抽奖并提现流程

```
用户有可用抽奖次数
→ 点击抽奖
→ 固定获得88 USDT（锁定状态）
→ 余额进入locked_balance
→ 完成所有任务（3阶段）
→ 点击解锁
→ locked_balance转为balance
→ 申请提现
```

---

## 🛡️ 风控机制

### 1. 支付幂等性

- 使用 `provider_tx_id` 作为唯一键
- 重复回调自动返回成功

### 2. 邀请防刷

- 记录被邀请者 IP 地址
- 追踪被邀请者行为（注册、游玩、付费等）
- 后台可查看完整邀请链

### 3. 任务验证

- 任务进度由服务端控制
- 前端只读展示，无法篡改
- 解锁奖金需验证所有任务完成

---

## 🚀 部署说明

### 1. 数据库迁移

```bash
# 执行迁移脚本
psql -U postgres -d dragon_game -f database/migrate_to_v2.sql

# 应用新schema
psql -U postgres -d dragon_game -f database/schema_v2.sql
```

### 2. 环境变量配置

- 配置 `.env` 文件
- 设置第三方支付 webhook secret
- 配置 Telegram Bot Token（生产环境）

### 3. 启动服务

```bash
npm run build
npm start
```

服务运行在：`http://localhost:3001`

---

## 📝 开发测试

### 测试支付回调（开发环境）

```bash
curl -X POST http://localhost:3001/api/webhook/payment/test \
  -H "Content-Type: application/json" \
  -d '{"user_id":"your-user-uuid","amount":10}'
```

### 模拟游戏完成

- 进入游戏页面
- 按 `Ctrl + G` 模拟通关

---

## ⚠️ 重要注意事项

1. **抽奖概率**：UI 可能显示多个奖项，但实际只有 88 USDT 可中奖，请确保符合当地法规
2. **数据备份**：迁移前已自动创建 `*_backup_v1` 表
3. **旧服务兼容**：保留了部分旧服务代码以保证编译通过，但实际不使用
4. **Webhook 安全**：生产环境务必配置正确的 webhook secret 并验证签名

---

## 🔧 故障排查

### 服务器无法启动

- 检查数据库连接：`DATABASE_URL`
- 检查必要配置：`TELEGRAM_BOT_TOKEN`, `JWT_SECRET`

### 抽奖不可用

- 检查用户是否有 `spin_entitlements` 记录
- 检查 `consumed` 字段是否为 false

### 任务进度不更新

- 检查 `user_task_progress` 表
- 查看审计日志 `audit_logs`

---

## 📊 项目统计

- **数据库表**：15+ 张表
- **API 接口**：30+ 个端点
- **前端页面**：8 个页面
- **代码行数**：约 3000+ 行

---

**项目重构完成时间**：2025年12月9日  
**服务器状态**：✅ 运行中 (http://localhost:3001)
