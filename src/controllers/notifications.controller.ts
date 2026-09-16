import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, notFound } from '../utils/response';

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
