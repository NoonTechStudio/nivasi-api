import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound, forbidden } from '../utils/response';

const RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'] as const;

const addSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  relation: z.enum(RELATIONS),
});

// Any resident of the flat can view the family list; only the head-of-family
// (isPrimary) can add or remove members. Login itself needs no changes —
// each member has their own phone number and logs in with the existing
// phone + OTP flow, same as any resident.
export async function listFamilyMembers(req: Request, res: Response) {
  const flatId = req.user.flat_id;
  if (!flatId) return badRequest(res, 'No flat associated with your account');

  const members = await prisma.user.findMany({
    where: { flatId, role: 'RESIDENT', isActive: true },
    select: { id: true, name: true, phone: true, isPrimary: true, familyRelation: true, createdAt: true },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
  return ok(res, members);
}

export async function addFamilyMember(req: Request, res: Response) {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const requester = await prisma.user.findUnique({ where: { id: req.user.user_id } });
  if (!requester?.isPrimary) return forbidden(res, 'Only the head of family can add family members');

  const flatId = req.user.flat_id;
  const wingId = req.user.wing_id;
  if (!flatId || !wingId) return badRequest(res, 'No flat associated with your account');

  const existing = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (existing) return badRequest(res, 'This phone number is already registered to another account');

  const member = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      familyRelation: parsed.data.relation,
      role: 'RESIDENT',
      isPrimary: false,
      societyId: requester.societyId,
      wingId,
      flatId,
    } as any,
  });
  return created(res, member, 'Family member added — they can log in with their own phone number');
}

export async function removeFamilyMember(req: Request, res: Response) {
  const { id } = req.params;

  const requester = await prisma.user.findUnique({ where: { id: req.user.user_id } });
  if (!requester?.isPrimary) return forbidden(res, 'Only the head of family can remove family members');

  const member = await prisma.user.findFirst({ where: { id, flatId: req.user.flat_id ?? undefined, role: 'RESIDENT' } });
  if (!member) return notFound(res, 'Family member not found');
  if (member.isPrimary) return badRequest(res, 'Cannot remove the head of family');

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return ok(res, null, 'Family member removed');
}
