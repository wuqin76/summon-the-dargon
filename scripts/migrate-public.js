#!/usr/bin/env node
/**
 * 使用公共连接字符串执行数据库迁移
 * 用法: DATABASE_URL_PUBLIC="你的公共连接字符串" node scripts/migrate-public.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const dbUrl = process.env.DATABASE_URL_PUBLIC || process.env.DATABASE_URL;
    
    if (!dbUrl) {
        console.error('❌ 错误: 请设置 DATABASE_URL_PUBLIC 环境变量');
        console.error('示例: $env:DATABASE_URL_PUBLIC="postgresql://..."; node scripts/migrate-public.js');
        process.exit(1);
    }

    console.log('🔗 连接到数据库...');
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 测试连接
        await pool.query('SELECT NOW()');
        console.log('✅ 数据库连接成功');
        
        console.log('🔄 开始数据库迁移...');
        
        // 读取 SQL 文件
        const schema = fs.readFileSync(path.join(__dirname, '../database/schema_v2.sql'), 'utf8');
        const taskSystem = fs.readFileSync(path.join(__dirname, '../database/add_task_system.sql'), 'utf8');
        
        // 执行迁移
        console.log('📝 执行 schema_v2.sql...');
        await pool.query(schema);
        
        console.log('📝 执行 add_task_system.sql...');
        await pool.query(taskSystem);
        
        console.log('✅ 数据库迁移完成!');
        
        // 验证表是否创建成功
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        
        console.log('\n📊 已创建的表:');
        result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));
        
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
