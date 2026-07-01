import redis from '../config/redis';

const DEMO_OTP = '403090';

export const sendOTP = async (phone: string): Promise<boolean> => {
  await redis.setex(`otp:${phone}`, 600, DEMO_OTP);
  console.log(`[OTP] Fixed demo OTP for ${phone}: ${DEMO_OTP}`);
  return true;
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  return otp === DEMO_OTP;
};

// Lowercase aliases kept for compatibility
export { sendOTP as sendOtp, verifyOTP as verifyOtp };
