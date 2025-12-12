-- 添加 first_play 到 spin_entitlements 的 source_type 约束
-- 执行时间：2025-12-12

BEGIN;

-- 删除旧的约束
ALTER TABLE spin_entitlements 
DROP CONSTRAINT IF EXISTS spin_entitlements_source_type_check;

-- 添加新的约束（包含 first_play）
ALTER TABLE spin_entitlements 
ADD CONSTRAINT spin_entitlements_source_type_check 
CHECK (source_type IN ('invite', 'paid_game', 'first_play', 'manual', 'bonus'));

-- 验证约束
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'spin_entitlements_source_type_check';

COMMIT;
