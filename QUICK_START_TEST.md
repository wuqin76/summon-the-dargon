# 🎯 超简单测试指南

## 第一步：设置环境变量（30秒）

1. 打开 Railway 控制台
2. 选择你的项目
3. 点击 **Variables**
4. 添加变量：
   ```
   SKIP_TELEGRAM_VERIFICATION=true
   ```
5. 点击保存

**Railway 会自动重新部署，等待 1-2 分钟。**

---

## 第二步：开始测试（1分钟）

### 🎲 方法1：快速添加抽奖次数（推荐）

1. 打开 Telegram Bot
2. 点击右上角 **"🛠️ 开发者"** 按钮
3. 点击 **"🎲 快速添加1次抽奖"** 按钮
4. 看到提示 "✅ 已添加 1 次抽奖机会！"
5. 关闭弹窗
6. 点击 **"🎲 立即抽奖 🎲"**
7. 转盘转动 → 显示中奖

**完成！就这么简单！**

### ⚡ 方法2：获得10次测试权限

1. 点击 **"⚡ 授予测试权限"**
2. 获得 10 次抽奖机会
3. 开始连续抽奖测试

---

## 第三步：测试邀请功能（可选）

1. 点击 **"👥 邀请好友"**
2. 复制邀请链接
3. 用另一个 Telegram 账号打开链接
4. 回到原账号查看
5. **"可抽奖次数"** 应该 +1

---

## 🚨 如果还是不工作

### 检查1：确认环境变量

Railway Variables 里面应该有：

```
SKIP_TELEGRAM_VERIFICATION=true
```

### 检查2：刷新应用

在 Telegram 中：

- 完全关闭 Mini App
- 重新打开 Bot
- 再次启动应用

### 检查3：查看日志

Railway Dashboard → Settings → Logs

应该看到：

```
[AUTH] 跳过 Telegram 验证 - 开发者模式
```

### 检查4：数据库查询

```sql
-- 查看你的抽奖次数
SELECT username, available_spins FROM users WHERE telegram_id = '你的ID';

-- 查看抽奖资格
SELECT COUNT(*) FROM spin_entitlements WHERE consumed = false;
```

---

## 📊 API 接口说明

| 接口                              | 功能         | 说明       |
| --------------------------------- | ------------ | ---------- |
| `POST /api/dev/add-spins`         | 添加1次抽奖  | 最快最简单 |
| `POST /api/dev/grant-test-access` | 添加10次抽奖 | 完整测试   |
| `GET /api/spin/available`         | 查看可用次数 | 实时显示   |
| `POST /api/spin/execute`          | 执行抽奖     | 真正抽奖   |
| `POST /api/invite/use`            | 使用邀请码   | 邀请注册   |

---

## ✨ 完整流程图

```
打开 Telegram Bot
    ↓
点击"开发者"按钮
    ↓
点击"快速添加1次抽奖"
    ↓
看到"已添加1次" ← 这里很关键！
    ↓
点击"立即抽奖"
    ↓
转盘转动
    ↓
显示中奖
    ↓
抽奖次数 -1
    ↓
完成！
```

---

## 🎓 技术说明

### 为什么需要跳过验证？

Telegram Mini App 使用 HMAC-SHA256 验证：

```
calculatedHash = HMAC(data, HMAC(BOT_TOKEN, "WebAppData"))
```

如果 `BOT_TOKEN` 有问题，验证会失败（401错误）。

通过设置 `SKIP_TELEGRAM_VERIFICATION=true`，在测试环境跳过这个验证，直接进入功能测试。

### 代码修改

1. **后端**：`auth.middleware.ts` 增加跳过逻辑
2. **后端**：`dev.routes.ts` 新增 `/add-spins` 接口
3. **前端**：`index.html` 新增快速添加按钮

---

## 📝 开发进度

- ✅ 邀请功能测试（12个测试通过）
- ✅ 前端显示抽奖次数
- ✅ 简化开发者工具
- ✅ 跳过 Telegram 验证
- ✅ 快速添加抽奖按钮
- ⏳ 完整流程测试（等待环境变量设置）

---

**现在就去 Railway 设置环境变量，1分钟后开始测试！**
