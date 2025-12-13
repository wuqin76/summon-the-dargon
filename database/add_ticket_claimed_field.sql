-- 添加ticket_claimed字段到game_sessions表，用于标记游玩机会是否已领取（幂等性控制）
-- 创建时间: 2025-12-13

-- 添加字段（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'ticket_claimed'
    ) THEN
        ALTER TABLE game_sessions 
        ADD COLUMN ticket_claimed BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'ticket_claimed字段已添加到game_sessions表';
    ELSE
        RAISE NOTICE 'ticket_claimed字段已存在';
    END IF;
END $$;

-- 为已存在的已支付订单标记为已领取（避免重复领取）
UPDATE game_sessions 
SET ticket_claimed = TRUE 
WHERE payment_status = 'paid' 
AND ticket_claimed IS NULL;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_game_sessions_ticket_claimed 
ON game_sessions(ticket_claimed) 
WHERE payment_status = 'paid';
