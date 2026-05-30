# fastlook — 快递柜可视化地图管理系统

让另一个 AI 快速看懂这个项目，直接上手维护。

---

## 一、项目结构

```
快递柜/
├── APP_SPEC.json            ← 完整规格说明书（功能清单、数据模型、API 设计）
├── fastlook.md              ← 本文件，AI 快速上手文档
├── README.md                ← 给人类看的文档
├── package.json             ← 根目录，concurrently 启动前后端
├── Dockerfile               ← 多阶段构建
├── docker-compose.yml       ← 一键部署
├── deploy.sh / deploy.ps1   ← 部署脚本（TS检查 + Docker构建）
├── .env.example             ← 环境变量模板
├── .husky/pre-commit        ← git 提交前自动 tsc 检查
│
├── server/                  ← 后端 (Express + TypeScript + SQLite)
│   ├── src/
│   │   ├── index.ts         ← 入口：路由注册、静态托管、Swagger
│   │   ├── db.ts            ← 建表 + 预置数据（8张表）
│   │   ├── middleware/auth.ts ← JWT 认证
│   │   └── routes/
│   │       ├── auth.ts      ← 登录/改密/状态检查
│   │       ├── cabinets.ts  ← 柜机 CRUD + 位置 + 批量生成 + 批量删除/移动 + 导入导出
│   │       ├── tags.ts      ← 标签 CRUD（13个预置标签不可删）
│   │       ├── zones.ts     ← 区域 CRUD（含样式字段）
│   │       ├── annotations.ts ← 地图注释 CRUD
│   │       ├── logs.ts      ← 操作日志（分页/筛选）
│   │       ├── backups.ts   ← 备份管理 + 回滚 + 清理
│   │       └── stats.ts     ← 系统概览统计
│   └── data/                ← SQLite 数据库文件（运行时生成）
│
└── client/                  ← 前端 (React 18 + Vite + react-konva)
    └── src/
        ├── main.tsx         ← 入口
        ├── App.tsx          ← 路由 + ToastProvider 包裹
        ├── types.ts         ← 所有 TypeScript 类型定义
        ├── index.css        ← 全局样式 + 响应式断点 + CSS 变量
        ├── api/index.ts     ← API 封装层（自动携带 JWT Token）
        ├── hooks/
        │   └── useDebounce.ts ← 防抖 hook（搜索优化）
        ├── context/
        │   ├── AuthContext.tsx  ← 登录状态管理
        │   └── ToastContext.tsx ← Toast 通知系统
        ├── components/
        │   ├── MapCanvas.tsx   ← 核心画布（react-konva，含注释/指南针/吸附/区域样式）
        │   ├── Toolbar.tsx     ← 导航栏（搜索/添加/批量生成/注释/多选/缩放/后台）
        │   ├── FilterPanel.tsx ← 标签筛选面板（React.memo）
        │   ├── DetailPanel.tsx ← 柜机详情面板（含外观样式设置）
        │   ├── LoginModal.tsx  ← 登录弹窗
        │   ├── BatchModal.tsx  ← 批量生成弹窗
        │   └── AnnotationModal.tsx ← 注释编辑弹窗
        └── pages/
            ├── MapPage.tsx     ← 主地图页面（数据加载 + 批量操作 + Toast + 注释管理）
            └── AdminPage.tsx   ← 后台管理页面（8大功能卡片）
```

---

## 二、核心业务逻辑

### 1. 数据版本号自动递增
- 每次柜机/标签/区域的写操作，`systemMeta.dataVersion` 自动 +1
- 导航栏右侧实时显示，后台概览也能看到
- 后端在 db.ts 的 `incrementDataVersion()` 函数中实现

### 2. 操作日志
- 所有操作自动记录 logs 表
- 类型包括：`add_cabinet/del_cabinet/move_cabinet/edit_cabinet/edit_tags/create_zone/edit_zone/del_zone/import_cabinets/export_cabinets/create_backup/delete_backup/rollback/login/logout/change_password`

### 3. 版本备份与回滚
- **自动备份**：每次添加/删除柜机时触发
- **手动备份**：管理员在后台创建带备注的检查点
- **回滚保护**：回滚前自动备份当前状态
- **备份清理**：一键清除多余自动备份（保留最近10个），手动备份可逐条删除（受最近3个保护）

