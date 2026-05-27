# ===== 阶段1：构建前端 =====
FROM node:18-alpine AS builder

WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci

COPY client/ .
RUN npm run build

# ===== 阶段2：构建后端 =====
FROM node:18-alpine AS server-builder

WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/ .
RUN npx tsc

# ===== 阶段3：运行 =====
FROM node:18-alpine

WORKDIR /app

# 复制后端产物
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/

# 复制前端构建产物
COPY --from=builder /app/client/dist ./client/dist

# 创建数据目录（SQLite 持久化）
RUN mkdir -p /app/server/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/server
CMD ["node", "dist/index.js"]
