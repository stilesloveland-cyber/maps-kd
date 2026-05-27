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
├── deploy.sh / deploy.ps1   ← 可选交互式部署脚本
├── .env.example             ← 环境变量模板
├── .husky/pre-commit        ← git 提交前自动 tsc 检查
│
├── server/                  ← 后端 (Express + TypeScript + SQLite)
│   ├── src/
│   │   ├── index.ts         ← 入口：路由注册、静态托管、Swagger
│   │   ├── db.ts            ← 建表 + 预置数据（7张表）
│   │   ├── middleware/auth.ts ← JWT 认证
│   │   └── routes/
│   │       ├── auth.ts      ← 登录/改密/状态检查 → 单管理员，密码默认 admin123
│   │       ├── cabinets.ts  ← 柜机 CRUD + 拖拽位置 + 批量生成 + 批量删除/移动 + 导入导出 Excel
│   │       ├── tags.ts      ← 标签 CRUD（13个预置标签不可删）
│   │       ├── zones.ts     ← 区域 CRUD
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
        │   ├── MapCanvas.tsx   ← 核心画布（react-konva，支持多选模式）
        │   ├── Toolbar.tsx     ← 导航栏（搜索/添加/批量生成/缩放/后台/登录）
        │   ├── FilterPanel.tsx ← 标签筛选面板（React.memo 优化）
        │   ├── DetailPanel.tsx ← 柜机详情面板（React.memo 优化）
        │   ├── LoginModal.tsx  ← 登录弹窗
        │   └── BatchModal.tsx  ← 批量生成弹窗
        └── pages/
            ├── MapPage.tsx     ← 主地图页面（数据加载 + 批量操作 + Toast）
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

### 4. 柜机拖拽
- 拖拽后通过 ref 缓存位置（避免 React 全量重绘导致闪白）
- 后端 API 异步保存，刷新后数据不丢失
- 代码在 `MapCanvas.tsx` 的 `draggedPositionsRef` 和 `onDragEnd` 中

### 5. 区域交互
- 前端画布上支持：拖拽移动 + 选中后四角手柄调整大小
- 工具栏有「添加区域」按钮，输入名称后创建在视图中心
- 后端 API 同步保存位置和尺寸

### 6. 画布触屏/鼠标拖拽
- Stage 设置 `draggable={false}`，完全自定义事件处理
- 容器 div 上监听的 `onMouseDown/Move/Up` 捕获所有鼠标事件（包括柜机上的点击）
- 拖拽超过 3px 自动取消柜机选中，避免干扰
- 触屏单指拖动 + 双指缩放，代码在 `handleTouchStart/Move/End` 中

### 7. 批量生成带标签柜机
- 工具栏「批量生成」按钮 → 弹窗输入数量和选择标签 → 自动编号 + 排列 + 挂标签
- 后端 `POST /api/cabinets/batch`

### 8. 批量操作（多选模式）
- 工具栏「多选」按钮开启多选模式 → 点击柜机进行多选
- 选中后出现批量删除 / 批量移动到区域操作按钮
- 后端 `POST /api/cabinets/batch-delete` + `PUT /api/cabinets/batch-move`

---

## 三、最近的重要改动

