/**
 * Admin Routes - 管理后台接口
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * 获取仪表盘统计数据
 * GET /api/admin/dashboard/stats
 */
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
    try {
        // 总用户数
        const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(totalUsersResult.rows[0].count);

        // 今日新增用户
        const todayUsersResult = await pool.query(`
            SELECT COUNT(*) as count FROM users 
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        const todayUsers = parseInt(todayUsersResult.rows[0].count);

        // 总充值金额
        const totalRevenueResult = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM payments 
            WHERE status = 'success'
        `);
        const totalRevenue = parseFloat(totalRevenueResult.rows[0].total);

        // 今日充值金额
        const todayRevenueResult = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM payments 
            WHERE status = 'success' AND DATE(created_at) = CURRENT_DATE
        `);
        const todayRevenue = parseFloat(todayRevenueResult.rows[0].total);

        // 总游戏次数
        const totalGamesResult = await pool.query('SELECT COUNT(*) as count FROM game_sessions');
        const totalGames = parseInt(totalGamesResult.rows[0].count);

        // 今日游戏次数
        const todayGamesResult = await pool.query(`
            SELECT COUNT(*) as count FROM game_sessions 
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        const todayGames = parseInt(todayGamesResult.rows[0].count);

        // 总邀请数
        const totalInvitesResult = await pool.query(`
            SELECT COUNT(*) as count FROM invitations WHERE registered = true
        `);
        const totalInvites = parseInt(totalInvitesResult.rows[0].count);

        // 今日邀请数
        const todayInvitesResult = await pool.query(`
            SELECT COUNT(*) as count FROM invitations 
            WHERE registered = true AND DATE(created_at) = CURRENT_DATE
        `);
        const todayInvites = parseInt(todayInvitesResult.rows[0].count);

        res.json({
            total_users: totalUsers,
            today_new_users: todayUsers,
            total_revenue: totalRevenue,
            today_revenue: todayRevenue,
            total_games: totalGames,
            today_games: todayGames,
            total_invites: totalInvites,
            today_invites: todayInvites
        });
    } catch (error) {
        logger.error('获取仪表盘统计失败:', error);
        res.status(500).json({ success: false, message: '获取统计数据失败' });
    }
});

/**
 * 获取用户列表
 * GET /api/admin/users/list
 */
router.get('/users/list', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const offset = (page - 1) * pageSize;

        // 获取总数
        const countResult = await pool.query('SELECT COUNT(*) as count FROM users');
        const total = parseInt(countResult.rows[0].count);

        // 获取用户列表（包含邀请统计）
        const usersResult = await pool.query(`
            SELECT 
                u.id as user_id,
                u.username as telegram_username,
                u.balance,
                u.total_invited,
                u.total_paid_plays as games_played,
                u.invite_code,
                u.invited_by,
                u.created_at,
                (SELECT COUNT(*) FROM invitations WHERE inviter_id = u.id AND registered = true) as invited_count,
                (SELECT COALESCE(SUM(p.amount), 0) FROM payments p 
                 JOIN invitations i ON p.user_id = i.invitee_id 
                 WHERE i.inviter_id = u.id AND p.status = 'success') as invited_users_revenue
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        res.json({
            users: usersResult.rows,
            total,
            page,
            pageSize
        });
    } catch (error) {
        logger.error('获取用户列表失败:', error);
        res.status(500).json({ success: false, message: '获取用户列表失败' });
    }
});

/**
 * 获取充值记录
 * GET /api/admin/payments/list
 */
router.get('/payments/list', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const offset = (page - 1) * pageSize;

        const countResult = await pool.query('SELECT COUNT(*) as count FROM payments');
        const total = parseInt(countResult.rows[0].count);

        const paymentsResult = await pool.query(`
            SELECT 
                p.id as order_id,
                p.user_id,
                p.amount,
                p.status as payment_status,
                p.created_at,
                u.username as telegram_username
            FROM payments p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        res.json({
            payments: paymentsResult.rows,
            total,
            page,
            pageSize
        });
    } catch (error) {
        logger.error('获取充值记录失败:', error);
        res.status(500).json({ success: false, message: '获取充值记录失败' });
    }
});

/**
 * 获取游戏记录
 * GET /api/admin/games/list
 */
