-- 添加FendPay相关字段到game_sessions表
-- 执行时间：2024-12-13

-- 添加字段用于存储FendPay订单号
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS fendpay_order_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);

-- 添加索引加速查询
CREATE INDEX IF NOT EXISTS idx_game_sessions_external_order_id 
ON game_sessions(external_order_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_fendpay_order_no 
ON game_sessions(fendpay_order_no);

-- 添加注释
COMMENT ON COLUMN game_sessions.fendpay_order_no IS 'FendPay平台订单号';
COMMENT ON COLUMN game_sessions.external_order_id IS '商户订单号（传给FendPay的outTradeNo）';
