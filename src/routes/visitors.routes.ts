import { Router } from 'express';
import { listVisitors, logVisitor, approveVisitor, denyVisitor, logVisitorExit } from '../controllers/visitors.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', listVisitors);
router.post('/', requireRole('GUARD'), logVisitor);
router.put('/:id/approve', requireRole('RESIDENT'), approveVisitor);
router.put('/:id/deny', requireRole('RESIDENT'), denyVisitor);
router.put('/:id/exit', requireRole('GUARD'), logVisitorExit);

export default router;
