import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { sendOTP, verifyOTP } from '../services/otp.service';
import { signToken, signRefreshToken, verifyToken } from '../utils/jwt';
import { ok, badRequest, unauthorized, serverError } from '../utils/response';

const MAX_SESSIONS_PER_FLAT = 2;

const sendOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().min(4).max(8),
  device_id: z.string().optional(),
});

const guardLoginSchema = z.object({
  wing_code: z.string().min(1),
  pin: z.string().length(4),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const ROLE_ORDER = ['SUPER_ADMIN', 'WING_ADMIN', 'GUARD', 'RESIDENT'] as const;

function pickHighestRole<T extends { role: string; isActive: boolean }>(users: T[]): T | null {
  return (
    users
      .filter((u) => u.isActive)
      .sort((a, b) => ROLE_ORDER.indexOf(a.role as typeof ROLE_ORDER[number]) - ROLE_ORDER.indexOf(b.role as typeof ROLE_ORDER[number]))[0] ?? null
  );
}

export async function handleSendOtp(req: Request, res: Response) {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const { phone } = parsed.data;

  const useDevOtp =
    process.env.NODE_ENV === 'development' ||
    !process.env.MSG91_API_KEY ||
    process.env.MSG91_API_KEY === 'placeholder' ||
    process.env.MSG91_API_KEY === 'your_msg91_key';

  if (useDevOtp) {
    await redis.setex(`otp:${phone}`, 600, '123456');
    return res.json({
      success: true,
      message: 'OTP sent successfully',
      ...(process.env.NODE_ENV === 'development' && { otp: '123456' }),
    });
  }

  const user = await prisma.user.findFirst({ where: { phone }, orderBy: [{ role: 'asc' }] });
  if (!user || !user.isActive) {
    return badRequest(res, 'Phone number not registered. Contact your Wing Secretary.');
  }

  try {
    await sendOTP(phone);
    return ok(res, null, 'OTP sent successfully');
  } catch (err) {
    console.error('OTP send error:', err);
    return serverError(res, 'Failed to send OTP');
  }
}

export const handleVerifyOtp = async (req: Request, res: Response) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[verifyOtp] TIMEOUT — handler took too long');
      res.status(500).json({ success: false, message: 'Request timeout' });
    }
  }, 10000);

  try {
    console.log('[verifyOtp] Start — body:', JSON.stringify(req.body));

    const { phone, otp, device_id } = req.body;
    const cleanPhone = String(phone || '').trim().replace(/[^0-9]/g, '');
    const cleanOtp = String(otp || '').trim();

    console.log('[verifyOtp] Clean phone:', cleanPhone, 'otp:', cleanOtp);

    if (!cleanPhone || !cleanOtp) {
      clearTimeout(timeout);
      return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    }

    const useDevOtp =
      !process.env.MSG91_API_KEY ||
      process.env.MSG91_API_KEY === 'placeholder' ||
      process.env.MSG91_API_KEY === 'your_msg91_key';

    console.log('[verifyOtp] useDevOtp:', useDevOtp);

    console.log('[verifyOtp] Verifying OTP...');
    const verified = await verifyOTP(cleanPhone, cleanOtp);
    if (!verified) {
      clearTimeout(timeout);
      return res.status(400).json({
        success: false,
        message: useDevOtp ? 'Invalid OTP. Use 123456 for demo.' : 'Invalid or expired OTP',
      });
    }

    console.log('[verifyOtp] Finding user in DB...');
    const users = await Promise.race([
      prisma.user.findMany({ where: { phone: cleanPhone } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 8000)),
    ]);

    console.log('[verifyOtp] Users found:', users.length);

    if (!users.length) {
      clearTimeout(timeout);
      return res.status(404).json({
        success: false,
        message: 'Phone not registered. Contact your Wing Secretary.',
      });
    }

    const roleOrder = ['SUPER_ADMIN', 'WING_ADMIN', 'GUARD', 'RESIDENT'];
    const user = [...users].sort(
      (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
    )[0];

    console.log('[verifyOtp] Logging in as:', user.role, user.phone);

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        societyId: user.societyId,
        wingId: user.wingId,
        flatId: user.flatId,
        phone: user.phone,
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    console.log('[verifyOtp] Token generated, sending response...');

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
  } catch (error: unknown) {
    clearTimeout(timeout);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[verifyOtp] Error:', msg);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: 'Verification failed: ' + msg });
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
