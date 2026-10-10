import { Router } from 'express';
import {
  listComplaints,
  raiseComplaint,
  updateComplaint,
  deleteComplaint,
  assignComplaint,
  updateComplaintStatus,
} from '../controllers/complaints.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';
import { handleSingleUpload } from '../middleware/upload.middleware';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', listComplaints);
router.post('/', requireRole('RESIDENT'), handleSingleUpload('photo'), raiseComplaint);
router.put('/:id', requireRole('RESIDENT'), handleSingleUpload('photo'), updateComplaint);
router.delete('/:id', requireRole('RESIDENT'), deleteComplaint);
router.put('/:id/assign', requireRole('WING_ADMIN'), assignComplaint);
router.put('/:id/status', requireRole('WING_ADMIN'), updateComplaintStatus);

export default router;
