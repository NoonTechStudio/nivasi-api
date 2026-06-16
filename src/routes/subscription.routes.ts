import { Router } from 'express';
import {
  getAll,
  getSummary,
  getExpiring,
  updatePlan,
  recordPayment,
  getPaymentHistory,
  sendReminder,
  deletePayment,
} from '../controllers/subscription.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';

const router = Router();
router.use(authenticate, requireRole('SUPER_ADMIN'));

router.get('/', getAll);
router.get('/summary', getSummary);
router.get('/expiring', getExpiring);
router.put('/:id/plan', updatePlan);
router.post('/:id/payment', recordPayment);
router.get('/:id/history', getPaymentHistory);
router.post('/:id/reminder', sendReminder);
router.delete('/payments/:paymentId', deletePayment);

export default router;
