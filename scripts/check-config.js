#!/usr/bin/env node
/**
 * 部署前配置检查脚本
 * 运行: node scripts/check-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Dragon Spin Game - Configuration Check\n');

const errors = [];
const warnings = [];
const passed = [];

// 检查 .env 文件
if (!fs.existsSync('.env')) {
    errors.push('.env file not found. Please copy .env.example to .env');
} else {
    passed.push('.env file exists');
    
    // 读取配置
    const envContent = fs.readFileSync('.env', 'utf8');
    const config = {};
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            config[match[1].trim()] = match[2].trim();
        }
    });

    // 检查必填配置
    const required = [
        'TELEGRAM_BOT_TOKEN',
        'PLATFORM_ADDRESS',
        'DATABASE_URL',
        'JWT_SECRET'
    ];

    required.forEach(key => {
        if (!config[key] || config[key] === '' || config[key].includes('your_')) {
            errors.push(`${key} is not configured`);
        } else {
            passed.push(`${key} is configured`);
        }
    });

    // 检查安全性
    if (config.JWT_SECRET === 'change-this-secret-in-production') {
        errors.push('JWT_SECRET must be changed from default value');
    }

    if (config.NODE_ENV === 'production') {
        if (config.LOG_LEVEL === 'debug') {
            warnings.push('LOG_LEVEL is debug in production');
        }
        
        if (!config.PLATFORM_PRIVATE_KEY || config.PLATFORM_PRIVATE_KEY.includes('your_')) {
            errors.push('PLATFORM_PRIVATE_KEY must be configured for production');
        }
    }

    // 检查 TRON 配置
    if (config.PLATFORM_ADDRESS && !config.PLATFORM_ADDRESS.startsWith('T')) {
        errors.push('PLATFORM_ADDRESS must be a valid TRON address (starts with T)');
    }

    // 检查 Spin 概率
    if (config.SPIN_PROBABILITIES) {
        try {
            const probs = JSON.parse(config.SPIN_PROBABILITIES);
            const total = probs.reduce((sum, p) => sum + p.probability, 0);
            if (Math.abs(total - 1.0) > 0.0001) {
                errors.push(`SPIN_PROBABILITIES total is ${total}, must be 1.0`);
            } else {
                passed.push('Spin probabilities sum to 1.0');
            }
        } catch (e) {
            errors.push('SPIN_PROBABILITIES is not valid JSON');
        }
    }
}

// 检查必要的目录
const directories = ['logs', 'exports', 'public'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        warnings.push(`Directory '${dir}' does not exist, will be created`);
        try {
            fs.mkdirSync(dir, { recursive: true });
            passed.push(`Created directory '${dir}'`);
        } catch (e) {
            errors.push(`Failed to create directory '${dir}': ${e.message}`);
        }
    } else {
        passed.push(`Directory '${dir}' exists`);
    }
});

// 检查 package.json
if (!fs.existsSync('package.json')) {
    errors.push('package.json not found');
} else {
    passed.push('package.json exists');
    
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (!fs.existsSync('node_modules')) {
        errors.push('node_modules not found. Run: npm install');
    } else {
        passed.push('node_modules directory exists');
    }
}

// 检查数据库 schema
if (!fs.existsSync('database/schema.sql')) {
    warnings.push('database/schema.sql not found');
} else {
    passed.push('Database schema file exists');
}

// 检查 TypeScript 配置
if (!fs.existsSync('tsconfig.json')) {
    errors.push('tsconfig.json not found');
} else {
    passed.push('tsconfig.json exists');
}

// 输出结果
console.log('✅ PASSED CHECKS:');
passed.forEach(msg => console.log(`   ✓ ${msg}`));

if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(msg => console.log(`   ⚠ ${msg}`));
}

if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(msg => console.log(`   ✗ ${msg}`));
    console.log('\n🚫 Configuration check FAILED. Please fix errors before deploying.\n');
    process.exit(1);
} else {
    console.log('\n✅ Configuration check PASSED!\n');
    console.log('Next steps:');
    console.log('  1. Initialize database: psql dragon_game < database/schema.sql');
    console.log('  2. Build project: npm run build');
    console.log('  3. Start server: npm start');
    console.log('');
    process.exit(0);
}
