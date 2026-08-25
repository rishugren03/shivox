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
    token = authHeader.split(' ')[1];
  } else if (req.headers['x-user-id']) {
    // Fallback for header id if valid user exists (legacy compatibility)
    const userIdHeader = req.headers['x-user-id'] as string;
    const user = await prisma.userProfile.findUnique({ where: { id: userIdHeader } });
    if (user) {
      req.user = user;
      return next();
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await prisma.userProfile.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({ error: 'User not found. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
