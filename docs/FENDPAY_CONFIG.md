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

### "channel error please connect custom service"

**原因：**

- 商户号错误或未配置
- 支付通道未开通
- 金额超出限制
- 签名验证失败

**解决方法：**

1. 检查 `FENDPAY_MERCHANT_NUMBER` 是否为 `2020213`
2. 检查 `FENDPAY_SECRET` 是否正确
3. 确认FendPay账户状态是否正常
4. 查看服务器日志中的详细错误信息

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
