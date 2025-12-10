-- ============================================
-- 清理旧任务系统表
-- ============================================

-- 删除旧的任务相关表（如果存在）
DROP TABLE IF EXISTS user_task_progress CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS spin_entitlements CASCADE;

-- 保留的表：
-- ✓ users
-- ✓ payments
-- ✓ spins
-- ✓ invitations
-- ✓ user_task_progress_v2
-- ✓ task_completion_log

-- 清理完成
SELECT 'Old tables cleaned up successfully!' as message;
