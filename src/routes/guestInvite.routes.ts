import { Router } from 'express';
import {
  listMyInvites, createInvite, cancelInvite, verifyInviteCode,
} from '../controllers/guestInvite.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', requireRole('RESIDENT'), listMyInvites);
router.post('/', requireRole('RESIDENT'), createInvite);
router.delete('/:id', requireRole('RESIDENT'), cancelInvite);
router.post('/verify', requireRole('GUARD'), verifyInviteCode);

export default router;
