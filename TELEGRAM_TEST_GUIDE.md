# Telegram Bot 测试指南

## ⚠️ 重要提示

**你必须在真实的 Telegram 环境中打开应用,不能直接在浏览器中访问!**

在浏览器中直接访问会显示 401 错误,这是正常的,因为:

1. 浏览器无法提供 Telegram 的 `initData`
2. 应用需要 Telegram 提供的用户身份信息
3. 所有 API 调用都需要通过 Telegram 验证

---

## 📱 正确的测试步骤

### 1️⃣ 打开 Telegram Bot

1. 打开 **Telegram** 应用(手机版或桌面版)
2. 搜索你的 Bot: `@summondargon_bot`
3. 点击 **开始(Start)** 按钮

### 2️⃣ 打开 Web App

有两种方式:

**方式 A: 通过菜单按钮**

- 在聊天界面底部,点击 **菜单按钮** (三条横线图标)
- 应用会在 Telegram 内置浏览器中打开

**方式 B: 通过命令**

- 发送 `/start` 命令
- Bot 会回复一个按钮,点击按钮打开应用

---

## 🧪 测试功能清单

### ✅ 基础功能

- [ ] 应用正常加载,显示转盘
- [ ] 显示用户余额 (默认 0)
- [ ] 显示邀请进度 (0/1000)

### ✅ 邀请功能

1. 点击 **"邀请好友"** 按钮
2. 生成邀请链接
3. 分享给朋友
4. 朋友点击链接并打开 Bot
5. 你获得 **1 次免费抽奖机会**
6. 朋友也获得欢迎奖励

### ✅ 抽奖功能

1. 点击 **"立即抽奖"** 按钮
2. 转盘旋转
3. 显示中奖金额
4. 余额自动增加

### ✅ 任务系统

1. 点击 **"提升进度"** 区域
2. 查看可用任务列表
3. 完成任务(如关注频道)
4. 获得能量值和奖励

---

## 🔍 常见问题排查

### 问题 1: 点击邀请按钮没有反应

**原因**: API 返回 401 错误

**解决方案**:

1. 确认你是在 **Telegram 内** 打开的应用,不是浏览器
2. 尝试关闭应用重新打开
3. 发送 `/start` 命令重新初始化

**检查日志**:

```
2025-12-10 14:00:29 [info]: Incoming request {"method":"GET","path":"/api/invite/info","ip":"100.64.0.4"}
```

如果看到 401 错误:

```
POST /api/auth/login 401
```

这意味着 Telegram 验证失败。

---

### 问题 2: 显示 "Telegram data verification failed"

**原因**: Telegram 数据验证失败

**可能的原因**:

1. **时间戳过期**: Telegram 数据有效期只有 5 分钟
   - 解决方案: 关闭应用重新打开

2. **Hash 不匹配**: Bot Token 配置错误
   - 检查环境变量 `TELEGRAM_BOT_TOKEN` 是否正确

3. **在浏览器中打开**: 没有 Telegram 环境
   - 必须在 Telegram 内打开

---

### 问题 3: 邀请链接无效

**检查邀请链接格式**:

```
https://t.me/summondargon_bot?start=invite_XXXXXX
```

**确认**:

- 链接包含 `?start=invite_` 前缀
- 邀请码是 10 位字符

**测试步骤**:

1. 用另一个 Telegram 账号
2. 点击邀请链接
3. 打开 Bot
4. 检查原账号是否获得抽奖机会

---

## 📊 监控和日志

### 查看实时日志

在 Railway 控制台:

```
Settings → Deployments → 选择最新部署 → View Logs
```

### 正常的日志输出

```
✅ 用户登录成功:
2025-12-10 14:00:55 [info]: Incoming request {"method":"POST","path":"/api/auth/login","ip":"100.64.0.5"}

✅ 获取邀请信息:
2025-12-10 14:00:29 [info]: Incoming request {"method":"GET","path":"/api/invite/info","ip":"100.64.0.4"}

✅ 接受邀请:
2025-12-10 14:01:00 [info]: Incoming request {"method":"POST","path":"/api/invite/accept","ip":"100.64.0.5"}
```

### 异常日志

```
❌ 验证失败:
2025-12-10 13:59:55 [warn]: Telegram data verification failed - hash mismatch

❌ Token 无效:
GET /api/user/balance 401
```

---

## 🚀 完整测试流程

### 第 1 步: 主账号测试

1. 打开 Telegram
2. 搜索 `@summondargon_bot`
3. 点击 Start
4. 点击菜单按钮打开应用
5. 检查应用是否正常显示

### 第 2 步: 生成邀请链接

1. 点击 **"邀请好友"** 按钮
2. 复制邀请链接
3. 发送到另一个设备或账号

### 第 3 步: 测试邀请功能

1. 用另一个 Telegram 账号
2. 点击邀请链接
3. 打开 Bot
4. 点击 Start
5. 打开应用

### 第 4 步: 验证奖励

1. 回到主账号
2. 刷新应用
3. 检查是否获得 1 次抽奖机会
4. 点击 **"立即抽奖"**
5. 验证抽奖功能

---

## 🔧 调试技巧

### 在 Telegram 桌面版调试

1. 右键点击应用页面
2. 选择 **"检查元素"** (Inspect Element)
3. 打开开发者工具
4. 查看 Console 日志

### 查看 API 请求

在开发者工具的 **Network** 标签:

1. 刷新应用
2. 查看所有 API 请求
3. 检查响应状态码
4. 查看错误信息

### 使用 Telegram 测试环境

创建测试 Bot (可选):

1. 与 @BotFather 对话
2. 发送 `/newbot` 创建测试 Bot
3. 获取测试 Token
4. 在 Railway 添加测试环境变量

---

## 📞 获取支持

如果遇到问题:

1. **检查日志**: Railway Dashboard → View Logs
2. **查看错误代码**:
   - 401: 认证失败
   - 404: 路径不存在
   - 500: 服务器错误

3. **常见解决方案**:
   - 重新部署: `railway up`
   - 重启服务: Railway Dashboard → Redeploy
   - 检查环境变量: Railway Dashboard → Variables

---

## ✅ 测试完成检查清单

- [ ] 在 Telegram 内成功打开应用
- [ ] 显示用户信息和余额
- [ ] 邀请按钮正常工作
- [ ] 生成邀请链接成功
- [ ] 新用户通过邀请链接注册
- [ ] 邀请人获得奖励
- [ ] 抽奖功能正常
- [ ] 任务系统显示
- [ ] 没有 401/500 错误

---

## 🎯 下一步

测试成功后:

1. ✅ 推广你的 Bot
2. ✅ 监控用户增长
3. ✅ 优化邀请奖励
4. ✅ 添加更多任务
5. ✅ 集成支付功能

祝你成功! 🎉
