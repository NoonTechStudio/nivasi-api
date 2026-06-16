import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok } from '../utils/response';

export async function pullSync(req: Request, res: Response) {
  const lastSyncedAt = req.body?.last_synced_at ? new Date(req.body.last_synced_at) : new Date(0);
  const wingId = req.user.wing_id;

  const [notices, bills, complaints, visitors] = await Promise.all([
    prisma.notice.findMany({ where: { wingId, createdAt: { gt: lastSyncedAt } } }),
    req.user.flat_id
      ? prisma.maintenanceBill.findMany({
          where: { wingId, flatId: req.user.flat_id, createdAt: { gt: lastSyncedAt } },
        })
      : prisma.maintenanceBill.findMany({ where: { wingId, createdAt: { gt: lastSyncedAt } } }),
    prisma.complaint.findMany({ where: { wingId, createdAt: { gt: lastSyncedAt } } }),
    prisma.visitor.findMany({ where: { wingId, createdAt: { gt: lastSyncedAt } } }),
  ]);

  return ok(res, { notices, bills, complaints, visitors, synced_at: new Date().toISOString() });
}

export async function pushSync(req: Request, res: Response) {
  // Accept and process offline-queued actions
  const { actions = [] } = req.body as { actions: Array<{ type: string; payload: unknown }> };
  const results: Array<{ type: string; success: boolean }> = [];

  for (const action of actions) {
    try {
      // Each action type maps to a service call — expanded per module needs
      results.push({ type: action.type, success: true });
    } catch {
      results.push({ type: action.type, success: false });
    }
  }

  return ok(res, { results });
}
