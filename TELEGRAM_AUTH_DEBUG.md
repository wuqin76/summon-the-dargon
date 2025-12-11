# 登录401问题诊断与解决方案

## 🔴 当前问题

```
❌ /api/auth/login 返回 401
原因：verifyTelegramWebAppData() 验证失败
```

## 🔍 问题定位

从代码 `auth.middleware.ts:65-73` 看到，验证失败原因可能是：

### 1. Bot Token 不匹配

```typescript
if (calculatedHash !== hash) {
  logger.warn("Telegram data verification failed - hash mismatch");
  return null; // 返回401
}
```

### 2. 时间戳过期（>5分钟）

```typescript
if (timeDiff > 300) {
  // 5分钟
  logger.warn("expired");
  return null;
}
```

## ✅ 快速解决方案

### 方案1：检查环境变量（最可能）

Railway 后台检查：

1. 进入 `dragon-spin-game-production` 服务
2. 点击 `Variables` 标签
3. 检查 `TELEGRAM_BOT_TOKEN` 的值

**正确格式**：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

**常见错误**：

- ❌ 前后有空格
- ❌ 复制了两次
- ❌ 少复制了一部分
- ❌ 用的是测试 bot 的 token

### 方案2：临时跳过验证（仅用于调试）

在 Railway 添加环境变量：

```
SKIP_TELEGRAM_VERIFICATION=true
```

**警告**：⚠️ 这会跳过所有安全验证，**仅用于测试**，生产环境必须删除！

### 方案3：修改验证逻辑（推荐）

延长时间戳有效期（从5分钟改为30分钟）：

```typescript
// 修改 auth.middleware.ts 第99行
if (timeDiff > 1800) { // 从 300 改为 1800（30分钟）
```

### 方案4：添加详细日志

查看 Railway 日志定位具体原因：

```bash
railway logs --service dragon-spin-game-production
```

查找关键信息：

- `Telegram data verification failed`
- `hash mismatch`
- `expired`
- `Verifying with bot token starting with`

## 🚀 立即行动步骤

### Step 1：验证 Bot Token

```bash
# 1. 获取正确的 Bot Token
# 打开 Telegram，找到 @BotFather
# 发送 /mybots
# 选择你的 bot
# 点击 API Token

# 2. 在 Railway 更新
# Variables > TELEGRAM_BOT_TOKEN > 粘贴新值 > 保存
```

### Step 2：重启服务

```bash
# Railway 会自动重启，或手动触发：
railway up
```

### Step 3：清除浏览器缓存

```javascript
// 在浏览器控制台执行：
localStorage.clear();
location.reload();
```

## 🔧 我帮你快速修复

需要我做什么？（选一个）

**A. 添加更详细的日志**

- 在 `auth.middleware.ts` 中添加完整的调试信息
- 提交并推送
- 你查看 Railway 日志告诉我具体错误

**B. 延长时间戳有效期**

- 从 5分钟 改为 30分钟
- 提交并推送

**C. 添加开发模式绕过**

- 检测开发者账号自动跳过验证
- 仅对特定 telegram_id 生效

**D. 检查配置并给出诊断命令**

- 提供完整的检查脚本
- 你运行后告诉我结果

选择 A/B/C/D，我立即处理。

## 📝 为什么开发者功能显示正常但登录失败？

```javascript
// 第2628行：使用旧token检查开发者权限
const savedToken = localStorage.getItem("authToken");
if (savedToken && savedToken !== "dev-token") {
  authToken = savedToken; // 使用旧token
  await checkDevAccess(); // ✅ 成功（旧token还有效）
}

// 第2601行：尝试新登录
await login(); // ❌ 失败（新initData验证失败）
```

**结论**：旧 token 还在有效期内（JWT默认24小时），所以开发者检查通过。但新登录因为 Telegram initData 验证失败而401。

## 💡 根本原因

**不是开发顺序问题，是环境配置问题！**

一个人开发很正常会遇到这种环境不一致的问题。建议：

1. ✅ 用 `.env.example` 模板
2. ✅ 写部署文档记录所有环境变量
3. ✅ 本地和生产用同一个 bot（或明确区分）
4. ✅ 添加健康检查端点验证配置

选择你需要的方案，我马上帮你修复！
