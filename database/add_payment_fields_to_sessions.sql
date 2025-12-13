-- 添加支付相关字段到 game_sessions 表
-- 执行时间：2024-12-13

-- 添加支付状态字段
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired'));

-- 添加外部订单ID字段（商户订单号）
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);

-- 添加FendPay平台订单号字段（如果不存在）
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS fendpay_order_no VARCHAR(100);

-- 添加索引加速查询
CREATE INDEX IF NOT EXISTS idx_game_sessions_external_order_id 
ON game_sessions(external_order_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_fendpay_order_no 
ON game_sessions(fendpay_order_no);

CREATE INDEX IF NOT EXISTS idx_game_sessions_payment_status 
ON game_sessions(payment_status);

-- 添加注释
COMMENT ON COLUMN game_sessions.payment_status IS '支付状态: pending=待支付, paid=已支付, failed=失败, expired=过期';
COMMENT ON COLUMN game_sessions.external_order_id IS '商户订单号（传给FendPay的outTradeNo）';
COMMENT ON COLUMN game_sessions.fendpay_order_no IS 'FendPay平台订单号';
