import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

const raiseComplaintSchema = z.object({
  category: z.enum(['PLUMBING', 'ELECTRICAL', 'LIFT', 'CLEANING', 'SECURITY', 'OTHER']),
  location: z.string().min(1),
  description: z.string().max(200).optional(),
  photo_url: z.string().url().optional(),
});

const assignSchema = z.object({ assigned_to: z.string().min(1) });
const statusSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']) });

export async function listComplaints(req: Request, res: Response) {
  const where =
    req.user.role === 'RESIDENT'
      ? { wingId: req.user.wing_id, userId: req.user.user_id }
      : { wingId: req.user.wing_id };

  const complaints = await prisma.complaint.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, complaints);
}

export async function raiseComplaint(req: Request, res: Response) {
  const parsed = raiseComplaintSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  if (!req.user.flat_id) return badRequest(res, 'No flat associated with your account');

  const complaint = await prisma.complaint.create({
    data: {
      wingId: req.user.wing_id,
      flatId: req.user.flat_id,
      userId: req.user.user_id,
      category: parsed.data.category,
      location: parsed.data.location,
      description: parsed.data.description,
      photoUrl: parsed.data.photo_url,
    },
  });
  return created(res, complaint, 'Complaint raised');
}

export async function assignComplaint(req: Request, res: Response) {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const complaint = await prisma.complaint.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!complaint) return notFound(res, 'Complaint not found');

  const updated = await prisma.complaint.update({
    where: { id: req.params.id },
    data: { assignedTo: parsed.data.assigned_to, status: 'IN_PROGRESS' },
  });
  return ok(res, updated);
}

export async function updateComplaintStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const complaint = await prisma.complaint.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!complaint) return notFound(res, 'Complaint not found');

  const updated = await prisma.complaint.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === 'RESOLVED' ? new Date() : null,
    },
  });
  return ok(res, updated);
}
