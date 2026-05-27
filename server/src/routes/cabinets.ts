/**
 * 柜机路由模块
 * 处理柜机的完整 CRUD、位置更新、标签更新、Excel 导入导出和模板下载
 * 每次修改操作自动递增数据版本号并记录操作日志
 * 每次添加/删除自动创建备份快照
 *
 * 注意：静态路径（/export, /import, /template）必须在 /:id 通配路由之前注册，
 *       否则 Express 会将 'export' 解析为 id 参数
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getDatabase, incrementDataVersion, addLog } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

// 配置文件上传：内存存储，限制 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * 创建自动备份快照（添加/删除柜机时自动调用）
 */
function createAutoSnapshot(): void {
  const db = getDatabase();
  const cabinets = db.prepare('SELECT * FROM cabinets').all();
  const maxVersion = db.prepare('SELECT COALESCE(MAX(version), 0) AS maxVer FROM backups').get() as { maxVer: number };
  const now: string = new Date().toISOString();

  db.prepare(
    'INSERT INTO backups (id, version, type, snapshot, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), maxVersion.maxVer + 1, 'auto', JSON.stringify(cabinets), now);
}

// ====================================================================
// 静态路径路由（必须在 /:id 之前注册）
// ====================================================================

/**
 * @swagger
 * /api/cabinets/export:
 *   get:
 *     summary: 导出柜机数据为 .xlsx 文件
 *     description: 将所有柜机数据导出为 Excel 文件（需登录）
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel 文件
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export', authMiddleware, (_req: Request, res: Response): void => {
  const db = getDatabase();
  const cabinets = db.prepare('SELECT * FROM cabinets ORDER BY number ASC').all() as Array<{
    number: string; name: string; x: number; y: number;
    width: number; height: number; color: string; zoneId: string | null; tags: string;
  }>;

  // 构建导出数据
  const exportData = cabinets.map((cab) => ({
    编号: cab.number,
    名称: cab.name,
    X坐标: cab.x,
    Y坐标: cab.y,
    宽度: cab.width,
    高度: cab.height,
    颜色: cab.color,
    区域: cab.zoneId || '',
    标签: cab.tags,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(workbook, worksheet, '柜机数据');

  const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  addLog('export_cabinets', `导出了 ${cabinets.length} 个柜机的数据到 Excel`, _req.admin!.username);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=cabinets_export_${Date.now()}.xlsx`);
  res.send(buffer);
});

/**
 * @swagger
 * /api/cabinets/import:
 *   post:
 *     summary: 从 .xlsx 文件批量导入柜机
 *     description: 上传 Excel 文件批量导入柜机（需登录），自动跳过编号重复的柜机
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 导入结果
 */
router.post('/import', authMiddleware, upload.single('file'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: '请上传 .xlsx 文件' });
    return;
  }

  const db = getDatabase();
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName: string = workbook.SheetNames[0];
  const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  if (rows.length === 0) {
    res.status(400).json({ error: 'Excel 文件为空' });
    return;
  }

  const now: string = new Date().toISOString();
  let successCount: number = 0;
  let failCount: number = 0;
  const failReasons: Array<{ row: number; reason: string }> = [];

  // 收集已有的柜机编号用于去重
  const existingNumbers = new Set<string>(
    (db.prepare('SELECT number FROM cabinets').all() as Array<{ number: string }>).map((r) => r.number)
  );

  const insertTransaction = db.transaction(() => {
    for (let i: number = 0; i < rows.length; i++) {
      const row: Record<string, unknown> = rows[i];
      const number: string = String(row['编号'] || '').trim();
      const name: string = String(row['名称'] || '').trim();

      if (!number || !name) {
        failCount++;
        failReasons.push({ row: i + 2, reason: '编号或名称为空' });
        continue;
      }

      if (existingNumbers.has(number)) {
        failCount++;
        failReasons.push({ row: i + 2, reason: `编号 "${number}" 已存在` });
        continue;
      }

      const x: number = parseFloat(String(row['X坐标'])) || 0;
      const y: number = parseFloat(String(row['Y坐标'])) || 0;
      const width: number = parseFloat(String(row['宽度'])) || 200;
      const height: number = parseFloat(String(row['高度'])) || 60;
      const color: string = String(row['颜色'] || '#4A90D9');
      const zoneId: string | null = String(row['区域'] || '').trim() || null;
      let tags: string = '[]';
      try {
        const rawTags: string = String(row['标签'] || '[]');
        tags = JSON.stringify(JSON.parse(rawTags));
      } catch {
        tags = '[]';
      }

      db.prepare(
        'INSERT INTO cabinets (id, name, number, x, y, width, height, tags, zoneId, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), name, number, x, y, width, height, tags, zoneId, color, now, now);

      existingNumbers.add(number);
      successCount++;
    }
  });

  insertTransaction();

  if (successCount > 0) {
    incrementDataVersion();
    addLog('import_cabinets', `从 Excel 导入了 ${successCount} 个柜机${failCount > 0 ? `，${failCount} 个跳过` : ''}`, req.admin!.username);
    createAutoSnapshot();
  }

  res.json({
    success: true,
    total: rows.length,
    successCount,
    failCount,
    failReasons,
    message: `成功导入 ${successCount} 个柜机${failCount > 0 ? `，${failCount} 个跳过` : ''}`,
  });
});

