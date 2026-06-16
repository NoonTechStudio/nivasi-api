import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../utils/response';

export function wingGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.wing_id) {
    return forbidden(res, 'Wing context missing');
  }
  next();
}

export const getWingFilter = (req: Request) => ({ wingId: req.user.wing_id });
