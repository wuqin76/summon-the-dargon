import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';

interface TelegramUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

/**
 * 验证 Telegram Web App 数据
 */
export function verifyTelegramWebAppData(initData: string): TelegramUser | null {
    try {
        // 开发模式：跳过验证
        if (process.env.NODE_ENV === 'development' && !initData) {
            logger.info('Development mode: skipping Telegram verification');
            return null;
        }

        // 检查 Bot Token 是否配置
        if (!config.telegram.botToken) {
            logger.error('TELEGRAM_BOT_TOKEN is not configured!');
            return null;
        }

        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');

        if (!hash) {
            logger.warn('Telegram verification failed: no hash provided');
            return null;
        }

        // 按字典序排序参数
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // 记录 Bot Token 的前几个字符（用于调试）
        const tokenPrefix = config.telegram.botToken.substring(0, 10);
        logger.info('Verifying with bot token starting with: ' + tokenPrefix);

        // 计算密钥
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(config.telegram.botToken)
            .digest();

        // 计算哈希
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (calculatedHash !== hash) {
            logger.warn('Telegram data verification failed - hash mismatch', {
                expected: calculatedHash,
                received: hash,
                dataCheckString: dataCheckString.substring(0, 100),
                botTokenPrefix: tokenPrefix
            });
            
            // 紧急措施：允许通过但记录警告（仅用于调试）
            // TODO: 在生产环境中移除此代码或通过环境变量控制
            const skipVerification = process.env.SKIP_TELEGRAM_VERIFICATION === 'true' || process.env.NODE_ENV === 'development';
            if (skipVerification) {
                logger.warn('⚠️ SKIPPING Telegram verification (dev mode or SKIP_TELEGRAM_VERIFICATION=true)');
                const userParam = params.get('user');
                if (userParam) {
                    try {
                        const user = JSON.parse(userParam);
                        const authDate = parseInt(params.get('auth_date') || '0', 10);
                        logger.info('✅ Bypassed verification, user data:', { id: user.id, username: user.username });
                        return {
                            ...user,
                            auth_date: authDate,
                            hash,
                        };
                    } catch (e) {
                        logger.error('Failed to parse user data in bypass mode', e);
                    }
                }
            }
            
            return null;
        }

        // 检查时间戳（30分钟内有效，从5分钟延长）
        const authDate = parseInt(params.get('auth_date') || '0', 10);
        const now = Math.floor(Date.now() / 1000);
        const timeDiff = now - authDate;
        
        logger.info('Telegram auth timestamp check', {
            authDate,
            now,
            timeDiff,
            maxAllowed: 1800
        });
        
        if (timeDiff > 1800) { // 30分钟 = 1800秒
            logger.warn('Telegram data verification failed - expired', {
                authDate,
                now,
                timeDiff,
                maxAge: 300
            });
            
            // 如果启用跳过验证，即使过期也允许（仅用于测试）
            if (process.env.SKIP_TELEGRAM_VERIFICATION === 'true') {
                logger.warn('⚠️ ALLOWING expired data due to SKIP_TELEGRAM_VERIFICATION=true');
            } else {
                return null;
            }
        }

        // 解析用户数据
        const userParam = params.get('user');
        if (!userParam) {
            return null;
        }

        const user = JSON.parse(userParam);
        return {
            ...user,
            auth_date: authDate,
            hash,
        };
    } catch (error: any) {
        logger.error('Error verifying Telegram data', { error: error.message });
        return null;
    }
}

/**
 * 认证中间件
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.substring(7);

        try {
            const decoded = jwt.verify(token, config.security.jwtSecret) as any;
            (req as any).user = decoded;
            next();
        } catch (error) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
    } catch (error: any) {
        logger.error('Auth middleware error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * 管理员中间件
 */
export async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = (req as any).user;

        if (!user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        // 检查是否是管理员
        if (!config.telegram.adminIds.includes(user.telegramId)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        next();
    } catch (error: any) {
        logger.error('Admin middleware error', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * 生成 JWT Token
 */
export function generateToken(user: any): string {
    return jwt.sign(
        {
            id: user.id,
            telegramId: user.telegram_id,
            username: user.username,
        },
        config.security.jwtSecret,
        { expiresIn: config.security.jwtExpiresIn } as jwt.SignOptions
    );
}
