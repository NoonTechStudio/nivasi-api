import { Router } from 'express';
import {
  handleSendOtp,
  handleVerifyOtp,
  handleGuardLogin,
  handleRefresh,
  handleLogout,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  verifyOtpPhoneLimiter, verifyOtpIpLimiter, sendOtpLimiter,
  guardLoginLimiter, guardLoginIpLimiter,
} from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/send-otp', sendOtpLimiter, handleSendOtp);
router.post('/verify-otp', verifyOtpIpLimiter, verifyOtpPhoneLimiter, handleVerifyOtp);
router.post('/guard-login', guardLoginIpLimiter, guardLoginLimiter, handleGuardLogin);
router.post('/refresh', handleRefresh);
router.post('/logout', authenticate, handleLogout);

export default router;
