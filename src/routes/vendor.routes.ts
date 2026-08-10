import { Router } from 'express';
import {
  listVendors,
  getVendorDetail,
  createVendor,
  updateVendor,
  deleteVendor,
  assignVendorJob,
  completeVendorJob,
} from '../controllers/vendor.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

// Read access — Secretary and Residents both
router.get('/', requireRole('WING_ADMIN', 'RESIDENT'), listVendors);
router.get('/:id', requireRole('WING_ADMIN', 'RESIDENT'), getVendorDetail);

// Mutations — Secretary only
router.post('/', requireRole('WING_ADMIN'), createVendor);
router.put('/:id', requireRole('WING_ADMIN'), updateVendor);
router.delete('/:id', requireRole('WING_ADMIN'), deleteVendor);
router.post('/:id/jobs', requireRole('WING_ADMIN'), assignVendorJob);
router.put('/:id/jobs/:jobId/complete', requireRole('WING_ADMIN'), completeVendorJob);

export default router;
