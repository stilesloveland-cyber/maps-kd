/**
 * 系统概览统计路由模块
 * 返回系统核心指标的统计概览数据
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDatabase, getCurrentDataVersion } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: 获取系统概览统计
 *     description: 返回柜机数、标签数、备份数、今日操作数、版本号、数据库大小等统计（需登录）
 *     tags: [系统统计]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计数据
 */
router.get('/', authMiddleware, (_req: Request, res: Response): void => {
  const db = getDatabase();

  // 柜机总数
  const cabinetCount: number = (db.prepare('SELECT COUNT(*) AS count FROM cabinets').get() as { count: number }).count;

  // 标签总数
  const tagCount: number = (db.prepare('SELECT COUNT(*) AS count FROM tags').get() as { count: number }).count;

  // 区域总数
  const zoneCount: number = (db.prepare('SELECT COUNT(*) AS count FROM zones').get() as { count: number }).count;

  // 备份总数
  const backupCount: number = (db.prepare('SELECT COUNT(*) AS count FROM backups').get() as { count: number }).count;

  // 今日操作数（按本地日期统计）
  const todayStart: string = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const todayOps: number = (db.prepare(
    'SELECT COUNT(*) AS count FROM logs WHERE createdAt >= ?'
  ).get(todayStart) as { count: number }).count;

  // 数据版本号
  const dataVersion: number = getCurrentDataVersion();

  // 应用版本号
  const appVersion: string = (db.prepare(
    'SELECT appVersion FROM systemMeta WHERE id = ?'
  ).get('global') as { appVersion: string }).appVersion;

  // 数据库文件大小
  const dbPath: string = path.resolve(__dirname, '..', 'data', 'cabinet.db');
  let dbSizeBytes: number = 0;
  let dbSizeFormatted: string = '0 B';
  try {
    if (fs.existsSync(dbPath)) {
      dbSizeBytes = fs.statSync(dbPath).size;
      dbSizeFormatted = formatFileSize(dbSizeBytes);
    }
  } catch {
    dbSizeFormatted = '未知';
  }

  res.json({
    cabinetCount,
    tagCount,
    zoneCount,
    backupCount,
    todayOps,
    dataVersion,
    appVersion,
    dbSize: dbSizeFormatted,
    dbSizeBytes,
  });
});

/**
 * 格式化文件大小为可读字符串
 * @param bytes - 文件字节数
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units: string[] = ['B', 'KB', 'MB', 'GB'];
  const k: number = 1024;
  const i: number = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

export default router;
