/**
 * 清理旧数据库表
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/dragon_game';
const pool = new Pool({ connectionString: DATABASE_URL });

async function cleanupOldTables() {
    console.log('开始清理旧数据库表...\n');

    try {
        const sqlFilePath = path.join(__dirname, '../database/cleanup_old_tables.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

        const client = await pool.connect();
        
        try {
            console.log('✓ 数据库连接成功');
            console.log('执行清理脚本...\n');

            await client.query(sqlContent);

            console.log('✓ 旧表清理成功!');
            console.log('\n已删除的表:');
            console.log('  - user_task_progress (旧任务进度表)');
            console.log('  - tasks (旧任务定义表)');
            console.log('  - spin_entitlements (旧抽奖资格表)');
            console.log('\n✓ 清理完成!\n');

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('\n✗ 清理失败:', error.message);
        if (error.message.includes('does not exist')) {
            console.log('\n✓ 表不存在，无需清理');
        }
    } finally {
        await pool.end();
    }
}

cleanupOldTables();
