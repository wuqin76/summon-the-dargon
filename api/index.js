/**
 * Vercel Serverless Function 入口
 * 将 Express 应用包装为 Vercel Function handler
 */

// 标记为 Vercel 环境
process.env.VERCEL = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// 导入编译后的 Express 应用
const path = require('path');
const fs = require('fs');

// 检查 dist 目录是否存在
const distPath = path.join(__dirname, '../dist/server.js');
if (!fs.existsSync(distPath)) {
    console.error('dist/server.js not found at:', distPath);
    module.exports = (req, res) => {
        res.status(500).json({ 
            error: 'Server not built',
            message: 'Please run npm run build',
            path: distPath
        });
    };
} else {
    try {
        const serverModule = require('../dist/server.js');
        const app = serverModule.default || serverModule;
        
        // 导出为 Vercel Serverless Function
        module.exports = app;
    } catch (error) {
        console.error('Failed to load Express app:', error);
        module.exports = (req, res) => {
            res.status(500).json({ 
                error: 'Failed to load server',
                message: error.message,
                stack: error.stack
            });
        };
    }
}
