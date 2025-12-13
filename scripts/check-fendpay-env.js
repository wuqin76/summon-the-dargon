/**
 * 环境变量检查脚本
 * 在Railway部署后运行，确认所有必需的环境变量都已正确设置
 */

console.log('========================================');
console.log('FendPay 环境变量检查');
console.log('========================================\n');

const requiredVars = {
    'FENDPAY_MERCHANT_NUMBER': {
        required: true,
        expected: '2020213',
        description: 'FendPay商户号'
    },
    'FENDPAY_SECRET': {
        required: true,
        expected: '2296917a15d04199a142aa493d27d172',
        description: 'FendPay密钥',
        hideValue: true
    },
    'FENDPAY_API_BASE_URL': {
        required: true,
        expected: 'https://kspay.shop',
        description: 'FendPay API地址'
    },
    'BASE_URL': {
        required: true,
        expected: 'https://dragon-spin-game-production.up.railway.app',
        description: '应用基础URL'
    },
    'TELEGRAM_WEBAPP_URL': {
        required: true,
        expected: 'https://t.me/summondragon_bot/dragongame',
        description: 'Telegram WebApp URL'
    },
    'DATABASE_URL': {
        required: true,
        description: 'PostgreSQL数据库连接',
        hideValue: true
    }
};

let hasErrors = false;

Object.entries(requiredVars).forEach(([key, config]) => {
    const value = process.env[key];
    const isSet = !!value;
    
    console.log(`\n[${isSet ? '✅' : '❌'}] ${key}`);
    console.log(`   描述: ${config.description}`);
    
    if (isSet) {
        if (config.hideValue) {
            console.log(`   值: ${value.substring(0, 10)}... (已隐藏)`);
        } else {
            console.log(`   值: ${value}`);
        }
        
        if (config.expected && value !== config.expected) {
            console.log(`   ⚠️  警告: 期望值为 "${config.expected}"`);
            hasErrors = true;
        }
    } else {
        console.log(`   ❌ 未设置！`);
        if (config.expected) {
            console.log(`   期望值: ${config.expected}`);
        }
        hasErrors = true;
    }
});

console.log('\n========================================');
if (hasErrors) {
    console.log('❌ 检查失败！请在Railway中设置缺失的环境变量');
    console.log('========================================\n');
    process.exit(1);
} else {
    console.log('✅ 所有环境变量配置正确！');
    console.log('========================================\n');
}
