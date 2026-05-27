/**
 * JWT 认证中间件模块
 * 提供 Token 生成、验证和请求拦截功能
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT 密钥：优先使用环境变量，否则使用默认密钥（生产环境建议修改）
const JWT_SECRET: string = process.env.JWT_SECRET || 'cabinet-management-secret-key-2024';
// Token 过期时间：24小时
const TOKEN_EXPIRES_IN: string = '24h';

// 扩展 Express Request 类型，添加管理员信息字段
export interface AdminPayload {
  id: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

/**
 * 生成 JWT Token
 * @param payload - 管理员信息（id + username）
 * @returns 签发的 JWT 字符串
 */
export function generateToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * JWT 认证中间件
 * 从请求头 Authorization: Bearer <token> 中提取并验证 Token
 * 验证失败返回 401，成功后将管理员信息注入 req.admin
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader: string | undefined = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证 Token，请先登录' });
    return;
  }

  const token: string = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload;
    req.admin = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token 已过期，请重新登录' });
    } else {
      res.status(401).json({ error: '无效的 Token，请重新登录' });
    }
  }
}
