# 抽奖功能修复说明

## 修复的问题

**问题**：数据库显示有 `available_spins = 10`，但前端提示"需要付费游玩才能抽奖"

**原因**：前端使用的是旧的抽奖API（`/api/spin`，需要 payment），而不是新的V2 API（`/api/spin/execute`，基于 `available_spins`）

## 已修改的内容

### 1. 前端抽奖逻辑 (`public/index.html`)

#### 修改前：

```javascript
// 检查未使用的支付
const paymentResponse = await fetch(`${API_BASE}/payment/unused`);
if (!paymentData.success || !paymentData.data) {
  alert("你需要先进行付费游玩才能抽奖！");
  return;
}

// 使用旧API
fetch(`${API_BASE}/spin`, {
  body: JSON.stringify({ paymentId, idempotencyKey }),
});
```

#### 修改后：

```javascript
// 检查可用抽奖次数
const availableResponse = await fetch(`${API_BASE}/spin/available`);
if (availableData.data.available_spins <= 0) {
  alert("你需要邀请好友或进行付费游玩来获得抽奖机会！");
  return;
}

// 使用新的V2 API（基于 available_spins）
fetch(`${API_BASE}/spin/execute`, {
  method: "POST",
});
```

### 2. 抽奖提示文字

**修改前**：`完成付费游玩即可抽奖！`  
**修改后**：`💡 邀请好友或付费游玩获得抽奖机会！`

## 抽奖逻辑说明

根据你的描述，当前的抽奖逻辑：

| 次数   | 获得方式     | 奖金     | 说明              |
| ------ | ------------ | -------- | ----------------- |
| 第1次  | 邀请 或 付费 | 88 USDT  | 任务1             |
| 第2次  | 邀请 或 付费 | 8 USDT   | 任务2             |
| 第3次  | 邀请 或 付费 | 3 USDT   | 任务3             |
| 第4次  | **仅付费**   | 0.7 USDT | 任务4（必须付费） |
| 第5次+ | 按原逻辑     | 变化     | 继续任务系统      |

### 如何获得抽奖次数

1. **邀请好友**（前3次）
   - 每邀请1个新用户 = 获得1次抽奖机会
   - `available_spins +1`
   - `spin_entitlements` 创建记录（source_type: 'invite'）

2. **付费游玩**（所有任务）
   - 每次付费10 USDT = 获得1次抽奖机会
   - `available_spins +1`
   - `spin_entitlements` 创建记录（source_type: 'payment'）

## 验证步骤

### 1. 检查数据库

```sql
-- 查看你的可抽奖次数
SELECT id, username, available_spins, total_invited
FROM users
WHERE invite_code = '你的邀请码';

-- 查看抽奖资格记录
SELECT * FROM spin_entitlements
WHERE user_id = '你的用户ID'
AND consumed = false
ORDER BY created_at;
```

### 2. 前端测试

1. **刷新页面**
   - 查看页面顶部：`🎲 可抽奖次数: 10`（应该显示你的实际次数）

2. **点击抽奖按钮**
   - 如果有次数：应该可以正常抽奖
   - 如果没有次数：提示"你需要邀请好友或进行付费游玩来获得抽奖机会！"

3. **抽奖后**
   - 转盘旋转
   - 显示中奖金额
   - `可抽奖次数` 减1
   - 能量条更新

## API端点对比

| 功能         | 旧API                          | 新API (V2)                              |
| ------------ | ------------------------------ | --------------------------------------- |
| 获取可用次数 | ❌ 无                          | ✅ `GET /api/spin/available`            |
| 执行抽奖     | `POST /api/spin` (需要payment) | ✅ `POST /api/spin/execute` (基于spins) |
| 解锁奖金     | ❌ 无                          | ✅ `POST /api/spin/unlock`              |

## 如果还是不能抽奖

### 检查清单

1. **检查 available_spins**

   ```sql
   SELECT available_spins FROM users WHERE id = '你的ID';
   ```

   - 如果是 0：需要邀请好友或付费
   - 如果 > 0：继续下面的检查

2. **检查 spin_entitlements**

   ```sql
   SELECT COUNT(*) FROM spin_entitlements
   WHERE user_id = '你的ID' AND consumed = false;
   ```

   - 如果是 0：数据不一致，需要修复
   - 如果 > 0：应该可以抽奖

3. **检查浏览器控制台**
   - 打开开发者工具 (F12)
   - 点击抽奖按钮
   - 查看 Console 是否有错误
   - 查看 Network 标签，确认 `/api/spin/execute` 请求状态

4. **检查后端日志**
   ```bash
   # 查看服务器日志
   # 应该能看到抽奖相关的日志
   ```

## 数据修复（如果需要）

如果 `available_spins` 和 `spin_entitlements` 不一致：

```sql
-- 方法1：根据 entitlements 更新 available_spins
UPDATE users
SET available_spins = (
    SELECT COUNT(*)
    FROM spin_entitlements
    WHERE user_id = users.id AND consumed = false
)
WHERE id = '你的用户ID';

-- 方法2：为现有的 available_spins 创建 entitlements
INSERT INTO spin_entitlements (user_id, source_type, source_id, consumed, created_at)
SELECT
    id,
    'manual_fix',
    NULL,
    false,
    NOW()
FROM users
WHERE id = '你的用户ID'
AND available_spins > 0;
```

## 测试场景

### 场景1：有抽奖次数

- **前提**：`available_spins = 10`
- **操作**：点击"立即抽奖"
- **预期**：
  1. 转盘开始旋转
  2. 4秒后停在奖金位置
  3. 显示"恭喜获得 ₹XX 卢比！"
  4. 可抽奖次数变为 9

### 场景2：没有抽奖次数

- **前提**：`available_spins = 0`
- **操作**：点击"立即抽奖"
- **预期**：
  1. 提示"你需要邀请好友或进行付费游玩来获得抽奖机会！"
  2. 不执行抽奖

### 场景3：邀请好友后

- **前提**：成功邀请1个新用户
- **操作**：查看页面
- **预期**：
  1. `可抽奖次数` 增加 1
  2. 邀请统计更新

## 总结

✅ **前端已修复**：使用新的 V2 抽奖API  
✅ **逻辑已更新**：基于 `available_spins` 而不是 `payment`  
✅ **提示已优化**：明确告知如何获得抽奖机会

现在你应该可以正常使用邀请获得的抽奖次数了！🎉

如果还有问题，请检查上面的"检查清单"或查看浏览器控制台的错误信息。
