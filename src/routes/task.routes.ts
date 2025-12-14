/**
 * Task Routes - 任务系统相关接口
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 任务奖励配置 - 24个任务，每个完成后抽奖必中对应金额
export const TASK_REWARDS = [
    9900,    // 任务1: 进入游戏玩一把 (首次必中9900)
    99,      // 任务2: 邀请好友 或 付费游玩一局
    0.5,     // 任务3: 邀请好友 或 付费游玩一局
    0.4,     // 任务4: 邀请好友 或 付费游玩一局
    0.05,    // 任务5: 必须付费游玩一局
    0.04,    // 任务6: 邀请好友 或 付费游玩一局
    0.001,   // 任务7: 必须付费游玩一局
    0.001,   // 任务8: 邀请好友 或 付费游玩一局
    0.001,   // 任务9: 邀请好友 或 付费游玩一局
    0.001,   // 任务10: 邀请好友 或 付费游玩一局
    0.001,   // 任务11: 必须付费游玩一局
    0.001,   // 任务12: 邀请好友 或 付费游玩一局
    0.0005,  // 任务13: 邀请好友 或 付费游玩一局
    0.0005,  // 任务14: 邀请好友 或 付费游玩一局
    0.0005,  // 任务15: 必须付费游玩一局
    0.0005,  // 任务16: 邀请好友 或 付费游玩一局
    0.0002,  // 任务17: 邀请好友 或 付费游玩一局
    0.0002,  // 任务18: 邀请好友 或 付费游玩一局
    0.0002,  // 任务19: 必须付费游玩一局
    0.0002,  // 任务20: 邀请好友 或 付费游玩一局
    0.0001,  // 任务21: 邀请好友 或 付费游玩一局
    0.0001,  // 任务22: 邀请好友 或 付费游玩一局
    0.0005,  // 任务23: 必须付费游玩一局
    0.0005   // 任务24: 必须付费游玩一局
];

// 任务类型
enum TaskType {
    INITIAL_SPIN = 'initial_spin',      // 初始抽奖
    PAID_GAME = 'paid_game',            // 必须付费游玩
    INVITE_OR_GAME = 'invite_or_game'   // 邀请好友或付费游玩
}

// 任务配置 - 24个任务
const TASK_CONFIG = [
    { index: 0, type: TaskType.INITIAL_SPIN, required: 1, mandatory: false },    // 任务1: 首次游玩
    { index: 1, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务2: 邀请或付费
    { index: 2, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务3: 邀请或付费
    { index: 3, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务4: 邀请或付费
    { index: 4, type: TaskType.PAID_GAME, required: 1, mandatory: true },        // 任务5: 必须付费
    { index: 5, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务6: 邀请或付费
    { index: 6, type: TaskType.PAID_GAME, required: 1, mandatory: true },        // 任务7: 必须付费
    { index: 7, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务8
    { index: 8, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务9
    { index: 9, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false },  // 任务10
    { index: 10, type: TaskType.PAID_GAME, required: 1, mandatory: true },       // 任务11: 必须付费
    { index: 11, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务12
    { index: 12, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务13
    { index: 13, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务14
    { index: 14, type: TaskType.PAID_GAME, required: 1, mandatory: true },       // 任务15: 必须付费
    { index: 15, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务16
    { index: 16, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务17
    { index: 17, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务18
    { index: 18, type: TaskType.PAID_GAME, required: 1, mandatory: true },       // 任务19: 必须付费
    { index: 19, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务20
    { index: 20, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务21
    { index: 21, type: TaskType.INVITE_OR_GAME, required: 1, mandatory: false }, // 任务22
    { index: 22, type: TaskType.PAID_GAME, required: 1, mandatory: true },       // 任务23: 必须付费
    { index: 23, type: TaskType.PAID_GAME, required: 1, mandatory: true }        // 任务24: 必须付费
];

/**
 * 获取当前任务
 * GET /api/task/current
 */
