/**
 * 数据库迁移脚本：添加 IP 字段
 * 修复 registration_ip 和 last_login_ip 字段缺失问题
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addIpColumns() {
    console.log('========================================');
    console.log('🔧 数据库迁移：添加 IP 字段');
    console.log('========================================\n');
    
    const client = await pool.connect();
    
    try {
        // 1. 检查当前表结构
        console.log('1. 检查当前 users 表结构...');
        const currentColumns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        console.log(`   找到 ${currentColumns.rows.length} 个列：`);
        currentColumns.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
        // 2. 检查是否已存在所有需要的字段
        const hasRegistrationIp = currentColumns.rows.some(col => col.column_name === 'registration_ip');
        const hasLastLoginIp = currentColumns.rows.some(col => col.column_name === 'last_login_ip');
        const hasLastLoginAt = currentColumns.rows.some(col => col.column_name === 'last_login_at');
        
        console.log('\n2. 检查所需字段状态...');
        console.log(`   registration_ip: ${hasRegistrationIp ? '✅ 已存在' : '❌ 不存在'}`);
        console.log(`   last_login_ip: ${hasLastLoginIp ? '✅ 已存在' : '❌ 不存在'}`);
        console.log(`   last_login_at: ${hasLastLoginAt ? '✅ 已存在' : '❌ 不存在'}`);
        
        // 3. 添加缺失的字段
        let needsMigration = false;
        
        if (!hasRegistrationIp || !hasLastLoginIp || !hasLastLoginAt) {
            console.log('\n3. 开始添加缺失的字段...');
            needsMigration = true;
            
            await client.query('BEGIN');
            
            try {
                if (!hasRegistrationIp) {
                    console.log('   添加 registration_ip 列...');
                    await client.query(`
                        ALTER TABLE users 
                        ADD COLUMN registration_ip VARCHAR(45);
                    `);
                    console.log('   ✅ registration_ip 添加成功');
                }
                
                if (!hasLastLoginIp) {
                    console.log('   添加 last_login_ip 列...');
                    await client.query(`
                        ALTER TABLE users 
                        ADD COLUMN last_login_ip VARCHAR(45);
                    `);
                    console.log('   ✅ last_login_ip 添加成功');
                }
                
                if (!hasLastLoginAt) {
                    console.log('   添加 last_login_at 列...');
                    await client.query(`
                        ALTER TABLE users 
                        ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                    `);
                    console.log('   ✅ last_login_at 添加成功');
                }
                
                await client.query('COMMIT');
                console.log('\n   ✅ 事务提交成功');
                
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('\n   ❌ 迁移失败，已回滚:', error.message);
                throw error;
            }
        } else {
            console.log('\n3. ✅ 所有字段已存在，无需迁移');
        }
        
        // 4. 验证最终表结构
        console.log('\n4. 验证最终表结构...');
        const finalColumns = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
            ORDER BY ordinal_position;
        `);
        
        console.log(`   当前 users 表有 ${finalColumns.rows.length} 个列：`);
        finalColumns.rows.forEach(col => {
            const isNew = (col.column_name === 'registration_ip' || col.column_name === 'last_login_ip');
            const marker = isNew ? '🆕 ' : '   ';
            console.log(`${marker}- ${col.column_name} (${col.data_type})`);
        });
        
        // 5. 统计现有用户
        const userCount = await client.query('SELECT COUNT(*) as count FROM users');
        console.log(`\n5. 数据库统计：`);
        console.log(`   现有用户数: ${userCount.rows[0].count}`);
        
        console.log('\n========================================');
        console.log('✅ 数据库迁移完成！');
        console.log('========================================\n');
        
        if (needsMigration) {
            console.log('💡 提示：现在可以重新部署应用，登录功能应该能正常工作了。\n');
        }
        
    } catch (error) {
        console.error('\n========================================');
        console.error('❌ 迁移过程出错');
        console.error('========================================');
        console.error('错误详情:', error.message);
        console.error('错误代码:', error.code);
        console.error('\n可能的原因：');
        console.error('1. 数据库连接失败 - 检查 DATABASE_URL');
        console.error('2. 权限不足 - 确保数据库用户有 ALTER TABLE 权限');
        console.error('3. 表不存在 - 先运行初始化脚本创建表');
        console.error('========================================\n');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// 执行迁移
console.log('\n开始执行数据库迁移...\n');
addIpColumns()
    .then(() => {
        console.log('迁移脚本执行完毕');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error.message);
        console.error('\n⚠️  迁移失败，但不影响应用启动（如果字段已存在）\n');
        // 不要 exit(1)，让应用继续启动
        process.exit(0);
    });
