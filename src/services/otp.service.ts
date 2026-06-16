import axios from 'axios';
import { redis } from '../config/redis';
import { env } from '../config/env';

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_KEY_PREFIX = 'otp:';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const DEV_OTP = '123456';

export async function sendOtp(phone: string): Promise<void> {
  if (!env.MSG91_API_KEY) {
    // Dev bypass: store fixed OTP, skip MSG91 call
    await redis.set(`${OTP_KEY_PREFIX}${phone}`, DEV_OTP, 'EX', OTP_TTL_SECONDS);
    console.log(`[DEV] OTP for ${phone}: ${DEV_OTP}`);
    return;
  }

  const otp = generateOtp();
  await redis.set(`${OTP_KEY_PREFIX}${phone}`, otp, 'EX', OTP_TTL_SECONDS);

  await axios.post(
    'https://api.msg91.com/api/v5/otp',
    {
      template_id: env.MSG91_TEMPLATE_ID,
      mobile: `91${phone}`,
      authkey: env.MSG91_API_KEY,
      otp,
    },
    { headers: { 'Content-Type': 'application/json' } },
  );
}

export async function verifyOtp(phone: string, otp: string): Promise<boolean> {
  const stored = await redis.get(`${OTP_KEY_PREFIX}${phone}`);
  if (!stored || stored !== otp) return false;
  await redis.del(`${OTP_KEY_PREFIX}${phone}`);
  return true;
}
