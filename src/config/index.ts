import dotenv from 'dotenv';

dotenv.config();

interface SpinProbability {
    value: number;
    probability: number;
    label: string;
}

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',

    database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/dragon_game',
    },

    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
        adminIds: (process.env.ADMIN_TELEGRAM_IDS || '').split(',').filter(Boolean).map(id => parseInt(id, 10)),
        alertChatId: process.env.ALERT_TELEGRAM_CHAT_ID || '',
    },

    // 第三方支付配置（移除了链上配置）
    thirdPartyPayment: {
        url: process.env.PAYMENT_URL || '',
        webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'default_secret',
    },

    // 兼容旧代码的临时配置（待移除）
    tron: {
        network: 'mainnet',
        apiUrl: 'https://api.trongrid.io',
        apiKey: '',
        usdtContractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    },
    platform: {
        address: 'temp_address',
        privateKey: '',
    },

    payment: {
        amount: parseFloat(process.env.PAYMENT_AMOUNT || '10'),
        confirmations: parseInt(process.env.PAYMENT_CONFIRMATIONS || '1', 10),
        timeoutMinutes: parseInt(process.env.PAYMENT_TIMEOUT_MINUTES || '30', 10),
    },

    spin: {
        largePrizeThreshold: parseFloat(process.env.LARGE_PRIZE_THRESHOLD || '888'),
        probabilities: JSON.parse(process.env.SPIN_PROBABILITIES || JSON.stringify([
            { value: 8888, probability: 0, label: '8888 USDT' },
            { value: 888, probability: 0, label: '888 USDT' },
            { value: 88, probability: 1.0, label: '88 USDT' },  // 100%概率
            { value: 8, probability: 0, label: '8 USDT' },
            { value: 3, probability: 0, label: '3 USDT' },
            { value: 1, probability: 0, label: '1 USDT' },
            { value: 0.5, probability: 0, label: '0.5 USDT' },
            { value: 0.1, probability: 0, label: '0.1 USDT' },
        ])) as SpinProbability[],
    },

    withdrawal: {
        threshold: parseFloat(process.env.WITHDRAWAL_THRESHOLD || '100'),
        platformPaysFee: process.env.PLATFORM_PAYS_FEE === 'true',
        feePercent: parseFloat(process.env.WITHDRAWAL_FEE_PERCENT || '1.0'),
        feeFixed: parseFloat(process.env.WITHDRAWAL_FEE_FIXED || '0'),
        dailyBatchHour: parseInt(process.env.DAILY_BATCH_HOUR || '4', 10),
    },

    invite: {
        firstReward: parseFloat(process.env.FIRST_INVITE_REWARD || '0.1'),
    },

    risk: {
        maxInvitesPerIpPerDay: parseInt(process.env.MAX_INVITES_PER_IP_PER_DAY || '10', 10),
        maxPaymentsPerUserPerDay: parseInt(process.env.MAX_PAYMENTS_PER_USER_PER_DAY || '10', 10),
        maxSpinPerUserPerDay: parseInt(process.env.MAX_SPIN_PER_USER_PER_DAY || '20', 10),
        kycRequiredForAmount: parseFloat(process.env.KYC_REQUIRED_FOR_AMOUNT || '100'),
        enableIpCheck: process.env.ENABLE_IP_CHECK === 'true',
        enableDeviceFingerprint: process.env.ENABLE_DEVICE_FINGERPRINT === 'true',
    },

    security: {
        jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        corsOrigin: (process.env.CORS_ORIGIN || 'https://t.me').split(','),
    },

    logs: {
        level: process.env.LOG_LEVEL || 'info',
        auditRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
};

// 验证必要配置
function validateConfig() {
    const requiredFields = [
        { key: 'telegram.botToken', value: config.telegram.botToken },
        { key: 'security.jwtSecret', value: config.security.jwtSecret },
    ];

    const missing = requiredFields.filter(field => !field.value);
    
    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.map(f => f.key).join(', ')}`);
    }

    // 注意：新版本使用固定88 USDT奖金，不再需要概率验证
    // 保留旧配置仅为兼容性，实际不使用
}

if (config.env !== 'test') {
    validateConfig();
}

export default config;