router.get('/current', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: '未授权'
        });
    }

    try {
        // 获取用户任务进度
        const progressResult = await pool.query(`
            SELECT task_index, progress, total_progress, completed_tasks
            FROM user_task_progress_v2
            WHERE user_id = $1
        `, [userId]);

        let taskIndex = 0;
        let progress = 0;
        let totalProgress = 0;
        let completedTasks = 0;

        if (progressResult.rows.length > 0) {
            const userProgress = progressResult.rows[0];
            taskIndex = userProgress.task_index;
            progress = userProgress.progress;
            totalProgress = parseFloat(userProgress.total_progress);
            completedTasks = userProgress.completed_tasks;
        }

        // 获取当前任务配置
        const currentTask = TASK_CONFIG[taskIndex] || TASK_CONFIG[0];

        res.json({
            success: true,
            data: {
                task_index: taskIndex,
                task_type: currentTask.type,
                progress: progress,
                required: currentTask.required,
                total_progress: totalProgress,
                completed_tasks: completedTasks,
                is_mandatory: currentTask.mandatory
            }
        });
    } catch (error) {
        console.error('获取当前任务错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 获取用户任务列表和进度（已废弃 - 旧任务系统）
 * GET /api/tasks
 */
router.get('/', async (_req: Request, res: Response) => {
    // 旧任务系统已移除，返回空数据保持兼容
    res.json({
        success: true,
        data: {
            tasks_by_stage: {},
            all_tasks: []
        }
    });
});

/**
 * 更新任务进度 V2（简化版）
 */
export async function updateTaskProgressV2(
    userId: string,
    completionMethod: 'spin' | 'paid_game' | 'invite',
    client?: any
): Promise<{ success: boolean; reward?: number; newTaskIndex?: number }> {
    const db = client || pool;

    try {
        // 获取用户当前任务进度
        const progressResult = await db.query(`
            SELECT task_index, progress, total_progress, completed_tasks
            FROM user_task_progress_v2
            WHERE user_id = $1
        `, [userId]);

        let taskIndex = 0;
        let progress = 0;
        let totalProgress = 0;
        let completedTasks = 0;

        if (progressResult.rows.length === 0) {
            // 创建新记录
            await db.query(`
                INSERT INTO user_task_progress_v2 (user_id, task_index, progress, total_progress, completed_tasks)
                VALUES ($1, 0, 0, 0, 0)
            `, [userId]);
        } else {
            const userProgress = progressResult.rows[0];
            taskIndex = userProgress.task_index;
            progress = userProgress.progress;
            totalProgress = parseFloat(userProgress.total_progress);
            completedTasks = userProgress.completed_tasks;
        }

        // 获取当前任务配置
        if (taskIndex >= TASK_CONFIG.length) {
            console.log('[TaskV2] All tasks completed');
            return { success: false };
        }

        const currentTask = TASK_CONFIG[taskIndex];

        // 检查完成方式是否符合任务要求
        let canComplete = false;
        if (currentTask.type === TaskType.INITIAL_SPIN) {
            // 任务1：首次游玩 - 只要抽奖就算完成（不管是通过什么方式获得的抽奖机会）
            canComplete = (completionMethod === 'spin' || completionMethod === 'paid_game');
        } else if (currentTask.type === TaskType.PAID_GAME && completionMethod === 'paid_game') {
            canComplete = true;
        } else if (currentTask.type === TaskType.INVITE_OR_GAME && 
                  (completionMethod === 'invite' || completionMethod === 'paid_game')) {
            canComplete = true;
        }

        if (!canComplete) {
            console.log(`[TaskV2] Cannot complete task ${taskIndex} with method ${completionMethod}`);
            return { success: false };
        }

        // 增加进度
        progress += 1;

        // 检查任务是否完成
        if (progress >= currentTask.required) {
            // 任务完成，发放奖励
            const reward = TASK_REWARDS[taskIndex];
            const newTotalProgress = totalProgress + (reward > 0 ? reward : 0);
            const newCompletedTasks = completedTasks + 1;
            const newTaskIndex = taskIndex + 1;

            // 如果奖励是-1,表示给抽奖机会而不是直接加余额
            if (reward === -1) {
                // 给用户增加抽奖次数
                await db.query(`
                    UPDATE users
                    SET available_spins = available_spins + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [userId]);
            } else {
                // 直接更新用户余额
                await db.query(`
                    UPDATE users
                    SET balance = balance + $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [reward, userId]);
            }

            // 更新任务进度
            await db.query(`
                UPDATE user_task_progress_v2
                SET task_index = $1,
                    progress = 0,
                    total_progress = $2,
                    completed_tasks = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $4
            `, [newTaskIndex, newTotalProgress, newCompletedTasks, userId]);

            // 记录任务完成日志
            await db.query(`
                INSERT INTO task_completion_log (
                    user_id, task_index, task_type, completion_method,
                    reward, balance_before, balance_after
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [userId, taskIndex, currentTask.type, completionMethod, reward, totalProgress, newTotalProgress]);

            console.log(`[TaskV2] Task ${taskIndex} completed! Reward: ${reward}, New task: ${newTaskIndex}`);

            return {
                success: true,
                reward: reward,
                newTaskIndex: newTaskIndex
            };
        } else {
            // 任务未完成，只更新进度
            await db.query(`
                UPDATE user_task_progress_v2
                SET progress = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2
            `, [progress, userId]);

            console.log(`[TaskV2] Task ${taskIndex} progress: ${progress}/${currentTask.required}`);

            return { success: true };
        }

    } catch (error) {
        console.error('[TaskV2] Update error:', error);
        throw error;
    }
}

/**
 * 旧任务进度更新函数（已废弃，保留用于向后兼容）
 * @deprecated 请使用 updateTaskProgressV2
 */
export async function updateTaskProgress(
    _userId: string,
    _taskKey: string,
    _increment: number = 1,
    _client?: any
): Promise<void> {
    // 旧任务系统已移除，此函数为空实现保持兼容
    return;
}

/**
 * 检查用户是否完成了所有任务
 */
export async function checkAllTasksCompleted(userId: string, client?: any): Promise<boolean> {
    const db = client || pool;

    try {
        const result = await db.query(`
            SELECT COUNT(*) as incomplete_count
            FROM tasks t
            LEFT JOIN user_task_progress utp 
                ON t.id = utp.task_id AND utp.user_id = $1
            WHERE t.is_active = true 
                AND (utp.completed IS NULL OR utp.completed = false)
        `, [userId]);

        return parseInt(result.rows[0].incomplete_count) === 0;

    } catch (error) {
        console.error('[Tasks] Check completion error:', error);
        return false;
    }
}

/**
 * 获取任务完成统计（旧API，已废弃）
 * GET /api/tasks/stats
 * @deprecated 使用 GET /api/task/current 替代
 */
router.get('/stats', async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: '未授权'
        });
    }

    // 返回空数据，保持向后兼容
    res.json({
        success: true,
        data: {
            total: 0,
            completed: 0,
            incomplete: 0,
            all_completed: false,
            completion_percentage: 0,
            message: 'This API is deprecated. Use /api/task/current instead.'
        }
    });
});

export default router;
