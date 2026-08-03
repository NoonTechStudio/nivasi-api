import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

const CATEGORIES = ['WATER', 'DRAINAGE', 'GARDEN', 'ELECTRICITY', 'PARKING', 'OTHER'] as const;
const FREQUENCIES = ['ONCE', 'WEEKLY', 'MONTHLY'] as const;
const STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'] as const;
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const createUtilitySchema = z.object({
  category: z.enum(CATEGORIES),
  name: z.string().min(1, 'Name is required'),
  assignedToName: z.string().min(1).optional(),
  assignedToPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional(),
  frequency: z.enum(FREQUENCIES).default('MONTHLY'),
  scheduleDays: z.array(z.enum(DAYS)).default([]),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
});

const updateUtilitySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  name: z.string().min(1).optional(),
  assignedToName: z.string().min(1).optional().nullable(),
  assignedToPhone: z.string().regex(/^[6-9]\d{9}$/).optional().nullable(),
  frequency: z.enum(FREQUENCIES).optional(),
  scheduleDays: z.array(z.enum(DAYS)).optional(),
  estimatedCost: z.number().positive().optional().nullable(),
  status: z.enum(STATUSES).optional(),
  notes: z.string().optional().nullable(),
});

const logCompletionSchema = z.object({
  completedAt: z.string().datetime().optional(),
  amountPaid: z.number().positive().optional(),
  paymentMode: z.enum(['UPI', 'CASH', 'CHEQUE']).optional(),
});

export async function listUtilities(req: Request, res: Response) {
  try {
    const wingId = req.user.wing_id;
    if (!wingId) return badRequest(res, 'Wing not assigned.');

    const categoryParam = req.query.category as string | undefined;
    const statusParam = req.query.status as string | undefined;
    const category = categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam) ? categoryParam : undefined;
    const status = statusParam && (STATUSES as readonly string[]).includes(statusParam) ? statusParam : undefined;

    const services = await prisma.utilityService.findMany({
      where: {
        wingId,
        ...(category ? { category: category as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        logs: { orderBy: { completedAt: 'desc' }, take: 1 },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return ok(res, services);
  } catch (err: any) {
    console.error('[listUtilities] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getUtilityDetail(req: Request, res: Response) {
  const { id } = req.params;
  const service = await prisma.utilityService.findFirst({
    where: { id, wingId: req.user.wing_id },
    include: { logs: { orderBy: { completedAt: 'desc' } } },
  });
  if (!service) return notFound(res, 'Utility service not found');
  return ok(res, service);
}

export async function createUtility(req: Request, res: Response) {
  const parsed = createUtilitySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const wingId = req.user.wing_id;
  if (!wingId) return badRequest(res, 'Wing not assigned.');

  const service = await prisma.utilityService.create({
    data: { ...parsed.data, wingId } as any,
  });
  return created(res, service, 'Utility service created');
}

export async function updateUtility(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateUtilitySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const service = await prisma.utilityService.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!service) return notFound(res, 'Utility service not found');

  const updated = await prisma.utilityService.update({ where: { id }, data: parsed.data });
  return ok(res, updated, 'Utility service updated');
}

export async function deleteUtility(req: Request, res: Response) {
  const { id } = req.params;
  const service = await prisma.utilityService.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!service) return notFound(res, 'Utility service not found');

  await prisma.utilityService.delete({ where: { id } });
  return ok(res, null, 'Utility service removed');
}

export async function logUtilityCompletion(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = logCompletionSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const service = await prisma.utilityService.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!service) return notFound(res, 'Utility service not found');

  const log = await prisma.utilityServiceLog.create({
    data: {
      utilityServiceId: id,
      completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : new Date(),
      amountPaid: parsed.data.amountPaid,
      paymentMode: parsed.data.paymentMode,
      recordedBy: req.user.user_id,
    },
  });

  // One-off services auto-complete after their single log entry
  if (service.frequency === 'ONCE' && service.status === 'ACTIVE') {
    await prisma.utilityService.update({ where: { id }, data: { status: 'COMPLETED' } });
  }

  return created(res, log, 'Completion logged');
}

export async function getUtilityLogs(req: Request, res: Response) {
  const { id } = req.params;
  const service = await prisma.utilityService.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!service) return notFound(res, 'Utility service not found');

  const logs = await prisma.utilityServiceLog.findMany({
    where: { utilityServiceId: id },
    orderBy: { completedAt: 'desc' },
  });
  return ok(res, logs);
}