### 4. 柜机拖拽与吸附
- 拖拽后通过 ref 缓存位置（避免 React 全量重绘导致闪白）
- 后端 API 异步保存，刷新后数据不丢失
- 拖拽时自动吸附到其他柜机边缘/中心线（10px 阈值），按住 Ctrl/Shift 可临时关闭吸附
- 代码在 `MapCanvas.tsx` 的 `draggedPositionsRef` 和 `onDragEnd` 中

### 5. 区域交互
- 前端画布上支持：拖拽移动 + 选中后四角手柄调整大小
- 工具栏有「添加区域」按钮，输入名称后创建在视图中心
- 区域支持 fillEnabled/边框颜色/宽度/样式（实线/虚线）

### 6. 标签联动柜机颜色
- 柜机可开启「跟随标签颜色」模式，底色自动使用关联标签的颜色
- 柜机和区域均可独立设置边框颜色、宽度、样式

### 7. 画布触屏/鼠标拖拽
- Stage 设置 `draggable={false}`，完全自定义事件处理
- 容器 div 上监听的 `onMouseDown/Move/Up` 捕获所有鼠标事件
- 触屏单指拖动 + 双指缩放
- 右上角固定指南针（中文 北/东/西/南）

### 8. 批量生成带标签柜机
- 工具栏「批量生成」按钮 → 弹窗输入数量和选择标签 → 自动编号 + 排列 + 挂标签
- 后端 `POST /api/cabinets/batch`

### 9. 批量操作（多选模式）
- 工具栏「多选」按钮 → 点击柜机多选（紫色高亮+勾选标记）
- 选中后出现批量删除 / 批量移动到区域操作按钮
- 后端 `POST /api/cabinets/batch-delete` + `PUT /api/cabinets/batch-move`

### 10. 地图注释
- 工具栏「添加注释」按钮 → 视图中心创建 → 编辑文字/大小/颜色
- 注释可拖拽移动，点击弹出编辑弹窗
- 后端 `annotations` 表完整 CRUD

---

## 三、最近的重要改动

