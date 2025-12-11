# 🛠️ 开发者模式使用指南

## 📋 功能说明

开发者模式让你可以快速测试所有功能，无需真实完成任务、邀请好友或付费游玩。

### 可用功能：

1. **⚡ 授予测试权限**
   - 自动设置余额为 150U
   - 添加 10 次抽奖记录
   - 添加 3 个邀请好友（2 个有效邀请）
   - 解锁提现功能
   - 方便测试提现流程和所有高级功能

2. **✅ 完成所有任务**
   - 自动完成数据库中所有可用任务
   - 无需手动点击每个任务
   - 快速查看任务系统的完整流程

3. **🔄 重置账号**
   - 清空所有数据（余额、抽奖记录、任务进度、邀请记录）
   - 恢复到初始状态
   - 方便重新测试完整流程

## 🔧 配置步骤

### 1. 获取你的 Telegram ID

有几种方式获取：

**方式 A：使用 @userinfobot**

1. 在 Telegram 搜索 `@userinfobot`
2. 发送 `/start`
3. 会返回你的 ID，例如：`123456789`

**方式 B：使用 @raw_data_bot**

1. 在 Telegram 搜索 `@raw_data_bot`
2. 发送任意消息
3. 在返回的数据中找到 `"id": 123456789`

**方式 C：通过浏览器开发者工具**

1. 在浏览器打开 Telegram Web
2. 打开开发者工具（F12）
3. 在 localStorage 中查找你的 ID

### 2. 配置环境变量

登录 [Railway Dashboard](https://railway.app/)：

1. 进入你的项目 `dragon-game`
2. 点击 Variables 标签
3. 添加新变量：
   ```
   变量名：DEV_TELEGRAM_IDS
   变量值：你的Telegram ID
   ```

**多个开发者示例：**

```
DEV_TELEGRAM_IDS=123456789,987654321,555666777
```

（用逗号分隔，不要有空格）

4. 点击 Save 保存
5. Railway 会自动重新部署

### 3. 验证配置

1. 在 Telegram 打开你的机器人 `@summondargon_bot`
2. 如果配置正确，你会在页面顶部看到 **🛠️ 开发者** 按钮
3. 如果没有看到：
   - 检查 Telegram ID 是否正确
   - 检查环境变量是否保存成功
   - 等待 Railway 完成部署（约 1-2 分钟）
   - 关闭并重新打开 Telegram 应用

## 📱 使用方法

### 打开开发者面板

1. 点击 **🛠️ 开发者** 按钮
2. 面板会显示你当前的账号状态：
   - 💰 余额
   - 🎲 抽奖次数
   - 👥 邀请人数
   - ✅ 提现资格

### 快速测试流程

**场景 1：测试完整游戏流程**

```
1. 点击 "⚡ 授予测试权限"
2. 页面刷新后查看效果
3. 测试抽奖、任务、邀请、提现等功能
4. 完成测试后点击 "🔄 重置账号"
```

**场景 2：测试任务系统**

```
1. 点击 "✅ 完成所有任务"
2. 查看任务列表（应该全部标记为已完成）
3. 检查余额是否增加
4. 测试任务完成后的 UI 变化
```

**场景 3：重新测试**

```
1. 点击 "🔄 重置账号"
2. 确认警告提示
3. 账号恢复到初始状态
4. 可以重新测试新用户体验
```

## ⚠️ 注意事项

### 安全提示

- ✅ **只在测试环境使用**：不要在生产环境给所有人开放
- ✅ **保护你的 Telegram ID**：不要泄露给其他人
- ✅ **定期检查白名单**：移除不再需要的 ID
- ❌ **不要在公开仓库提交真实 ID**：使用 .env 文件

### 使用限制

- 开发者功能只对白名单用户可见
- 非白名单用户访问开发者 API 会返回 403 错误
- 重置账号操作不可恢复，请谨慎使用

### 数据说明

开发者模式**只修改以下字段**：

- `game_balance` - 余额
- `total_spins` - 抽奖次数
- `win_count` - 中奖次数
- `total_invites` - 邀请人数
- `valid_invites` - 有效邀请数
- `withdrawal_eligible` - 提现资格
- `user_tasks` 表 - 任务完成状态

**不会修改**：

- 用户基本信息（用户名、Telegram ID 等）
- 支付记录
- 提现记录

## 🐛 故障排查

### 问题：看不到开发者按钮

**解决方案：**

1. 确认 Telegram ID 配置正确
2. 检查 Railway 环境变量：

   ```bash
   # 正确格式
   DEV_TELEGRAM_IDS=123456789

   # 错误格式（有引号）
   DEV_TELEGRAM_IDS="123456789"  ❌

   # 错误格式（有空格）
   DEV_TELEGRAM_IDS=123, 456, 789  ❌
   ```

3. 查看 Railway 部署日志，确认没有错误
4. 清除浏览器缓存，重新打开机器人

### 问题：点击按钮没有反应

**解决方案：**

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签是否有错误
3. 检查 Network 标签，查看 API 请求是否成功
4. 如果返回 403，说明 ID 未在白名单中
5. 如果返回 500，查看 Railway 日志

### 问题：授予权限后余额没变化

**解决方案：**

1. 确认操作成功（应该有成功提示）
2. 刷新页面（页面会自动刷新）
3. 检查 Railway 数据库日志
4. 确认没有其他错误

## 📊 开发者 API 文档

### 检查开发者权限

```http
GET /api/dev/info
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "isDev": true,
    "telegramId": "123456789",
    "devMode": "enabled"
  }
}
```

### 授予测试权限

```http
POST /api/dev/grant-test-access
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "✅ 测试权限已授予",
  "data": {
    "game_balance": 150,
    "total_spins": 10,
    "win_count": 5,
    "total_invites": 3,
    "valid_invites": 2,
    "withdrawal_eligible": true
  }
}
```

### 完成所有任务

```http
POST /api/dev/complete-all-tasks
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "✅ 已完成 9 个任务",
  "data": {
    "completedTasks": 9
  }
}
```

### 重置账号

```http
POST /api/dev/reset-account
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "✅ 账号已重置为初始状态"
}
```

## 💡 高级用法

### 添加临时测试账号

如果需要临时给其他人测试权限：

1. 获取他们的 Telegram ID
2. 在 Railway 环境变量中添加：
   ```
   DEV_TELEGRAM_IDS=你的ID,他们的ID
   ```
3. 测试完成后移除他们的 ID
4. 保存并重新部署

### 自定义测试数据

如果需要自定义测试数据，修改 `src/routes/dev.routes.ts`：

```typescript
// 授予测试权限时的数据
await db.query(
  `
    UPDATE users SET 
        game_balance = 150,    // 修改这里的值
        total_spins = 10,      // 修改这里的值
        win_count = 5,
        total_invites = 3,
        valid_invites = 2,
        withdrawal_eligible = true,
        updated_at = NOW()
    WHERE id = $1
`,
  [userId]
);
```

## 🎓 最佳实践

1. **测试前先重置**：确保干净的测试环境
2. **记录测试步骤**：方便复现问题
3. **测试完整流程**：不要只测试单个功能
4. **检查数据一致性**：确保余额、任务等数据正确
5. **测试边界情况**：尝试异常操作，确保系统稳定

## 📝 相关文档

- [主文档](./README.md)
- [部署指南](./DEPLOYMENT.md)
- [快速开始](./QUICKSTART.md)
- [Telegram 认证修复](./TELEGRAM_AUTH_FIX.md)

---

**享受开发测试！** 如有问题，请查看 Railway 日志或联系开发团队。
