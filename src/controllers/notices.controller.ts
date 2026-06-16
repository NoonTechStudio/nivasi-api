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
