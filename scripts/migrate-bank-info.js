const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrateBankInfo() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('🔄 开始添加银行信息表...');

        const sqlPath = path.join(__dirname, '../database/add_bank_info_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pool.query(sql);

        console.log('✅ 银行信息表添加成功！');

        // 检查表是否创建成功
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'user_bank_info'
        `);

        if (result.rows.length > 0) {
            console.log('✅ 验证成功：user_bank_info 表已存在');
        } else {
            console.log('⚠️ 警告：表创建可能失败');
        }

    } catch (error) {
        console.error('❌ 迁移失败:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    migrateBankInfo()
        .then(() => {
            console.log('✅ 迁移完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 迁移失败:', error);
            process.exit(1);
        });
}

module.exports = { migrateBankInfo };
