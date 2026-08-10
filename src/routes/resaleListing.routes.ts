import { Router } from 'express';
import {
  listMyListings,
  listApprovedListings,
  listPendingListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  approveListing,
  rejectListing,
} from '../controllers/resaleListing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';
import { handleMultipleImageUpload } from '../middleware/upload.middleware';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', requireRole('RESIDENT', 'WING_ADMIN'), listApprovedListings);
router.get('/mine', requireRole('RESIDENT'), listMyListings);
router.get('/pending', requireRole('WING_ADMIN'), listPendingListings);
router.get('/:id', requireRole('RESIDENT', 'WING_ADMIN'), getListingById);
router.post('/', requireRole('RESIDENT'), handleMultipleImageUpload('photos', 5), createListing);
router.put('/:id', requireRole('RESIDENT'), updateListing);
router.delete('/:id', requireRole('RESIDENT'), deleteListing);
router.patch('/:id/approve', requireRole('WING_ADMIN'), approveListing);
router.patch('/:id/reject', requireRole('WING_ADMIN'), rejectListing);

export default router;
