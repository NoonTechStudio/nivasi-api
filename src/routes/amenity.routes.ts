import { Router } from 'express';
import {
  listAmenities, createAmenity, updateAmenity, deleteAmenity,
  getAvailableSlots, createBooking, listMyBookings, cancelBooking,
  listPendingBookings, approveBooking, rejectBooking,
} from '../controllers/amenity.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/', requireRole('RESIDENT', 'WING_ADMIN'), listAmenities);
router.post('/', requireRole('WING_ADMIN'), createAmenity);
router.put('/:id', requireRole('WING_ADMIN'), updateAmenity);
router.delete('/:id', requireRole('WING_ADMIN'), deleteAmenity);

router.get('/bookings/mine', requireRole('RESIDENT'), listMyBookings);
router.get('/bookings/pending', requireRole('WING_ADMIN'), listPendingBookings);
router.patch('/bookings/:id/approve', requireRole('WING_ADMIN'), approveBooking);
router.patch('/bookings/:id/reject', requireRole('WING_ADMIN'), rejectBooking);
router.delete('/bookings/:id', requireRole('RESIDENT'), cancelBooking);

router.get('/:id/slots', requireRole('RESIDENT', 'WING_ADMIN'), getAvailableSlots);
router.post('/:id/bookings', requireRole('RESIDENT'), createBooking);

export default router;
