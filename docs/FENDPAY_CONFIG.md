# FendPay集成配置指南

## 必需的环境变量

在Railway中配置以下环境变量：

### 1. FendPay支付配置

```bash
FENDPAY_MERCHANT_NUMBER=2020213
FENDPAY_SECRET=2296917a15d04199a142aa493d27d172
FENDPAY_API_BASE_URL=https://kspay.shop
```

### 2. 应用基础配置

```bash
BASE_URL=https://dragon-spin-game-production.up.railway.app
```

### 3. Telegram WebApp配置

```bash
TELEGRAM_WEBAPP_URL=https://t.me/summondragon_bot/dragongame
```

## 环境变量检查清单

✅ 在Railway项目中检查以下环境变量是否已设置：

1. 打开Railway项目
2. 点击你的服务
3. 切换到 **Variables** 标签
4. 确认以下变量存在且值正确：
   - `FENDPAY_MERCHANT_NUMBER` = `2020213`
   - `FENDPAY_SECRET` = `2296917a15d04199a142aa493d27d172`
   - `FENDPAY_API_BASE_URL` = `https://kspay.shop`
   - `BASE_URL` = `https://dragon-spin-game-production.up.railway.app`
   - `TELEGRAM_WEBAPP_URL` = `https://t.me/summondragon_bot/dragongame`

## 常见错误排查

### 🔴 错误码 10004: "channel error please connect custom service"

**诊断结果（从日志）：**

```
✅ 环境变量配置正确
✅ 签名生成正确
❌ FendPay返回 code: 10004
```

**根本原因（需联系FendPay确认）：**

1. ⚠️ **支付通道未开通**（最可能）
   - 商户号 2020213 的代收通道可能未激活
   - 需要在FendPay商户后台开通

2. 💰 **金额限制**
   - 当前测试金额：10 INR
   - FendPay可能要求最小金额（如100或1000 INR）

3. 🔧 **商户状态**
   - 账户可能需要完成KYC认证
   - 商户类型配置可能不正确

**🚨 必须采取的行动：**

**立即联系FendPay客服：**

- 登录: https://fend.kspay.shop
- 商户号: `2020213`
- 询问内容:
  1. ✅ 代收支付通道是否已开通？
  2. ✅ 支付金额限制范围（最小/最大）？
  3. ✅ 账户状态是否正常？需要什么认证？
  4. ✅ 错误码10004的具体含义？

**临时解决：**

- 等待FendPay确认通道状态
- 根据反馈调整支付金额
- 完成必要的商户认证

### "FendPay支付服务未配置"

**原因：** 环境变量未设置

**解决方法：**

1. 在Railway添加所有必需的环境变量
2. 重新部署服务

## 调试步骤

1. **查看服务器日志**

   ```bash
   # Railway会显示详细的FendPay请求/响应日志
   ```

2. **检查日志关键信息**
   - `FendPay服务初始化` - 确认配置已加载
   - `准备调用FendPay API` - 查看请求参数
   - `FendPay创建订单响应` - 查看返回的错误码和消息

3. **验证签名**
   - 日志会显示签名字符串（隐藏密钥）
   - 确认参数排序正确
   - 确认金额格式为两位小数

## 测试支付流程

1. 确认环境变量已设置
2. 重新部署Railway服务
3. 打开Telegram游戏
4. 完成第一次免费游玩
5. 第二次进入会提示支付
6. 点击付费游玩
7. 查看Railway日志中的详细信息

## 联系FendPay客服

如果配置正确但仍有问题，可能需要联系FendPay确认：

- 商户账号状态
- 支付通道是否开通
- 是否有金额限制
- API访问权限

商户号：`2020213`
