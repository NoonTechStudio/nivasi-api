import redis from '../config/redis';

const DEV_KEY_VALUES = ['', 'placeholder', 'your_msg91_key'];

function isDevMode(): boolean {
  return DEV_KEY_VALUES.includes(process.env.MSG91_API_KEY ?? '');
}

export const sendOTP = async (phone: string): Promise<boolean> => {
  if (isDevMode()) {
    await redis.setex(`otp:${phone}`, 600, '123456');
    console.log(`[OTP] Dev mode — OTP for ${phone}: 123456`);
    return true;
  }

  try {
    const url = `https://control.msg91.com/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=91${phone}&authkey=${process.env.MSG91_API_KEY}&otp_length=6&otp_expiry=10`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json() as { type: string; message?: string };
    console.log('[OTP] MSG91 response:', JSON.stringify(data));

    if (data.type === 'success') {
      return true;
    } else {
      console.error('[OTP] MSG91 error:', data.message);
      return false;
    }
  } catch (error: any) {
    console.error('[OTP] Failed to send:', error.message);
    return false;
  }
};

export const verifyOTP = async (phone: string, otp: string): Promise<boolean> => {
  if (isDevMode()) {
    return otp === '123456';
  }

  try {
    const url = `https://control.msg91.com/api/v5/otp/verify?mobile=91${phone}&otp=${otp}&authkey=${process.env.MSG91_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json() as { type: string; message?: string };
    console.log('[OTP] Verify response:', JSON.stringify(data));

    return data.type === 'success';
  } catch (error: any) {
    console.error('[OTP] Verify failed:', error.message);
    return false;
  }
};

// Lowercase aliases kept for compatibility
export { sendOTP as sendOtp, verifyOTP as verifyOtp };
