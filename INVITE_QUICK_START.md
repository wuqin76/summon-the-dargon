# 邀请功能快速验证指南 🚀

## 验证邀请功能是否正常工作

### 方法1：查看代码（已完成✅）

邀请功能的核心代码在：

- **后端**：`src/routes/invite.routes.ts` - `handleInviteRegistration()` 函数
- **前端**：`public/index.html` - 显示可抽奖次数

### 方法2：运行测试

```bash
# 1. 安装依赖（如果还没安装）
npm install

# 2. 运行邀请功能测试
npm test tests/invite.test.ts

# 3. 查看测试结果
# 如果全部通过，说明邀请功能正常 ✅
```

### 方法3：开发者模式测试（推荐）

在Telegram中打开应用，使用开发者模式：

1. **打开应用**
   - 在Telegram中打开你的机器人应用

2. **启用开发者模式**
   - 点击页面上的"🛠️ 开发者"按钮（仅开发者可见）
   - 点击"⚡ 授予测试权限"

3. **验证可抽奖次数显示**
   - 页面顶部应该显示：`🎲 可抽奖次数: X`
   - X应该是一个数字（0或更多）

4. **测试邀请功能**
   - 点击"👥 邀请好友"按钮
   - 分享邀请链接给测试账号
   - 让测试账号通过链接进入
   - 返回查看你的"可抽奖次数"是否增加了1

### 方法4：数据库直接验证

如果你有数据库访问权限：

```sql
-- 1. 查看用户的可抽奖次数
SELECT id, username, available_spins, total_invited
FROM users
WHERE telegram_id = YOUR_TELEGRAM_ID;

-- 2. 查看邀请记录
SELECT * FROM invitations
WHERE inviter_id = 'YOUR_USER_ID';

-- 3. 查看抽奖资格
SELECT * FROM spin_entitlements
WHERE user_id = 'YOUR_USER_ID'
AND source_type = 'invite';
```

## 期望行为

### 当有人通过你的邀请链接注册时：

1. **数据库变化**：
   - `users.available_spins` +1（你的抽奖次数增加）
   - `users.total_invited` +1（你的邀请总数增加）
   - `invitations` 表新增一条记录
   - `spin_entitlements` 表新增一条记录（source_type='invite'）

2. **前端显示**：
   - 页面顶部的"🎲 可抽奖次数"数字增加
   - 邀请弹窗中的"总邀请数"增加
   - 邀请弹窗中的"邀请奖励"增加

3. **用户体验**：
   - 你现在可以进行一次抽奖
   - 抽奖后，可抽奖次数减1

## 快速验证流程图

```
[打开应用]
    ↓
[查看页面顶部] → 看到 "🎲 可抽奖次数: 0"
    ↓
[点击邀请好友]
    ↓
[复制邀请链接]
    ↓
[测试账号点击链接进入应用]
    ↓
[返回原账号刷新页面]
    ↓
[查看页面顶部] → 看到 "🎲 可抽奖次数: 1" ✅
```

## 常见问题排查

### Q1: 页面不显示可抽奖次数

**检查**：

- 打开浏览器开发者工具（F12）
- 查看Console有无错误
- 检查Network标签，确认 `/api/spin/available` 请求成功

**解决**：

```javascript
// 手动调用加载函数
await loadAvailableSpins();
```

### Q2: 邀请后次数没增加

**检查**：

- 确认被邀请人是新用户（未被邀请过）
- 确认被邀请人不是你自己
- 查看服务器日志有无错误

**验证**：

```bash
# 查看服务器日志
# 应该能看到 "[Invite] User XXX earned spin from invite YYY"
```

### Q3: 测试失败

**可能原因**：

- 数据库连接问题
- 测试数据库未正确设置
- 环境变量缺失

**解决**：

```bash
# 设置测试数据库
export TEST_DATABASE_URL="postgresql://localhost:5432/test_db"

# 重新运行测试
npm test tests/invite.test.ts
```

## 成功标志 ✅

如果以下全部满足，说明邀请功能正常：

- ✅ 页面显示"可抽奖次数"
- ✅ 邀请好友后次数增加
- ✅ 抽奖后次数减少
- ✅ 测试全部通过
- ✅ 数据库记录正确

## 需要帮助？

查看详细文档：

- 测试文档：`tests/README.md`
- 完整报告：`INVITE_FEATURE_REPORT.md`
- 邀请路由：`src/routes/invite.routes.ts`
