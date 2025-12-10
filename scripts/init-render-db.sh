#!/bin/bash

# Render 部署初始化脚本
# 此脚本在 Render 首次部署时自动运行数据库初始化

set -e

echo "开始数据库初始化..."

# 检查是否已经初始化过
TABLES_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$TABLES_COUNT" -gt 0 ]; then
  echo "数据库已经初始化,跳过..."
  exit 0
fi

echo "执行 schema_v2.sql..."
psql $DATABASE_URL < database/schema_v2.sql

echo "执行 add_task_system.sql..."
psql $DATABASE_URL < database/add_task_system.sql

echo "数据库初始化完成!"
