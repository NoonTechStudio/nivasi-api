import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

const logVisitorSchema = z.object({
  flat_id: z.string().min(1),
  visitor_name: z.string().min(1),
  photo_url: z.string().optional(),
  purpose: z.string().optional(),
  delivery_handling: z.enum(['CABIN_DROP', 'HELPER_DELIVERY', 'DIRECT_DELIVERY']).optional(),
});

export async function listVisitors(req: Request, res: Response) {
  const where =
    req.user.role === 'RESIDENT'
      ? { wingId: req.user.wing_id, flatId: req.user.flat_id ?? undefined }
      : { wingId: req.user.wing_id };

  const visitors = await prisma.visitor.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return ok(res, visitors);
}

export async function logVisitor(req: Request, res: Response) {
  const parsed = logVisitorSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const flat = await prisma.flat.findFirst({ where: { id: parsed.data.flat_id, wingId: req.user.wing_id } });
  if (!flat) return notFound(res, 'Flat not found');

  const visitor = await prisma.visitor.create({
    data: {
      wingId: req.user.wing_id,
      flatId: parsed.data.flat_id,
      visitorName: parsed.data.visitor_name,
      photoUrl: parsed.data.photo_url,
      purpose: parsed.data.purpose,
      deliveryHandling: parsed.data.delivery_handling,
      status: 'APPROVED',
      entryTime: new Date(),
    },
  });
  return created(res, visitor, 'Visitor logged');
}

export async function approveVisitor(req: Request, res: Response) {
  const visitor = await prisma.visitor.findFirst({
    where: { id: req.params.id, wingId: req.user.wing_id, flatId: req.user.flat_id ?? undefined },
  });
  if (!visitor) return notFound(res, 'Visitor not found');

  const updated = await prisma.visitor.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approvedBy: req.user.user_id, entryTime: new Date() },
  });
  return ok(res, updated, 'Visitor approved');
}

export async function denyVisitor(req: Request, res: Response) {
  const visitor = await prisma.visitor.findFirst({
    where: { id: req.params.id, wingId: req.user.wing_id, flatId: req.user.flat_id ?? undefined },
  });
  if (!visitor) return notFound(res, 'Visitor not found');

  const updated = await prisma.visitor.update({
    where: { id: req.params.id },
    data: { status: 'DENIED', approvedBy: req.user.user_id },
  });
  return ok(res, updated, 'Visitor denied');
}

export async function logVisitorExit(req: Request, res: Response) {
  const visitor = await prisma.visitor.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!visitor) return notFound(res, 'Visitor not found');

  const updated = await prisma.visitor.update({ where: { id: req.params.id }, data: { exitTime: new Date() } });
  return ok(res, updated, 'Exit logged');
}