router.get('/games/list', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const offset = (page - 1) * pageSize;

        const countResult = await pool.query('SELECT COUNT(*) as count FROM game_sessions');
        const total = parseInt(countResult.rows[0].count);

        const gamesResult = await pool.query(`
            SELECT 
                g.id as game_session_id,
                g.user_id,
                g.final_score as score,
                COALESCE(g.bonus_amount, 0) as reward_amount,
                g.created_at,
                u.username as telegram_username
            FROM game_sessions g
            LEFT JOIN users u ON g.user_id = u.id
            ORDER BY g.created_at DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        res.json({
            games: gamesResult.rows,
            total,
            page,
            pageSize
        });
    } catch (error) {
        logger.error('获取游戏记录失败:', error);
        res.status(500).json({ success: false, message: '获取游戏记录失败' });
    }
});

/**
 * 获取抽奖记录
 * GET /api/admin/spins/list
 */
router.get('/spins/list', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const offset = (page - 1) * pageSize;

        const countResult = await pool.query('SELECT COUNT(*) as count FROM spins');
        const total = parseInt(countResult.rows[0].count);

        const spinsResult = await pool.query(`
            SELECT 
                s.id as spin_id,
                s.user_id,
                s.prize_amount as reward_amount,
                s.created_at,
                u.username as telegram_username
            FROM spins s
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        res.json({
            spins: spinsResult.rows,
            total,
            page,
            pageSize
        });
    } catch (error) {
        logger.error('获取抽奖记录失败:', error);
        res.status(500).json({ success: false, message: '获取抽奖记录失败' });
    }
});

/**
 * 获取提现记录
 * GET /api/admin/payouts/list
 */
router.get('/payouts/list', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;

        // 数据库中暂无payouts表，返回空数据
        res.json({
            payouts: [],
            total: 0,
            page,
            pageSize
        });
    } catch (error) {
        logger.error('获取提现记录失败:', error);
        res.status(500).json({ success: false, message: '获取提现记录失败' });
    }
});

/**
 * 获取邀请统计（Top邀请者）
 * GET /api/admin/invites/top
 */
router.get('/invites/top', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const result = await pool.query(`
            SELECT 
                u.id as user_id,
                u.username as telegram_username,
                u.invite_code,
                COUNT(i.id) as invited_count,
                COALESCE(SUM(p.amount), 0) as invited_users_total_revenue,
                COUNT(DISTINCT CASE WHEN p.status = 'success' THEN i.invitee_id END) as paying_invitees
            FROM users u
            LEFT JOIN invitations i ON u.id = i.inviter_id AND i.registered = true
            LEFT JOIN payments p ON i.invitee_id = p.user_id AND p.status = 'success'
            GROUP BY u.id, u.username, u.invite_code
            HAVING COUNT(i.id) > 0
            ORDER BY invited_count DESC, invited_users_total_revenue DESC
            LIMIT $1
        `, [limit]);

        res.json({
            top_inviters: result.rows
        });
    } catch (error) {
        logger.error('获取邀请统计失败:', error);
        res.status(500).json({ success: false, message: '获取邀请统计失败' });
    }
});

/**
 * 获取单个用户的邀请详情
 * GET /api/admin/invites/details/:userId
 */
router.get('/invites/details/:userId', async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId);

        // 获取被邀请用户列表
        const inviteesResult = await pool.query(`
            SELECT 
                u.id as user_id,
                u.username as telegram_username,
                u.balance,
                u.balance as total_deposited,
                u.total_paid_plays as games_played,
                u.created_at as registered_at,
                COALESCE(SUM(p.amount), 0) as total_spent,
                COUNT(DISTINCT p.id) as payment_count
            FROM invitations i
            JOIN users u ON i.invitee_id = u.id
            LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'success'
            WHERE i.inviter_id = $1 AND i.registered = true
            GROUP BY u.id, u.username, u.balance, u.total_paid_plays, u.created_at
            ORDER BY u.created_at DESC
        `, [userId]);

        // 获取邀请者信息
        const inviterResult = await pool.query(`
            SELECT 
                id,
                username as telegram_username,
                invite_code,
                created_at
            FROM users
            WHERE id = $1
        `, [userId]);

        res.json({
            inviter: inviterResult.rows[0],
            invitees: inviteesResult.rows,
            total_invites: inviteesResult.rows.length
        });
    } catch (error) {
        logger.error('获取邀请详情失败:', error);
        res.status(500).json({ success: false, message: '获取邀请详情失败' });
    }
});

export default router;

