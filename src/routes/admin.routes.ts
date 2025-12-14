import { Router, Request, Response } from 'express';
import { payoutService } from '../services/payout.service';
import { spinService } from '../services/spin.service';
import { userService } from '../services/user.service';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { db } from '../database';

const router = Router();

// 简单密码验证函�?
function checkPassword(req: Request): boolean {
    const { password } = req.body;
    return password === '1234';
}

/**
 * POST /api/admin/stats-simple
 * 获取统计数据（密码验证）
 */
router.post('/stats-simple', async (req: Request, res: Response) => {
    if (!checkPassword(req)) {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success') as total_revenue,
                (SELECT COUNT(*) FROM game_sessions WHERE completed = true) as total_games,
                (SELECT COUNT(*) FROM spins) as total_spins
        `);
        res.json(stats.rows[0]);
    } catch (error: any) {
        logger.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/users-simple
 * 获取用户列表（密码验证）
 */
router.post('/users-simple', async (req: Request, res: Response) => {
    if (!checkPassword(req)) {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const result = await db.query(`
            SELECT id, telegram_id, username, first_name, balance, 
                   available_spins, created_at
            FROM users ORDER BY created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Users error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/payments-simple
 * 获取支付记录（密码验证）
 */
router.post('/payments-simple', async (req: Request, res: Response) => {
    if (!checkPassword(req)) {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const result = await db.query(`
            SELECT p.id, p.amount, p.status, p.created_at,
                   u.username, u.telegram_id, u.first_name
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Payments error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/games-simple
 * 获取游戏记录（密码验证）
 */
router.post('/games-simple', async (req: Request, res: Response) => {
    if (!checkPassword(req)) {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const result = await db.query(`
            SELECT g.id, g.game_mode, g.completed, g.created_at,
                   u.username, u.telegram_id, u.first_name
            FROM game_sessions g
            LEFT JOIN users u ON g.user_id = u.id
            ORDER BY g.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Games error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/spins-simple
 * 获取抽奖记录（密码验证）
 */
router.post('/spins-simple', async (req: Request, res: Response) => {
    if (!checkPassword(req)) {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const result = await db.query(`
            SELECT s.id, s.prize_amount, s.status, s.created_at,
                   u.username, u.telegram_id, u.first_name
            FROM spins s
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Spins error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/payouts-simple
 * 获取提现记录（密码验证）
 */
router.post('/payouts-simple', async (req: Request, res: Response) => {
    if (!checkPassword(req)) {
        return res.status(401).json({ error: '密码错误' });
    }

    try {
        const result = await db.query(`
            SELECT pr.id, pr.amount, pr.status, pr.created_at,
                   u.username, u.telegram_id, u.first_name
            FROM payout_requests pr
            LEFT JOIN users u ON pr.user_id = u.id
            ORDER BY pr.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (error: any) {
        logger.error('Payouts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/simple-login
 * 简单的用户名密码登�?
 */
router.post('/simple-login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        // 简单的管理员账号验�?
        if (username === 'admin' && password === '1234') {
            const telegramId = 8498203261;
            
            // 从数据库查找或创建管理员用户，获取真实的 user.id
            const user = await userService.findOrCreateUser({
                id: telegramId,
                username: 'admin',
                first_name: 'Admin'
            });

            // 使用数据库中的真�?user.id 生成 Token
            const token = jwt.sign(
                { 
                    id: user.id,              // 使用 DB 真实 id
                    userId: user.id,
                    telegramId: telegramId.toString(),
                    isAdmin: true,
                    username: 'admin'
                },
                process.env.JWT_SECRET || 'dragon-spin-secret-key-2024',
                { expiresIn: '365d' }
            );

            return res.json({
                success: true,
                token,
                message: '登录成功'
            });
        } else {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
    } catch (error) {
        logger.error('Simple login error:', error);
        return res.status(500).json({
            success: false,
            message: '登录失败，服务器错误'
        });
    }
});

/**
 * POST /api/admin/generate-token
 * 为管理员生成登录 Token（无需认证�?
 * 如果用户不存在会自动创建
 */
router.post('/generate-token', async (req: Request, res: Response) => {
    try {
        const { telegramId } = req.body;
        
        if (!telegramId) {
            return res.status(400).json({ 
                success: false,
                error: 'Telegram ID 是必填项' 
            });
        }

        // 检查是否为管理�?
        const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',') || [];
        if (!adminIds.includes(telegramId.toString())) {
            return res.status(403).json({ 
                success: false,
                error: '您不是管理员，无权访问管理后�? 
            });
        }

        const jwt = require('jsonwebtoken');
        const { Pool } = require('pg');
        

        // 查找或创建用�?
        let userResult = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
        
        let userData;
        if (userResult.rows.length === 0) {
            // 自动创建管理员账�?
            const createResult = await db.query(`
                INSERT INTO users (telegram_id, username, first_name, invite_code)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [telegramId, 'admin', 'Admin', 'ADMIN_' + telegramId]);
            userData = createResult.rows[0];
        } else {
            userData = userResult.rows[0];
        }

        // 生成永久 Token
        const token = jwt.sign(
            { 
                id: userData.id,
                telegramId: userData.telegram_id,
                isAdmin: true
            },
            process.env.JWT_SECRET || 'change-this-secret-in-production',
            { expiresIn: '365d' }
        );

        res.json({
            success: true,
            token: token,
            user: {
                id: userData.id,
                telegramId: userData.telegram_id,
                username: userData.username,
                firstName: userData.first_name
            }
        });

    } catch (error: any) {
        logger.error('Generate admin token error', { error: error.message });
        res.status(500).json({
            success: false,
            error: '生成 Token 失败: ' + error.message,
        });
    }
});

// 所有其他管理路由都需要管理员权限
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/payouts/pending
 * 获取待处理的提现请求
 */
router.get('/payouts/pending', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const requests = await payoutService.getPendingPayoutRequests(limit);

        res.json({
            success: true,
            data: requests,
        });

    } catch (error: any) {
        logger.error('Get pending payouts error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/approve
 * 批准提现请求
 */
router.post('/payouts/approve', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestId } = req.body;

        if (!requestId) {
            return res.status(400).json({ error: 'Request ID is required' });
        }

        await payoutService.approvePayoutRequest(requestId, adminId);

        res.json({
            success: true,
            message: 'Payout request approved',
        });

    } catch (error: any) {
        logger.error('Approve payout error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/batch-approve
 * 批量批准提现请求
 */
router.post('/payouts/batch-approve', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestIds } = req.body;

        if (!requestIds || !Array.isArray(requestIds)) {
            return res.status(400).json({ error: 'Request IDs array is required' });
        }

        await payoutService.batchApprovePayoutRequests(requestIds, adminId);

        res.json({
            success: true,
            message: `${requestIds.length} payout requests approved`,
        });

    } catch (error: any) {
        logger.error('Batch approve payouts error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/create-batch
 * 创建提现批次
 */
router.post('/payouts/create-batch', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestIds } = req.body;

        if (!requestIds || !Array.isArray(requestIds)) {
            return res.status(400).json({ error: 'Request IDs array is required' });
        }

        const batchId = await payoutService.createPayoutBatch(requestIds, adminId);

        res.json({
            success: true,
            data: { batchId },
        });

    } catch (error: any) {
        logger.error('Create batch error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/payouts/mark-paid
 * 标记提现已完�?
 */
router.post('/payouts/mark-paid', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { requestId, chainTxId, feePaid } = req.body;

        if (!requestId || !chainTxId) {
            return res.status(400).json({ error: 'Request ID and chain TX ID are required' });
        }

        await payoutService.markPayoutPaid(requestId, chainTxId, adminId, feePaid);

        res.json({
            success: true,
            message: 'Payout marked as paid',
        });

    } catch (error: any) {
        logger.error('Mark paid error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/spins/approve
 * 批准大奖 Spin
 */
router.post('/spins/approve', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { spinId, notes } = req.body;

        if (!spinId) {
            return res.status(400).json({ error: 'Spin ID is required' });
        }

        await spinService.approveSpin(spinId, adminId, notes);

        res.json({
            success: true,
            message: 'Spin approved',
        });

    } catch (error: any) {
        logger.error('Approve spin error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/spins/reject
 * 拒绝大奖 Spin
 */
router.post('/spins/reject', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { spinId, reason } = req.body;

        if (!spinId || !reason) {
            return res.status(400).json({ error: 'Spin ID and reason are required' });
        }

        await spinService.rejectSpin(spinId, adminId, reason);

        res.json({
            success: true,
            message: 'Spin rejected',
        });

    } catch (error: any) {
        logger.error('Reject spin error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/users/set-withdrawal-eligibility
 * 设置用户提现资格
 */
router.post('/users/set-withdrawal-eligibility', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { userId, eligible } = req.body;

        if (!userId || eligible === undefined) {
            return res.status(400).json({ error: 'User ID and eligible status are required' });
        }

        await userService.setWithdrawalEligibility(userId, eligible, adminId);

        res.json({
            success: true,
            message: 'Withdrawal eligibility updated',
        });

    } catch (error: any) {
        logger.error('Set withdrawal eligibility error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/admin/users/ban
 * 封禁用户
 */
router.post('/users/ban', async (req: Request, res: Response) => {
    try {
        const adminId = (req as any).user.id;
        const { userId, reason } = req.body;

        if (!userId || !reason) {
            return res.status(400).json({ error: 'User ID and reason are required' });
        }

        await userService.banUser(userId, reason, adminId);

        res.json({
            success: true,
            message: 'User banned',
        });

    } catch (error: any) {
        logger.error('Ban user error', { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
});



/**
 * GET /api/admin/dashboard/stats
 * 获取仪表板统计数�? 
 */
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
    try {
        const { Pool } = require('pg');
        

        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as users_last_7d,
                (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as users_last_24h,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success') as total_revenue,
                (SELECT COUNT(*) FROM payments WHERE status = 'success' AND created_at > NOW() - INTERVAL '7 days') as payments_last_7d,
                (SELECT COUNT(*) FROM game_sessions WHERE completed = true) as total_games_played,
                (SELECT COUNT(*) FROM spins) as total_spins,
                (SELECT COUNT(*) FROM payout_requests WHERE status = 'pending') as pending_payouts,
                (SELECT COALESCE(SUM(amount), 0) FROM payout_requests WHERE status = 'pending') as pending_payout_amount
        `);

        res.json({
            success: true,
            data: stats.rows[0],
        });

    } catch (error: any) {
        logger.error('Get dashboard stats error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/users/list
 * 获取用户列表
 */
router.get('/users/list', async (req: Request, res: Response) => {
    try {
        const { Pool } = require('pg');
        
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT 
                u.id,
                u.telegram_id,
                u.username,
                u.first_name,
                u.balance,
                u.available_spins,
                u.total_invited,
                u.total_paid_plays,
                u.total_free_plays,
                u.is_banned,
                u.created_at,
                u.last_active_at,
                (SELECT COUNT(*) FROM invitations WHERE inviter_id = u.id) as invite_count,
                (SELECT COUNT(*) FROM game_sessions WHERE user_id = u.id AND completed = true) as completed_games,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = u.id AND status = 'success') as total_paid
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.query('SELECT COUNT(*) FROM users');
        const totalUsers = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                users: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalUsers,
                    pages: Math.ceil(totalUsers / limit),
                },
            },
        });

    } catch (error: any) {
        logger.error('Get users list error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/payments/list
 * 获取支付记录列表
 */
router.get('/payments/list', async (req: Request, res: Response) => {
    try {
        const { Pool } = require('pg');
        
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT 
                p.id,
                p.provider_tx_id,
                p.amount,
                p.currency,
                p.status,
                p.used,
                p.created_at,
                u.telegram_id,
                u.username,
                u.first_name
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.query('SELECT COUNT(*) FROM payments');
        const totalPayments = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                payments: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalPayments,
                    pages: Math.ceil(totalPayments / limit),
                },
            },
        });

    } catch (error: any) {
        logger.error('Get payments list error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/games/list
 * 获取游戏记录列表
 */
router.get('/games/list', async (req: Request, res: Response) => {
    try {
        const { Pool } = require('pg');
        
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT 
                g.id,
                g.game_mode,
                g.completed,
                g.earned_spin,
                g.created_at,
                g.completed_at,
                u.telegram_id,
                u.username,
                u.first_name
            FROM game_sessions g
            LEFT JOIN users u ON g.user_id = u.id
            ORDER BY g.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.query('SELECT COUNT(*) FROM game_sessions');
        const totalGames = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                games: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalGames,
                    pages: Math.ceil(totalGames / limit),
                },
            },
        });

    } catch (error: any) {
        logger.error('Get games list error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/spins/list
 * 获取抽奖记录列表
 */
router.get('/spins/list', async (req: Request, res: Response) => {
    try {
        const { Pool } = require('pg');
        
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const result = await db.query(`
            SELECT 
                s.id,
                s.prize_amount,
                s.status,
                s.requires_manual_review,
                s.reviewed,
                s.created_at,
                s.completed_at,
                u.telegram_id,
                u.username,
                u.first_name
            FROM spins s
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.query('SELECT COUNT(*) FROM spins');
        const totalSpins = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                spins: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalSpins,
                    pages: Math.ceil(totalSpins / limit),
                },
            },
        });

    } catch (error: any) {
        logger.error('Get spins list error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/admin/payouts/list
 * 获取提现申请列表
 */
router.get('/payouts/list', async (req: Request, res: Response) => {
    try {
        const { Pool } = require('pg');
        
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        const status = req.query.status as string;

        let query = `
            SELECT 
                pr.id,
                pr.amount,
                pr.fee,
                pr.net_amount,
                pr.withdrawal_method,
                pr.withdrawal_address,
                pr.status,
                pr.created_at,
                pr.approved_at,
                pr.completed_at,
                u.telegram_id,
                u.username,
                u.first_name
            FROM payout_requests pr
            LEFT JOIN users u ON pr.user_id = u.id
        `;

        const params: any[] = [limit, offset];
        if (status) {
            query += ` WHERE pr.status = $3`;
            params.push(status);
        }

        query += ` ORDER BY pr.created_at DESC LIMIT $1 OFFSET $2`;

        const result = await db.query(query, params);

        const countQuery = status 
            ? 'SELECT COUNT(*) FROM payout_requests WHERE status = $1' 
            : 'SELECT COUNT(*) FROM payout_requests';
        const countParams = status ? [status] : [];
        const countResult = await db.query(countQuery, countParams);
        const totalPayouts = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                payouts: result.rows,
                pagination: {
                    page,
                    limit,
                    total: totalPayouts,
                    pages: Math.ceil(totalPayouts / limit),
                },
            },
        });

    } catch (error: any) {
        logger.error('Get payouts list error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;

