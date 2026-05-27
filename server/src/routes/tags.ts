/**
 * 标签路由模块
 * 处理标签的 CRUD 操作
 * 预置标签不可删除，仅自定义标签（category='custom'）可删除
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, incrementDataVersion, addLog } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: 获取所有标签
 *     description: 返回所有标签列表（公开接口）
 *     tags: [标签管理]
 *     responses:
 *       200:
 *         description: 标签列表
 */
router.get('/', (_req: Request, res: Response): void => {
  const db = getDatabase();
  const tags = db.prepare('SELECT * FROM tags ORDER BY category, name').all();
  res.json(tags);
});

/**
 * @swagger
 * /api/tags:
 *   post:
 *     summary: 新增自定义标签
 *     description: 创建新的自定义标签（需登录）
 *     tags: [标签管理]
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
 *                 description: 标签名称
 *               color:
 *                 type: string
 *                 description: 标签颜色（十六进制，默认 #6B7280）
 *               category:
 *                 type: string
 *                 description: 标签分类，默认 'custom'
 *     responses:
 *       201:
 *         description: 创建成功
 *       400:
 *         description: 参数错误
 */
router.post('/', authMiddleware, (req: Request, res: Response): void => {
  const { name, color, category }: { name: string; color?: string; category?: string } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: '标签名称不能为空' });
    return;
  }

  // 检查标签名是否已存在
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim());
  if (existing) {
    res.status(400).json({ error: `标签 "${name}" 已存在` });
    return;
  }

  const id: string = uuidv4();
  const tagData = {
    id,
    name: name.trim(),
    color: color || '#6B7280',
    category: category || 'custom',
  };

  db.prepare(
    'INSERT INTO tags (id, name, category, color) VALUES (?, ?, ?, ?)'
  ).run(tagData.id, tagData.name, tagData.category, tagData.color);

  incrementDataVersion();
  addLog('edit_tags', `新增标签 "${tagData.name}"`, req.admin!.username);

  res.status(201).json(tagData);
});

/**
 * @swagger
 * /api/tags/{id}:
 *   delete:
 *     summary: 删除自定义标签
 *     description: 删除指定标签（仅可删除自定义标签，预置标签不可删除）（需登录）
 *     tags: [标签管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 标签 ID
 *     responses:
 *       200:
 *         description: 删除成功
 *       400:
 *         description: 无法删除预置标签
 *       404:
 *         description: 标签不存在
 */
router.delete('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;

  const db = getDatabase();
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as { id: string; name: string; category: string } | undefined;

  if (!tag) {
    res.status(404).json({ error: '标签不存在' });
    return;
  }

  // 禁止删除预置标签（快递公司和品牌标签）
  if (tag.category !== 'custom') {
    res.status(400).json({ error: `"${tag.name}" 是预置标签，无法删除` });
    return;
  }

  // 从所有柜机中移除该标签引用
  const cabinetsWithTag = db.prepare(
    "SELECT id, tags FROM cabinets WHERE tags LIKE ?"
  ).all(`%${id}%`) as Array<{ id: string; tags: string }>;

  for (const cabinet of cabinetsWithTag) {
    const tagIds: string[] = JSON.parse(cabinet.tags);
    const updatedTags: string[] = tagIds.filter((tId: string) => tId !== id);
    db.prepare('UPDATE cabinets SET tags = ?, updatedAt = ? WHERE id = ?').run(
      JSON.stringify(updatedTags),
      new Date().toISOString(),
      cabinet.id
    );
  }

  db.prepare('DELETE FROM tags WHERE id = ?').run(id);

  incrementDataVersion();
  addLog('edit_tags', `删除标签 "${tag.name}"`, req.admin!.username);

  res.json({ message: `标签 "${tag.name}" 已删除` });
});

/**
 * @swagger
 * /api/tags/{id}:
 *   put:
 *     summary: 更新标签
 *     description: 更新指定标签的名称或颜色（需登录）
 *     tags: [标签管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 标签 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 标签名称（可选）
 *               color:
 *                 type: string
 *                 description: 标签颜色（可选）
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 标签不存在
 */
router.put('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const { name, color }: { name?: string; color?: string } = req.body;

  const db = getDatabase();
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as { id: string; name: string; category: string; color: string } | undefined;

  if (!tag) {
    res.status(404).json({ error: '标签不存在' });
    return;
  }

  const newName = name ? name.trim() : tag.name;
  const newColor = color || tag.color;

  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(newName, newColor, id);

  incrementDataVersion();
  addLog('edit_tags', `更新标签 "${tag.name}" -> "${newName}"`, req.admin!.username);

  res.json({ ...tag, name: newName, color: newColor });
});

export default router;
