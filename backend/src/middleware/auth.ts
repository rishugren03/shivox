import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

export const JWT_SECRET = process.env.JWT_SECRET || 'tsenta-super-secret-jwt-key-2026';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export function generateToken(user: { id: string; email: string | null }): string {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.split(' ')[1]?.trim();
    if (candidate && candidate !== 'undefined' && candidate !== 'null' && candidate.length > 0) {
      token = candidate;
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      const user = await prisma.userProfile.findUnique({ where: { id: decoded.userId } });

      if (user) {
        req.user = user;
        return next();
      }
    } catch (err: any) {
      console.warn('[Auth] JWT token invalid/expired, checking fallbacks:', err.message);
    }
  }

  // Fallback 1: x-user-id header
  const userIdHeader = (req.headers['x-user-id'] as string)?.trim();
  if (userIdHeader && userIdHeader !== 'undefined' && userIdHeader !== 'null' && userIdHeader.length > 0) {
    const user = await prisma.userProfile.findUnique({ where: { id: userIdHeader } });
    if (user) {
      req.user = user;
      return next();
    }
  }

  // Fallback 2: x-user-email header
  const userEmailHeader = (req.headers['x-user-email'] as string)?.trim();
  if (userEmailHeader && userEmailHeader !== 'undefined' && userEmailHeader !== 'null' && userEmailHeader.length > 0) {
    const user = await prisma.userProfile.findUnique({ where: { email: userEmailHeader } });
    if (user) {
      req.user = user;
      return next();
    }
  }

  // Fallback 3: Default single-user / demo user mode if DB has a user profile
  const defaultUser = await prisma.userProfile.findFirst();
  if (defaultUser) {
    req.user = defaultUser;
    return next();
  }

  return res.status(401).json({ error: 'Authentication required. Please log in.' });
}
