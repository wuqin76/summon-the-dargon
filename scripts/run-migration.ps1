# 执行FendPay数据库迁移脚本
# 使用方法：.\scripts\run-migration.ps1

$env:PGPASSWORD = "rZRhUCiZwNxPPgzalXHntwdDWwcVbgSn"

Write-Host "开始执行数据库迁移..." -ForegroundColor Green

# 执行SQL文件
Get-Content "database\add_fendpay_fields.sql" | psql -h trolley.proxy.rlwy.net -U postgres -p 30119 -d railway

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 数据库迁移成功完成！" -ForegroundColor Green
}
else {
    Write-Host "`n❌ 数据库迁移失败，错误代码：$LASTEXITCODE" -ForegroundColor Red
    Write-Host "如果提示找不到psql命令，请先安装PostgreSQL客户端" -ForegroundColor Yellow
}

# 清除密码
Remove-Item Env:\PGPASSWORD
