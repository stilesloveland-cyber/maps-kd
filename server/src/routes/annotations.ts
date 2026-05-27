import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

router.get('/', (_req: Request, res: Response): void => {
  const db = getDatabase();
  const annotations = db.prepare('SELECT * FROM annotations ORDER BY createdAt ASC').all();
  res.json(annotations);
});

router.post('/', authMiddleware, (req: Request, res: Response): void => {
  const { text, x, y, fontSize, textColor, bgColor }: {
    text?: string; x?: number; y?: number; fontSize?: number; textColor?: string; bgColor?: string;
  } = req.body;

  const db = getDatabase();
  const now: string = new Date().toISOString();
  const data = {
    id: uuidv4(),
    text: text || '',
    x: x ?? 0,
    y: y ?? 0,
    fontSize: fontSize ?? 14,
    textColor: textColor || '#1e293b',
    bgColor: bgColor || '#ffffff',
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    'INSERT INTO annotations (id, text, x, y, fontSize, textColor, bgColor, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.id, data.text, data.x, data.y, data.fontSize, data.textColor, data.bgColor, data.createdAt, data.updatedAt);

  res.status(201).json(data);
});

router.put('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const { text, x, y, fontSize, textColor, bgColor }: {
    text?: string; x?: number; y?: number; fontSize?: number; textColor?: string; bgColor?: string;
  } = req.body;

  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '注释不存在' });
    return;
  }

  const now: string = new Date().toISOString();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (text !== undefined) { updates.push('text = ?'); values.push(text); }
  if (x !== undefined) { updates.push('x = ?'); values.push(x); }
  if (y !== undefined) { updates.push('y = ?'); values.push(y); }
  if (fontSize !== undefined) { updates.push('fontSize = ?'); values.push(fontSize); }
  if (textColor !== undefined) { updates.push('textColor = ?'); values.push(textColor); }
  if (bgColor !== undefined) { updates.push('bgColor = ?'); values.push(bgColor); }

  updates.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE annotations SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', authMiddleware, (req: Request, res: Response): void => {
  const id: string = req.params.id;
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '注释不存在' });
    return;
  }
  db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
