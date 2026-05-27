/**
 * 区域路由模块
 * 处理区域的 CRUD 操作
 * 删除区域时，属于该区域的柜机自动变为无区域状态
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, incrementDataVersion, addLog } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * /api/zones:
 *   get:
 *     summary: 获取所有区域
 *     description: 返回所有区域列表（公开接口）
 *     tags: [区域管理]
 *     responses:
 *       200:
 *         description: 区域列表
 */
router.get('/', (_req: Request, res: Response): void => {
  const db = getDatabase();
  const zones = db.prepare('SELECT * FROM zones ORDER BY createdAt ASC').all();
  res.json(zones);
});

/**
 * @swagger
 * /api/zones:
 *   post:
 *     summary: 创建新区域
 *     description: 创建一个新的柜机区域（需登录）
 *     tags: [区域管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: 区域名称
 *               color:
 *                 type: string
 *                 description: 区域颜色（十六进制）
 *               x:
 *                 type: number
 *                 description: X 坐标
 *               y:
 *                 type: number
 *                 description: Y 坐标
 *               width:
 *                 type: number
 *                 description: 区域宽度
 *               height:
 *                 type: number
 *                 description: 区域高度
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 */
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  const { name, color, x, y, width, height, fillEnabled, strokeColor, strokeWidth, strokeStyle }: {
    name: string; color?: string; x?: number; y?: number; width?: number; height?: number;
    fillEnabled?: boolean; strokeColor?: string; strokeWidth?: number; strokeStyle?: string;
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: '区域名称不能为空' });
    return;
  }

  const now: string = new Date().toISOString();
  const zoneData = {
    id: uuidv4(),
    name: name.trim(),
    color: color || '#4A90D9',
    fillEnabled: fillEnabled !== undefined ? (fillEnabled ? 1 : 0) : 1,
    strokeColor: strokeColor || '#4A90D9',
    strokeWidth: strokeWidth ?? 2,
    strokeStyle: strokeStyle || 'dashed',
    x: x ?? 0,
    y: y ?? 0,
    width: width ?? 300,
    height: height ?? 200,
    createdAt: now,
    updatedAt: now,
  };

  const db = getDatabase();
  db.prepare(
    'INSERT INTO zones (id, name, color, fillEnabled, strokeColor, strokeWidth, strokeStyle, x, y, width, height, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(zoneData.id, zoneData.name, zoneData.color, zoneData.fillEnabled, zoneData.strokeColor,
    zoneData.strokeWidth, zoneData.strokeStyle, zoneData.x, zoneData.y, zoneData.width,
    zoneData.height, zoneData.createdAt, zoneData.updatedAt);

  incrementDataVersion();
  addLog('create_zone', `创建区域 "${zoneData.name}"`, req.admin!.username);

  res.status(201).json(zoneData);
});

/**
 * @swagger
 * /api/zones/{id}:
 *   put:
 *     summary: 更新区域信息
 *     description: 更新区域的名称、颜色、位置或大小（需登录）
 *     tags: [区域管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 区域 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 区域不存在
 */
router.put('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM zones WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: '区域不存在' });
    return;
  }

  const { name, color, x, y, width, height, fillEnabled, strokeColor, strokeWidth, strokeStyle }: {
    name?: string; color?: string; x?: number; y?: number; width?: number; height?: number;
    fillEnabled?: boolean; strokeColor?: string; strokeWidth?: number; strokeStyle?: string;
  } = req.body;

  const now: string = new Date().toISOString();
  const updatedData: Record<string, unknown> = {
    name: name ?? existing.name,
    color: color ?? existing.color,
    fillEnabled: fillEnabled !== undefined ? (fillEnabled ? 1 : 0) : existing.fillEnabled,
    strokeColor: strokeColor ?? existing.strokeColor,
    strokeWidth: strokeWidth ?? existing.strokeWidth,
    strokeStyle: strokeStyle ?? existing.strokeStyle,
    x: x ?? existing.x,
    y: y ?? existing.y,
    width: width ?? existing.width,
    height: height ?? existing.height,
    updatedAt: now,
  };

  db.prepare(
    'UPDATE zones SET name = ?, color = ?, fillEnabled = ?, strokeColor = ?, strokeWidth = ?, strokeStyle = ?, x = ?, y = ?, width = ?, height = ?, updatedAt = ? WHERE id = ?'
  ).run(updatedData.name, updatedData.color, updatedData.fillEnabled, updatedData.strokeColor,
    updatedData.strokeWidth, updatedData.strokeStyle, updatedData.x, updatedData.y,
    updatedData.width, updatedData.height, updatedData.updatedAt, id);

  incrementDataVersion();
  addLog('edit_zone', `更新区域 "${updatedData.name}" 的信息`, req.admin!.username);

  res.json({ id, ...updatedData });
});

/**
 * @swagger
 * /api/zones/{id}:
 *   delete:
 *     summary: 删除区域
 *     description: 删除指定区域，该区域下的柜机自动变为无区域状态（需登录）
 *     tags: [区域管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 区域 ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 区域不存在
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;

  const db = getDatabase();
  const zone = db.prepare('SELECT * FROM zones WHERE id = ?').get(id) as { name: string } | undefined;

  if (!zone) {
    res.status(404).json({ error: '区域不存在' });
    return;
  }

  // 将该区域下的所有柜机 zoneId 置为 null
  db.prepare('UPDATE cabinets SET zoneId = NULL, updatedAt = ? WHERE zoneId = ?').run(new Date().toISOString(), id);

  db.prepare('DELETE FROM zones WHERE id = ?').run(id);

  incrementDataVersion();
  addLog('del_zone', `删除区域 "${zone.name}"`, req.admin!.username);

  res.json({ message: `区域 "${zone.name}" 已删除，其下柜机已解除区域关联` });
});

export default router;
