# ⚡ 快速部署到 Render (5 分钟)

## 🚀 一键部署

### 步骤 1: 创建账号并连接 GitHub

1. 访问 https://render.com/
2. 点击 **Sign Up** 并使用 GitHub 登录
3. 授权 Render 访问你的仓库

### 步骤 2: 创建数据库 (2 分钟)

1. 点击 **New +** → **PostgreSQL**
2. 设置:
   - Name: `dragon-game-db`
   - Database: `dragon_game`
   - Region: **Singapore**
   - Plan: **Free**
3. 点击 **Create Database**
4. 🔴 **重要**: 复制 **Internal Database URL**

### 步骤 3: 部署服务 (3 分钟)

1. 点击 **New +** → **Web Service**
2. 选择仓库: `NatukiHw/SummonTheDragon`
3. 设置:
   - Name: `dragon-spin-game`
   - Region: **Singapore**
   - Runtime: **Node**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: **Free**
4. 添加环境变量(点击 **Add Environment Variable**):

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=[粘贴步骤2复制的Internal Database URL]
TELEGRAM_BOT_TOKEN=[从 @BotFather 获取]
TELEGRAM_BOT_USERNAME=[你的Bot用户名]
JWT_SECRET=[随机字符串,例如: abc123xyz789]
TRON_NETWORK=mainnet
TRON_API_URL=https://api.trongrid.io
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
PLATFORM_ADDRESS=[你的TRON钱包地址]
PLATFORM_PRIVATE_KEY=[你的TRON私钥]
```

5. 点击 **Create Web Service**

### 步骤 4: 配置 Telegram Bot

1. 部署完成后,复制你的 URL(例如: `https://dragon-spin-game.onrender.com`)
2. 与 @BotFather 对话:
   ```
   /setmenubutton
   ```
3. 选择你的机器人,设置按钮 URL 为你的 Render URL

### 步骤 5: 测试

打开 Telegram,点击机器人的菜单按钮开始游戏!

---

## 📋 需要准备的信息

### 必须配置:

- ✅ **TELEGRAM_BOT_TOKEN**: 从 [@BotFather](https://t.me/BotFather) 创建机器人获取
- ✅ **TELEGRAM_BOT_USERNAME**: 你的机器人用户名
- ✅ **DATABASE_URL**: Render 自动生成
- ✅ **JWT_SECRET**: 任意随机字符串

### 支付功能(可选):

- ⚠️ **PLATFORM_ADDRESS**: TRON 钱包地址
- ⚠️ **PLATFORM_PRIVATE_KEY**: TRON 钱包私钥

如果暂时不配置支付功能,游戏的抽奖、任务、邀请功能仍可正常使用。

---

## 🔧 常见问题

**Q: 首次访问很慢?**  
A: 免费版服务会休眠,首次访问需要 30 秒唤醒,之后就快了。

**Q: 如何查看日志?**  
A: 在 Render Dashboard → 你的服务 → **Logs** 标签

**Q: 如何更新代码?**  
A: 推送到 GitHub 后,Render 会自动重新部署:

```bash
git add .
git commit -m "update"
git push
```

**Q: 数据库连接失败?**  
A: 确保使用 **Internal Database URL**(不是 External),格式:

```
postgresql://dragon_game_user:xxx@xxx.internal/dragon_game
```

---

## 📊 部署后检查清单

- [ ] 服务状态为 **Live** (绿色)
- [ ] 数据库状态为 **Available** (绿色)
- [ ] 打开你的 URL 能看到游戏界面
- [ ] Telegram Bot 菜单按钮可以打开游戏
- [ ] 抽奖转盘可以正常使用
- [ ] 邀请功能可以复制链接
- [ ] 任务系统可以查看当前任务

---

**完整文档**: 查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 获取详细说明
