import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

function computeStatus(subscriptionEnd: Date | null): { status: string; daysLeft: number | null } {
  if (!subscriptionEnd) return { status: 'ACTIVE', daysLeft: null };
  const days = Math.ceil((subscriptionEnd.getTime() - Date.now()) / 86400000);
  if (days < 0) return { status: 'EXPIRED', daysLeft: days };
  if (days <= 30) return { status: 'EXPIRING', daysLeft: days };
  return { status: 'ACTIVE', daysLeft: days };
}

export async function getAll(_req: Request, res: Response) {
  const societies = await prisma.society.findMany({
    include: {
      wings: {
        include: {
          users: {
            where: { role: 'WING_ADMIN', isActive: true },
            select: { phone: true, name: true },
            take: 1,
          },
        },
        take: 1,
      },
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = societies.map((s) => {
    const { status, daysLeft } = computeStatus(s.subscriptionEnd);
    const secretaryPhone = s.wings[0]?.users[0]?.phone ?? null;
    const { wings, ...rest } = s;
    return { ...rest, status, daysLeft, secretaryPhone };
  });

  return ok(res, result);
}

export async function getSummary(_req: Request, res: Response) {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const all = await prisma.society.findMany({
    select: { subscriptionEnd: true, monthlyAmount: true },
  });

  const totalActive = all.filter((s) => !s.subscriptionEnd || s.subscriptionEnd > now).length;
  const totalExpiring30 = all.filter((s) => {
    if (!s.subscriptionEnd) return false;
    return s.subscriptionEnd > now && s.subscriptionEnd <= in30;
  }).length;
  const totalExpired = all.filter((s) => s.subscriptionEnd && s.subscriptionEnd <= now).length;
  const monthlyRevenue = all
    .filter((s) => !s.subscriptionEnd || s.subscriptionEnd > now)
    .reduce((sum, s) => sum + s.monthlyAmount, 0);
  const annualRevenue = monthlyRevenue * 12;

  return ok(res, { totalActive, totalExpiring30, totalExpired, monthlyRevenue, annualRevenue });
}

export async function getExpiring(req: Request, res: Response) {
  const days = parseInt((req.query.days as string) || '30', 10);
  const now = new Date();
  const future = new Date(now.getTime() + days * 86400000);

  const societies = await prisma.society.findMany({
    where: { subscriptionEnd: { gte: now, lte: future } },
    orderBy: { subscriptionEnd: 'asc' },
  });

  return ok(res, societies);
}

const updatePlanSchema = z.object({
  planType: z.string().min(1),
  monthlyAmount: z.number().min(0),
});

export async function updatePlan(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const society = await prisma.society.findUnique({ where: { id } });
  if (!society) return notFound(res, 'Society not found');

  const updated = await prisma.society.update({
    where: { id },
    data: { planType: parsed.data.planType, monthlyAmount: parsed.data.monthlyAmount },
  });

  return ok(res, updated);
}

const recordPaymentSchema = z.object({
  amount: z.number().min(0),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  method: z.string().default('UPI'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  extendMonths: z.number().int().min(1).max(12).default(1),
});

export async function recordPayment(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const society = await prisma.society.findUnique({ where: { id } });
  if (!society) return notFound(res, 'Society not found');

  const { amount, month, year, method, reference, notes, extendMonths } = parsed.data;

  const now = new Date();
  const base = society.subscriptionEnd && society.subscriptionEnd > now ? society.subscriptionEnd : now;
  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + extendMonths);

  const [payment] = await Promise.all([
    prisma.subscriptionPayment.create({
      data: { societyId: id, amount, month, year, method, reference, notes },
    }),
    prisma.society.update({
      where: { id },
      data: { subscriptionEnd: newEnd, subscriptionStatus: 'ACTIVE' },
    }),
  ]);

  return created(res, payment, 'Payment recorded');
}

export async function getPaymentHistory(req: Request, res: Response) {
  const { id } = req.params;

  const society = await prisma.society.findUnique({ where: { id } });
  if (!society) return notFound(res, 'Society not found');

  const payments = await prisma.subscriptionPayment.findMany({
    where: { societyId: id },
    orderBy: { createdAt: 'desc' },
  });

  return ok(res, { society, payments });
}

export async function sendReminder(req: Request, res: Response) {
  const { id } = req.params;

  const society = await prisma.society.findUnique({ where: { id } });
  if (!society) return notFound(res, 'Society not found');

  const note = `[Reminder sent ${new Date().toLocaleDateString('en-IN')}]`;
  await prisma.society.update({
    where: { id },
    data: { notes: society.notes ? `${society.notes} ${note}` : note },
  });

  return ok(res, null, 'Reminder logged');
}

export async function deletePayment(req: Request, res: Response) {
  const { paymentId } = req.params;

  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return notFound(res, 'Payment not found');

  await prisma.subscriptionPayment.delete({ where: { id: paymentId } });
  return ok(res, null, 'Payment deleted');
}
