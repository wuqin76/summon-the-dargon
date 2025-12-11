/**
 * Spin Routes V2 - 抽奖系统（固定88 USDT + 任务解锁）
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authMiddleware } from '../middleware/auth.middleware';
import { checkAllTasksCompleted } from './task.routes';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 固定奖金
const FIXED_PRIZE = 88;

/**
 * 获取可用抽奖次数
 * GET /api/spin/available
 */
router.get('/available', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    try {
        // 查询未消耗的抽奖资格
        const result = await pool.query(`
            SELECT COUNT(*) as count
            FROM spin_entitlements
            WHERE user_id = $1 AND consumed = false
        `, [userId]);

        const availableCount = parseInt(result.rows[0].count);
        
        // 同时获取 users 表的 available_spins 用于调试
        const userResult = await pool.query(`
            SELECT available_spins FROM users WHERE id = $1
        `, [userId]);
        
        const userSpins = userResult.rows[0]?.available_spins || 0;
        
        // 如果数据不一致，自动修复
        if (availableCount !== userSpins) {
            console.warn('[Spin] 数据不一致检测到!', {
                userId,
                spin_entitlements_count: availableCount,
                users_available_spins: userSpins
            });
            
            // 修复逻辑:如果 users 表有次数但 spin_entitlements 缺少记录,创建记录
            if (userSpins > availableCount) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const missingCount = userSpins - availableCount;
                    for (let i = 0; i < missingCount; i++) {
                        await client.query(
                            'INSERT INTO spin_entitlements (user_id, consumed) VALUES ($1, false)',
                            [userId]
                        );
                    }
                    await client.query('COMMIT');
                    console.info('[Spin] 已自动创建缺失的 spin_entitlements', { 
                        userId, 
                        created: missingCount,
                        newTotal: userSpins 
                    });
                } catch (err) {
                    await client.query('ROLLBACK');
                    console.error('[Spin] 创建 spin_entitlements 失败', err);
                } finally {
                    client.release();
                }
            } else if (availableCount > userSpins) {
                // 如果 spin_entitlements 记录多于 users 表,同步 users 表
                await pool.query(`
                    UPDATE users SET available_spins = $1 WHERE id = $2
                `, [availableCount, userId]);
                console.info('[Spin] 已同步 users.available_spins', { userId, newValue: availableCount });
            }
        }

        // 重新查询最终可用次数
        const finalResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM spin_entitlements
            WHERE user_id = $1 AND consumed = false
        `, [userId]);
        const finalCount = parseInt(finalResult.rows[0].count);

        res.json({
            success: true,
            data: {
                available_spins: finalCount
            }
        });

    } catch (error: any) {
        console.error('[Spin] Get available error:', error);
        res.status(500).json({
            success: false,
            message: '获取抽奖次数失败'
        });
    }
});

/**
 * 执行抽奖（固定88 USDT）
 * POST /api/spin/execute
 */
router.post('/execute', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. 获取一个未消耗的抽奖资格
        const entitlementResult = await client.query(`
            SELECT id, source_type, source_id
            FROM spin_entitlements
            WHERE user_id = $1 AND consumed = false
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE
        `, [userId]);

        if (entitlementResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '没有可用的抽奖机会'
            });
        }

        const entitlement = entitlementResult.rows[0];

        // 2. 标记抽奖资格为已消耗
        await client.query(`
            UPDATE spin_entitlements
            SET consumed = true,
                consumed_at = NOW()
            WHERE id = $1
        `, [entitlement.id]);

        // 3. 创建抽奖记录（固定88 USDT，需要完成任务）
        const spinResult = await client.query(`
            INSERT INTO spins (
                user_id,
                entitlement_id,
                prize_amount,
                prize_type,
                status,
                requires_tasks,
                tasks_completed,
                created_at,
                completed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id, prize_amount, status
        `, [
            userId,
            entitlement.id,
            FIXED_PRIZE,
            'cash',
            'locked',  // 锁定状态，需完成任务
            true,      // 需要完成任务
            false      // 任务未完成
        ]);

        const spin = spinResult.rows[0];

        // 4. 更新用户锁定余额
        await client.query(`
            UPDATE users
            SET locked_balance = locked_balance + $1,
                updated_at = NOW()
            WHERE id = $2
        `, [FIXED_PRIZE, userId]);

        // 5. 记录余额变动
        await client.query(`
            INSERT INTO balance_changes (
                user_id, change_type, amount, 
                balance_before, balance_after,
                reference_type, reference_id, notes, created_at
            )
            SELECT 
                $1, 'spin_win', $2,
                locked_balance - $2, locked_balance,
                'spin', $3, 'Spin prize locked', NOW()
            FROM users WHERE id = $1
        `, [userId, FIXED_PRIZE, spin.id]);

        // 6. 更新用户可用抽奖次数
        await client.query(`
            UPDATE users
            SET available_spins = available_spins - 1,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

        // 7. 记录审计日志
        await client.query(`
            INSERT INTO audit_logs (
                actor_id, actor_type, action, target_type, target_id,
                details, success, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            userId,
            'user',
            'spin_executed',
            'spin',
            spin.id,
            JSON.stringify({ 
                prize_amount: FIXED_PRIZE,
                source_type: entitlement.source_type 
            }),
            true
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                spin_id: spin.id,
                prize_amount: FIXED_PRIZE,
                currency: 'USDT',
                status: 'locked',
                message: '恭喜你抽中 88 USDT！完成任务后即可提现。'
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Spin] Execute error:', error);
        res.status(500).json({
            success: false,
            message: '抽奖失败，请重试'
        });
    } finally {
        client.release();
    }
});

/**
 * 获取抽奖历史
 * GET /api/spin/history
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    try {
        const result = await pool.query(`
            SELECT 
                s.id,
                s.prize_amount,
                s.prize_type,
                s.status,
                s.requires_tasks,
                s.tasks_completed,
                s.tasks_completed_at,
                s.created_at,
                s.completed_at,
                se.source_type
            FROM spins s
            LEFT JOIN spin_entitlements se ON s.entitlement_id = se.id
            WHERE s.user_id = $1
            ORDER BY s.created_at DESC
            LIMIT $2
        `, [userId, limit]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error: any) {
        console.error('[Spin] Get history error:', error);
        res.status(500).json({
            success: false,
            message: '获取抽奖历史失败'
        });
    }
});

/**
 * 检查任务完成情况并解锁奖金
 * POST /api/spin/unlock
 */
router.post('/unlock', authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { spin_id } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. 检查抽奖记录
        const spinResult = await client.query(`
            SELECT id, prize_amount, status, tasks_completed
            FROM spins
            WHERE id = $1 AND user_id = $2
            FOR UPDATE
        `, [spin_id, userId]);

        if (spinResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: '抽奖记录不存在'
            });
        }

        const spin = spinResult.rows[0];

        if (spin.status === 'unlocked') {
            await client.query('ROLLBACK');
            return res.json({
                success: true,
                message: '奖金已解锁'
            });
        }

        // 2. 检查所有任务是否完成
        const allTasksCompleted = await checkAllTasksCompleted(userId, client);

        if (!allTasksCompleted) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: '请先完成所有任务'
            });
        }

        // 3. 解锁奖金
        await client.query(`
            UPDATE spins
            SET status = 'unlocked',
                tasks_completed = true,
                tasks_completed_at = NOW()
            WHERE id = $1
        `, [spin_id]);

        // 4. 将锁定余额转为可用余额
        await client.query(`
            UPDATE users
            SET balance = balance + $1,
                locked_balance = locked_balance - $1,
                updated_at = NOW()
            WHERE id = $2
        `, [spin.prize_amount, userId]);

        // 5. 记录余额变动
        await client.query(`
            INSERT INTO balance_changes (
                user_id, change_type, amount,
                balance_before, balance_after,
                reference_type, reference_id, notes, created_at
            )
            SELECT 
                $1, 'unlock', $2,
                balance - $2, balance,
                'spin', $3, 'Prize unlocked after tasks', NOW()
            FROM users WHERE id = $1
        `, [userId, spin.prize_amount, spin_id]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: '奖金已解锁，可以申请提现了！',
            data: {
                unlocked_amount: spin.prize_amount
            }
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Spin] Unlock error:', error);
        res.status(500).json({
            success: false,
            message: '解锁失败'
        });
    } finally {
        client.release();
    }
});

export default router;
