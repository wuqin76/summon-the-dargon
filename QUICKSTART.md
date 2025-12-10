# Dragon Spin Game - 快速启动指南

## 🚀 5分钟快速部署

### 前置要求

- Node.js 18+ 
- PostgreSQL 12+
- Redis (可选，但推荐)
- TRON 钱包地址

### 第一步：安装依赖

```bash
cd /path/to/dagron
npm install
```

### 第二步：配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑 .env 文件，至少配置以下必填项：
# - TELEGRAM_BOT_TOKEN (从 @BotFather 获取)
# - PLATFORM_ADDRESS (你的 TRC20 收款地址)
# - DATABASE_URL (PostgreSQL 连接字符串)
# - JWT_SECRET (随机字符串，用于 JWT 签名)
```

### 第三步：初始化数据库

```bash
# 方式1: 使用 psql 导入
createdb dragon_game
psql dragon_game < database/schema.sql

# 方式2: 使用 migration 脚本（如果实现了）
npm run migrate
```

### 第四步：启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`

### 第五步：配置 Telegram Bot

1. 打开 Telegram，找到 @BotFather
2. 发送 `/setmenubutton`
3. 选择你的 bot
4. 设置 Web App URL: `https://your-domain.com`

### 第六步：测试

1. 在 Telegram 中打开你的 bot
2. 点击菜单按钮进入 Web App
3. 测试支付和转盘功能

---

## 📋 功能清单

✅ **已完成的核心功能**

- [x] Telegram Web App 集成和用户认证
- [x] TRC20 USDT 支付验证系统
- [x] 转盘抽奖机制（8档奖励）
- [x] 提现系统（批量审批+人工打款）
- [x] 邀请奖励系统
- [x] 风控和反作弊机制
- [x] 管理后台 API
- [x] 完整的审计日志
- [x] 前端页面（首页/支付/游戏/转盘/提现）
- [x] 数据库 Schema 和索引优化

---

## 🔧 开发调试

### 使用 ngrok 进行本地测试

```bash
# 安装 ngrok
npm install -g ngrok

# 启动服务
npm run dev

# 在另一个终端启动 ngrok
ngrok http 3000

# 使用 ngrok 提供的 HTTPS URL 配置 Telegram Bot
```

### 使用 TRON 测试网

在 `.env` 中配置：

```env
TRON_NETWORK=testnet
TRON_API_URL=https://api.shasta.trongrid.io
USDT_CONTRACT_ADDRESS=TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs
```

### 查看日志

```bash
# 实时查看所有日志
tail -f logs/combined.log

# 只查看错误日志
tail -f logs/error.log
```

---

## 📊 数据库管理

### 常用 SQL 查询

```sql
-- 查看所有用户
SELECT id, telegram_id, username, game_balance, withdrawal_eligible FROM users;

-- 查看待确认的支付
SELECT * FROM payments WHERE status = 'pending';

-- 查看待审批的提现
SELECT * FROM payout_requests WHERE status = 'pending';

-- 查看转盘历史
SELECT s.*, u.username FROM spins s 
JOIN users u ON s.user_id = u.id 
ORDER BY s.created_at DESC LIMIT 20;

-- 统计数据
SELECT 
    COUNT(DISTINCT user_id) as total_users,
    COUNT(*) as total_payments,
    SUM(amount) as total_amount
FROM payments 
WHERE status = 'confirmed';
```

### 备份数据库

```bash
# 备份
pg_dump dragon_game > backup_$(date +%Y%m%d).sql

# 恢复
psql dragon_game < backup_20241208.sql
```

---

## 🎮 测试流程

### 完整的用户流程测试

1. **注册登录**
   - 在 Telegram 打开 Bot
   - 点击菜单进入 Web App
   - 检查用户是否创建成功

2. **支付测试**
   - 访问支付页面
   - 向平台地址转账 10 USDT（测试网可用测试币）
   - 提交 txHash 验证
   - 等待确认（1-3分钟）

