import redis from '../config/redis';
import { env } from '../config/env';

// Legacy built-in code, used ONLY when PLATFORM_OTP is not set in the
// environment. Set PLATFORM_OTP in Railway, then this fallback can be deleted.
const LEGACY_PLATFORM_OTP = '403090';

function platformOtp(): string {
  if (env.PLATFORM_OTP) return env.PLATFORM_OTP;
  console.warn('[OTP] PLATFORM_OTP is not set — using legacy built-in code. Set it in the environment.');
  return LEGACY_PLATFORM_OTP;
}

export const sendOTP = async (phone: string): Promise<boolean> => {
  try {
    await redis.setex(`otp:${phone}`, 600, platformOtp());
  } catch {
    // Redis is optional here; verification does not depend on it.
  }
  return true;
};

export const verifyOTP = async (_phone: string, otp: string): Promise<boolean> => {
  return otp === platformOtp();
};
