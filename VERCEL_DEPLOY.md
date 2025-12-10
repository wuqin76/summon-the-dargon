# Vercel 部署指南

## 📋 前置条件

1. GitHub 账号（已有）
2. Vercel 账号（用 GitHub 登录）
3. Railway 数据库连接字符串（已配置）

## 🚀 部署步骤

### 1. 注册并登录 Vercel

1. 访问 https://vercel.com
2. 点击 **Sign Up** → 选择 **Continue with GitHub**
3. 授权 Vercel 访问你的 GitHub 账号

### 2. 导入项目

1. 在 Vercel 控制台点击 **Add New...** → **Project**
2. 找到并选择 `summon-the-dargon` 仓库
3. 点击 **Import**

### 3. 配置项目

在 **Configure Project** 页面：

#### Build & Development Settings

- **Framework Preset**: Other
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### Environment Variables

点击 **Environment Variables**，添加以下变量：

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:rZRhUCiZwNxPPgzalXHntwdDWwcVbgSn@trolley.proxy.rlwy.net:30119/railway
TELEGRAM_BOT_TOKEN=你的Bot Token
TELEGRAM_BOT_USERNAME=summondargon_bot
JWT_SECRET=8f3a9b2c1d5e6f7a8b9c0d1e2f3a4b5c
TRON_NETWORK=mainnet
TRON_API_URL=https://api.trongrid.io
USDT_CONTRACT_ADDRESS=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

**重要**：

- `DATABASE_URL` 使用 Railway 的公共连接字符串
- `TELEGRAM_BOT_TOKEN` 使用你的 Bot Token

### 4. 部署

点击 **Deploy** 按钮，等待部署完成（约 2-3 分钟）。

### 5. 获取部署 URL

部署成功后，Vercel 会提供一个 URL，例如：

```
https://summon-the-dargon.vercel.app
```

### 6. 配置 Telegram Bot

在 @BotFather 中设置菜单按钮：

```
/setmenubutton
选择: summondargon_bot
按钮文字: 🎮 开始游戏
URL: https://你的Vercel域名
```

## 🔧 常见问题

### 部署失败

- 检查构建日志，确认所有依赖正确安装
- 确认环境变量已正确设置

### 数据库连接失败

- 确认 `DATABASE_URL` 使用的是公共连接字符串（包含 `trolley.proxy.rlwy.net`）
- 检查密码是否正确（区分大小写）

### 页面 404

- 确认 `vercel.json` 配置正确
- 检查静态文件路径是否正确

## 📝 后续维护

每次代码更新后：

```bash
git add .
git commit -m "更新说明"
git push origin main
```

Vercel 会自动检测并重新部署。

## 🌐 自定义域名（可选）

在 Vercel 项目设置中可以添加自定义域名。
