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

        const sqlPath = path.join(__dirname, '../database/add_paid_play_tickets.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('\n执行付费游玩机会字段迁移脚本...');
        await client.query(sql);

        console.log('✅ 数据库迁移成功完成！\n');
        console.log('已添加以下字段到 users 表：');
        console.log('- paid_play_tickets (付费游玩机会数量)');
        console.log('- 相关索引已创建');
        
        // 验证字段是否存在
        const result = await client.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'paid_play_tickets'
        `);
        
        if (result.rows.length > 0) {
            console.log('\n✅ 字段验证成功:', result.rows[0]);
        }

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
