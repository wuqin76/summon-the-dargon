#!/usr/bin/env node

/**
 * 部署前检查脚本
 * 确保所有必需的配置和文件都准备就绪
 */

const fs = require('fs');
const path = require('path');

const checks = {
  passed: [],
  warnings: [],
  errors: []
};

console.log('🔍 开始部署前检查...\n');

// 1. 检查必需文件
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'src/server.ts',
  'database/schema_v2.sql',
  'public/index.html',
  'scripts/add-ip-columns.js'
];

console.log('📁 检查必需文件...');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  if (exists) {
    checks.passed.push(`✓ ${file}`);
  } else {
    checks.errors.push(`✗ 缺少文件: ${file}`);
  }
});

// 2. 检查 package.json
console.log('\n📦 检查 package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  if (pkg.scripts && pkg.scripts.build) {
    checks.passed.push('✓ build 脚本存在');
  } else {
    checks.errors.push('✗ package.json 缺少 build 脚本');
  }
  
  if (pkg.scripts && pkg.scripts.start) {
    checks.passed.push('✓ start 脚本存在');
  } else {
    checks.errors.push('✗ package.json 缺少 start 脚本');
  }
  
  if (pkg.engines && pkg.engines.node) {
    checks.passed.push(`✓ Node.js 版本要求: ${pkg.engines.node}`);
  } else {
    checks.warnings.push('⚠ 未指定 Node.js 版本要求');
  }
} catch (err) {
  checks.errors.push('✗ 无法解析 package.json');
}

// 3. 检查 TypeScript 配置
console.log('\n⚙️  检查 TypeScript 配置...');
try {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tsconfig.json'), 'utf8'));
  
  if (tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
    checks.passed.push(`✓ 输出目录: ${tsconfig.compilerOptions.outDir}`);
  } else {
    checks.warnings.push('⚠ tsconfig.json 未指定输出目录');
  }
} catch (err) {
  checks.errors.push('✗ 无法解析 tsconfig.json');
}

// 4. 检查 .gitignore
console.log('\n🚫 检查 .gitignore...');
if (fs.existsSync(path.join(__dirname, '..', '.gitignore'))) {
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  
  if (gitignore.includes('node_modules')) {
    checks.passed.push('✓ node_modules 已被忽略');
  } else {
    checks.warnings.push('⚠ .gitignore 未包含 node_modules');
  }
  
  if (gitignore.includes('.env')) {
    checks.passed.push('✓ .env 已被忽略');
  } else {
    checks.errors.push('✗ .gitignore 必须包含 .env');
  }
  
  if (gitignore.includes('dist')) {
    checks.warnings.push('⚠ dist 被忽略(Render 需要构建产物)');
  }
} else {
  checks.errors.push('✗ 缺少 .gitignore 文件');
}

// 5. 检查环境变量示例
console.log('\n🔐 检查环境变量配置...');
if (fs.existsSync(path.join(__dirname, '..', '.env.example'))) {
  checks.passed.push('✓ .env.example 存在');
  
  const envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  const requiredEnvVars = [
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN',
    'JWT_SECRET',
    'PLATFORM_ADDRESS'
  ];
  
  requiredEnvVars.forEach(envVar => {
    if (envExample.includes(envVar)) {
      checks.passed.push(`  ✓ ${envVar}`);
    } else {
      checks.warnings.push(`  ⚠ .env.example 缺少 ${envVar}`);
    }
  });
} else {
  checks.warnings.push('⚠ .env.example 不存在');
}

// 6. 检查数据库脚本
console.log('\n🗄️  检查数据库脚本...');
const dbScripts = [
  'database/schema_v2.sql',
  'database/add_task_system.sql'
];

dbScripts.forEach(script => {
  if (fs.existsSync(path.join(__dirname, '..', script))) {
    checks.passed.push(`✓ ${script}`);
  } else {
    checks.errors.push(`✗ 缺少数据库脚本: ${script}`);
  }
});

// 7. 检查 Render 配置
console.log('\n☁️  检查 Render 配置...');
if (fs.existsSync(path.join(__dirname, '..', 'render.yaml'))) {
  checks.passed.push('✓ render.yaml 存在');
} else {
  checks.warnings.push('⚠ render.yaml 不存在(可选)');
}

// 8. 输出结果
console.log('\n' + '='.repeat(60));
console.log('📊 检查结果汇总');
console.log('='.repeat(60));

if (checks.passed.length > 0) {
  console.log('\n✅ 通过的检查:');
  checks.passed.forEach(msg => console.log('  ' + msg));
}

if (checks.warnings.length > 0) {
  console.log('\n⚠️  警告:');
  checks.warnings.forEach(msg => console.log('  ' + msg));
}

if (checks.errors.length > 0) {
  console.log('\n❌ 错误:');
  checks.errors.forEach(msg => console.log('  ' + msg));
}

console.log('\n' + '='.repeat(60));

if (checks.errors.length === 0) {
  console.log('\n✅ 所有检查通过! 可以开始部署到 Render');
  console.log('\n📖 下一步:');
  console.log('  1. 确保代码已推送到 GitHub');
  console.log('  2. 访问 https://render.com/ 创建账号');
  console.log('  3. 按照 RENDER_QUICKSTART.md 的步骤操作');
  console.log('  4. 查看 DEPLOYMENT.md 获取详细说明\n');
  process.exit(0);
} else {
  console.log('\n❌ 发现错误,请修复后再部署');
  console.log('   查看上面的错误信息进行修复\n');
  process.exit(1);
}