3. **游戏测试**
   - 进入付费游戏模式
   - 完成游戏（可简化为点击按钮）
   - 检查是否获得 spin 资格

4. **转盘测试**
   - 访问转盘页面
   - 点击 SPIN 按钮
   - 查看抽奖结果
   - 确认奖励是否到账

5. **提现测试**
   - 访问提现页面
   - 填写接收地址和金额
   - 提交提现申请
   - 管理员批准
   - 标记已支付

---

## 🛡️ 安全检查清单

部署前请确认：

- [ ] 更改了 JWT_SECRET
- [ ] 配置了正确的 PLATFORM_ADDRESS
- [ ] PLATFORM_PRIVATE_KEY 只在服务器上存储
- [ ] 数据库使用强密码
- [ ] 启用了 HTTPS
- [ ] 配置了防火墙规则
- [ ] 设置了管理员 Telegram ID
- [ ] 测试了支付验证流程
- [ ] 测试了提现流程
- [ ] 配置了日志轮转
- [ ] 设置了数据库备份

---

## 📞 常见问题

### Q: 支付验证一直失败？
A: 检查以下几点：
- TRON API Key 是否正确
- 网络类型（mainnet/testnet）是否匹配
- USDT 合约地址是否正确
- 转账金额是否正好 10 USDT

### Q: 转盘无法执行？
A: 确认：
- 支付是否已确认（status = 'confirmed'）
- payment.used_spin 是否为 false
- 查看服务器日志获取详细错误

### Q: 提现无法创建？
A: 检查：
- 用户余额是否充足
- withdrawal_eligible 是否为 true
- 是否达到最小提现额度（100 USDT）

### Q: 如何成为管理员？
A: 在 `.env` 中添加你的 Telegram ID 到 ADMIN_TELEGRAM_IDS

---

## 🔄 更新和维护

### 定期维护任务

**每日**
- [ ] 检查提现队列
- [ ] 处理大奖审核
- [ ] 查看风控告警
- [ ] 检查系统日志

**每周**
- [ ] 数据库性能分析
- [ ] 清理过期日志
- [ ] 检查磁盘空间
- [ ] 审查可疑活动

**每月**
- [ ] 完整数据库备份
- [ ] 安全审计
- [ ] 更新依赖包
- [ ] 生成运营报告

---

## 📈 监控指标

### 关键业务指标

- 日活用户数
- 支付成功率
- 转盘执行次数
- 提现处理时长
- 平均用户余额
- 邀请转化率

### 技术指标

- API 响应时间
- 数据库连接数
- 错误率
- CPU/内存使用率
- 磁盘 I/O

---

## 🎯 下一步优化

### 建议的功能增强

1. **性能优化**
   - 添加 Redis 缓存
   - 数据库查询优化
   - CDN 加速静态资源

2. **功能增强**
   - 多语言支持
   - 更丰富的游戏玩法
   - VIP 等级系统
   - 每日签到奖励

3. **运营工具**
   - 数据分析面板
   - 自动化运营报表
   - 用户行为追踪
   - A/B 测试框架

4. **安全加固**
   - 双因素认证
   - 更复杂的风控规则
   - 异常检测系统
   - 定期安全扫描

---

## 📚 相关文档

- [完整 README](README.md)
- [数据库架构说明](database/schema.sql)
- [API 接口文档](docs/API.md) (待创建)
- [部署指南](docs/DEPLOYMENT.md) (待创建)

---

## ⚖️ 法律声明

本项目仅供学习和研究使用。在生产环境使用前，请确保：

1. 遵守当地法律法规
2. 获得必要的运营许可
3. 实施适当的 KYC/AML 措施
4. 咨询法律顾问

开发者不对任何使用本代码导致的法律问题负责。

---

**祝你部署顺利！🎉**

如有问题，请查看日志文件或提交 Issue。
