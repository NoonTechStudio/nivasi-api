import redis from '../config/redis';

const DEMO_OTP = '403090';

export const sendOTP = async (phone: string): Promise<boolean> => {
  try {
    await redis.setex(`otp:${phone}`, 600, DEMO_OTP);
    console.log(`[OTP] Stored demo OTP for ${phone}: ${DEMO_OTP}`);
    return true;
  } catch (err: any) {
    console.error('[OTP] Redis error:', err.message);
    return true; // Return true anyway so user can still try
  }
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  console.log(`[OTP] Verifying — phone: ${phone}, otp: ${otp}, expected: ${DEMO_OTP}`);
  // Accept fixed demo OTP regardless of Redis
  if (otp === DEMO_OTP) {
    console.log('[OTP] Demo OTP matched!');
    return true;
  }
  console.log('[OTP] OTP did not match');
  return false;
};
