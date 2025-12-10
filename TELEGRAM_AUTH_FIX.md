# Telegram 认证失败修复指南

## 问题诊断

根据日志显示：

```
Telegram data verification failed - hash mismatch
```

这表示 **Bot Token 配置错误或不匹配**。

## 原因分析

Telegram Web App 使用 Bot Token 来验证数据的真实性。当 hash 不匹配时，说明：

1. 环境变量中的 `TELEGRAM_BOT_TOKEN` 与实际使用的 Bot Token 不一致
2. Bot Token 可能包含额外的空格或换行符
3. Bot Token 可能配置错误

## 解决方案

### 方案 1：正确配置 Bot Token（推荐）

1. **获取正确的 Bot Token**
   - 打开 Telegram，找到 [@BotFather](https://t.me/BotFather)
   - 发送 `/mybots` 查看你的 bot 列表
   - 选择你的 bot (summondargon_bot)
   - 点击 "API Token" 查看或重新生成 Token
   - Token 格式类似：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

2. **在 Railway 上配置环境变量**
   - 登录 [Railway](https://railway.app)
   - 找到你的项目
   - 进入 "Variables" 选项卡
   - 找到 `TELEGRAM_BOT_TOKEN` 变量
   - 确保值**完全匹配** BotFather 给你的 Token
   - **注意**：不要有多余的空格或换行符
   - 保存后需要重新部署

3. **验证配置**
   ```bash
   # 在 Railway 日志中应该看到：
   Verifying with bot token starting with: 1234567890
   ```

### 方案 2：临时跳过验证（仅用于测试）

⚠️ **警告**：此方法会降低安全性，仅用于调试！

在 Railway 环境变量中添加：

```
SKIP_TELEGRAM_VERIFICATION=true
```

这将允许在验证失败时仍然允许登录（但会记录警告日志）。

**重要**：测试完成后请立即移除此变量！

## 验证步骤

配置完成后：

1. 重新部署应用
2. 在 Telegram 中打开你的 bot
3. 点击"邀请好友"按钮
4. 检查 Railway 日志：
   - 应该看到：`Verifying with bot token starting with: [你的token前缀]`
   - 应该**不再**看到：`hash mismatch` 错误

## 常见问题

### Q: 如何确认 Bot Token 是否正确？

A: 在终端运行：

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

如果返回 bot 信息，说明 Token 正确。

### Q: 我确定 Token 正确但还是失败？

A: 可能的原因：

1. Token 中包含隐藏字符（复制粘贴时带入）
2. 环境变量设置后没有重新部署
3. 使用了错误的 bot（如果你有多个 bot）

### Q: 为什么会出现 hash mismatch？

A: Telegram 使用以下流程验证数据：

```
secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
hash = HMAC-SHA256(data_check_string, secret_key)
```

如果服务器端的 BOT_TOKEN 与客户端使用的不一致，计算出的 hash 就会不匹配。

## 下一步

完成修复后，请：

1. 测试邀请功能是否正常
2. 测试其他需要认证的功能（余额查询、抽奖等）
3. 如果使用了 `SKIP_TELEGRAM_VERIFICATION=true`，记得删除它
4. 监控日志确保没有其他认证错误

## 需要帮助？

如果问题仍未解决，请提供：

1. Railway 日志中的完整错误信息
2. Bot Token 的前10个字符（用于验证格式）
3. 是否能访问 BotFather 并确认 bot 状态
