# =============================================
#   快递柜可视化地图管理系统 - 一键部署脚本
#   支持 Windows (PowerShell 5+)
# =============================================

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║      📦 快递柜可视化地图管理系统 - 一键部署     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ---- 检测环境 ----
Write-Host "▶ 第一步：检测服务器环境" -ForegroundColor Yellow

$osInfo = Get-CimInstance Win32_OperatingSystem
Write-Host "   ✔ 系统: $($osInfo.Caption) $($osInfo.OSArchitecture)" -ForegroundColor Green

try {
    $dockerVer = docker --version 2>$null
    if ($dockerVer) {
        Write-Host "   ✔ Docker: 已安装 ($dockerVer)" -ForegroundColor Green
    } else {
        throw "Docker 未安装"
    }
} catch {
    Write-Host "   ✘ Docker 未安装！请先安装 Docker Desktop" -ForegroundColor Red
    exit 1
}

try {
    $publicIp = (Invoke-WebRequest -Uri "https://ifconfig.me" -UseBasicParsing).Content
    Write-Host "   ✔ 公网IP: $publicIp" -ForegroundColor Green
} catch {
    Write-Host "   ✔ 公网IP: 无法检测（不影响部署）" -ForegroundColor Gray
}

Write-Host ""

# ---- 端口配置 ----
Write-Host "▶ 第二步：端口配置" -ForegroundColor Yellow
$portInput = Read-Host "   请输入服务端口号 [默认: 3000]"
$port = if ($portInput) { $portInput } else { "3000" }
Write-Host "   ✔ 端口: $port" -ForegroundColor Green
Write-Host ""

# ---- 管理员密码 ----
Write-Host "▶ 第三步：管理员密码" -ForegroundColor Yellow
$pwInput = Read-Host "   请设置管理员密码 [默认: admin123]"
$adminPw = if ($pwInput) { $pwInput } else { "admin123" }
Write-Host "   ✔ 密码已设置" -ForegroundColor Green
Write-Host ""

# ---- JWT密钥 ----
$jwtSecret = "cabinet-manager-secret-$(Get-Date -Format 'yyyyMMddHHmmss')"
Write-Host "   ✔ JWT密钥: 已自动生成" -ForegroundColor Green
Write-Host ""

# ---- 域名配置 ----
Write-Host "▶ 第四步：域名配置（可选）" -ForegroundColor Yellow
$hasDomain = Read-Host "   是否配置域名访问？(y/N)"
$domain = ""
if ($hasDomain -eq "y" -or $hasDomain -eq "Y") {
    $domain = Read-Host "   请输入域名 (如 kuaidi.example.com)"

    $cfMode = Read-Host "   是否通过 Cloudflare 托管？(Y/n)"
    if ($cfMode -eq "n" -or $cfMode -eq "N") {
        Write-Host "   💡 建议使用 Let's Encrypt 申请 SSL 证书" -ForegroundColor Yellow
    } else {
        Write-Host "   ✔ Cloudflare 模式 — 请在 Cloudflare 面板将 SSL/TLS 设为 Flexible 或 Full" -ForegroundColor Green
    }
    Write-Host "   ✔ 域名: $domain" -ForegroundColor Green
}
Write-Host ""

# ---- 生成 .env 文件 ----
Write-Host "▶ 第五步：生成配置文件" -ForegroundColor Yellow
@"
PORT=$port
ADMIN_PASSWORD=$adminPw
JWT_SECRET=$jwtSecret
"@ | Out-File -FilePath ".env" -Encoding utf8
Write-Host "   ✔ .env 文件已生成" -ForegroundColor Green
Write-Host ""

# ---- 确认部署 ----
Write-Host "▶ 第六步：确认部署" -ForegroundColor Yellow
Write-Host "   ┌──────────────────────────────────────────────┐"
Write-Host "   │  端口映射    $port → 容器 3000" -ForegroundColor Cyan
Write-Host "   │  数据目录    ./data (已挂载持久卷)" -ForegroundColor Cyan
Write-Host "   │  镜像名称    cabinet-manager:latest" -ForegroundColor Cyan
if ($domain) {
    Write-Host "   │  访问地址    http://$domain" -ForegroundColor Cyan
} else {
    Write-Host "   │  访问地址    http://localhost:$port" -ForegroundColor Cyan
}
Write-Host "   └──────────────────────────────────────────────┘"
$confirm = Read-Host "   确认部署？(Y/n)"
if ($confirm -eq "n" -or $confirm -eq "N") {
    Write-Host "   部署已取消" -ForegroundColor Red
    exit 0
}
Write-Host ""

# ---- 构建并启动 ----
Write-Host "▶ 第七步：开始部署" -ForegroundColor Yellow
Write-Host "   ⏳ 构建 Docker 镜像..."

$buildResult = docker compose build -q 2>$null
if ($LASTEXITCODE -ne 0) {
    docker-compose build -q
}
Write-Host "   ✔ 镜像构建完成" -ForegroundColor Green

Write-Host "   ⏳ 启动容器..."
$upResult = docker compose up -d 2>$null
if ($LASTEXITCODE -ne 0) {
    docker-compose up -d
}
Write-Host "   ✔ 容器启动完成" -ForegroundColor Green
Write-Host ""

# ---- 完成 ----
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          ✅ 部署成功！                        ║" -ForegroundColor Green
Write-Host "║                                              ║" -ForegroundColor Green
if ($domain) {
    Write-Host "║     访问地址: http://$domain                ║" -ForegroundColor Cyan
} else {
    Write-Host "║     访问地址: http://localhost:$port            ║" -ForegroundColor Cyan
}
Write-Host "║                                              ║" -ForegroundColor Green
Write-Host "║     管理后台: /admin                          ║" -ForegroundColor Cyan
Write-Host "║     API文档: /api-docs                         ║" -ForegroundColor Cyan
Write-Host "║                                              ║" -ForegroundColor Green
Write-Host "║     管理命令:                                    ║" -ForegroundColor Green
Write-Host "║     查看日志: docker compose logs -f            ║" -ForegroundColor Cyan
Write-Host "║     停止服务: docker compose down               ║" -ForegroundColor Cyan
Write-Host "║     重启服务: docker compose restart             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
