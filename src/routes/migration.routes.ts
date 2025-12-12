import { Router, Request, Response } from 'express';
import { db } from '../database';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/admin/migrate-first-play
 * 执行数据库迁移：添加first_play到source_type约束
 * 只有开发者可以执行
 */
router.post('/migrate-first-play', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        
        // 检查是否是开发者
        const user = await db.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
        const isDev = process.env.DEVELOPER_IDS?.split(',').includes(user.rows[0]?.telegram_id?.toString());
        
        if (!isDev) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        logger.info('🔄 开始数据库迁移：添加first_play到source_type约束', { userId });

        // 删除旧约束
        await db.query(`
            ALTER TABLE spin_entitlements 
            DROP CONSTRAINT IF EXISTS spin_entitlements_source_type_check;
        `);
        logger.info('✅ 已删除旧约束');

        // 添加新约束
        await db.query(`
            ALTER TABLE spin_entitlements 
            ADD CONSTRAINT spin_entitlements_source_type_check 
            CHECK (source_type IN ('invite', 'paid_game', 'first_play', 'manual', 'bonus'));
        `);
        logger.info('✅ 已添加新约束（包含 first_play）');

        // 验证约束
        const result = await db.query(`
            SELECT constraint_name, check_clause 
            FROM information_schema.check_constraints 
            WHERE constraint_name = 'spin_entitlements_source_type_check';
        `);

        logger.info('🎉 迁移成功！', result.rows[0]);

        res.json({
            success: true,
            data: {
                message: '数据库迁移成功',
                constraint: result.rows[0]
            }
        });

    } catch (error: any) {
        logger.error('❌ 数据库迁移失败', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
