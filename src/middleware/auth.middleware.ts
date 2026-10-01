import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { unauthorized } from '../utils/response';
import { prisma } from '../config/db';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
}

// Caches recent isActive lookups briefly so we're not hitting the DB on
// every single request, while still closing access within seconds of a
// resident/family member being deactivated (access tokens live for 30
// days, so without this a removed family member would keep working
// until their token happened to expire).
const activeCache = new Map<string, { active: boolean; checkedAt: number }>();
const CACHE_TTL_MS = 30_000;

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }

  try {
    const cached = activeCache.get(payload.user_id);
    let isActive: boolean;
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
      isActive = cached.active;
    } else {
      const user = await prisma.user.findUnique({ where: { id: payload.user_id }, select: { isActive: true } });
      isActive = !!user?.isActive;
      activeCache.set(payload.user_id, { active: isActive, checkedAt: Date.now() });
    }
    if (!isActive) return unauthorized(res, 'Your access has been revoked. Please contact your Wing Secretary.');
  } catch (err) {
    // If the DB check itself fails (transient outage), don't lock everyone
    // out — fall back to trusting the token rather than cascading an
    // unrelated failure into every authenticated request.
    console.error('[authenticate] isActive check failed:', err);
  }

  req.user = payload;
  next();
}
