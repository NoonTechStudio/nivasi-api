import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

// Resident raises the alert. Returns the on-duty guard's phone (falling back
// to the secretary's) so the app can auto-dial immediately — no push
// notification infra exists yet, so a real phone call is the reliable
// same-day path to a real-time response.
export async function raiseAlert(req: Request, res: Response) {
  const flatId = req.user.flat_id;
  const wingId = req.user.wing_id;
  if (!flatId || !wingId) return badRequest(res, 'No flat associated with your account');

  const [alert, guard, secretary] = await Promise.all([
    prisma.emergencyAlert.create({
      data: { wingId, flatId, raisedById: req.user.user_id },
    }),
    prisma.user.findFirst({
      where: { wingId, role: 'GUARD', isActive: true },
      select: { name: true, phone: true },
    }),
    prisma.user.findFirst({
      where: { wingId, role: 'WING_ADMIN', isActive: true },
      select: { name: true, phone: true },
    }),
  ]);

  const contact = guard ?? secretary;
  return created(res, {
    alert,
    callContact: contact ? { name: contact.name, phone: contact.phone, isGuard: !!guard } : null,
  }, 'Emergency alert raised');
}

// Guard/Secretary — active alerts across the wing.
export async function listActiveAlerts(req: Request, res: Response) {
  const alerts = await prisma.emergencyAlert.findMany({
    where: { wingId: req.user.wing_id, status: 'ACTIVE' },
    include: {
      flat: { select: { number: true, floor: true } },
      raisedBy: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, alerts);
}

export async function resolveAlert(req: Request, res: Response) {
  const { id } = req.params;
  const alert = await prisma.emergencyAlert.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!alert) return notFound(res, 'Alert not found');
  if (alert.status === 'RESOLVED') return badRequest(res, 'Already resolved');

  const updated = await prisma.emergencyAlert.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedById: req.user.user_id, resolvedAt: new Date() },
  });
  return ok(res, updated, 'Alert marked as resolved');
}