/**
 * @swagger
 * /api/cabinets/template:
 *   get:
 *     summary: 下载导入模板
 *     description: 下载柜机导入模板 .xlsx 文件（公开接口）
 *     tags: [柜机管理]
 *     responses:
 *       200:
 *         description: 模板文件
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/template', (_req: Request, res: Response): void => {
  const templateData = [
    {
      编号: 'C-01',
      名称: '示例柜机A',
      X坐标: 100,
      Y坐标: 200,
      宽度: 200,
      高度: 60,
      颜色: '#4A90D9',
      区域: '',
      标签: '[]',
    },
    {
      编号: 'C-02',
      名称: '示例柜机B',
      X坐标: 400,
      Y坐标: 200,
      宽度: 200,
      高度: 60,
      颜色: '#E02020',
      区域: '',
      标签: '[]',
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 10 }, // 编号
    { wch: 20 }, // 名称
    { wch: 10 }, // X坐标
    { wch: 10 }, // Y坐标
    { wch: 8 },  // 宽度
    { wch: 8 },  // 高度
    { wch: 12 }, // 颜色
    { wch: 10 }, // 区域
    { wch: 20 }, // 标签
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');

  const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=import_template.xlsx');
  res.send(buffer);
});

// ====================================================================
// 通用 CRUD 路由（含参数化路径）
// ====================================================================

/**
 * @swagger
 * /api/cabinets:
 *   get:
 *     summary: 获取所有柜机列表
 *     description: 返回所有柜机数据（公开接口）
 *     tags: [柜机管理]
 *     responses:
 *       200:
 *         description: 柜机列表
 */
router.get('/', (_req: Request, res: Response): void => {
  const db = getDatabase();
  const cabinets = db.prepare('SELECT * FROM cabinets ORDER BY createdAt ASC').all();

  // 将 tags 字段从 JSON 字符串解析为数组
  const parsed = (cabinets as Array<Record<string, unknown>>).map((cab: Record<string, unknown>) => ({
    ...cab,
    tags: typeof cab.tags === 'string' ? JSON.parse(cab.tags as string) : cab.tags,
  }));

  res.json(parsed);
});

/**
 * @swagger
 * /api/cabinets:
 *   post:
 *     summary: 新增柜机
 *     description: 创建一个新的快递柜（需登录），自动创建备份快照
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, number]
 *             properties:
 *               name:
 *                 type: string
 *               number:
 *                 type: string
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               color:
 *                 type: string
 *               zoneId:
 *                 type: string
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 */
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  const { name, number, x, y, width, height, color, zoneId }: {
    name: string; number: string; x?: number; y?: number;
    width?: number; height?: number; color?: string; zoneId?: string;
  } = req.body;

  if (!name || !name.trim() || !number || !number.trim()) {
    res.status(400).json({ error: '柜机名称和编号不能为空' });
    return;
  }

  // 检查编号是否重复
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM cabinets WHERE number = ?').get(number.trim());
  if (existing) {
    res.status(400).json({ error: `柜机编号 "${number}" 已存在` });
    return;
  }

  const now: string = new Date().toISOString();
  const cabinetData = {
    id: uuidv4(),
    name: name.trim(),
    number: number.trim(),
    x: x ?? 0,
    y: y ?? 0,
    width: width ?? 200,
    height: height ?? 60,
    tags: '[]',
    zoneId: zoneId || null,
    color: color || '#4A90D9',
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    'INSERT INTO cabinets (id, name, number, x, y, width, height, tags, zoneId, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(cabinetData.id, cabinetData.name, cabinetData.number, cabinetData.x, cabinetData.y,
    cabinetData.width, cabinetData.height, cabinetData.tags, cabinetData.zoneId,
    cabinetData.color, cabinetData.createdAt, cabinetData.updatedAt);

  incrementDataVersion();
  addLog('add_cabinet', `添加柜机 "${cabinetData.number} - ${cabinetData.name}"`, req.admin!.username);
  createAutoSnapshot();

  res.status(201).json({ ...cabinetData, tags: [] });
});

