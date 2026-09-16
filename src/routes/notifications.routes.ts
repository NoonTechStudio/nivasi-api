import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notifications.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/:id/read', markNotificationRead);
router.post('/read-all', markAllNotificationsRead);

export default router;
