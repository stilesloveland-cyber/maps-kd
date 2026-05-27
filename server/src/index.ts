/**
 * 快递柜可视化地图管理系统 - 后端服务主入口
 * Express 应用启动、路由注册、Swagger 文档、静态文件托管
 */
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { initializeDatabase } from './db';

// 导入路由模块
import authRoutes from './routes/auth';
import cabinetRoutes from './routes/cabinets';
import tagRoutes from './routes/tags';
import zoneRoutes from './routes/zones';
import logRoutes from './routes/logs';
import backupRoutes from './routes/backups';
import statsRoutes from './routes/stats';
import annotationRoutes from './routes/annotations';

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// ---- 中间件配置 ----
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Swagger 文档配置 ----
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: '快递柜可视化地图管理系统 API',
      version: '1.0.0',
      description: '快递柜可视化地图管理系统的后端 RESTful API 接口文档',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: '开发服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '输入 JWT Token，格式：Bearer <token>',
        },
      },
    },
  },
  // 扫描所有路由文件中的 JSDoc 注释自动生成文档
  apis: [path.resolve(__dirname, './routes/*.js')],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: '快递柜管理系统 API 文档',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// ---- 注册 API 路由 ----
app.use('/api/auth', authRoutes);
app.use('/api/cabinets', cabinetRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/annotations', annotationRoutes);

// ---- 前端静态文件托管 ----
// 将 client/dist 目录下的前端构建文件作为静态资源提供服务
const clientDistPath: string = path.resolve(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// 所有非 API 路由返回前端入口文件（支持前端路由的 History 模式）
app.get('*', (_req: Request, res: Response): void => {
  res.sendFile(path.join(clientDistPath, 'index.html'), (err: Error | undefined) => {
    if (err) {
      // 如果前端文件不存在，返回简单的提示信息
      res.status(200).send('快递柜可视化地图管理系统后端服务运行中。前端构建文件未找到，请先构建前端项目。');
    }
  });
});

// ---- 启动服务 ----
initializeDatabase();

const server = app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  快递柜管理系统后端服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  API 文档: http://localhost:${PORT}/api-docs`);
  console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

export default app;
