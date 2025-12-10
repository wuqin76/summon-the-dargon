-- ============================================
-- 任务系统 V2 - 简化版本
-- 每次只显示当前任务，不暴露奖励数值
-- ============================================

-- 用户任务进度表 V2
CREATE TABLE IF NOT EXISTS user_task_progress_v2 (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- 当前任务索引 (0-25)
    task_index INTEGER DEFAULT 0 NOT NULL CHECK (task_index >= 0 AND task_index <= 25),
    
    -- 当前任务进度
    progress INTEGER DEFAULT 0 NOT NULL CHECK (progress >= 0),
    
    -- 累计获得的能量值
    total_progress DECIMAL(18, 6) DEFAULT 0 NOT NULL CHECK (total_progress >= 0),
    
    -- 已完成的任务数
    completed_tasks INTEGER DEFAULT 0 NOT NULL CHECK (completed_tasks >= 0 AND completed_tasks <= 26),
    
    -- 付费游玩计数（用于追踪付费任务）
    paid_game_count INTEGER DEFAULT 0 NOT NULL,
    
    -- 邀请好友计数（用于追踪邀请任务）
    invite_count INTEGER DEFAULT 0 NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_task_progress_v2_user_id ON user_task_progress_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_user_task_progress_v2_task_index ON user_task_progress_v2(task_index);

-- 任务完成记录表
CREATE TABLE IF NOT EXISTS task_completion_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 任务索引
    task_index INTEGER NOT NULL,
    
    -- 任务类型
    task_type VARCHAR(50) NOT NULL,
    
    -- 完成方式 (spin/paid_game/invite)
    completion_method VARCHAR(50) NOT NULL,
    
    -- 获得的奖励
    reward DECIMAL(18, 6) NOT NULL,
    
    -- 完成前后的能量值
    balance_before DECIMAL(18, 6) NOT NULL,
    balance_after DECIMAL(18, 6) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_task_completion_log_user_id ON task_completion_log(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_created_at ON task_completion_log(created_at DESC);

-- 更新时间戳函数
CREATE OR REPLACE FUNCTION update_task_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_task_progress_v2_timestamp ON user_task_progress_v2;
CREATE TRIGGER trigger_update_task_progress_v2_timestamp
    BEFORE UPDATE ON user_task_progress_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_task_progress_timestamp();

-- 初始化现有用户的任务进度
INSERT INTO user_task_progress_v2 (user_id, task_index, progress, total_progress, completed_tasks)
SELECT 
    id,
    0,  -- 从任务0开始
    0,  -- 进度为0
    balance,  -- 将现有余额作为total_progress
    0   -- 已完成任务数为0
FROM users
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE user_task_progress_v2 IS '用户任务进度表V2 - 简化版本，每次只显示当前任务';
COMMENT ON COLUMN user_task_progress_v2.task_index IS '当前任务索引 (0=初始抽奖, 1-25=普通任务)';
COMMENT ON COLUMN user_task_progress_v2.progress IS '当前任务的进度';
COMMENT ON COLUMN user_task_progress_v2.total_progress IS '累计获得的能量值';
COMMENT ON COLUMN user_task_progress_v2.completed_tasks IS '已完成的任务总数';

COMMENT ON TABLE task_completion_log IS '任务完成记录表 - 用于审计和统计';
