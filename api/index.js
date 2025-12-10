// Vercel Serverless Function 入口
// 将编译后的 Express 应用导出为 Serverless Function
const app = require('../dist/server').default;

module.exports = app;
