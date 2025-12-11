/**
 * Jest 测试环境设置文件
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.TELEGRAM_BOT_USERNAME = 'test_bot';

// 全局测试超时
jest.setTimeout(30000);

// Mock console方法以减少测试输出噪音
global.console = {
  ...console,
  // 保留error和warn，但可以mock掉log
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// 清理测试数据库的辅助函数
export async function cleanupTestDatabase(pool: any) {
  try {
    await pool.query('DELETE FROM spin_entitlements');
    await pool.query('DELETE FROM invitations');
    await pool.query('DELETE FROM spins');
    await pool.query('DELETE FROM users WHERE telegram_id > 100000000');
  } catch (error) {
    console.error('清理测试数据库失败:', error);
  }
}
