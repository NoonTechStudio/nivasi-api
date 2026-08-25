import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound, forbidden } from '../utils/response';

const createNoticeSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().optional(),
  category: z.enum(['MEETING', 'WATER', 'EVENT', 'MAINTENANCE', 'OTHER']),
  audience: z.string().default('ALL'),
  photo_url: z.string().url().optional(),
});

export async function listNotices(req: Request, res: Response) {
  const notices = await prisma.notice.findMany({
    where: { wingId: req.user.wing_id },
    include: { seenBy: { select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, notices);
}

export async function createNotice(req: Request, res: Response) {
  const parsed = createNoticeSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const notice = await prisma.notice.create({
    data: {
      wingId: req.user.wing_id,
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      audience: parsed.data.audience,
      photoUrl: parsed.data.photo_url,
    },
  });
  return created(res, notice, 'Notice created');
}

export async function deleteNotice(req: Request, res: Response) {
  const notice = await prisma.notice.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!notice) return notFound(res, 'Notice not found');

  await prisma.notice.delete({ where: { id: req.params.id } });
  return ok(res, null, 'Notice deleted');
}

export async function markNoticeSeen(req: Request, res: Response) {
  const notice = await prisma.notice.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!notice) return notFound(res, 'Notice not found');

  await prisma.noticeSeen.upsert({
    where: { noticeId_userId: { noticeId: req.params.id, userId: req.user.user_id } },
    create: { noticeId: req.params.id, userId: req.user.user_id },
    update: {},
  });
  return ok(res, null, 'Marked as seen');
}

// Secretary-only: who has (and hasn't) seen a given notice, plus the total
// resident headcount for the wing so the UI can show "X of Y have seen this".
export async function getNoticeSeenDetail(req: Request, res: Response) {
  const notice = await prisma.notice.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!notice) return notFound(res, 'Notice not found');

  const [totalResidents, seenRows] = await Promise.all([
    prisma.user.count({ where: { wingId: req.user.wing_id, role: 'RESIDENT', isActive: true } }),
    prisma.noticeSeen.findMany({ where: { noticeId: req.params.id }, orderBy: { seenAt: 'desc' } }),
  ]);

  const userIds = seenRows.map((r) => r.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, flat: { select: { number: true } } },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const seenBy = seenRows.map((r) => ({
    userId: r.userId,
    name: userMap.get(r.userId)?.name ?? 'Unknown',
    flatNumber: userMap.get(r.userId)?.flat?.number ?? null,
    seenAt: r.seenAt,
  }));

  return ok(res, { totalResidents, seenCount: seenBy.length, seenBy });
}