| # | 改动 | 涉及文件 | 说明 |
|---|------|---------|------|
| 1 | 搜索显示品牌+名称 | Toolbar.tsx, MapPage.tsx | 搜索下拉显示"袋鼠1号柜"而非 C-01 |
| 2 | 柜机默认名称 | MapPage.tsx | 添加柜机默认名改为"1号柜" |
| 3 | 标签分类选择 | AdminPage.tsx | 后台添加标签可选快递公司/柜机品牌/自定义 |
| 4 | 暗黑模式保护 | index.css | 强制 `color-scheme: light` |
| 5 | 画布触屏重写 | MapCanvas.tsx | 完全自定义事件，不用 Stage draggable |
| 6 | 区域交互增强 | MapCanvas.tsx, MapPage.tsx | 区域拖拽 + 四角手柄调整大小 |
| 7 | 拖拽防止闪白 | MapCanvas.tsx | 用 ref 缓存位置，不用 setState 重绘 |
| 8 | 搜索自动聚焦 | MapCanvas.tsx, MapPage.tsx | 点击搜索结果平移到对应柜机 |
| 9 | 批量生成柜机 | MapPage.tsx, BatchModal.tsx | 批量 N 个柜机 + 自动编号 + 指定标签 |
| 10 | 备份清理 | AdminPage.tsx, backups.ts | 一键清自动备份 + 逐条删手动备份 |
| 11 | Canvas 缓存 | MapCanvas.tsx | 柜机组启用 Konva cache() |
| 12 | 搜索防抖 | Toolbar.tsx, useDebounce.ts | 200ms 防抖 |
| 13 | Toast 通知 | ToastContext.tsx | 替换所有 alert() |
| 14 | 批量操作 | MapPage.tsx, cabinets.ts | 多选模式 + 批量删除/移动 |
| 15 | 主界面美化 | index.css, MapPage.tsx | 按钮动效、悬浮 FAB、面板动画、移动端适配 |
| 16 | pre-commit | package.json, .husky/ | commit 前自动 tsc |
| 17 | 标签联动颜色 | MapCanvas.tsx, DetailPanel.tsx | 柜机颜色跟随标签颜色（可开关） |
| 18 | 边框样式 | MapCanvas.tsx, zones.ts, cabinets.ts | 柜机/区域可设边框颜色/宽度/样式 |
| 19 | 区域填充开关 | MapCanvas.tsx, zones.ts | 区域可开关内部填充底色 |
| 20 | 指南针 | MapCanvas.tsx | 地图右上角固定指南针（中文方向） |
| 21 | 驿站入口自定义 | MapCanvas.tsx, MapPage.tsx | 入口大小/文字/颜色可配 |
| 22 | 地图注释 | annotations.ts, AnnotationModal.tsx | 完整注释 CRUD + 拖拽编辑 |
| 23 | 区域性能优化 | MapCanvas.tsx | 区域渲染优化 |
| 24 | deploy.sh 安全部署 | deploy.sh | 先 TS 检查再构建，防止错误代码部署 |
| 25 | favicon | client/public/favicon.svg | 快递柜图标 |
| 26 | 柜机间吸附 | MapCanvas.tsx | 拖拽柜机时吸附到其他柜机边缘/中心线（替代网格吸附），Ctrl/Shift 可临时关闭 |
| 27 | 移动端名称优化 | MapCanvas.tsx | 根据缩放级别动态显示/隐藏柜机名称，desktop≥0.8/mobile≥1.0 全显示 |
| 28 | 指南针修正 | MapCanvas.tsx | 修正方向标签 CSS 定位，上北下南左西右东，红针指北 |
| 29 | 标签颜色同步 | AdminPage.tsx, MapPage.tsx, tags.ts, api/index.ts | 新增 PUT /api/tags/:id 接口 + AdminPage 标签颜色编辑 + tag-updated 自定义事件，修改后柜机自动同步 |
| 30 | 缩放按钮修复 | MapPage.tsx, MapCanvas.tsx | 修复 +/- 缩放按钮无响应问题，通过 MapCanvas ref 的 zoomIn/zoomOut 方法 |
| 31 | 搜索高亮增强 | MapCanvas.tsx | 搜索选中柜机增加脉冲呼吸动画（shadowBlur 20→35，3秒）、边框 4px、名称 16px 绿色 |
| 32 | deploy.sh 增强 | deploy.sh, deploy.ps1 | 新增 6 个交互菜单（状态/日志/重启/备份）、彩色输出、磁盘检查、Docker 检测、kd 快捷命令指引 |
| 33 | 柜机品牌标签显示 | MapCanvas.tsx | 品牌名显示在柜机名上方（小字），如「丰巢」+「1号柜」 |
| 34 | 文字对比度自适应 | MapCanvas.tsx | getContrastColor 根据底色亮度自动切换深/浅文字色 + 文字阴影增强可读性 |
| 35 | 多选视觉增强 | MapCanvas.tsx | 蓝色虚线边框 + 半透明蓝色遮罩 + 左上角序号标记 |
| 36 | 多选批量拖拽 | MapCanvas.tsx, MapPage.tsx | 拖动一个选中柜机，其他选中柜机同步移动（Konva 节点直操） |
| 37 | 交互逻辑修复 | MapCanvas.tsx, MapPage.tsx | 移除 cache()、点击选中不跳中央、panToCabinet 可视区域判断、移除信息精简模式 |
| 38 | 移动端精简 | MapPage.tsx, Toolbar.tsx | 移动端仅保留查看+筛选+搜索，隐藏所有管理按钮 |
| 39 | 地图背景优化 | MapCanvas.tsx | 纯白背景改为淡灰点阵网格（#cbd5e1 圆点，50px间距） |

---

## 四、关键实现细节

### 4.1 MapCanvas ref 暴露的方法
```typescript
export interface MapCanvasRef {
  getCanvasCenter: () => { x: number; y: number };
  resetView: () => void;
  panToCabinet: (cabinetId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}
```

### 4.2 SQLite 数据库
- 文件位置：`server/data/cabinet.db`（运行时自动创建）
- 使用 WAL 模式提升并发性能
- 8 张表：cabinets, tags, zones, annotations, admin, logs, backups, systemMeta
- 通过 `ALTER TABLE` 添加新列兼容旧数据库

