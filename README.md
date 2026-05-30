# 📦 快递柜可视化地图管理系统

一个可部署在服务器上的 Web 应用，用于可视化查看和管理快递驿站不同编号快递柜的相对位置。支持地图式拖拽、缩放、标签筛选、柜机管理、操作日志、版本备份与回滚、管理员权限控制、全局搜索及移动端适配。

---

## 🚀 快速部署

### Docker Compose 部署（推荐）

**要求：** 服务器已安装 Git 和 Docker

```bash
# 1. 克隆项目
git clone https://github.com/stilesloveland-cyber/maps-kd.git

# 2. 进入目录
cd maps-kd

# 3. 一键启动
sudo docker compose up -d
```

就这么简单！默认配置即可运行，如需自定义端口或密码，编辑 `.env` 文件：

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置（端口、密码等）
nano .env

# 重新启动
sudo docker compose up -d
```

**环境变量说明：**
| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `ADMIN_PASSWORD` | 管理员初始密码 | `admin123` |
| `JWT_SECRET` | JWT 加密密钥 | 自动生成 |

**启动后访问：**
| 地址 | 说明 |
|------|------|
| `http://localhost:3000` | 主页面 |
| `http://localhost:3000/admin` | 后台管理 |
| `http://localhost:3000/api-docs` | API 接口文档 |

### 更新代码后重启

修改代码后，在服务器上拉取并重新构建：

```bash
cd ~/maps-kd
git pull
sudo docker compose up -d --build
```

> `--build` 会增量构建，只重新编译有变化的部分，未改动的层使用缓存，速度很快。
> 
> 只有修改了 `Dockerfile` 或 `package.json` 时，才需要加 `--no-cache` 完全重建：
> ```bash
> sudo docker compose build --no-cache
> sudo docker compose up -d
> ```

### 方式二：本地开发

**要求：** Node.js 18+

```bash
# 1. 安装后端依赖
cd server
npm install

# 2. 启动后端（开发模式，端口 3000）
npm run dev

# 3. 新终端，安装前端依赖
cd client
npm install

# 4. 启动前端（开发模式，端口 5173，自动代理到 3000）
npm run dev
```

---

## 📖 使用指南

### 游客模式
- 浏览柜机地图
- 拖拽平移、滚轮缩放
- 按标签筛选柜机
- 全局搜索柜机

### 管理员模式
1. 点击右上角 **登录** 按钮
2. 输入密码（默认 `admin123`）
3. 登录后可进行所有修改操作

### 管理后台
登录后在导航栏点击 **后台管理** 进入 `/admin` 页面：

| 功能卡片 | 说明 |
|---------|------|
| 📊 概览统计 | 查看柜机数、标签数、备份数、今日操作数、数据版本号 |
| 🔐 账户安全 | 修改密码、退出登录 |
| 📝 操作日志 | 查看所有操作记录，支持按类型和日期筛选 |
| 💾 版本管理 | 创建手动备份、查看备份历史、一键回滚 |
| 🏷️ 标签管理 | 查看/添加/删除自定义标签 |
| 🗺️ 区域管理 | 创建/编辑/删除区域分组 |
| 📥 导入导出 | 导出布局为 Excel、批量导入柜机、下载模板 |
| ⚙️ 系统信息 | 查看版本号、数据库大小、API 文档链接 |

---

## 🗺️ 功能详解

### 地图操作
| 操作 | 鼠标 | 触屏 |
|------|------|------|
| 平移视图 | 拖拽空白区域 | 单指拖动 |
| 缩放 | 滚轮 | 双指捏合 |
| 选择柜机 | 点击柜机 | 点击柜机 |
| 移动柜机 | 拖拽柜机（需登录） | 拖拽柜机（需登录） |
| 取消选择 | 点击空白区域 | 点击空白区域 |

### 标签筛选
- 点击右侧筛选面板中的标签
- 匹配的柜机保持正常显示 + 发光效果
- 未匹配的柜机降低透明度至 20%
- 支持多选（或关系，命中任一即匹配）

### 版本备份
- **自动备份**：每次添加/删除柜机后自动创建
- **手动备份**：管理员可随时创建带备注的检查点
- **回滚**：选择任意版本一键恢复，回滚前自动备份当前状态

---

## 🔧 技术架构

```
Frontend (React 18 + TypeScript + Vite)
    │
    │  react-konva (Canvas 2D)
    │  lucide-react (图标)
    │
    └── HTTP / REST API ──→ Backend (Express + TypeScript)
                                │
                                ├── JWT 鉴权 (bcryptjs + jsonwebtoken)
                                ├── Swagger 文档 (swagger-jsdoc)
                                └── SQLite (better-sqlite3)
                                     ├── cabinets   柜机表
                                     ├── tags       标签表
                                     ├── zones      区域表
                                     ├── admin      管理员表
                                     ├── logs       操作日志表
                                     ├── backups    备份表
                                     └── systemMeta 系统元数据表
```

