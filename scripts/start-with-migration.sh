#!/bin/bash
# Railway 部署后自动运行的数据库迁移脚本

echo "检查是否需要运行数据库迁移..."

# 运行迁移脚本
node scripts/add-ip-columns.js

# 如果迁移成功，启动应用
if [ $? -eq 0 ]; then
    echo "数据库迁移完成，启动应用..."
    node dist/server.js
else
    echo "数据库迁移失败，但仍然尝试启动应用..."
    node dist/server.js
fi