### 4.3 JWT 认证
- Token 过期时间：24h
- 存储在 localStorage key `token`
- 401 时自动触发登出事件 `auth:logout`

### 4.4 后端静态文件
- 构建后的前端文件在 `client/dist`
- 后端在 `/` 路由 serve 这个目录
- 所有非 API 路由返回 `index.html`（支持前端 History 路由）

### 4.5 Toast 通知系统
- `ToastProvider` 在 `App.tsx` 根级别包裹
- 任意组件通过 `useToast()` 获取 `{ toast }` 函数
- 支持 4 种类型：success / error / warning / info
- 3 秒自动消失，右上角滑入

### 4.6 性能优化要点
- **拖拽位置缓存**：柜机拖拽时通过 `draggedPositionsRef` 缓存位置，避免 React 全量重绘
- **搜索防抖**：`useDebounce` hook 延迟 200ms
- **React.memo**：`FilterPanel` 和 `DetailPanel` 用 `React.memo` 包裹
- **多选拖拽直操**：多选拖拽时直接操作 Konva 节点（`stage.findOne` + `node.position()`），绕过 React 渲染循环

### 4.7 数据库 Schema 变更兼容
- 使用 `addColumnIfNotExists` 函数以 `ALTER TABLE ADD COLUMN` + try-catch 方式添加新字段
- cabinets 表扩展了 followTagColor, strokeColor, strokeWidth, strokeStyle
- zones 表扩展了 fillEnabled, strokeColor, strokeWidth, strokeStyle
- annotations 表为新增表（CREATE TABLE IF NOT EXISTS）

---

## 五、开发环境

```bash
# 后端 (端口 3000)
cd server && npm install && npm run dev

# 前端 (端口 5173，代理 API 到 3000)
cd client && npm install && npm run dev
```

## 六、部署

```bash
git clone https://github.com/stilesloveland-cyber/maps-kd.git
cd maps-kd
sudo docker compose up -d
```

**安全部署（推荐）**：
```bash
./deploy.sh
# 交互菜单：
#   1 → 完整构建部署（git pull + TS检查 + Docker构建）
#   2 → 仅 TS 检查
#   3 → 查看运行状态
#   4 → 查看容器日志
#   5 → 重启服务
#   6 → 数据库备份
```

**快捷命令**（输入 kd 即可运行部署脚本）：
```bash
# Linux/macOS
echo "alias kd='~/maps-kd/deploy.sh'" >> ~/.bashrc && source ~/.bashrc

# Windows PowerShell（管理员运行）
if (!(Test-Path $PROFILE)) { New-Item -Path $PROFILE -Force }
Add-Content -Path $PROFILE -Value 'function kd { & "E:\trae项目\快递柜\deploy.ps1" }'
```

更新代码后：
```bash
git pull
sudo docker compose up -d --build
```

---

## 七、维护要点

1. **不要随意改 node_modules**：用 `npm install` 管理依赖
2. **TypeScript strict 模式**：所有函数参数、事件参数必须显式标注类型
3. **前端组件样式用内联 `<style>`**：每个组件自带 CSS，不改全局样式
4. **后端添加 API**：在 `routes/` 下新建文件 → 在 `index.ts` 注册路由 → 加 Swagger JSDoc 注释；注意静态路由（/batch, /batch-delete, /batch-move 等）必须在 `/:id` 通配路由之前注册
5. **数据模型改字段**：改 `db.ts` 建表语句 + `client/src/types.ts` + 路由中的 SQL 查询；已有表用 `ALTER TABLE ADD COLUMN` 兼容
6. **前端新增组件**：在 `components/` 下新建 → 需在 `MapPage.tsx` 中 import 使用
7. **推送注意**：用户自己手动 `git push`，AI 只管写代码
8. **首次安装 husky**：在项目根目录运行 `npm install` 会自动触发 `prepare` 脚本初始化 husky hooks
9. **部署前检查**：使用 `deploy.sh` 会自动运行 `npx tsc --noEmit` 检测类型错误，避免构建失败
