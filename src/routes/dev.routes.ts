import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { db } from '../database';

const router = Router();

// 开发者 Telegram ID 白名单（在环境变量中配置）
const DEV_TELEGRAM_IDS = (process.env.DEV_TELEGRAM_IDS || '').split(',').filter(Boolean);

// ⚠️ 临时开关：设为 true 则所有用户都是开发者（仅用于内部测试）
const DEV_MODE_FOR_ALL = process.env.DEV_MODE_FOR_ALL === 'true';

// 启动时输出调试信息
logger.info('开发者模式配置', { 
    env: process.env.DEV_TELEGRAM_IDS,
    parsed: DEV_TELEGRAM_IDS,
    count: DEV_TELEGRAM_IDS.length,
    devModeForAll: DEV_MODE_FOR_ALL 
});

/**
 * 检查是否为开发者
 */
function isDevUser(telegramId: string): boolean {
    // 如果开启了全员开发者模式，所有人都是开发者
    if (DEV_MODE_FOR_ALL) {
        logger.info('开发者权限检查（全员模式）', { telegramId, isDev: true });
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
        await db.query(`
            UPDATE users SET 
                game_balance = 150,
                total_spins = 10,
                win_count = 5,
                total_invites = 3,
                valid_invites = 2,
                withdrawal_eligible = true,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

        logger.info('Dev test access granted', { userId, telegramId });

        res.json({
            success: true,
            message: '✅ 测试权限已授予',
            data: {
                game_balance: 150,
                total_spins: 10,
                win_count: 5,
                total_invites: 3,
                valid_invites: 2,
                withdrawal_eligible: true,
            },
        });

    } catch (error: any) {
        logger.error('Grant test access error', { error: error.message });
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
                game_balance = 0,
                total_spins = 0,
                win_count = 0,
                total_invites = 0,
                valid_invites = 0,
                withdrawal_eligible = false,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

        logger.info('Dev account reset', { userId, telegramId });

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
