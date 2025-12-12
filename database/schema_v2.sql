-- ============================================
-- Dragon Spin Game - Database Schema V2
-- 新需求：第三方支付 + 邀请抽奖 + 任务系统
-- PostgreSQL 12+
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'en',
    
    -- 邀请码相关
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- 余额（单位：USDT）
    balance DECIMAL(18, 6) DEFAULT 0 NOT NULL CHECK (balance >= 0),
    locked_balance DECIMAL(18, 6) DEFAULT 0 NOT NULL CHECK (locked_balance >= 0),
    
    -- 可用抽奖次数
    available_spins INTEGER DEFAULT 0 NOT NULL CHECK (available_spins >= 0),
    
    -- 统计数据
    total_invited INTEGER DEFAULT 0 NOT NULL,
    total_paid_plays INTEGER DEFAULT 0 NOT NULL,
    total_free_plays INTEGER DEFAULT 0 NOT NULL,
    
    -- 是否被封禁
    is_banned BOOLEAN DEFAULT false NOT NULL,
    ban_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_balance_total CHECK (balance + locked_balance >= 0)
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_invite_code ON users(invite_code);
CREATE INDEX idx_users_invited_by ON users(invited_by);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- 第三方支付记录表（移除链上字段）
-- ============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 第三方支付信息
    provider_name VARCHAR(100) NOT NULL DEFAULT 'external_api',
    provider_tx_id VARCHAR(255) UNIQUE NOT NULL,  -- 第三方交易ID（幂等key）
    provider_order_id VARCHAR(255),                -- 第三方订单ID
    
    -- 金额
    amount DECIMAL(18, 6) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'USDT' NOT NULL,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- pending: 等待支付
    -- success: 支付成功
    -- failed: 支付失败
    -- expired: 已过期
    
    -- 是否已使用（用于游戏）
    used BOOLEAN DEFAULT false NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- 原始回调数据
    callback_payload JSONB,
    
    -- 签名验证
    signature VARCHAR(255),
    signature_verified BOOLEAN DEFAULT false,
    
    -- IP 记录（风控）
    user_ip VARCHAR(45),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chk_used_at CHECK (NOT used OR used_at IS NOT NULL)
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_provider_tx_id ON payments(provider_tx_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_used ON payments(used);

-- ============================================
-- 邀请记录表（增强版，记录被邀请者行为）
-- ============================================
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- 被邀请者信息
    invitee_telegram_id BIGINT,
    invitee_username VARCHAR(255),
    invitee_first_name VARCHAR(255),
    
    -- 邀请码
    invite_code VARCHAR(20) NOT NULL,
    
    -- 被邀请者行为追踪（用于风控和任务判定）
    registered BOOLEAN DEFAULT false NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE,
    
    played_free BOOLEAN DEFAULT false NOT NULL,
    first_free_play_at TIMESTAMP WITH TIME ZONE,
    
    played_paid BOOLEAN DEFAULT false NOT NULL,
    first_paid_play_at TIMESTAMP WITH TIME ZONE,
    
    has_invited_others BOOLEAN DEFAULT false NOT NULL,
    first_invite_at TIMESTAMP WITH TIME ZONE,
    
    has_spun BOOLEAN DEFAULT false NOT NULL,
    first_spin_at TIMESTAMP WITH TIME ZONE,
    
    -- 奖励发放
    reward_issued BOOLEAN DEFAULT false NOT NULL,
    reward_issued_at TIMESTAMP WITH TIME ZONE,
    
    -- IP 地址（风控：检测同IP多账号）
    invitee_ip VARCHAR(45),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_registered CHECK (NOT registered OR registered_at IS NOT NULL)
);

CREATE INDEX idx_invitations_inviter ON invitations(inviter_id);
CREATE INDEX idx_invitations_invitee ON invitations(invitee_id);
CREATE INDEX idx_invitations_code ON invitations(invite_code);
CREATE INDEX idx_invitations_registered ON invitations(registered);
CREATE INDEX idx_invitations_played_paid ON invitations(played_paid);

