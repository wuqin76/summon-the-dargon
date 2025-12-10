/**
 * Vercel Serverless Function 入口
 * 将 Express 应用包装为 Vercel Function handler
 */

// 标记为 Vercel 环境
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

let app;

try {
    // 尝试导入编译后的 Express 应用
    const serverModule = require('../dist/server.js');
    app = serverModule.default || serverModule;
} catch (error) {
    console.error('Failed to load Express app:', error);
    throw error;
}

// 导出为 Vercel Serverless Function
module.exports = app;
