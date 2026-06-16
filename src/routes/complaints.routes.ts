import { Router } from 'express';
import {
  listComplaints,
  raiseComplaint,
  assignComplaint,
  updateComplaintStatus,
} from '../controllers/complaints.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', listComplaints);
router.post('/', requireRole('RESIDENT'), raiseComplaint);
router.put('/:id/assign', requireRole('WING_ADMIN'), assignComplaint);
router.put('/:id/status', requireRole('WING_ADMIN'), updateComplaintStatus);

export default router;
