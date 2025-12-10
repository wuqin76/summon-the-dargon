# 🐲 Dragon Spin Game - Complete Implementation

## 项目概述

Dragon Spin Game 是一个基于 Telegram WebApp 的 HTML5 小游戏，集成了 TRC20 USDT 支付和转盘抽奖机制。用户通过支付 10 USDT 购买游戏门票，完成游戏后可进行一次转盘抽奖，有机会赢取从 0.1 到 8888 USDT 不等的奖励。

## 核心特性

### ✅ 已实现功能

- **Telegram Web App 集成**
  - 完整的用户认证和 JWT Token 管理
  - Telegram initData 验证
  - 用户信息同步

- **TRC20 支付系统**
  - 用户直接向平台钱包转账
  - 链上交易验证（通过 TronGrid API）
  - 支付状态实时追踪
  - 防重复提交机制

- **转盘抽奖机制**
  - 后端控制的概率系统（CSPRNG）
  - 8 档奖励配置（0.1 ~ 8888 USDT）
  - 大奖人工审核流程
  - 完整的审计日志

- **提现系统**
  - 最小提现额度控制（100 USDT）
  - 手续费计算（从提现中扣除）
  - 批量审批和导出
  - 人工打款回填

- **邀请奖励**
  - 首次邀请奖励（0.1 USDT）
  - 邀请链接生成
  - 防作弊检测

- **风控系统**
  - IP 检测和限制
  - 支付和提现风险评分
  - 大额交易人工审核
  - 风险事件记录

- **管理后台**
  - 支付/提现审批
  - 用户管理
  - Spin 审核
  - 数据统计

## 技术栈

### 后端
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 12+
- **Cache**: Redis
- **Blockchain**: TronWeb (TRC20)
- **Language**: TypeScript

### 前端
- **Framework**: 原生 HTML5/CSS3/JavaScript
- **Integration**: Telegram Web App SDK
- **UI**: 响应式设计，支持移动端

### 依赖包
```json
{
  "express": "^4.18.2",
  "pg": "^8.11.3",
  "redis": "^4.6.12",
  "tronweb": "^5.3.2",
  "jsonwebtoken": "^9.0.2",
  "winston": "^3.11.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0"
}
```

## 项目结构

```
dagron/
├── src/
│   ├── config/
│   │   └── index.ts                 # 配置管理
│   ├── database/
│   │   └── index.ts                 # 数据库连接
│   ├── middleware/
│   │   └── auth.middleware.ts       # 认证中间件
│   ├── routes/
│   │   ├── auth.routes.ts           # 认证路由
│   │   ├── payment.routes.ts        # 支付路由
│   │   ├── spin.routes.ts           # 转盘路由
│   │   ├── payout.routes.ts         # 提现路由
│   │   ├── user.routes.ts           # 用户路由
│   │   └── admin.routes.ts          # 管理路由
│   ├── services/
│   │   ├── tron.service.ts          # TRON 区块链服务
│   │   ├── payment.service.ts       # 支付服务
│   │   ├── spin.service.ts          # 转盘服务
│   │   ├── payout.service.ts        # 提现服务
│   │   └── user.service.ts          # 用户服务
│   ├── utils/
│   │   └── logger.ts                # 日志工具
│   └── server.ts                    # 服务器入口
├── public/
│   ├── index.html                   # 首页
│   ├── pay.html                     # 支付页
│   ├── game.html                    # 游戏页
│   ├── spin.html                    # 转盘页
│   ├── withdraw.html                # 提现页
│   └── invite.html                  # 邀请页
├── database/
│   └── schema.sql                   # 数据库架构
├── .env.example                     # 环境变量示例
├── package.json
├── tsconfig.json
└── README.md
```

## 安装和部署

### 1. 环境准备

```bash
# 安装 Node.js 18+
# 安装 PostgreSQL 12+
# 安装 Redis

# 克隆项目
cd /path/to/project

# 安装依赖
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```env
# 必填项
TELEGRAM_BOT_TOKEN=your_bot_token
PLATFORM_ADDRESS=your_trc20_address
PLATFORM_PRIVATE_KEY=your_private_key
DATABASE_URL=postgresql://user:pass@localhost:5432/dragon_game

# 其他配置见 .env.example
```

### 3. 初始化数据库

```bash
# 创建数据库
createdb dragon_game

# 导入 schema
psql dragon_game < database/schema.sql

# 或使用 migration 脚本
npm run migrate
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 5. 配置 Telegram Bot

```bash
# 设置 Web App URL
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhookUrl?url=https://yourdomain.com

# 设置菜单按钮
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setChatMenuButton
```

## 数据库架构

### 核心表

- **users**: 用户信息和余额
- **payments**: 支付记录
- **spins**: 转盘记录
- **payout_requests**: 提现请求
- **payout_batches**: 提现批次
- **invitations**: 邀请记录
- **balance_changes**: 余额变动记录
- **audit_logs**: 审计日志
- **risk_events**: 风控事件

