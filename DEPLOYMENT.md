# 🚀 Render 部署指南

## 📋 部署前准备

### 1. 准备必要信息

在部署前,请准备好以下信息:

- **Telegram Bot Token**: 从 [@BotFather](https://t.me/BotFather) 创建机器人获取
- **Telegram Bot Username**: 你的机器人用户名(例如: MyDragonBot)
- **TRON 钱包地址**: 用于接收支付的 TRC20 地址
- **TRON 私钥**: 用于自动提现的钱包私钥
- **TronGrid API Key**: 从 [TronGrid](https://www.trongrid.io/) 获取(可选,提高请求限制)
- **管理员 Telegram ID**: 管理员的 Telegram 用户 ID(可选)

### 2. 推送代码到 GitHub

确保你的代码已推送到 GitHub 仓库:

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

---

## 🌐 Render 部署步骤

### 第一步: 创建 Render 账号

1. 访问 [Render](https://render.com/)
2. 点击 **Sign Up** 注册账号
3. 使用 GitHub 账号登录(推荐)

### 第二步: 创建 PostgreSQL 数据库

1. 登录后,点击顶部的 **New +** 按钮
2. 选择 **PostgreSQL**
3. 填写数据库信息:
   - **Name**: `dragon-game-db`
   - **Database**: `dragon_game`
   - **User**: `dragon_game_user`
   - **Region**: 选择离你最近的区域(建议: Singapore)
   - **Plan**: 选择 **Free** (足够测试使用)
4. 点击 **Create Database**
5. 等待数据库创建完成(约 1-2 分钟)
6. **重要**: 复制 **Internal Database URL**(以 `postgresql://` 开头的完整连接字符串)

### 第三步: 初始化数据库

1. 在数据库详情页,点击 **Connect** 按钮
2. 选择 **External Connection** 标签
3. 复制 **PSQL Command**,格式类似:
   ```
   PGPASSWORD=xxx psql -h xxx.render.com -U dragon_game_user dragon_game
   ```
4. 在本地终端执行该命令连接到数据库
5. 执行数据库初始化脚本:
   ```sql
   -- 复制 database/schema_v2.sql 的内容并执行
   -- 然后复制 database/add_task_system.sql 的内容并执行
   ```

### 第四步: 部署 Web 服务

1. 返回 Render Dashboard,点击 **New +** 按钮
2. 选择 **Web Service**
3. 连接你的 GitHub 仓库:
   - 如果是首次使用,需要授权 Render 访问 GitHub
   - 选择 `SummonTheDragon` 仓库
4. 填写服务信息:
   - **Name**: `dragon-spin-game`
   - **Region**: 选择与数据库相同的区域
   - **Branch**: `main`
   - **Root Directory**: 留空(使用根目录)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: 选择 **Free** (每月 750 小时免费)

### 第五步: 配置环境变量

在 **Environment Variables** 部分,添加以下变量:

#### 必需变量:

```
NODE_ENV = production
PORT = 3000
HOST = 0.0.0.0
DATABASE_URL = [粘贴第二步复制的 Internal Database URL]
TELEGRAM_BOT_TOKEN = [你的 Bot Token]
TELEGRAM_BOT_USERNAME = [你的 Bot Username]
JWT_SECRET = [随机生成的密钥,例如: openssl rand -base64 32]
```

#### TRON 配置:

```
TRON_NETWORK = mainnet
TRON_API_URL = https://api.trongrid.io
TRON_API_KEY = [你的 TronGrid API Key,可选]
USDT_CONTRACT_ADDRESS = TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
PLATFORM_ADDRESS = [你的 TRON 钱包地址]
PLATFORM_PRIVATE_KEY = [你的 TRON 私钥]
```

#### 其他配置:

```
PAYMENT_AMOUNT = 10
PAYMENT_CONFIRMATIONS = 1
PAYMENT_TIMEOUT_MINUTES = 30
LARGE_PRIZE_THRESHOLD = 888
ADMIN_TELEGRAM_IDS = [你的 Telegram ID,多个用逗号分隔]
ALERT_TELEGRAM_CHAT_ID = [接收告警的 Chat ID,可选]
```

### 第六步: 部署

1. 点击 **Create Web Service**
2. Render 会自动:
   - 克隆你的 GitHub 仓库
   - 安装依赖 (`npm install`)
   - 构建项目 (`npm run build`)
   - 启动服务 (`npm start`)
3. 等待部署完成(首次部署约 3-5 分钟)
4. 部署成功后,会显示你的应用 URL,格式类似: `https://dragon-spin-game.onrender.com`

### 第七步: 配置 Telegram Bot

1. 复制你的 Render 应用 URL
2. 与 [@BotFather](https://t.me/BotFather) 对话
3. 发送命令:
   ```
   /setmenubutton
   ```
4. 选择你的机器人
5. 点击 **Configure Menu Button**
6. 设置 URL 为你的 Render URL:
   ```
   https://dragon-spin-game.onrender.com
   ```
7. 设置按钮文本(例如: "🎮 开始游戏")

### 第八步: 测试

1. 在 Telegram 中找到你的机器人
2. 点击 **开始** 或菜单按钮
3. 测试各项功能:
   - ✅ 抽奖转盘
   - ✅ 邀请好友
   - ✅ 任务系统
   - ✅ 能量条显示

---

## 📊 监控和日志

### 查看日志:

1. 在 Render Dashboard 中打开你的服务
2. 点击 **Logs** 标签
3. 实时查看服务器日志

### 查看数据库:

1. 打开数据库详情页
2. 点击 **Connect** → **External Connection**
3. 使用 PSQL 命令或 GUI 工具(如 DBeaver)连接

---

## 🔧 常见问题

### 1. 部署失败?

- 检查 Build Command 和 Start Command 是否正确
- 查看 Logs 中的错误信息
- 确认 `package.json` 中的 `engines` 字段指定了正确的 Node 版本

### 2. 数据库连接失败?

- 确认 `DATABASE_URL` 环境变量是否正确
- 使用 **Internal Database URL**(不是 External)
- 确保数据库和 Web 服务在同一区域

### 3. Telegram Bot 无法打开?

- 确认 Bot 菜单按钮的 URL 是否正确
- 检查 HTTPS 是否可访问
- 查看浏览器控制台是否有 CORS 错误

### 4. 免费额度限制?

- Web Service: 750 小时/月(足够 24/7 运行)
- PostgreSQL: 1GB 存储,可用于小型测试
- 如果服务 15 分钟无请求会自动休眠(下次请求时自动唤醒,约 30 秒)

---

## 🔄 更新部署

当你修改代码后,更新部署非常简单:

1. 推送代码到 GitHub:

   ```bash
   git add .
   git commit -m "Update features"
   git push origin main
   ```

2. Render 会自动检测到更改并重新部署(约 2-3 分钟)

或者手动触发部署:

1. 在 Render Dashboard 中打开你的服务
2. 点击右上角的 **Manual Deploy** → **Deploy latest commit**

---

## 💡 优化建议

### 1. 避免冷启动(推荐)

免费版服务会休眠,可以使用 **UptimeRobot** 或 **Cron-job.org** 每 10 分钟 ping 一次:

```
https://dragon-spin-game.onrender.com/api/user/balance
```

### 2. 启用自动部署

在 Render 服务设置中:

- **Settings** → **Build & Deploy**
- 确保 **Auto-Deploy** 为 **Yes**

### 3. 设置健康检查

在 Render 服务设置中:

- **Settings** → **Health Check Path**
- 设置为: `/api/user/balance`

---

## 📞 支持

如果遇到问题:

1. 查看 Render 官方文档: https://render.com/docs
2. 检查服务日志中的错误信息
3. 参考本项目的 GitHub Issues

---

**祝部署顺利! 🎉**
