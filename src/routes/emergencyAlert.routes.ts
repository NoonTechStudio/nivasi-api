import { Router } from 'express';
import { raiseAlert, listActiveAlerts, resolveAlert } from '../controllers/emergencyAlert.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.post('/', requireRole('RESIDENT'), raiseAlert);
router.get('/', requireRole('WING_ADMIN', 'GUARD'), listActiveAlerts);
router.patch('/:id/resolve', requireRole('WING_ADMIN', 'GUARD'), resolveAlert);

export default router;
