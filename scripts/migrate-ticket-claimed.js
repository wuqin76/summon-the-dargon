/**
 * 数据库迁移脚本：添加ticket_claimed字段
 * 用途：标记支付订单的游玩机会是否已领取，实现幂等性控制
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 使用Railway公网数据库地址
const connectionString = process.env.DATABASE_PUBLIC_URL || 
                        'postgresql://postgres:rZRhUCiZwNxPPgzalXHntwdDWwcVbgSn@trolley.proxy.rlwy.net:30119/railway';

console.log('🔗 连接数据库...');

const pool = new Pool({ connectionString });

async function migrate() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 开始数据库迁移：添加ticket_claimed字段...');
        
        // 读取SQL文件
        const sqlFile = path.join(__dirname, '../database/add_ticket_claimed_field.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // 执行SQL
        await client.query(sql);
        
        console.log('✅ 数据库迁移成功！');
        console.log('');
        console.log('迁移内容：');
        console.log('  - 添加game_sessions.ticket_claimed字段');
        console.log('  - 为已存在的已支付订单标记为已领取');
        console.log('  - 创建查询索引');
        
    } catch (error) {
        console.error('❌ 数据库迁移失败:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// 执行迁移
migrate()
    .then(() => {
        console.log('');
        console.log('🎉 迁移完成！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('');
        console.error('💥 迁移失败:', error);
        process.exit(1);
    });
