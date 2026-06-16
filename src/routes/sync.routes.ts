import { Router } from 'express';
import { pullSync, pushSync } from '../controllers/sync.controller';
import { authenticate } from '../middleware/auth.middleware';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.post('/pull', pullSync);
router.post('/push', pushSync);

export default router;
