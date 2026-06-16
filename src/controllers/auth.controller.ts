import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { sendOtp, verifyOtp } from '../services/otp.service';
import { signToken, signRefreshToken, verifyToken } from '../utils/jwt';
import { ok, badRequest, unauthorized, serverError } from '../utils/response';

const MAX_SESSIONS_PER_FLAT = 2;

const sendOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().length(6),
  device_id: z.string().min(1),
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

  if (env.NODE_ENV === 'development') {
    const user = await prisma.user.findFirst({ where: { phone }, orderBy: [{ role: 'asc' }] });
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'Phone number not registered. Contact your Wing Secretary.' });
    }
    await redis.set(`otp:${phone}`, '123456', 'EX', 600);
    return ok(res, null, 'OTP sent');
  }

  const user = await prisma.user.findFirst({ where: { phone }, orderBy: [{ role: 'asc' }] });
  if (!user || !user.isActive) {
    return badRequest(res, 'Phone number not registered. Contact your Wing Secretary.');
  }

  try {
    await sendOtp(phone);
    return ok(res, null, 'OTP sent successfully');
  } catch (err) {
    console.error('OTP send error:', err);
    return serverError(res, 'Failed to send OTP');
  }
}

export async function handleVerifyOtp(req: Request, res: Response) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const { phone, otp, device_id } = parsed.data;

  if (env.NODE_ENV === 'development') {
    // Skip Redis entirely — '123456' always accepted for any registered phone
    if (otp !== '123456') return unauthorized(res, 'Invalid or expired OTP');
  } else {
    const valid = await verifyOtp(phone, otp);
    if (!valid) return unauthorized(res, 'Invalid or expired OTP');
  }

  const users = await prisma.user.findMany({ where: { phone } });
  if (users.length === 0) {
    return res.status(404).json({ success: false, message: 'Phone number not registered. Contact your Wing Secretary.' });
  }

  const user = pickHighestRole(users);
  if (!user) return unauthorized(res, 'User not found');

  // Enforce max 2 sessions per flat
  if (user.flatId) {
    const sessions = await prisma.session.findMany({ where: { userId: user.id }, orderBy: { lastActive: 'asc' } });
    if (sessions.length >= MAX_SESSIONS_PER_FLAT) {
      await prisma.session.delete({ where: { id: sessions[0].id } });
    }
  }

  const sessionToken = signRefreshToken({ user_id: user.id });

  await prisma.session.create({
    data: { userId: user.id, deviceId: device_id, sessionToken, lastActive: new Date() },
  });

  const token = signToken({
    user_id: user.id,
    role: user.role,
    society_id: user.societyId ?? '',
    wing_id: user.wingId ?? '',
    flat_id: user.flatId,
  });

  return ok(res, {
    token,
    refresh_token: sessionToken,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
  }, 'Login successful');
}

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
