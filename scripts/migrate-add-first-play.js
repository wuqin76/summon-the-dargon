const { Pool } = require('pg');

async function migrate() {
    // 使用环境变量或公共连接
    const connectionString = process.env.DATABASE_URL || 
        'postgresql://postgres:rZRhUCiZwNxPPgzalXHntwdDWwcVbgSn@trolley.proxy.rlwy.net:38119/railway';
    
    console.log('🔌 连接到Railway数据库...');
    console.log('使用', process.env.DATABASE_URL ? '内部' : '公共', '网络连接');
    
    const pool = new Pool({
        connectionString: connectionString,
        connectionTimeoutMillis: 10000
    });

    try {
        console.log('🔄 开始数据库迁移...');
        console.log('🔌 测试数据库连接...');
        await pool.query('SELECT NOW()');
        console.log('✅ 数据库连接成功');
        
        // 删除旧约束
        await pool.query(`
            ALTER TABLE spin_entitlements 
            DROP CONSTRAINT IF EXISTS spin_entitlements_source_type_check;
        `);
        console.log('✅ 已删除旧约束');

        // 添加新约束
        await pool.query(`
            ALTER TABLE spin_entitlements 
            ADD CONSTRAINT spin_entitlements_source_type_check 
            CHECK (source_type IN ('invite', 'paid_game', 'first_play', 'manual', 'bonus'));
        `);
        console.log('✅ 已添加新约束（包含 first_play）');

        // 验证约束
        const result = await pool.query(`
            SELECT constraint_name, check_clause 
            FROM information_schema.check_constraints 
            WHERE constraint_name = 'spin_entitlements_source_type_check';
        `);
        
        console.log('🎉 迁移成功！');
        console.log('验证结果:', result.rows[0]);

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