| # | 改动 | 涉及文件 | 说明 |
|---|------|---------|------|
| 1 | 搜索显示品牌+名称 | Toolbar.tsx, MapPage.tsx | 搜索下拉不再显示编号 C-01，改为"袋鼠1号柜" |
| 2 | 柜机默认名称 | MapPage.tsx | 添加柜机默认名改为"1号柜"（不带 C- 前缀） |
| 3 | 标签分类选择 | AdminPage.tsx | 后台添加标签可选手动选择"快递公司/柜机品牌/自定义" |
| 4 | 暗黑模式保护 | index.css | 强制 `color-scheme: light`，不跟随系统暗黑模式 |
| 5 | 画布鼠标/触屏重写 | MapCanvas.tsx | 全程使用自定义事件，不用 Stage 内置 draggable |
| 6 | 区域交互增强 | MapCanvas.tsx, MapPage.tsx | 区域支持拖拽移动 + 四角手柄调整大小 |
| 7 | 拖拽防止闪白 | MapCanvas.tsx, MapPage.tsx | 用 ref 缓存拖拽位置，不用 setState 重绘 |
| 8 | 搜索自动聚焦 | MapCanvas.tsx, MapPage.tsx | 点击搜索结果自动平移到对应柜机 |
| 9 | 批量生成柜机 | MapPage.tsx, BatchModal.tsx, server | 批量 N 个柜机 + 自动编号 + 指定标签 + 排列 |
| 10 | 备份清理 | AdminPage.tsx, backups.ts | 一键清自动备份 + 逐条删手动备份 + 保护锁定 |
| 11 | Canvas 缓存 | MapCanvas.tsx | 柜机组启用 Konva cache()，减少重绘 |
| 12 | 搜索防抖 | Toolbar.tsx, useDebounce.ts | 200ms 防抖，避免高频过滤 |
| 13 | Toast 通知 | ToastContext.tsx | 替换所有 alert()，右上角滑入通知 |
| 14 | 批量操作 | MapPage.tsx, cabinets.ts | 多选模式 + 批量删除/移动 |
| 15 | 主界面美化 | index.css, MapPage.tsx | 按钮动效、悬浮 FAB、面板动画、移动端适配 |
| 16 | pre-commit | package.json, .husky/ | commit 前自动运行 tsc --noEmit |

---

## 四、关键实现细节

### 4.1 MapCanvas ref 暴露的方法
```typescript
export interface MapCanvasRef {
  getCanvasCenter: () => { x: number; y: number };  // 获取当前视图中心对应的画布坐标
  resetView: () => void;                              // 重置视图到驿站入口
  panToCabinet: (cabinetId: string) => void;          // 平移到指定柜机
}
```
使用：`mapCanvasRef.current?.getCanvasCenter()` 等。

### 4.2 SQLite 数据库
- 文件位置：`server/data/cabinet.db`（运行时自动创建）
- 使用 WAL 模式提升并发性能
- 表结构在 `db.ts` 的 `initializeDatabase()` 中定义

### 4.3 JWT 认证
- Token 过期时间：24h
- Token 存储在 localStorage key `token`
- 401 时自动触发登出事件 `auth:logout`

### 4.4 后端静态文件
- 构建后的前端文件在 `client/dist`
- 后端在 `/` 路由 serve 这个目录
- 所有非 API 路由返回 `index.html`（支持前端 History 路由）

### 4.5 Toast 通知系统
- `ToastProvider` 在 `App.tsx` 根级别包裹
- 任意组件通过 `useToast()` 获取 `{ toast }` 函数
- 支持 4 种类型：success / error / warning / info
- 3 秒自动消失，右上角滑入，手机端全宽显示

### 4.6 性能优化要点
- **Canvas 缓存**：柜机 `<Group>` 通过 callback ref 调用 `node.cache()`
- **搜索防抖**：`useDebounce` hook 延迟 200ms 过滤搜索结果
- **React.memo**：`FilterPanel` 和 `DetailPanel` 用 `React.memo` 包裹避免无关重绘

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
4. **后端添加 API**：在 `routes/` 下新建文件 → 在 `index.ts` 注册路由 → 加 Swagger JSDoc 注释；注意静态路由（/batch, /batch-delete 等）必须在 `/:id` 通配路由之前注册
5. **数据模型改字段**：改 `db.ts` 建表语句 + `client/src/types.ts` + 路由中的 SQL 查询
6. **推送注意**：用户自己手动 `git push`，AI 只管写代码
7. **首次安装 husky**：在项目根目录运行 `npm install` 会自动触发 `prepare` 脚本初始化 husky hooks