-- ============================================
-- 抽奖资格表（spin entitlements）
-- ============================================
CREATE TABLE spin_entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 来源类型
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('invite', 'paid_game', 'first_play', 'manual', 'bonus')),
    -- invite: 邀请好友获得
    -- paid_game: 付费游戏通关获得
    -- first_play: 首次游玩获得
    -- manual: 管理员手动发放
    -- bonus: 活动奖励等
    
    -- 来源关联ID
    source_id UUID,  -- 关联 invitations.id 或 payments.id
    
    -- 是否已消耗
    consumed BOOLEAN DEFAULT false NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_consumed CHECK (NOT consumed OR consumed_at IS NOT NULL)
);

CREATE INDEX idx_spin_entitlements_user_id ON spin_entitlements(user_id);
CREATE INDEX idx_spin_entitlements_consumed ON spin_entitlements(consumed);
CREATE INDEX idx_spin_entitlements_source ON spin_entitlements(source_type, source_id);

-- ============================================
-- 转盘抽奖记录表（只有88 USDT可中奖）
-- ============================================
CREATE TABLE spins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entitlement_id UUID REFERENCES spin_entitlements(id) ON DELETE SET NULL,
    
    -- 抽奖结果（固定88 USDT）
    prize_amount DECIMAL(18, 6) NOT NULL DEFAULT 88.000000,
    prize_type VARCHAR(20) DEFAULT 'cash' NOT NULL,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- pending: 待抽奖
    -- completed: 已完成
    -- locked: 已中奖但锁定（需完成任务）
    -- unlocked: 已解锁可提现
    
    -- 是否需要完成任务才能提现
    requires_tasks BOOLEAN DEFAULT true NOT NULL,
    tasks_completed BOOLEAN DEFAULT false NOT NULL,
    tasks_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- 风控标记
    requires_manual_review BOOLEAN DEFAULT false NOT NULL,
    reviewed BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_spins_user_id ON spins(user_id);
CREATE INDEX idx_spins_status ON spins(status);
CREATE INDEX idx_spins_created_at ON spins(created_at);
CREATE INDEX idx_spins_requires_review ON spins(requires_manual_review) WHERE requires_manual_review = true;

-- ============================================
-- 任务定义表
-- ============================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_key VARCHAR(100) UNIQUE NOT NULL,
    
    -- 任务阶段
    stage INTEGER NOT NULL CHECK (stage > 0),
    
    -- 任务描述
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- 任务目标
    target_type VARCHAR(50) NOT NULL,
    -- invite_count: 邀请人数
    -- paid_play_count: 付费游玩次数
    -- custom: 自定义
    
    target_value INTEGER NOT NULL CHECK (target_value > 0),
    
    -- 是否启用
    is_active BOOLEAN DEFAULT true NOT NULL,
    
    -- 排序
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认任务
INSERT INTO tasks (task_key, stage, title, description, target_type, target_value, sort_order) VALUES
('invite_3', 1, '邀请3位好友', '邀请3位好友进入游戏', 'invite_count', 3, 1),
('paid_play_1', 2, '完成1次付费游玩', '至少完成1次付费游戏', 'paid_play_count', 1, 2),
('invite_20', 3, '邀请20位好友', '邀请20位好友进入游戏', 'invite_count', 20, 3);

-- ============================================
-- 用户任务进度表
-- ============================================
CREATE TABLE user_task_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- 当前进度
    progress INTEGER DEFAULT 0 NOT NULL CHECK (progress >= 0),
    
    -- 是否完成
    completed BOOLEAN DEFAULT false NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_completed CHECK (NOT completed OR completed_at IS NOT NULL),
    CONSTRAINT unique_user_task UNIQUE(user_id, task_id)
);

CREATE INDEX idx_user_task_progress_user_id ON user_task_progress(user_id);
CREATE INDEX idx_user_task_progress_task_id ON user_task_progress(task_id);
CREATE INDEX idx_user_task_progress_completed ON user_task_progress(completed);

-- ============================================
-- 游戏记录表
-- ============================================
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    
    -- 游戏模式
    game_mode VARCHAR(20) NOT NULL CHECK (game_mode IN ('free', 'paid')),
    
    -- 游戏结果
    completed BOOLEAN DEFAULT false NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- 游戏时长（秒）
    duration_seconds INTEGER,
    
    -- 是否获得抽奖资格
    earned_spin BOOLEAN DEFAULT false NOT NULL,
    spin_entitlement_id UUID REFERENCES spin_entitlements(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX idx_game_sessions_mode ON game_sessions(game_mode);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at);