详细字段说明见 `database/schema.sql`

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/refresh` - 刷新 Token

### 支付
- `GET /api/payment/info` - 获取支付信息
- `POST /api/payment/verify` - 验证支付
- `GET /api/payment/status/:id` - 查询支付状态
- `GET /api/payment/history` - 支付历史

### 转盘
- `POST /api/spin` - 执行抽奖
- `GET /api/spin/history` - 抽奖历史

### 提现
- `POST /api/payout/request` - 创建提现请求
- `GET /api/payout/history` - 提现历史

### 管理后台
- `GET /api/admin/payouts/pending` - 待审批提现
- `POST /api/admin/payouts/approve` - 批准提现
- `POST /api/admin/payouts/batch` - 创建批次
- `POST /api/admin/payouts/mark-paid` - 标记已支付
- `POST /api/admin/spins/approve` - 批准大奖

## 运营流程

### 每日提现流程

1. **上午时段**：用户提交提现请求
2. **12:00 PM**：管理员批量审批
3. **批次导出**：导出 CSV 文件
4. **人工打款**：使用钱包转账
5. **回填记录**：上传 txid 标记完成

### 大奖审核流程

1. 用户抽中大奖（≥888 USDT）
2. 系统自动标记待审核
3. 发送告警给管理员
4. 人工核验（KYC、邀请链路等）
5. 批准或拒绝
6. 批准后自动发放到余额

## 安全措施

### 支付安全
- ✅ 链上验证交易真实性
- ✅ 防止 txHash 重复使用
- ✅ 金额和地址严格校验
- ✅ 确认数配置

### 抽奖公平性
- ✅ 后端控制随机性（CSPRNG）
- ✅ 完整审计日志
- ✅ 概率配置透明
- ✅ 大奖人工复核

### 风控机制
- ✅ IP 限制和检测
- ✅ 每日操作次数限制
- ✅ 风险评分系统
- ✅ 可疑交易标记

### 数据安全
- ✅ JWT Token 认证
- ✅ 数据库事务保证一致性
- ✅ 敏感信息加密
- ✅ 完整审计日志

## 配置说明

### 转盘概率配置

在 `.env` 中配置 `SPIN_PROBABILITIES`：

```json
[
  {"value": 8888, "probability": 0.0001, "label": "8888 USDT"},
  {"value": 888, "probability": 0.0009, "label": "888 USDT"},
  {"value": 88, "probability": 0.01, "label": "88 USDT"},
  {"value": 8, "probability": 0.08, "label": "8 USDT"},
  {"value": 3, "probability": 0.20, "label": "3 USDT"},
  {"value": 1, "probability": 0.30, "label": "1 USDT"},
  {"value": 0.5, "probability": 0.25, "label": "0.5 USDT"},
  {"value": 0.1, "probability": 0.159, "label": "0.1 USDT"}
]
```

**注意**：概率总和必须等于 1.0

### 风控参数

```env
MAX_INVITES_PER_IP_PER_DAY=10
MAX_PAYMENTS_PER_USER_PER_DAY=10
MAX_SPIN_PER_USER_PER_DAY=20
KYC_REQUIRED_FOR_AMOUNT=100
LARGE_PRIZE_THRESHOLD=888
```

## 监控和日志

### 日志位置
- `logs/combined.log` - 所有日志
- `logs/error.log` - 错误日志

### 关键监控指标
- 支付成功率
- 转盘执行次数
- 提现处理时长
- 风控事件数量
- API 响应时间

## 故障排查

### 常见问题

**1. 支付验证失败**
- 检查 TRON API Key 配置
- 确认网络类型（mainnet/testnet）
- 查看 USDT 合约地址

**2. 转盘不工作**
- 检查 payment 是否已确认
- 确认 used_spin 标记
- 查看服务器日志

**3. 提现无法创建**
- 检查用户余额
- 确认 withdrawal_eligible 状态
- 查看风控评分

## 测试

### 开发测试

```bash
# 使用 TRON Shasta 测试网
TRON_NETWORK=testnet
TRON_API_URL=https://api.shasta.trongrid.io
USDT_CONTRACT_ADDRESS=TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs

# 运行测试
npm test
```

### 本地调试

使用 ngrok 暴露本地服务：

```bash
ngrok http 3000
# 使用 ngrok 提供的 HTTPS URL 配置 Telegram Bot
```

## 生产部署建议

### 服务器要求
- CPU: 2 核+
- RAM: 4GB+
- 存储: 50GB+ SSD
- 网络: 稳定的公网 IP

### 推荐架构
- 负载均衡: Nginx
- 进程管理: PM2
- 数据库: PostgreSQL 主从
- 缓存: Redis 集群
- 监控: Prometheus + Grafana

### 安全加固
- 启用 HTTPS（Let's Encrypt）
- 配置防火墙规则
- 定期数据库备份
- 私钥冷存储
- 日志定期归档

## 维护和更新

### 日常维护
- 每日检查提现队列
- 监控风控告警
- 查看系统日志
- 数据库性能优化

### 更新流程
1. 备份数据库
2. 测试环境验证
3. 灰度发布
4. 监控关键指标
5. 回滚准备

## 法律和合规

⚠️ **重要提示**：
- 确保在合法司法管辖区运营
- 遵守当地博彩和金融法规
- 实施必要的 KYC/AML 措施
- 保留完整的交易记录
- 定期进行合规审计

## 许可证

MIT License

## 联系和支持

- 技术文档：见项目 Wiki
- 问题反馈：GitHub Issues
- 安全问题：security@example.com

---

**开发状态**: ✅ 完整实现

**最后更新**: 2025-12-08

**版本**: 1.0.0
