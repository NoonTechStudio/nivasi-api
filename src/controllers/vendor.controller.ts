import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

const CATEGORIES = ['PLUMBER', 'ELECTRICIAN', 'CLEANER', 'GARDENER', 'CONTRACTOR', 'OTHER'] as const;

const createVendorSchema = z.object({
  category: z.enum(CATEGORIES),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  notes: z.string().optional(),
});

const updateVendorSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const assignJobSchema = z.object({
  description: z.string().min(1, 'Description is required'),
});

const completeJobSchema = z.object({
  cost: z.number().positive().optional(),
  paymentMode: z.enum(['UPI', 'CASH', 'CHEQUE']).optional(),
});

// Residents can see that a vendor exists, was assigned work, and its status —
// but not what the society paid them. Cost/payment info stays Secretary-only.
function stripJobFinancialsForResident<T extends { jobs: any[] }>(vendor: T, role: string): T {
  if (role !== 'RESIDENT') return vendor;
  return {
    ...vendor,
    jobs: vendor.jobs.map(({ cost, paymentMode, ...rest }) => rest),
  };
}

export async function listVendors(req: Request, res: Response) {
  try {
    const wingId = req.user.wing_id;
    if (!wingId) return badRequest(res, 'Wing not assigned.');

    const categoryParam = req.query.category as string | undefined;
    const category = categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam) ? categoryParam : undefined;

    const vendors = await prisma.vendor.findMany({
      where: { wingId, isActive: true, ...(category ? { category: category as any } : {}) },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    const result = vendors.map((v) => stripJobFinancialsForResident(v, req.user.role));
    return ok(res, result);
  } catch (err: any) {
    console.error('[listVendors] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getVendorDetail(req: Request, res: Response) {
  const { id } = req.params;
  const vendor = await prisma.vendor.findFirst({
    where: { id, wingId: req.user.wing_id },
    include: { jobs: { orderBy: { createdAt: 'desc' } } },
  });
  if (!vendor) return notFound(res, 'Vendor not found');
  return ok(res, stripJobFinancialsForResident(vendor, req.user.role));
}

export async function createVendor(req: Request, res: Response) {
  const parsed = createVendorSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const wingId = req.user.wing_id;
  if (!wingId) return badRequest(res, 'Wing not assigned.');

  const vendor = await prisma.vendor.create({
    data: {
      wingId,
      category: parsed.data.category,
      name: parsed.data.name,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
    },
  });
  return created(res, vendor, 'Vendor added');
}

export async function updateVendor(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateVendorSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const vendor = await prisma.vendor.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!vendor) return notFound(res, 'Vendor not found');

  const updated = await prisma.vendor.update({ where: { id }, data: parsed.data });
  return ok(res, updated, 'Vendor updated');
}

export async function deleteVendor(req: Request, res: Response) {
  const { id } = req.params;
  const vendor = await prisma.vendor.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!vendor) return notFound(res, 'Vendor not found');

  // Soft-delete: keep job history intact, just hide from the active directory
  await prisma.vendor.update({ where: { id }, data: { isActive: false } });
  return ok(res, null, 'Vendor removed');
}

export async function assignVendorJob(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = assignJobSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const vendor = await prisma.vendor.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!vendor) return notFound(res, 'Vendor not found');

  const job = await prisma.vendorJob.create({
    data: { vendorId: id, description: parsed.data.description },
  });
  return created(res, job, 'Work assigned');
}

export async function completeVendorJob(req: Request, res: Response) {
  const { id, jobId } = req.params;
  const parsed = completeJobSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const vendor = await prisma.vendor.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!vendor) return notFound(res, 'Vendor not found');

  const job = await prisma.vendorJob.findFirst({ where: { id: jobId, vendorId: id } });
  if (!job) return notFound(res, 'Job not found');

  const updated = await prisma.vendorJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      cost: parsed.data.cost,
      paymentMode: parsed.data.paymentMode,
    },
  });
  return ok(res, updated, 'Job marked completed');
}
