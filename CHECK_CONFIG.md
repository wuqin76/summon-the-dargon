# 一次性配置检查清单

## 🚨 当前问题

数据库密码认证失败：`password authentication failed for user "postgres"`

## ✅ 需要检查的配置

### 1. DATABASE_URL 格式检查

**正确格式应该是：**

```
postgresql://用户名:密码@主机:端口/数据库名
```

**示例：**

```
postgresql://postgres:rZRhuCiZwNxPPgzalXHntwDNwcVbpSn@dragon-game-db.railway.internal:5432/railway
```

**从你的截图看到的值（错误的）：**

```
postgresql://postgres:rZRhuCiZwNxPPgzalXHntwDNwcVbpSn@dragon-game-db.railway.internal:5432/railwaypostgresql://postgres:rZRhuCiZwNxPPgzalXHntwDNwcVbpSn@dragon-game-db.railway.internal:5432/railway
```

### 2. 如何修复

#### Option A: 在 Railway Web 界面修复

1. 进入 Railway 项目
2. 选择 **Database** 服务（PostgreSQL）
3. 点击 **Variables** 或 **Connect** 选项卡
4. 找到正确的连接字符串，通常是：
   - `DATABASE_URL` 或
   - `DATABASE_PRIVATE_URL` 或
   - `PGDATABASE`, `PGHOST`, `PGPASSWORD` 等分开的变量

5. 复制**正确的** `DATABASE_URL`

6. 回到你的 **App** 服务
7. 进入 Variables
8. 更新 `DATABASE_URL` 为正确的值

#### Option B: 使用 Railway CLI 获取正确配置

```bash
# 安装 Railway CLI（如果还没安装）
npm i -g @railway/cli

# 登录
railway login

# 链接项目
railway link

# 查看数据库连接信息
railway variables
```

### 3. 必需的环境变量清单

请确保以下变量都正确配置：

```bash
# ✅ 数据库配置
DATABASE_URL=postgresql://postgres:密码@主机:端口/数据库名

# ✅ Telegram 配置
TELEGRAM_BOT_TOKEN=8498203261:AAG882s-ykbDt16jqTwXxo1-QKtc1c31DBuw
TELEGRAM_BOT_USERNAME=summondargon_bot

# ✅ JWT 安全配置
JWT_SECRET=LhuT009z1C1AJA9at-f6.9869Zbknfl5

# ✅ 应用配置
NODE_ENV=production
PORT=3000

# ✅ 支付配置（如果需要）
PAYMENT_AMOUNT=10
PAYMENT_CONFIRMATIONS=1
PAYMENT_TIMEOUT_MINUTES=30
```

### 4. 快速验证方法

执行以下命令测试数据库连接：

```bash
# 使用 psql 测试（在本地或 Railway shell 中）
psql "你的DATABASE_URL"
```

如果连接成功，会进入 PostgreSQL 命令行。

### 5. 一次性修复脚本

我可以创建一个配置验证脚本，帮你检查所有配置是否正确。
