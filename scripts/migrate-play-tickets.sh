#!/bin/bash
# 添加 paid_play_tickets 字段的迁移脚本

echo "开始数据库迁移：添加付费游玩机会字段..."

# 执行SQL迁移
psql $DATABASE_URL -f database/add_paid_play_tickets.sql

if [ $? -eq 0 ]; then
    echo "✅ 数据库迁移成功完成"
else
    echo "❌ 数据库迁移失败"
    exit 1
fi
