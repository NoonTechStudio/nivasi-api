import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, notFound, badRequest, forbidden } from '../utils/response';
import { notifyUser } from '../services/notification.service';

const leaveRequestSchema = z.object({
  leaving_date: z.string().min(1),
  note: z.string().max(200).optional(),
});

// A resident tells the Wing Secretary they are leaving the society on a given
// date. The Secretary gets an in-app notification and removes the resident
// from the directory on/after that date.
export async function submitLeaveRequest(req: Request, res: Response) {
  if (req.user.role !== 'RESIDENT') return forbidden(res, 'Only residents can send a leaving request');

  const parsed = leaveRequestSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, 'Please choose the date you are leaving');

  const leavingDate = new Date(parsed.data.leaving_date);
  if (isNaN(leavingDate.getTime())) return badRequest(res, 'Invalid date');

  const resident = await prisma.user.findUnique({
    where: { id: req.user.user_id },
    select: { name: true, flat: { select: { number: true } } },
  });
  if (!resident) return notFound(res, 'User not found');

  const admins = await prisma.user.findMany({
    where: { wingId: req.user.wing_id, role: 'WING_ADMIN', isActive: true },
    select: { id: true },
  });
  if (!admins.length) return badRequest(res, 'No Wing Secretary found for your wing');

  const dateLabel = leavingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const flatLabel = resident.flat?.number ? ` (Flat ${resident.flat.number})` : '';
  const note = parsed.data.note?.trim();

  await Promise.all(
    admins.map((a) =>
      notifyUser({
        userId: a.id,
        title: `${resident.name}${flatLabel} is leaving`,
        body: `Leaving on ${dateLabel}.${note ? ` Note: ${note}` : ''} Please remove them from the directory after this date.`,
        type: 'LEAVE_REQUEST',
        relatedId: req.user.user_id,
      }),
    ),
  );

  return ok(res, null, 'Your Wing Secretary has been informed.');
}

export async function listNotifications(req: Request, res: Response) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.user_id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok(res, notifications);
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await prisma.notification.count({
    where: { userId: req.user.user_id, read: false },
  });
  return ok(res, { count });
}

export async function markNotificationRead(req: Request, res: Response) {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.user_id },
  });
  if (!notification) return notFound(res, 'Notification not found');

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  return ok(res, updated);
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  await prisma.notification.updateMany({
    where: { userId: req.user.user_id, read: false },
    data: { read: true },
  });
  return ok(res, null, 'All notifications marked as read');
}
