import redis from '../config/redis';

const DEMO_OTP = '403090';

export const sendOTP = async (phone: string): Promise<boolean> => {
  try {
    await redis.setex(`otp:${phone}`, 600, DEMO_OTP);
    console.log(`[OTP] Demo OTP set for ${phone}: ${DEMO_OTP}`);
  } catch (err) {
    console.log('[OTP] Redis warning:', err);
  }
  return true;
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  console.log(`[OTP] Verifying phone: ${phone}, received: ${otp}, expected: ${DEMO_OTP}`);
  return otp === DEMO_OTP;
};
