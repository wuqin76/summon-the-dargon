-- 创建用户银行信息表
CREATE TABLE IF NOT EXISTS user_bank_info (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_bank_info_user_id ON user_bank_info(user_id);

-- 添加注释
COMMENT ON TABLE user_bank_info IS '用户银行信息表';
COMMENT ON COLUMN user_bank_info.user_id IS '用户ID，关联users表';
COMMENT ON COLUMN user_bank_info.full_name IS '完整姓名';
COMMENT ON COLUMN user_bank_info.phone_number IS '手机号码';
COMMENT ON COLUMN user_bank_info.account_number IS '银行账号';
COMMENT ON COLUMN user_bank_info.ifsc_code IS '印度银行IFSC代码';
COMMENT ON COLUMN user_bank_info.bank_name IS '银行名称';
COMMENT ON COLUMN user_bank_info.branch_name IS '分行名称（可选）';
