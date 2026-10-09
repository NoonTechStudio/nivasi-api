import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

// Login brute-force protection. Failed attempts only (skipSuccessfulRequests),
// so a resident who logs in correctly is never penalised. In-memory store is
// fine while the API runs as a single instance; move to a Redis store if the
// API is ever scaled to multiple instances.

const FIFTEEN_MIN = 15 * 60 * 1000;

function tooMany(message: string) {
  return (_req: Request, res: Response) =>
    res.status(429).json({ success: false, message });
}

function cleanPhone(req: Request): string {
  return String(req.body?.phone || '').replace(/[^0-9]/g, '');
}

// 5 wrong codes per phone number (per IP) per 15 minutes.
export const verifyOtpPhoneLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${cleanPhone(req)}`,
  handler: tooMany('Too many wrong attempts. Please try again in 15 minutes.'),
});

// Wider net: 30 wrong codes per IP per 15 minutes (stops one device sweeping many numbers).
export const verifyOtpIpLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooMany('Too many attempts from this device. Please try again later.'),
});

// OTP "send" requests: 5 per hour per phone.
export const sendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${cleanPhone(req)}`,
  handler: tooMany('Too many requests. Please try again in an hour.'),
});

// Guard PIN is only 4 digits, so it gets the strictest lock:
// 5 wrong PINs per wing + IP per 15 minutes.
export const guardLoginLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.wing_code || '').trim().toLowerCase()}`,
  handler: tooMany('Too many wrong attempts. Please try again in 15 minutes.'),
});

export const guardLoginIpLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooMany('Too many attempts from this device. Please try again later.'),
});
