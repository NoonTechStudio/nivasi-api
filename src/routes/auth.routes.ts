import { Router } from 'express';
import {
  handleSendOtp,
  handleVerifyOtp,
  handleGuardLogin,
  handleRefresh,
  handleLogout,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/send-otp', handleSendOtp);
router.post('/verify-otp', handleVerifyOtp);
router.post('/guard-login', handleGuardLogin);
router.post('/refresh', handleRefresh);
router.post('/logout', authenticate, handleLogout);

export default router;
