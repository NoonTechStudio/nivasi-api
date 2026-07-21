import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { sendOTP, verifyOTP } from '../services/otp.service';
import { signToken, verifyToken } from '../utils/jwt';
import { ok, badRequest, unauthorized } from '../utils/response';

const guardLoginSchema = z.object({
  wing_code: z.string().min(1),
  pin: z.string().length(4),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export async function handleSendOtp(req: Request, res: Response) {
  try {
    const { phone } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/[^0-9]/g, '');

    console.log('[sendOtp] Phone:', cleanPhone);

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number required' });
    }

    await sendOTP(cleanPhone);

    return res.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error: any) {
    console.error('[sendOtp] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
}

export const handleVerifyOtp = async (req: Request, res: Response) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Request timeout' });
    }
  }, 15000);

  try {
    console.log('[verifyOtp] Body received:', JSON.stringify(req.body));

    const { phone, otp } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/[^0-9]/g, '');
    const cleanOtp = String(otp || '').trim();

    console.log('[verifyOtp] Clean phone:', cleanPhone, 'Clean OTP:', cleanOtp);

    if (!cleanPhone || !cleanOtp) {
      clearTimeout(timeout);
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    // Verify OTP
    const isValid = await verifyOTP(cleanPhone, cleanOtp);
    console.log('[verifyOtp] OTP valid:', isValid);

    if (!isValid) {
      clearTimeout(timeout);
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    // Find user
    console.log('[verifyOtp] Finding user with phone:', cleanPhone);
    const users = await prisma.user.findMany({
      where: { phone: cleanPhone },
    });

    console.log('[verifyOtp] Users found:', users.length);

    if (!users.length) {
      clearTimeout(timeout);
      return res.status(404).json({
        success: false,
        message: 'Phone not registered. Contact your Wing Secretary.',
      });
    }

    // Pick highest role
    const roleOrder = ['SUPER_ADMIN', 'WING_ADMIN', 'GUARD', 'RESIDENT'];
    const user = [...users].sort(
      (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
    )[0];

    console.log('[verifyOtp] Logging in as:', user.role, user.phone);

    // Generate JWT using signToken so the payload matches JwtPayload (snake_case)
    const token = signToken({
      user_id: user.id,
      role: user.role,
      society_id: user.societyId ?? '',
      wing_id: user.wingId ?? '',
      flat_id: user.flatId ?? null,
    });

    clearTimeout(timeout);
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          societyId: user.societyId,
          wingId: user.wingId,
          flatId: user.flatId,
        },
      },
    });
  } catch (error: any) {
    clearTimeout(timeout);
    console.error('[verifyOtp] Error:', error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Verification failed: ' + error.message,
      });
    }
  }
};

export async function handleGuardLogin(req: Request, res: Response) {
  const parsed = guardLoginSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const { wing_code, pin } = parsed.data;

  // Look up guard directly in DB — wing name matched case-insensitively,
  // guardPin stored on the User record (set by secretary via ManageGuards).
  const guard = await prisma.user.findFirst({
    where: {
      role: 'GUARD',
      guardPin: pin,
      isActive: true,
      wing: { name: { equals: wing_code, mode: 'insensitive' } },
    },
  });
  if (!guard) return unauthorized(res, 'Invalid wing code or PIN');

  const token = signToken({
    user_id: guard.id,
    role: guard.role,
    society_id: guard.societyId ?? '',
    wing_id: guard.wingId ?? '',
    flat_id: null,
  });

  return ok(res, { token, role: 'GUARD' }, 'Guard login successful');
}

export async function handleRefresh(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const { refresh_token } = parsed.data;

  let payload: { user_id: string };
  try {
    payload = verifyToken(refresh_token) as { user_id: string };
  } catch {
    return unauthorized(res, 'Invalid refresh token');
  }

  const session = await prisma.session.findFirst({ where: { sessionToken: refresh_token } });
  if (!session) return unauthorized(res, 'Session not found');

  const user = await prisma.user.findUnique({ where: { id: payload.user_id } });
  if (!user || !user.isActive) return unauthorized(res, 'User not found');

  await prisma.session.update({ where: { id: session.id }, data: { lastActive: new Date() } });

  const token = signToken({
    user_id: user.id,
    role: user.role,
    society_id: user.societyId ?? '',
    wing_id: user.wingId ?? '',
    flat_id: user.flatId,
  });

  return ok(res, { token }, 'Token refreshed');
}

export async function handleLogout(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return badRequest(res, 'No token provided');

  const refresh_token = req.body?.refresh_token as string | undefined;
  if (refresh_token) {
    await prisma.session.deleteMany({ where: { sessionToken: refresh_token } });
  }

  return ok(res, null, 'Logged out successfully');
}
