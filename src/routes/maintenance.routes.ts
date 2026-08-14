import { Router } from 'express';
import {
  listBills,
  getBillById,
  getDistinctMonths,
  generateBills,
  markPaid,
  initiateUpiPayment,
  getBillingSummary,
  claimUpiPayment,
  confirmPayment,
  rejectPayment,
  getBillPaymentProofUrl,
  getLateFeeSettings,
  updateLateFeeSettings,
} from '../controllers/maintenance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';
import { handleSingleUpload } from '../middleware/upload.middleware';

const router = Router();
router.use(authenticate, wingGuard);

router.get('/bills', listBills);
router.get('/bills/months', requireRole('WING_ADMIN', 'SUPER_ADMIN'), getDistinctMonths);
router.get('/bills/:id', getBillById);
router.post('/generate', requireRole('WING_ADMIN'), generateBills);
router.put('/bills/:id/pay', requireRole('WING_ADMIN'), markPaid);
router.post('/bills/:id/upi', requireRole('RESIDENT'), initiateUpiPayment);
router.get('/summary', requireRole('WING_ADMIN', 'SUPER_ADMIN'), getBillingSummary);
router.patch('/bills/:id/claim-payment', requireRole('RESIDENT'), handleSingleUpload('file'), claimUpiPayment);
router.patch('/bills/:id/confirm-payment', requireRole('WING_ADMIN'), confirmPayment);
router.patch('/bills/:id/reject-payment', requireRole('WING_ADMIN'), rejectPayment);
router.get('/bills/:id/proof-url', requireRole('WING_ADMIN'), getBillPaymentProofUrl);
router.get('/late-fee-settings', requireRole('WING_ADMIN'), getLateFeeSettings);
router.put('/late-fee-settings', requireRole('WING_ADMIN'), updateLateFeeSettings);

export default router;