/**
 * @swagger
 * /api/cabinets/{id}:
 *   put:
 *     summary: 更新柜机信息
 *     description: 更新柜机的名称、编号、颜色、尺寸等基本信息（需登录）
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               number:
 *                 type: string
 *               color:
 *                 type: string
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               zoneId:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 柜机不存在
 */
router.put('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM cabinets WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: '柜机不存在' });
    return;
  }

  const { name, number, color, width, height, zoneId }: {
    name?: string; number?: string; color?: string; width?: number; height?: number; zoneId?: string | null;
  } = req.body;

  const now: string = new Date().toISOString();
  const updatedData: Record<string, unknown> = {
    name: name ?? existing.name,
    number: number ?? existing.number,
    color: color ?? existing.color,
    width: width ?? existing.width,
    height: height ?? existing.height,
    zoneId: zoneId !== undefined ? zoneId : existing.zoneId,
    updatedAt: now,
  };

  db.prepare(
    'UPDATE cabinets SET name = ?, number = ?, color = ?, width = ?, height = ?, zoneId = ?, updatedAt = ? WHERE id = ?'
  ).run(updatedData.name, updatedData.number, updatedData.color, updatedData.width,
    updatedData.height, updatedData.zoneId, updatedData.updatedAt, id);

  incrementDataVersion();
  addLog('edit_cabinet', `编辑柜机 "${updatedData.number}" 的信息`, req.admin!.username);

  const result = db.prepare('SELECT * FROM cabinets WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({
    ...result,
    tags: typeof result.tags === 'string' ? JSON.parse(result.tags as string) : result.tags,
  });
});

/**
 * @swagger
 * /api/cabinets/{id}:
 *   delete:
 *     summary: 删除柜机
 *     description: 删除指定的快递柜（需登录），自动创建备份快照
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 删除成功
 *       404:
 *         description: 柜机不存在
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const db = getDatabase();
  const cabinet = db.prepare('SELECT * FROM cabinets WHERE id = ?').get(id) as { number: string; name: string } | undefined;

  if (!cabinet) {
    res.status(404).json({ error: '柜机不存在' });
    return;
  }

  db.prepare('DELETE FROM cabinets WHERE id = ?').run(id);

  incrementDataVersion();
  addLog('del_cabinet', `删除柜机 "${cabinet.number} - ${cabinet.name}"`, req.admin!.username);
  createAutoSnapshot();

  res.json({ message: `柜机 "${cabinet.number}" 已删除` });
});

/**
 * @swagger
 * /api/cabinets/{id}/position:
 *   put:
 *     summary: 更新柜机位置
 *     description: 更新柜机的 X/Y 坐标（拖拽移动时调用）（需登录）
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [x, y]
 *             properties:
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 *     responses:
 *       200:
 *         description: 位置更新成功
 *       404:
 *         description: 柜机不存在
 */
router.put('/:id/position', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const { x, y }: { x: number; y: number } = req.body;

  if (typeof x !== 'number' || typeof y !== 'number') {
    res.status(400).json({ error: '请提供有效的 X/Y 坐标' });
    return;
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM cabinets WHERE id = ?').get(id) as { number: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: '柜机不存在' });
    return;
  }

  const now: string = new Date().toISOString();
  db.prepare('UPDATE cabinets SET x = ?, y = ?, updatedAt = ? WHERE id = ?').run(x, y, now, id);

  incrementDataVersion();
  addLog('move_cabinet', `移动柜机 "${existing.number}" 到位置 (${x}, ${y})`, req.admin!.username);

  res.json({ id, x, y, message: '位置已更新' });
});

/**
 * @swagger
 * /api/cabinets/{id}/tags:
 *   put:
 *     summary: 更新柜机标签
 *     description: 批量更新柜机的标签列表（需登录）
 *     tags: [柜机管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tags]
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 标签 ID 数组
 *     responses:
 *       200:
 *         description: 标签更新成功
 *       404:
 *         description: 柜机不存在
 */
router.put('/:id/tags', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const { tags }: { tags: string[] } = req.body;

  if (!Array.isArray(tags)) {
    res.status(400).json({ error: 'tags 必须是数组' });
    return;
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM cabinets WHERE id = ?').get(id) as { number: string } | undefined;

  if (!existing) {
    res.status(404).json({ error: '柜机不存在' });
    return;
  }

  const now: string = new Date().toISOString();
  db.prepare('UPDATE cabinets SET tags = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(tags), now, id);

  incrementDataVersion();
  addLog('edit_tags', `更新柜机 "${existing.number}" 的标签`, req.admin!.username);

  const result = db.prepare('SELECT * FROM cabinets WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({
    ...result,
    tags: typeof result.tags === 'string' ? JSON.parse(result.tags as string) : result.tags,
  });
});

export default router;
