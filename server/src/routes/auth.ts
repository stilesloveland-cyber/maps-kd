/**
 * 认证路由模块
 * 处理管理员登录、修改密码、状态检查
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase, addLog } from '../db';
import { generateToken, authMiddleware } from '../middleware/auth';

const router: Router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 管理员登录
 *     description: 使用用户名和密码登录，返回 JWT Token
 *     tags: [认证管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: 管理员用户名
 *               password:
 *                 type: string
 *                 description: 密码
 *     responses:
 *       200:
 *         description: 登录成功，返回 Token
 *       401:
 *         description: 用户名或密码错误
 */
router.post('/login', (req: Request, res: Response): void => {
  const { username, password }: { username?: string; password: string } = req.body;

  if (!password) {
    res.status(400).json({ error: '请输入密码' });
    return;
  }

  // 兼容前端只传密码的登录方式，默认使用 admin 用户名
  const loginUsername: string = username || 'admin';

  const db = getDatabase();
  const admin = db.prepare(
    'SELECT id, username, passwordHash FROM admin WHERE username = ?'
  ).get(loginUsername) as { id: string; username: string; passwordHash: string } | undefined;

  if (!admin) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const isPasswordValid: boolean = bcrypt.compareSync(password, admin.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token: string = generateToken({ id: admin.id, username: admin.username });
  addLog('login', `管理员 ${admin.username} 登录系统`, admin.username);

  res.json({
    token,
    admin: { id: admin.id, username: admin.username },
  });
});

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     summary: 修改管理员密码
 *     description: 管理员修改自己的密码（需登录）
 *     tags: [认证管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 description: 旧密码
 *               newPassword:
 *                 type: string
 *                 description: 新密码
 *     responses:
 *       200:
 *         description: 密码修改成功
 *       400:
 *         description: 参数错误
 *       401:
 *         description: 旧密码错误
 */
router.put('/password', authMiddleware, (req: Request, res: Response): void => {
  const { oldPassword, newPassword }: { oldPassword: string; newPassword: string } = req.body;

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: '请提供旧密码和新密码' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: '新密码长度不能少于6位' });
    return;
  }

  const db = getDatabase();
  const admin = db.prepare(
    'SELECT id, username, passwordHash FROM admin WHERE id = ?'
  ).get(req.admin!.id) as { id: string; username: string; passwordHash: string };

  if (!bcrypt.compareSync(oldPassword, admin.passwordHash)) {
    res.status(401).json({ error: '旧密码错误' });
    return;
  }

  const newHash: string = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin SET passwordHash = ? WHERE id = ?').run(newHash, req.admin!.id);

  addLog('change_password', '管理员修改了登录密码', req.admin!.username);
  res.json({ message: '密码修改成功' });
});

/**
 * @swagger
 * /api/auth/status:
 *   get:
 *     summary: 检查登录状态
 *     description: 验证当前 Token 是否有效，返回管理员信息
 *     tags: [认证管理]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token 有效，返回管理员信息
 *       401:
 *         description: Token 无效或已过期
 */
router.get('/status', authMiddleware, (req: Request, res: Response): void => {
  res.json({
    authenticated: true,
    admin: req.admin,
  });
});

export default router;
