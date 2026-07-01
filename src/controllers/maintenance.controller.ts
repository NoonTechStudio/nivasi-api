import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound } from '../utils/response';

const generateBillsSchema = z.object({
  amount: z.number().positive(),
  month: z.number().min(1).max(12),
  year: z.number().min(2024),
  due_date: z.string().datetime(),
});

const markPaidSchema = z.object({
  payment_mode: z.enum(['CASH', 'CHEQUE', 'UPI']),
});

const VALID_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'PENDING_VERIFICATION'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

export async function listBills(req: Request, res: Response) {
  try {
    const wingId = req.user.wing_id;
    console.log('[listBills] User wing_id:', wingId, 'role:', req.user.role);

    if (!wingId) {
      return res.status(400).json({
        success: false,
        message: 'Wing not assigned.',
      });
    }

    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const statusParam = req.query.status as string | undefined;
    const statusFilter = statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as ValidStatus)
      : undefined;

    const baseWhere =
      req.user.role === 'RESIDENT'
        ? { wingId, flatId: req.user.flat_id ?? undefined }
        : { wingId };

    const where = {
      ...baseWhere,
      ...(month !== undefined && !isNaN(month) ? { month } : {}),
      ...(year !== undefined && !isNaN(year) ? { year } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const bills = await prisma.maintenanceBill.findMany({
      where,
      include: { flat: { select: { number: true, floor: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return ok(res, bills);
  } catch (err: any) {
    console.error('[listBills] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getDistinctMonths(req: Request, res: Response) {
  const bills = await prisma.maintenanceBill.findMany({
    where: { wingId: req.user.wing_id },
    select: { month: true, year: true, status: true },
  });

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const map = new Map<string, { month: number; year: number; total: number; pending: number; paid: number }>();
  for (const bill of bills) {
    const key = `${bill.year}-${String(bill.month).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, { month: bill.month, year: bill.year, total: 0, pending: 0, paid: 0 });
    }
    const entry = map.get(key)!;
    entry.total++;
    if (bill.status === 'PENDING' || bill.status === 'OVERDUE') entry.pending++;
    if (bill.status === 'PAID') entry.paid++;
  }

  const result = Array.from(map.values())
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
    .map((entry) => ({
      ...entry,
      label: `${MONTH_NAMES[entry.month - 1]} ${entry.year}`,
    }));

  return ok(res, result);
}

export async function generateBills(req: Request, res: Response) {
  const parsed = generateBillsSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const { amount, month, year, due_date } = parsed.data;

  const [allFlats, occupiedFlats] = await Promise.all([
    prisma.flat.findMany({ where: { wingId: req.user.wing_id }, select: { id: true } }),
    prisma.flat.findMany({
      where: { wingId: req.user.wing_id, users: { some: { role: 'RESIDENT', isActive: true } } },
      select: { id: true },
    }),
  ]);

  if (allFlats.length === 0) return badRequest(res, 'No flats found in wing');
  if (occupiedFlats.length === 0) {
    return badRequest(res, 'No occupied flats found. Add residents before generating bills.');
  }

  const skipped = allFlats.length - occupiedFlats.length;

  const bills = await prisma.$transaction(
    occupiedFlats.map((flat) =>
      prisma.maintenanceBill.upsert({
        where: { flatId_month_year: { flatId: flat.id, month, year } },
        create: { flatId: flat.id, wingId: req.user.wing_id, amount, month, year, dueDate: new Date(due_date) },
        update: {},
      }),
    ),
  );

  const generated = bills.length;
  const message = `Bills generated for ${generated} occupied flat${generated !== 1 ? 's' : ''}. ${skipped} vacant flat${skipped !== 1 ? 's' : ''} skipped.`;

  return created(res, { generated, skipped, message }, message);
}

export async function getBillById(req: Request, res: Response) {
  const { id } = req.params;
  const raw = await prisma.maintenanceBill.findUnique({
    where: { id },
    include: {
      flat: {
        select: {
          number: true,
          floor: true,
          wing: {
            select: {
              users: {
                where: { role: 'WING_ADMIN' },
                select: { name: true, phone: true, upiId: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!raw) return notFound(res, 'Bill not found');
  const { flat, ...rest } = raw;
  const sec = flat?.wing?.users?.[0];
  return ok(res, {
    ...rest,
    flat: flat ? { number: flat.number, floor: flat.floor } : null,
    secretary: {
      name: sec?.name ?? '',
      phone: sec?.phone ?? '',
      upiId: sec?.upiId ?? null,
    },
  });
}

export async function claimUpiPayment(req: Request, res: Response) {
  const { id: billId } = req.params;
  const flatId = req.user.flat_id;
  if (!flatId) return badRequest(res, 'No flat associated with your account');

  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: billId, flatId, status: 'PENDING' },
  });
  if (!bill) return notFound(res, 'Bill not found or already processed');

  const updated = await prisma.maintenanceBill.update({
    where: { id: billId },
    data: { status: 'PENDING_VERIFICATION', paymentMode: 'UPI' },
    include: { flat: { select: { number: true, floor: true } } },
  });
  return ok(res, updated, 'Payment claimed. Awaiting secretary verification.');
}

export async function confirmPayment(req: Request, res: Response) {
  const { id: billId } = req.params;
  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: billId, wingId: req.user.wing_id, status: 'PENDING_VERIFICATION' },
  });
  if (!bill) return notFound(res, 'Bill not found or not awaiting verification');

  const updated = await prisma.maintenanceBill.update({
    where: { id: billId },
    data: { status: 'PAID', paidAt: new Date() },
    include: { flat: { select: { number: true, floor: true } } },
  });
  return ok(res, updated, 'Payment confirmed');
}

export async function rejectPayment(req: Request, res: Response) {
  const { id: billId } = req.params;
  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: billId, wingId: req.user.wing_id, status: 'PENDING_VERIFICATION' },
  });
  if (!bill) return notFound(res, 'Bill not found or not awaiting verification');

  const updated = await prisma.maintenanceBill.update({
    where: { id: billId },
    data: { status: 'PENDING', paymentMode: null },
    include: { flat: { select: { number: true, floor: true } } },
  });
  return ok(res, updated, 'Payment rejected. Bill reset to pending.');
}

export async function markPaid(req: Request, res: Response) {
  const parsed = markPaidSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: req.params.id, wingId: req.user.wing_id },
  });
  if (!bill) return notFound(res, 'Bill not found');

  const updatedBill = await prisma.maintenanceBill.update({
    where: { id: req.params.id },
    data: { status: 'PAID', paymentMode: parsed.data.payment_mode, paidAt: new Date() },
    include: { flat: { select: { number: true, floor: true } } },
  });
  return ok(res, updatedBill, 'Bill marked as paid');
}

export async function initiateUpiPayment(req: Request, res: Response) {
  const bill = await prisma.maintenanceBill.findFirst({
    where: { id: req.params.id, wingId: req.user.wing_id, flatId: req.user.flat_id ?? undefined },
  });
  if (!bill) return notFound(res, 'Bill not found');

  // Return UPI payment link — actual UPI ID to be configured per society
  const upiLink = `upi://pay?pa=nivasi@upi&am=${bill.amount}&tn=Maintenance+${bill.month}/${bill.year}&cu=INR`;
  return ok(res, { upi_link: upiLink, amount: bill.amount });
}

export async function getBillingSummary(req: Request, res: Response) {
  const [paid, pending, overdue, pendingVerification] = await Promise.all([
    prisma.maintenanceBill.count({ where: { wingId: req.user.wing_id, status: 'PAID' } }),
    prisma.maintenanceBill.count({ where: { wingId: req.user.wing_id, status: 'PENDING' } }),
    prisma.maintenanceBill.count({ where: { wingId: req.user.wing_id, status: 'OVERDUE' } }),
    prisma.maintenanceBill.count({ where: { wingId: req.user.wing_id, status: 'PENDING_VERIFICATION' } }),
  ]);

  const totalCollected = await prisma.maintenanceBill.aggregate({
    where: { wingId: req.user.wing_id, status: 'PAID' },
    _sum: { amount: true },
  });

  return ok(res, {
    paid, pending, overdue,
    pending_verification: pendingVerification,
    total_collected: totalCollected._sum.amount ?? 0,
  });
}
