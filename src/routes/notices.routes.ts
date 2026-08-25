import { Router } from 'express';
import { listNotices, createNotice, deleteNotice, markNoticeSeen, getNoticeSeenDetail } from '../controllers/notices.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', listNotices);
router.post('/', requireRole('WING_ADMIN'), createNotice);
router.delete('/:id', requireRole('WING_ADMIN'), deleteNotice);
router.post('/:id/seen', markNoticeSeen);
router.get('/:id/seen-detail', requireRole('WING_ADMIN'), getNoticeSeenDetail);

export default router;
