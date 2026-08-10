import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound, forbidden } from '../utils/response';

const ROLES = ['MAID', 'COOK', 'DRIVER', 'NANNY', 'WATCHMAN', 'OTHER'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  role: z.enum(ROLES),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  role: z.enum(ROLES).optional(),
  notes: z.string().optional().nullable(),
});

// Residents see only their own flat's staff. The Secretary sees every flat's
// staff across the wing, with the flat number attached for context.
export async function listDomesticHelp(req: Request, res: Response) {
  try {
    if (req.user.role === 'WING_ADMIN') {
      const wingId = req.user.wing_id;
      if (!wingId) return badRequest(res, 'Wing not assigned.');

      const staff = await prisma.domesticHelp.findMany({
        where: { wingId, isActive: true },
        include: { flat: { select: { number: true, floor: true } } },
        orderBy: [{ flat: { number: 'asc' } }],
      });
      return ok(res, staff);
    }

    const flatId = req.user.flat_id;
    if (!flatId) return badRequest(res, 'No flat associated with your account');

    const staff = await prisma.domesticHelp.findMany({
      where: { flatId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, staff);
  } catch (err: any) {
    console.error('[listDomesticHelp] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function addDomesticHelp(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const flatId = req.user.flat_id;
  const wingId = req.user.wing_id;
  if (!flatId || !wingId) return badRequest(res, 'No flat associated with your account');

  const staff = await prisma.domesticHelp.create({
    data: { ...parsed.data, flatId, wingId },
  });
  return created(res, staff, 'Added to your household staff');
}

export async function updateDomesticHelp(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const staff = await prisma.domesticHelp.findUnique({ where: { id } });
  if (!staff) return notFound(res, 'Not found');
  if (staff.flatId !== req.user.flat_id) return forbidden(res, 'Not your household staff');

  const updated = await prisma.domesticHelp.update({ where: { id }, data: parsed.data });
  return ok(res, updated, 'Updated');
}

export async function deleteDomesticHelp(req: Request, res: Response) {
  const { id } = req.params;

  const staff = await prisma.domesticHelp.findUnique({ where: { id } });
  if (!staff) return notFound(res, 'Not found');
  if (staff.flatId !== req.user.flat_id) return forbidden(res, 'Not your household staff');

  await prisma.domesticHelp.update({ where: { id }, data: { isActive: false } });
  return ok(res, null, 'Removed');
}
