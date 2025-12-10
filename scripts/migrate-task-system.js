/**
 * 数据库迁移脚本 - 任务系统V2
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 从环境变量或直接配置获取数据库URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/dragon_game';

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigration() {
    console.log('开始数据库迁移: 任务系统V2...\n');

    try {
        // 读取SQL文件
        const sqlFilePath = path.join(__dirname, '../database/add_task_system.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

        // 连接数据库
        const client = await pool.connect();
        
        try {
            console.log('✓ 数据库连接成功');
            console.log('执行SQL脚本...\n');

            // 执行SQL脚本
            await client.query(sqlContent);

            console.log('✓ 任务系统V2表创建成功!');
            console.log('\n创建的表:');
            console.log('  - user_task_progress_v2 (用户任务进度表)');
            console.log('  - task_completion_log (任务完成记录表)');
            console.log('\n✓ 迁移完成!\n');

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('\n✗ 迁移失败:', error.message);
        console.error('\n详细错误:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// 运行迁移
runMigration();
