-- 添加付费游玩机会字段
-- 用户支付后获得1次游玩机会，可以随时使用

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS paid_play_tickets INTEGER DEFAULT 0 NOT NULL CHECK (paid_play_tickets >= 0);

COMMENT ON COLUMN users.paid_play_tickets IS '付费游玩机会数量（支付成功后立即获得，随时可用）';

-- 为现有用户设置默认值（如果需要）
UPDATE users SET paid_play_tickets = 0 WHERE paid_play_tickets IS NULL;

-- 创建索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_users_paid_play_tickets ON users(paid_play_tickets) WHERE paid_play_tickets > 0;
