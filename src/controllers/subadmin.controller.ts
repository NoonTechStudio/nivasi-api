import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChildrenInclude(depth: number): object {
  if (depth === 0) return {};
  return {
    include: {
      children: buildChildrenInclude(depth - 1),
      _count: { select: { children: true, societies: true } },
    },
  };
}

// ─── Get All ─────────────────────────────────────────────────────────────────

export async function getAll(_req: Request, res: Response) {
  const subadmins = await prisma.subAdmin.findMany({
    include: {
      _count: { select: { children: true, societies: true } },
      parent: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, subadmins);
}

// ─── Get Hierarchy ────────────────────────────────────────────────────────────

export async function getHierarchy(_req: Request, res: Response) {
  const roots = await prisma.subAdmin.findMany({
    where: { parentId: null },
    include: {
      _count: { select: { children: true, societies: true } },
      children: {
        include: {
          _count: { select: { children: true, societies: true } },
          children: {
            include: {
              _count: { select: { children: true, societies: true } },
              children: {
                include: {
                  _count: { select: { children: true, societies: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, roots);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response) {
  const { name, phone, email, password, role, region, regionType, parentId, commissionPct } = req.body;
  if (!name || !phone || !password || !region || !regionType) {
    return badRequest(res, 'name, phone, password, region, and regionType are required');
  }

  const existing = await prisma.subAdmin.findUnique({ where: { phone } });
  if (existing) return badRequest(res, 'Phone number already registered');

  const hashed = await bcrypt.hash(password, 10);

  const subadmin = await prisma.subAdmin.create({
    data: {
      name,
      phone,
      email: email || null,
      password: hashed,
      role: role || 'AREA_PARTNER',
      region,
      regionType,
      parentId: parentId || null,
      commissionPct: commissionPct ?? 20,
    },
    include: {
      _count: { select: { children: true, societies: true } },
      parent: { select: { id: true, name: true } },
    },
  });

  return created(res, subadmin, 'Partner created successfully');
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { name, email, region, regionType, commissionPct, isActive } = req.body;

  const existing = await prisma.subAdmin.findUnique({ where: { id } });
  if (!existing) return notFound(res, 'Partner not found');

  const updated = await prisma.subAdmin.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(region !== undefined && { region }),
      ...(regionType !== undefined && { regionType }),
      ...(commissionPct !== undefined && { commissionPct }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      _count: { select: { children: true, societies: true } },
      parent: { select: { id: true, name: true } },
    },
  });

  return ok(res, updated, 'Partner updated');
}

// ─── Deactivate ───────────────────────────────────────────────────────────────

export async function deactivate(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await prisma.subAdmin.findUnique({ where: { id } });
  if (!existing) return notFound(res, 'Partner not found');

  await prisma.subAdmin.update({ where: { id }, data: { isActive: false } });
  return ok(res, null, 'Partner deactivated');
}

// ─── Get Societies ────────────────────────────────────────────────────────────

export async function getSocieties(req: Request, res: Response) {
  const { id } = req.params;
  const societies = await prisma.society.findMany({
    where: { subAdminId: id },
    include: { wings: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, societies);
}

// ─── Assign Society ───────────────────────────────────────────────────────────

export async function assignSociety(req: Request, res: Response) {
  const { id } = req.params;
  const { societyId } = req.body;
  if (!societyId) return badRequest(res, 'societyId is required');

  const partner = await prisma.subAdmin.findUnique({ where: { id } });
  if (!partner) return notFound(res, 'Partner not found');

  const society = await prisma.society.findUnique({ where: { id: societyId } });
  if (!society) return notFound(res, 'Society not found');

  await prisma.society.update({ where: { id: societyId }, data: { subAdminId: id } });
  return ok(res, null, 'Society assigned to partner');
}

// ─── Unassign Society ─────────────────────────────────────────────────────────

export async function unassignSociety(req: Request, res: Response) {
  const { societyId } = req.params;
  const society = await prisma.society.findUnique({ where: { id: societyId } });
  if (!society) return notFound(res, 'Society not found');

  await prisma.society.update({ where: { id: societyId }, data: { subAdminId: null } });
  return ok(res, null, 'Society unassigned');
}
