// 执行支付字段迁移脚本
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:rZRhUCiZwNxPPgzalXHntwdDWwcVbgSn@trolley.proxy.rlwy.net:30119/railway',
    });

    try {
        console.log('正在连接数据库...');
        await client.connect();
        console.log('✅ 数据库连接成功');

        const sqlPath = path.join(__dirname, '../database/add_payment_fields_to_sessions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('\n执行支付字段迁移脚本...');
        await client.query(sql);

        console.log('✅ 数据库迁移成功完成！\n');
        console.log('已添加以下字段到 game_sessions 表：');
        console.log('- payment_status (支付状态)');
        console.log('- external_order_id (商户订单号)');
        console.log('- fendpay_order_no (FendPay平台订单号，如果不存在)');
        console.log('- 相关索引已创建');

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
