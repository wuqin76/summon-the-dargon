/**
 * 配置验证脚本
 * 用于检查所有必需的环境变量和数据库连接
 */

require('dotenv').config();
const { Pool } = require('pg');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkConfig() {
    log('\n========================================', 'blue');
    log('🔍 环境配置检查', 'blue');
    log('========================================\n', 'blue');

    let hasErrors = false;

    // 1. 检查必需的环境变量
    log('1. 检查环境变量...', 'yellow');
    
    const requiredVars = [
        { name: 'DATABASE_URL', secret: true },
        { name: 'TELEGRAM_BOT_TOKEN', secret: true },
        { name: 'TELEGRAM_BOT_USERNAME', secret: false },
        { name: 'JWT_SECRET', secret: true },
        { name: 'NODE_ENV', secret: false },
    ];

    for (const varConfig of requiredVars) {
        const value = process.env[varConfig.name];
        if (!value) {
            log(`   ❌ ${varConfig.name}: 未设置`, 'red');
            hasErrors = true;
        } else {
            if (varConfig.secret) {
                const preview = value.substring(0, 10) + '...';
                log(`   ✅ ${varConfig.name}: ${preview}`, 'green');
            } else {
                log(`   ✅ ${varConfig.name}: ${value}`, 'green');
            }
        }
    }

    // 2. 检查 DATABASE_URL 格式
    log('\n2. 检查数据库 URL 格式...', 'yellow');
    const dbUrl = process.env.DATABASE_URL;
    
    if (dbUrl) {
        // 检查是否有重复的协议前缀
        if ((dbUrl.match(/postgresql:\/\//g) || []).length > 1) {
            log('   ❌ DATABASE_URL 包含重复的协议前缀！', 'red');
            log(`   当前值: ${dbUrl}`, 'red');
            hasErrors = true;
        } else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
            log('   ❌ DATABASE_URL 格式不正确（应以 postgresql:// 开头）', 'red');
            hasErrors = true;
        } else {
            try {
                const url = new URL(dbUrl.replace('postgres://', 'postgresql://'));
                log('   ✅ 格式正确', 'green');
                log(`      协议: ${url.protocol}`, 'blue');
                log(`      主机: ${url.hostname}`, 'blue');
                log(`      端口: ${url.port || '5432'}`, 'blue');
                log(`      数据库: ${url.pathname.substring(1)}`, 'blue');
                log(`      用户: ${url.username}`, 'blue');
                log(`      密码: ${url.password ? '***' + url.password.substring(url.password.length - 3) : '未设置'}`, 'blue');
            } catch (error) {
                log(`   ❌ 无法解析 URL: ${error.message}`, 'red');
                hasErrors = true;
            }
        }
    }

    // 3. 测试数据库连接
    log('\n3. 测试数据库连接...', 'yellow');
    
    if (dbUrl && !hasErrors) {
        const pool = new Pool({
            connectionString: dbUrl,
            connectionTimeoutMillis: 5000,
        });

        try {
            const client = await pool.connect();
            log('   ✅ 数据库连接成功！', 'green');
            
            // 测试查询
            const result = await client.query('SELECT version()');
            log(`   ✅ PostgreSQL 版本: ${result.rows[0].version.split(' ')[1]}`, 'green');
            
            // 检查必需的表
            const tables = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            `);
            
            log(`   ✅ 找到 ${tables.rows.length} 个表`, 'green');
            if (tables.rows.length > 0) {
                log('      表列表:', 'blue');
                tables.rows.forEach(row => {
                    log(`        - ${row.table_name}`, 'blue');
                });
            }
            
            client.release();
            await pool.end();
        } catch (error) {
            log(`   ❌ 数据库连接失败: ${error.message}`, 'red');
            log(`   错误详情: ${error.code || 'N/A'}`, 'red');
            hasErrors = true;
            await pool.end();
        }
    }

    // 4. 检查 Telegram Bot Token
    log('\n4. 验证 Telegram Bot Token...', 'yellow');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (botToken) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const data = await response.json();
            
            if (data.ok) {
                log('   ✅ Bot Token 有效', 'green');
                log(`      Bot 名称: ${data.result.first_name}`, 'blue');
                log(`      Bot 用户名: @${data.result.username}`, 'blue');
                log(`      Bot ID: ${data.result.id}`, 'blue');
            } else {
                log(`   ❌ Bot Token 无效: ${data.description}`, 'red');
                hasErrors = true;
            }
        } catch (error) {
            log(`   ❌ 无法验证 Bot Token: ${error.message}`, 'red');
            hasErrors = true;
        }
    }

    // 总结
    log('\n========================================', 'blue');
    if (hasErrors) {
        log('❌ 配置检查失败！请修复上述问题', 'red');
        log('========================================\n', 'blue');
        process.exit(1);
    } else {
        log('✅ 所有配置检查通过！', 'green');
        log('========================================\n', 'blue');
        process.exit(0);
    }
}

// 执行检查
checkConfig().catch(error => {
    log(`\n❌ 检查过程出错: ${error.message}`, 'red');
    process.exit(1);
});