### 环境变量
| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `ADMIN_PASSWORD` | 管理员初始密码 | `admin123` |
| `JWT_SECRET` | JWT 加密密钥 | 自动生成 |

---

## 🌐 域名与 HTTPS

### 使用 Cloudflare
1. 在 Cloudflare 添加您的域名，将 DNS 指向服务器 IP
2. 部署脚本中选择 Cloudflare 模式
3. 在 Cloudflare 面板设置 SSL/TLS 为 **Flexible**
4. Nginx 仅监听 80 端口，Cloudflare 负责 HTTPS

### 不使用 Cloudflare
1. 部署脚本中输入域名
2. 使用 Let's Encrypt 申请证书：
   ```bash
   certbot --nginx -d your-domain.com
   ```
3. 编辑 `nginx.conf` 配置证书路径

---

## 📊 API 概览

完整 API 文档请访问 `/api-docs`（服务启动后）。

| 方法 | 路径 | 说明 | 需登录 |
|------|------|------|:-----:|
| GET | `/api/cabinets` | 获取所有柜机 | ❌ |
| POST | `/api/cabinets` | 新增柜机 | ✅ |
| PUT | `/api/cabinets/:id` | 更新柜机 | ✅ |
| DELETE | `/api/cabinets/:id` | 删除柜机 | ✅ |
| PUT | `/api/cabinets/:id/position` | 更新柜机位置 | ✅ |
| PUT | `/api/cabinets/:id/tags` | 更新柜机标签 | ✅ |
| GET | `/api/tags` | 获取所有标签 | ❌ |
| POST | `/api/tags` | 新增标签 | ✅ |
| DELETE | `/api/tags/:id` | 删除标签 | ✅ |
| GET | `/api/zones` | 获取所有区域 | ❌ |
| POST | `/api/zones` | 新增区域 | ✅ |
| PUT | `/api/zones/:id` | 更新区域 | ✅ |
| DELETE | `/api/zones/:id` | 删除区域 | ✅ |
| POST | `/api/auth/login` | 管理员登录 | ❌ |
| PUT | `/api/auth/password` | 修改密码 | ✅ |
| GET | `/api/auth/status` | 检查登录状态 | ❌ |
| GET | `/api/logs` | 获取操作日志 | ✅ |
| GET | `/api/backups` | 获取备份列表 | ✅ |
| POST | `/api/backups` | 创建手动备份 | ✅ |
| POST | `/api/backups/:id/rollback` | 回滚到指定版本 | ✅ |
| DELETE | `/api/backups/:id` | 删除单个备份（受保护锁定） | ✅ |
| DELETE | `/api/backups/auto` | 一键清除多余自动备份 | ✅ |
| POST | `/api/cabinets/batch` | 批量生成带标签柜机 | ✅ |
| POST | `/api/cabinets/batch-delete` | 批量删除柜机 | ✅ |
| PUT | `/api/cabinets/batch-move` | 批量移动柜机到区域 | ✅ |
| GET | `/api/stats` | 系统概览统计 | ✅ |
| GET | `/api/cabinets/export` | 导出柜机 Excel | ✅ |
| POST | `/api/cabinets/import` | 批量导入柜机 | ✅ |
| GET | `/api/cabinets/template` | 下载导入模板 | ❌ |

---

## 🧑‍💻 开发

```bash
# 开发模式（前后端同时启动）
npm run dev

# 构建前端
cd client && npm run build

# TypeScript 类型检查
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

---

## 📝 版本

当前版本：**v1.2.1**
- 数据版本号：每次修改自动递增（显示在导航栏和后台概览中）

### 最近更新 (v1.2.1)
- 🎨 文字对比度自适应：深底白字/浅底黑字 + 文字阴影增强可读性
- 🔧 交互逻辑修复：点击选中不再跳中央、移除信息精简模式、移除 cache() 缓存
- ✨ 多选批量拖拽：拖动一个选中柜机，其他选中柜机同步移动
- 📱 移动端精简：仅保留查看+筛选+搜索，隐藏管理按钮
- 🗺️ 地图背景优化：淡灰点阵网格替代纯白背景
- 🏷️ 品牌标签显示：品牌名显示在柜机名上方（如「丰巢」+「1号柜」）
- 🔍 搜索高亮增强：脉冲呼吸动画 + 边框加粗 + 名称变色
- 🧭 指南针修正：上北下南左西右东
- 🏷️ 标签颜色同步：修改标签颜色后柜机自动同步
- 🔍 缩放按钮修复：+/- 按钮正常工作
- 📦 deploy.sh 增强：6 菜单交互 + 彩色输出 + kd 快捷命令
