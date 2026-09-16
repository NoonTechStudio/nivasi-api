import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound, forbidden } from '../utils/response';

const createNoticeSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().optional(),
  category: z.enum(['MEETING', 'WATER', 'EVENT', 'MAINTENANCE', 'OTHER']),
  audience: z.string().default('ALL'),
  target_flat_id: z.string().optional(),
  target_floor: z.coerce.number().int().optional(),
  photo_url: z.string().url().optional(),
});

export async function listNotices(req: Request, res: Response) {
  const baseWhere: any = { wingId: req.user.wing_id };

  // Residents only see notices addressed to everyone, to their specific
  // flat, or to their floor. Secretaries/admins see everything so they can
  // manage the full board regardless of targeting.
  if (req.user.role === 'RESIDENT') {
    let userFloor: number | null = null;
    if (req.user.flat_id) {
      const flat = await prisma.flat.findUnique({ where: { id: req.user.flat_id }, select: { floor: true } });
      userFloor = flat?.floor ?? null;
    }
    baseWhere.OR = [
      { audience: 'ALL' },
      ...(req.user.flat_id ? [{ audience: 'FLAT', targetFlatId: req.user.flat_id }] : []),
      ...(userFloor !== null ? [{ audience: 'FLOOR', targetFloor: userFloor }] : []),
    ];
  }

  const notices = await prisma.notice.findMany({
    where: baseWhere,
    include: { seenBy: { select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, notices);
}

async function resolveTargeting(wingId: string, audience: string, targetFlatId?: string, targetFloor?: number) {
  if (audience === 'FLAT') {
    if (!targetFlatId) return { error: 'Please select a flat to notify.' };
    const flat = await prisma.flat.findFirst({ where: { id: targetFlatId, wingId } });
    if (!flat) return { error: 'Selected flat was not found in this wing.' };
    return { targetFlatId, targetFloor: null };
  }
  if (audience === 'FLOOR') {
    if (targetFloor === undefined || targetFloor === null) return { error: 'Please select a floor to notify.' };
    return { targetFlatId: null, targetFloor };
  }
  return { targetFlatId: null, targetFloor: null };
}

export async function createNotice(req: Request, res: Response) {
  const parsed = createNoticeSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const targeting = await resolveTargeting(
    req.user.wing_id,
    parsed.data.audience,
    parsed.data.target_flat_id,
    parsed.data.target_floor,
  );
  if ('error' in targeting) return badRequest(res, targeting.error);

  const notice = await prisma.notice.create({
    data: {
      wingId: req.user.wing_id,
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      audience: parsed.data.audience,
      targetFlatId: targeting.targetFlatId,
      targetFloor: targeting.targetFloor,
      photoUrl: parsed.data.photo_url,
    },
  });
  return created(res, notice, 'Notice created');
}

export async function updateNotice(req: Request, res: Response) {
  const parsed = createNoticeSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const existing = await prisma.notice.findFirst({ where: { id: req.params.id, wingId: req.user.wing_id } });
  if (!existing) return notFound(res, 'Notice not found');

  const targeting = await resolveTargeting(
    req.user.wing_id,
    parsed.data.audience,
    parsed.data.target_flat_id,
    parsed.data.target_floor,
  );
  if ('error' in targeting) return badRequest(res, targeting.error);

  const notice = await prisma.notice.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      audience: parsed.data.audience,
      targetFlatId: targeting.targetFlatId,
      targetFloor: targeting.targetFloor,
      photoUrl: parsed.data.photo_url,
    },
  });
  return ok(res, notice, 'Notice updated');
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
