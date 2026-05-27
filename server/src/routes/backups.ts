/**
 * 版本备份与回滚路由模块
 * 支持查看备份列表、创建手动主备份、一键回滚到指定版本
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, incrementDataVersion, addLog } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * /api/backups:
 *   get:
 *     summary: 获取备份列表
 *     description: 返回所有备份版本列表（需登录）
 *     tags: [版本管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 备份列表
 */
router.get('/', authMiddleware, (_req: Request, res: Response): void => {
  const db = getDatabase();
  const backups = db.prepare(
    'SELECT id, version, type, remark, createdAt FROM backups ORDER BY version DESC'
  ).all();

  res.json(backups);
});

/**
 * @swagger
 * /api/backups:
 *   post:
 *     summary: 创建手动主备份
 *     description: 管理员手动创建带备注的备份快照（需登录）
 *     tags: [版本管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remark:
 *                 type: string
 *                 description: 备份备注说明
 *     responses:
 *       201:
 *         description: 备份创建成功
 */
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  const { remark }: { remark?: string } = req.body;

  const db = getDatabase();
  const cabinets = db.prepare('SELECT * FROM cabinets').all();
  const maxVersion = db.prepare('SELECT COALESCE(MAX(version), 0) AS maxVer FROM backups').get() as { maxVer: number };
  const now: string = new Date().toISOString();

  const backupData = {
    id: uuidv4(),
    version: maxVersion.maxVer + 1,
    type: 'manual',
    remark: remark || null,
    snapshot: JSON.stringify(cabinets),
    createdAt: now,
  };

  db.prepare(
    'INSERT INTO backups (id, version, type, remark, snapshot, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(backupData.id, backupData.version, backupData.type, backupData.remark, backupData.snapshot, backupData.createdAt);

  addLog('create_backup', `创建手动备份 v${backupData.version}${remark ? `: "${remark}"` : ''}`, req.admin!.username);

  res.status(201).json({
    id: backupData.id,
    version: backupData.version,
    type: backupData.type,
    remark: backupData.remark,
    createdAt: backupData.createdAt,
  });
});

/**
 * @swagger
 * /api/backups/{id}/rollback:
 *   post:
 *     summary: 回滚到指定备份版本
 *     description: 将柜机数据回滚到指定备份版本的状态（需登录），回滚前会先创建当前版本的自动备份
 *     tags: [版本管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 备份 ID
 *     responses:
 *       200:
 *         description: 回滚成功
 *       404:
 *         description: 备份不存在
 */
router.post('/:id/rollback', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;

  const db = getDatabase();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as {
    version: number; snapshot: string; type: string; remark: string | null;
  } | undefined;

  if (!backup) {
    res.status(404).json({ error: '备份不存在' });
    return;
  }

  // ---- 回滚前先创建当前数据的自动备份（防止误操作丢失数据） ----
  const currentCabinets = db.prepare('SELECT * FROM cabinets').all();
  const maxVersion = db.prepare('SELECT COALESCE(MAX(version), 0) AS maxVer FROM backups').get() as { maxVer: number };
  const now: string = new Date().toISOString();

  db.prepare(
    'INSERT INTO backups (id, version, type, snapshot, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), maxVersion.maxVer + 1, 'auto', JSON.stringify(currentCabinets), now);

  // ---- 执行回滚 ----
  const snapshot: Array<Record<string, unknown>> = JSON.parse(backup.snapshot);

  const rollbackTransaction = db.transaction(() => {
    // 清空当前柜机表
    db.prepare('DELETE FROM cabinets').run();

    // 批量插入备份中的柜机数据
    const insertStmt = db.prepare(
      'INSERT INTO cabinets (id, name, number, x, y, width, height, tags, zoneId, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const cab of snapshot) {
      insertStmt.run(
        cab.id, cab.name, cab.number, cab.x, cab.y,
        cab.width, cab.height, cab.tags || '[]', cab.zoneId || null,
        cab.color || '#4A90D9', cab.createdAt, cab.updatedAt
      );
    }
  });

  rollbackTransaction();

  incrementDataVersion();
  const backupLabel: string = backup.type === 'manual' && backup.remark
    ? `v${backup.version} ("${backup.remark}")`
    : `v${backup.version}`;
  addLog('rollback', `回滚到备份版本 ${backupLabel}`, req.admin!.username);

  res.json({
    message: `已回滚到备份版本 v${backup.version}`,
    cabinetCount: snapshot.length,
  });
});

export default router;
