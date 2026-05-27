/**
 * 操作日志路由模块
 * 提供日志列表查询（分页、按类型筛选、按日期范围搜索）和最近日志获取
 */
import { Router, Request, Response } from 'express';
import { getDatabase } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: 获取操作日志列表
 *     description: 分页查询操作日志，支持按类型筛选和日期范围搜索（需登录）
 *     tags: [日志管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页条数
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 按操作类型筛选
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *         description: 开始日期（ISO 格式）
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *         description: 结束日期（ISO 格式）
 *     responses:
 *       200:
 *         description: 日志列表（含分页信息）
 */
router.get('/', authMiddleware, (req: Request, res: Response): void => {
  const db = getDatabase();

  // 解析查询参数
  const page: number = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize: number = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '20'), 10)));
  const type: string | undefined = req.query.type as string | undefined;
  const startDate: string | undefined = req.query.startDate as string | undefined;
  const endDate: string | undefined = req.query.endDate as string | undefined;

  // 构建 WHERE 条件
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (type && type !== 'all') {
    conditions.push('type = ?');
    params.push(type);
  }

  if (startDate) {
    conditions.push('createdAt >= ?');
    params.push(startDate);
  }

  if (endDate) {
    // 将结束日期加一天以包含当天所有记录
    const endDateTime: Date = new Date(endDate);
    endDateTime.setDate(endDateTime.getDate() + 1);
    conditions.push('createdAt < ?');
    params.push(endDateTime.toISOString());
  }

  const whereClause: string = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 查询总数
  const countResult = db.prepare(
    `SELECT COUNT(*) AS total FROM logs ${whereClause}`
  ).get(...params) as { total: number };

  const total: number = countResult.total;
  const offset: number = (page - 1) * pageSize;

  // 查询分页数据（按时间倒序）
  const logs = db.prepare(
    `SELECT * FROM logs ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  res.json({
    data: logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * @swagger
 * /api/logs/recent:
 *   get:
 *     summary: 获取最近操作日志
 *     description: 获取最近 N 条操作日志，供后台面板概览使用（需登录）
 *     tags: [日志管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 获取条数
 *     responses:
 *       200:
 *         description: 最近日志列表
 */
router.get('/recent', authMiddleware, (req: Request, res: Response): void => {
  const db = getDatabase();
  const limit: number = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));

  const logs = db.prepare(
    'SELECT * FROM logs ORDER BY createdAt DESC LIMIT ?'
  ).all(limit);

  res.json(logs);
});

export default router;
