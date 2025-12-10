#!/usr/bin/env node
/**
 * Railway 数据库迁移脚本
 * 用法: railway run node scripts/migrate-railway.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
    if (!process.env.DATABASE_URL) {
        console.error('❌ 错误: DATABASE_URL 环境变量未设置');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
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
        result.rows.forEach(row => console.log(`  - ${row.table_name}`));
        
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
