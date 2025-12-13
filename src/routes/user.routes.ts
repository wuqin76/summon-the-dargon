import { Router, Request, Response } from 'express';
import { userService } from '../services/user.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/user/profile
 * 获取用户信息
 */
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const user = await userService.getUserById(userId);
        const stats = await userService.getUserStats(userId);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    telegramId: user.telegram_id,
                    username: user.username,
                    firstName: user.first_name,
                    gameBalance: user.game_balance,
                    withdrawalEligible: user.withdrawal_eligible,
                    inviteCode: user.invite_code,
                    totalInvites: user.total_invites,
                    validInvites: user.valid_invites,
                },
                stats: stats || {},
            },
        });

    } catch (error: any) {
        logger.error('Get user profile error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/user/balance
 * 获取用户余额
 */
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const user = await userService.getUserById(userId);

        res.json({
            success: true,
            data: {
                gameBalance: user.game_balance,
                lockedBalance: user.locked_balance,
                withdrawalEligible: user.withdrawal_eligible,
            },
        });

    } catch (error: any) {
        logger.error('Get user balance error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/user/play-status
 * 检查用户是否已经玩过游戏
 */
router.get('/play-status', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        
        if (!userId) {
            logger.error('Play status: userId is null');
            return res.status(401).json({
                success: false,
                error: 'User ID not found'
            });
        }
        
        const user = await userService.getUserById(userId);
        
        if (!user) {
            logger.error('Play status: user not found', { userId });
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // 检查用户是否已经玩过（total_free_plays + total_paid_plays > 0）
        const hasPlayed = (user.total_free_plays || 0) + (user.total_paid_plays || 0) > 0;

        res.json({
            success: true,
            hasPlayed,
            totalPlays: (user.total_free_plays || 0) + (user.total_paid_plays || 0)
        });

    } catch (error: any) {
        logger.error('Check play status error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/user/game-reward
 * 每次游戏完成，赠送抽奖机会（不区分首次还是付费）
 */
router.post('/game-reward', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { gameMode } = req.body; // 接收游戏模式：'first-time-free' 或 'paid'
        
        logger.info('🎁 收到游戏完成奖励请求', { userId, gameMode });
        
        const user = await userService.getUserById(userId);
        logger.info('📊 用户当前状态', { 
            userId, 
            total_free_plays: user.total_free_plays, 
            total_paid_plays: user.total_paid_plays,
            available_spins: user.available_spins
        });
        
        // 每次游戏完成都给予1次抽奖机会（使用paid_game类型）
        const { db } = await import('../database');
        
        logger.info('🔄 开始插入spin_entitlements记录', { userId, source_type: 'paid_game' });
        
        const insertResult = await db.query(`
            INSERT INTO spin_entitlements (user_id, source_type, created_at)
            VALUES ($1, 'paid_game', NOW())
            RETURNING id
        `, [userId]);
        
        logger.info('✅ spin_entitlements记录已插入', { 
            userId, 
            entitlementId: insertResult.rows[0].id 
        });
        
        logger.info('🔄 更新用户可抽奖次数和游玩次数', { userId, current_spins: user.available_spins, gameMode });
        
        // 根据游戏模式更新不同的计数器
        const isFirstTimeFree = gameMode === 'first-time-free';
        const updateResult = await db.query(`
            UPDATE users 
            SET available_spins = available_spins + 1,
                total_free_plays = total_free_plays + $2,
                total_paid_plays = total_paid_plays + $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING available_spins, total_free_plays, total_paid_plays
        `, [userId, isFirstTimeFree ? 1 : 0, isFirstTimeFree ? 0 : 1]);
        
        const newSpins = updateResult.rows[0].available_spins;
        const newFreePlays = updateResult.rows[0].total_free_plays;
        const newPaidPlays = updateResult.rows[0].total_paid_plays;
        logger.info('✅ 用户统计已更新', { 
            userId, 
            new_spins: newSpins, 
            new_free_plays: newFreePlays,
            new_paid_plays: newPaidPlays
        });
        
        logger.info('🎉 游戏完成奖励发放成功', { userId, granted_spins: 1, total_spins: newSpins });

        res.json({
            success: true,
            data: {
                spinsGranted: 1,
                message: '恭喜完成游戏，获得一次抽奖机会！'
            }
        });

    } catch (error: any) {
        logger.error('❌ Grant game reward error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/user/bank-info
 * 保存用户银行信息
 */
router.post('/bank-info', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { fullName, phoneNumber, accountNumber, ifscCode, bankName, branchName } = req.body;

        // 验证必填字段
        if (!fullName || !phoneNumber || !accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({
                success: false,
                error: '请填写所有必填字段',
            });
        }

        // 验证IFSC代码格式（印度银行IFSC代码格式：4位字母+0+6位字母或数字）
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(ifscCode)) {
            return res.status(400).json({
                success: false,
                error: 'IFSC代码格式不正确，请检查',
            });
        }

        // 验证账号格式（9-18位数字）
        const accountRegex = /^[0-9]{9,18}$/;
        if (!accountRegex.test(accountNumber)) {
            return res.status(400).json({
                success: false,
                error: '银行账号格式不正确，请检查',
            });
        }

        logger.info('💳 保存用户银行信息', { userId, fullName, bankName });

        // 保存到数据库
        const db = require('../database').db;
        await db.query(`
            INSERT INTO user_bank_info 
            (user_id, full_name, phone_number, account_number, ifsc_code, bank_name, branch_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                full_name = $2,
                phone_number = $3,
                account_number = $4,
                ifsc_code = $5,
                bank_name = $6,
                branch_name = $7,
                updated_at = NOW()
        `, [userId, fullName, phoneNumber, accountNumber, ifscCode, bankName, branchName || null]);

        logger.info('✅ 银行信息保存成功', { userId });

        res.json({
            success: true,
            message: '银行信息已保存',
        });

    } catch (error: any) {
        logger.error('❌ Save bank info error', { error: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/user/play-tickets
 * 获取用户可用的游玩机会数量
 */
router.get('/play-tickets', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        
        const db = require('../database').db;
        const result = await db.query(
            'SELECT paid_play_tickets FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        const paidPlayTickets = result.rows[0].paid_play_tickets || 0;
        
        res.json({
            success: true,
            data: {
                paid_play_tickets: paidPlayTickets,
                has_tickets: paidPlayTickets > 0
            }
        });
        
    } catch (error: any) {
        logger.error('Get play tickets error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/user/claim-ticket-for-payment
 * 确保支付成功的订单获得游玩机会（幂等操作）
 */
router.post('/claim-ticket-for-payment', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: '缺少订单号'
            });
        }
        
        const db = require('../database').db;
        const client = await db.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. 先从payments表查询支付记录
            const paymentResult = await client.query(`
                SELECT p.id, p.status, p.user_id
                FROM payments p
                WHERE p.provider_order_id = $1 AND p.user_id = $2
            `, [orderId, userId]);
            
            let paymentConfirmed = false;
            
            if (paymentResult.rows.length > 0 && paymentResult.rows[0].status === 'confirmed') {
                paymentConfirmed = true;
            }
            
            // 2. 然后查询game_sessions
            const sessionResult = await client.query(`
                SELECT gs.id, gs.user_id, gs.payment_status, gs.ticket_claimed
                FROM game_sessions gs
                WHERE gs.external_order_id = $1 AND gs.user_id = $2
            `, [orderId, userId]);
            
            if (sessionResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: '订单不存在'
                });
            }
            
            const session = sessionResult.rows[0];
            
            // 3. 检查支付状态（优先payments表，其次game_sessions表）
            if (!paymentConfirmed && session.payment_status !== 'confirmed') {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: '订单尚未支付成功',
                    payment_status: session.payment_status,
                    has_payment_record: paymentResult.rows.length > 0
                });
            }
            
            // 2. 检查是否已经领取过游玩机会（幂等性）
            if (session.ticket_claimed) {
                const userTickets = await client.query(
                    'SELECT paid_play_tickets FROM users WHERE id = $1',
                    [userId]
                );
                
                await client.query('ROLLBACK');
                return res.json({
                    success: true,
                    data: {
                        already_claimed: true,
                        current_tickets: userTickets.rows[0]?.paid_play_tickets || 0
                    },
                    message: '该订单的游玩机会已经领取过了'
                });
            }
            
            // 3. 增加游玩机会并标记已领取
            await client.query(`
                UPDATE users
                SET 
                    paid_play_tickets = paid_play_tickets + 1,
                    total_paid_plays = total_paid_plays + 1,
                    updated_at = NOW()
                WHERE id = $1
            `, [userId]);
            
            await client.query(`
                UPDATE game_sessions
                SET ticket_claimed = TRUE, updated_at = NOW()
                WHERE id = $1
            `, [session.id]);
            
            await client.query('COMMIT');
            
            const userTickets = await client.query(
                'SELECT paid_play_tickets FROM users WHERE id = $1',
                [userId]
            );
            
            logger.info('[ClaimTicket] 用户领取游玩机会', { 
                userId, 
                orderId,
                newTickets: userTickets.rows[0]?.paid_play_tickets || 0
            });
            
            res.json({
                success: true,
                data: {
                    current_tickets: userTickets.rows[0]?.paid_play_tickets || 0,
                    claimed: true
                },
                message: '游玩机会已成功领取！'
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error: any) {
        logger.error('Claim ticket error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/user/use-play-ticket
 * 使用一次游玩机会（进入游戏时调用）
 */
router.post('/use-play-ticket', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        
        const db = require('../database').db;
        
        // 使用事务确保原子性
        const client = await db.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 检查并扣减游玩机会
            const result = await client.query(`
                UPDATE users
                SET paid_play_tickets = paid_play_tickets - 1
                WHERE id = $1 AND paid_play_tickets > 0
                RETURNING paid_play_tickets
            `, [userId]);
            
            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: '没有可用的游玩机会'
                });
            }
            
            // 创建游戏会话
            const sessionResult = await client.query(`
                INSERT INTO game_sessions 
                (user_id, game_mode, payment_status, created_at)
                VALUES ($1, 'paid', 'confirmed', NOW())
                RETURNING id
            `, [userId]);
            
            await client.query('COMMIT');
            
            const remainingTickets = result.rows[0].paid_play_tickets;
            const sessionId = sessionResult.rows[0].id;
            
            logger.info('✅ 用户使用游玩机会', { 
                userId, 
                sessionId,
                remainingTickets 
            });
            
            res.json({
                success: true,
                data: {
                    session_id: sessionId,
                    remaining_tickets: remainingTickets
                },
                message: '游玩机会已使用，祝您游戏愉快！'
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error: any) {
        logger.error('Use play ticket error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
