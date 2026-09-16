import { prisma } from '../config/db';

// Central place to fire in-app notifications whenever an approval-type
// action happens (visitor approved/denied, booking approved/rejected,
// emergency alert resolved, resale listing approved/rejected, complaint
// resolved). Errors are swallowed so a notification failure never blocks
// the actual approval action itself.

export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string;
  type: string;
  relatedId?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        relatedId: params.relatedId,
      },
    });
  } catch (err) {
    console.error('[notifyUser] Failed to create notification:', err);
  }
}

// Notifies every active user (owner/tenant/family) linked to a flat — used
// for events like visitor approval where there's no single "requester"
// user, just a flat the visitor was headed to.
export async function notifyFlat(params: {
  flatId: string;
  title: string;
  body?: string;
  type: string;
  relatedId?: string;
}) {
  try {
    const users = await prisma.user.findMany({
      where: { flatId: params.flatId, isActive: true },
      select: { id: true },
    });
    if (!users.length) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: params.title,
        body: params.body,
        type: params.type,
        relatedId: params.relatedId,
      })),
    });
  } catch (err) {
    console.error('[notifyFlat] Failed to create notifications:', err);
  }
}
