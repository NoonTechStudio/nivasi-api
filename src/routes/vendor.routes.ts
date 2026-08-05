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
router.use(authenticate, wingGuard, requireRole('WING_ADMIN'));

router.get('/', listVendors);
router.get('/:id', getVendorDetail);
router.post('/', createVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);
router.post('/:id/jobs', assignVendorJob);
router.put('/:id/jobs/:jobId/complete', completeVendorJob);

export default router;