-- ============================================
-- 提现请求表
-- ============================================
CREATE TABLE payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spin_id UUID REFERENCES spins(id) ON DELETE SET NULL,
    
    -- 提现金额
    amount DECIMAL(18, 6) NOT NULL CHECK (amount > 0),
    fee DECIMAL(18, 6) DEFAULT 0 NOT NULL CHECK (fee >= 0),
    net_amount DECIMAL(18, 6) NOT NULL CHECK (net_amount > 0),
    
    -- 提现地址（可以是钱包地址、银行卡等）
    withdrawal_method VARCHAR(50) NOT NULL,
    withdrawal_address TEXT NOT NULL,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- pending: 待审核
    -- approved: 已批准
    -- processing: 处理中
    -- completed: 已完成
    -- rejected: 已拒绝
    -- failed: 失败
    
    -- 审核信息
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- 交易哈希（如果有）
    tx_hash VARCHAR(255),
    
    -- 拒绝原因
    reject_reason TEXT,
    
    -- 备注
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
CREATE INDEX idx_payout_requests_created_at ON payout_requests(created_at);

-- ============================================
-- 余额变动记录表
-- ============================================
CREATE TABLE balance_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 变动类型
    change_type VARCHAR(50) NOT NULL,
    -- spin_win: 抽奖获得
    -- payout: 提现
    -- refund: 退款
    -- bonus: 奖金
    -- lock: 锁定
    -- unlock: 解锁
    -- admin_adjust: 管理员调整
    
    -- 变动金额（正数为增加，负数为减少）
    amount DECIMAL(18, 6) NOT NULL,
    
    -- 变动前后余额
    balance_before DECIMAL(18, 6) NOT NULL,
    balance_after DECIMAL(18, 6) NOT NULL,
    
    -- 关联ID
    reference_type VARCHAR(50),  -- spins, payout_requests, etc.
    reference_id UUID,
    
    -- 备注
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_balance_changes_user_id ON balance_changes(user_id);
CREATE INDEX idx_balance_changes_type ON balance_changes(change_type);
CREATE INDEX idx_balance_changes_created_at ON balance_changes(created_at);

-- ============================================
-- 审计日志表
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 操作者
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(20) DEFAULT 'user',  -- user, admin, system
    
    -- 操作类型
    action VARCHAR(100) NOT NULL,
    
    -- 目标
    target_type VARCHAR(50),
    target_id UUID,
    
    -- IP 地址
    ip_address VARCHAR(45),
    
    -- 详细信息
    details JSONB,
    
    -- 结果
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- 创建更新时间戳触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 应用触发器到需要的表
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_task_progress_updated_at BEFORE UPDATE ON user_task_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON payout_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 创建视图：用户邀请统计（用于后台和任务判定）
-- ============================================
CREATE VIEW v_user_invite_stats AS
SELECT 
    u.id as user_id,
    u.telegram_id,
    u.username,
    COUNT(i.id) as total_invites,
    COUNT(i.id) FILTER (WHERE i.registered = true) as registered_invites,
    COUNT(i.id) FILTER (WHERE i.played_paid = true) as paid_invites,
    COUNT(i.id) FILTER (WHERE i.has_invited_others = true) as recursive_invites,
    COUNT(i.id) FILTER (WHERE i.has_spun = true) as spun_invites
FROM users u
LEFT JOIN invitations i ON u.id = i.inviter_id
GROUP BY u.id, u.telegram_id, u.username;

-- ============================================
-- 创建视图：用户任务完成情况
-- ============================================
CREATE VIEW v_user_task_status AS
SELECT 
    u.id as user_id,
    u.telegram_id,
    u.username,
    t.task_key,
    t.stage,
    t.title,
    t.target_value,
    COALESCE(utp.progress, 0) as current_progress,
    COALESCE(utp.completed, false) as is_completed,
    utp.completed_at
FROM users u
CROSS JOIN tasks t
LEFT JOIN user_task_progress utp ON u.id = utp.user_id AND t.id = utp.task_id
WHERE t.is_active = true
ORDER BY u.id, t.stage, t.sort_order;

-- ============================================
-- 插入系统管理员用户（可选）
-- ============================================
-- INSERT INTO users (telegram_id, username, first_name, invite_code) 
-- VALUES (0, 'system', 'System Admin', 'ADMIN000')
-- ON CONFLICT DO NOTHING;

COMMIT;
