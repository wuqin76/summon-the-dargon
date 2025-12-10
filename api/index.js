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

console.log('[Vercel API] Starting function...');
console.log('[Vercel API] __dirname:', __dirname);
console.log('[Vercel API] process.cwd():', process.cwd());

// 检查 dist 目录是否存在
const distPath = path.join(__dirname, '../dist/server.js');
console.log('[Vercel API] Looking for server at:', distPath);
console.log('[Vercel API] File exists:', fs.existsSync(distPath));

if (!fs.existsSync(distPath)) {
    console.error('[Vercel API] ERROR: dist/server.js not found!');
    
    // 列出可用的文件
    try {
        const files = fs.readdirSync(path.join(__dirname, '..'));
        console.log('[Vercel API] Available files in parent dir:', files);
    } catch (e) {
        console.error('[Vercel API] Cannot list files:', e.message);
    }
    
    module.exports = (req, res) => {
        res.status(500).json({ 
            success: false,
            error: 'Server not built',
            message: 'dist/server.js not found. Please ensure build command runs successfully.',
            path: distPath,
            cwd: process.cwd()
        });
    };
} else {
    try {
        console.log('[Vercel API] Loading Express app...');
        const serverModule = require('../dist/server.js');
        const app = serverModule.default || serverModule;
        console.log('[Vercel API] Express app loaded successfully');
        console.log('[Vercel API] App type:', typeof app);
        
        // 导出为 Vercel Serverless Function
        module.exports = app;
    } catch (error) {
        console.error('[Vercel API] ERROR loading Express app:', error);
        console.error('[Vercel API] Error stack:', error.stack);
        
        module.exports = (req, res) => {
            res.status(500).json({ 
                success: false,
                error: 'Failed to load server',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        };
    }
}
