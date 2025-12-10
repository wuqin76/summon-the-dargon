打开本地服务器

npm start

端口3001已被占用,让我先关闭之前的进程:

netstat -ano | findstr :3001

taskkill /PID 30788 /F

npm run build

http://localhost:3001

完美!现在让我提交这些更改:

git add .

git commit -m "feat: 增大转盘至500px,添加12个扇区,前4个任务改为抽奖机会,预设抽奖结果,U改为卢比₹"

git push origin main
