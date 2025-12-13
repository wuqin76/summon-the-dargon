import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './database';

// Import routes
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment_v2.routes';  // 新版支付（第三方）
import spinRoutes from './routes/spin_v2.routes';        // 新版抽奖（固定88）
import payoutRoutes from './routes/payout.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';     // 第三方支付回调
import taskRoutes from './routes/task.routes';           // 任务系统
import inviteRoutes from './routes/invite.routes';       // 邀请系统

const app: Application = express();

// Trust Railway proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org"],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            frameSrc: ["'self'"],
            frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org"],
        },
    },
}));
app.use(cors({
    origin: config.security.corsOrigin,
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP',
});
app.use('/api/', limiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    next();
});

// Health check
app.get('/health', async (_req: Request, res: Response) => {
    const dbHealthy = await db.healthCheck();
    const status = dbHealthy ? 200 : 503;

    res.status(status).json({
        status: dbHealthy ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payment/v2', paymentRoutes);  // V2支付（FendPay第三方）
app.use('/api/spin', spinRoutes);
app.use('/api/payout', payoutRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', webhookRoutes);  // 第三方支付webhook
app.use('/api/task', taskRoutes);         // 任务系统（单数形式）
app.use('/api/invite', inviteRoutes);     // 邀请系统

// Serve static files (frontend)
app.use(express.static('public'));

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
    });

    res.status(500).json({
        error: config.env === 'production' ? 'Internal server error' : err.message,
    });
});

// Start server (仅在非 Serverless 环境下启动)
if (process.env.VERCEL !== '1') {
    const PORT = config.port;
    const HOST = config.host;

    app.listen(PORT, HOST, () => {
        logger.info(`Server started`, {
            env: config.env,
            host: HOST,
            port: PORT,
            url: `http://${HOST}:${PORT}`,
        });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        await db.end();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        await db.end();
        process.exit(0);
    });
}

export default app;
