import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { db } from '../database';

const router = Router();

// 开发者 Telegram ID 白名单（在环境变量中配置）
const DEV_TELEGRAM_IDS = (process.env.DEV_TELEGRAM_IDS || '').split(',').filter(Boolean);

// 开发者模式全局开关（从环境变量读取）
const DEV_MODE_FOR_ALL = process.env.DEV_MODE_FOR_ALL === 'true';

// 启动时输出调试信息
logger.info('🛠️ 开发者模式配置', { 
    env: process.env.DEV_TELEGRAM_IDS,
    parsed: DEV_TELEGRAM_IDS,
    count: DEV_TELEGRAM_IDS.length,
    devModeForAll: DEV_MODE_FOR_ALL,
    fromEnv: true
});

/**
 * 检查是否为开发者
 */
function isDevUser(telegramId: string): boolean {
    // 如果开启了全员开发者模式，所有人都是开发者
    if (DEV_MODE_FOR_ALL) {
        logger.info('✅ 开发者权限检查（全员模式）', { telegramId, isDev: true });
        return true;
    }
    
    const result = DEV_TELEGRAM_IDS.includes(telegramId);
    logger.info('开发者权限检查', { telegramId, whitelist: DEV_TELEGRAM_IDS, isDev: result });
    return result;
}

/**
 * POST /api/dev/grant-test-access
 * 授予测试权限：解锁所有功能
 */
router.post('/grant-test-access', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const telegramId = (req as any).user.telegramId;

        // 检查是否为开发者
        if (!isDevUser(telegramId.toString())) {
            return res.status(403).json({
                success: false,
                error: '无权限访问开发者功能',
            });
        }

        // 授予测试权限
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // 更新用户数据
            await client.query(`
                UPDATE users SET 
                    balance = 150,
                    available_spins = 10,
                    total_invited = 3,
                    updated_at = NOW()
                WHERE id = $1
            `, [userId]);
            
            // 直接创建10个抽奖资格（简单直接）
            for (let i = 0; i < 10; i++) {
                await client.query(`
                    INSERT INTO spin_entitlements (user_id, source_type, consumed, created_at)
                    VALUES ($1, 'dev_grant', false, NOW())
                `, [userId]);
            }
            
            await client.query('COMMIT');
            logger.info('✅ Dev test access granted with spin entitlements', { userId, telegramId });

            res.json({
                success: true,
                message: '✅ 测试权限已授予（包含10次抽奖机会）',
                data: {
                    balance: 150,
                    available_spins: 10,
                    total_invited: 3,
                },
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error: any) {
        logger.error('Grant test access error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/dev/add-spins
 * 快速添加抽奖次数（最简单直接的方式）
 */
router.post('/add-spins', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const telegramId = (req as any).user.telegramId;
        const { count = 1 } = req.body; // 默认添加1次

        if (!isDevUser(telegramId.toString())) {
            return res.status(403).json({
                success: false,
                error: '无权限访问开发者功能',
            });
        }

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            
            // 直接增加次数
            await client.query(`
                UPDATE users 
                SET available_spins = available_spins + $2,
                    updated_at = NOW()
                WHERE id = $1
            `, [userId, count]);
            
            // 创建对应的抽奖资格
            for (let i = 0; i < count; i++) {
                await client.query(`
                    INSERT INTO spin_entitlements (user_id, source_type, consumed, created_at)
                    VALUES ($1, 'dev_manual', false, NOW())
                `, [userId]);
            }
            
            await client.query('COMMIT');
            
            // 获取当前次数
            const result = await db.query(
                'SELECT available_spins FROM users WHERE id = $1',
                [userId]
            );
            
            logger.info('✅ Added spins via dev tool', { userId, count, newTotal: result.rows[0].available_spins });

            res.json({
                success: true,
                message: `✅ 已添加 ${count} 次抽奖机会`,
                data: {
                    added: count,
                    total: result.rows[0].available_spins,
                },
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error: any) {
        logger.error('Add spins error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/dev/reset-account
 * 重置账号为初始状态
 */
router.post('/reset-account', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const telegramId = (req as any).user.telegramId;

        if (!isDevUser(telegramId.toString())) {
            return res.status(403).json({
                success: false,
                error: '无权限访问开发者功能',
            });
        }

        // 重置账号
        await db.query(`
            UPDATE users SET 
                balance = 0,
                available_spins = 0,
                total_invited = 0,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

        logger.info('✅ Dev account reset', { userId, telegramId });

        res.json({
            success: true,
            message: '✅ 账号已重置为初始状态',
        });

    } catch (error: any) {
        logger.error('Reset account error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/dev/complete-all-tasks
 * 自动完成所有任务
 */
router.post('/complete-all-tasks', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const telegramId = (req as any).user.telegramId;

        if (!isDevUser(telegramId.toString())) {
            return res.status(403).json({
                success: false,
                error: '无权限访问开发者功能',
            });
        }

        // 任务系统可能不存在，先检查表是否存在
        const checkTableResult = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'tasks'
            );
        `);
        
        if (!checkTableResult.rows[0].exists) {
            return res.json({
                success: true,
                message: '✅ 任务系统尚未启用',
                data: { completedTasks: 0 },
            });
        }
        
        // 获取所有任务
        const tasksResult = await db.query('SELECT id FROM tasks WHERE is_active = true');
        
        // 标记所有任务为已完成
        for (const task of tasksResult.rows) {
            await db.query(`
                INSERT INTO user_tasks (user_id, task_id, status, completed_at)
                VALUES ($1, $2, 'completed', NOW())
                ON CONFLICT (user_id, task_id) 
                DO UPDATE SET status = 'completed', completed_at = NOW()
            `, [userId, task.id]);
        }

        logger.info('Dev all tasks completed', { userId, telegramId, taskCount: tasksResult.rows.length });

        res.json({
            success: true,
            message: `✅ 已完成 ${tasksResult.rows.length} 个任务`,
            data: {
                completedTasks: tasksResult.rows.length,
            },
        });

    } catch (error: any) {
        logger.error('Complete all tasks error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/dev/info
 * 获取开发者模式信息
 */
router.get('/info', authMiddleware, async (req: Request, res: Response) => {
    try {
        const telegramId = (req as any).user.telegramId;
        const isDev = isDevUser(telegramId.toString());

        res.json({
            success: true,
            data: {
                isDev,
                telegramId,
                devMode: isDev ? 'enabled' : 'disabled',
            },
        });

    } catch (error: any) {
        logger.error('Get dev info error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
