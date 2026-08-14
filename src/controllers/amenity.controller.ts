import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound, forbidden } from '../utils/response';

function toMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function toTime(mins: number) { return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; }

function generateSlots(openTime: string, closeTime: string, slotMinutes: number) {
  const slots: { start: string; end: string }[] = [];
  let cur = toMinutes(openTime);
  const end = toMinutes(closeTime);
  while (cur + slotMinutes <= end) {
    slots.push({ start: toTime(cur), end: toTime(cur + slotMinutes) });
    cur += slotMinutes;
  }
  return slots;
}

function parseDateOnly(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const amenitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capacity_per_slot: z.number().int().positive().default(1),
  slot_minutes: z.number().int().positive().default(60),
  open_time: z.string().regex(/^\d{2}:\d{2}$/),
  close_time: z.string().regex(/^\d{2}:\d{2}$/),
  requires_approval: z.boolean().default(false),
});

export async function listAmenities(req: Request, res: Response) {
  const isSecretary = req.user.role === 'WING_ADMIN';
  const amenities = await prisma.amenity.findMany({
    where: { wingId: req.user.wing_id, ...(isSecretary ? {} : { isActive: true }) },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, amenities);
}

export async function createAmenity(req: Request, res: Response) {
  const parsed = amenitySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const amenity = await prisma.amenity.create({
    data: {
      wingId: req.user.wing_id,
      name: parsed.data.name,
      description: parsed.data.description,
      capacityPerSlot: parsed.data.capacity_per_slot,
      slotMinutes: parsed.data.slot_minutes,
      openTime: parsed.data.open_time,
      closeTime: parsed.data.close_time,
      requiresApproval: parsed.data.requires_approval,
    } as any,
  });
  return created(res, amenity, 'Amenity added');
}

const updateAmenitySchema = amenitySchema.partial().extend({ is_active: z.boolean().optional() });

export async function updateAmenity(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateAmenitySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const amenity = await prisma.amenity.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!amenity) return notFound(res, 'Amenity not found');

  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.capacity_per_slot !== undefined) data.capacityPerSlot = parsed.data.capacity_per_slot;
  if (parsed.data.slot_minutes !== undefined) data.slotMinutes = parsed.data.slot_minutes;
  if (parsed.data.open_time !== undefined) data.openTime = parsed.data.open_time;
  if (parsed.data.close_time !== undefined) data.closeTime = parsed.data.close_time;
  if (parsed.data.requires_approval !== undefined) data.requiresApproval = parsed.data.requires_approval;
  if (parsed.data.is_active !== undefined) data.isActive = parsed.data.is_active;

  const updated = await prisma.amenity.update({ where: { id }, data });
  return ok(res, updated, 'Amenity updated');
}

export async function deleteAmenity(req: Request, res: Response) {
  const { id } = req.params;
  const amenity = await prisma.amenity.findFirst({ where: { id, wingId: req.user.wing_id } });
  if (!amenity) return notFound(res, 'Amenity not found');

  await prisma.amenity.update({ where: { id }, data: { isActive: false } });
  return ok(res, null, 'Amenity removed');
}

export async function getAvailableSlots(req: Request, res: Response) {
  const { id } = req.params;
  const dateStr = req.query.date as string | undefined;
  if (!dateStr) return badRequest(res, 'date query param required (YYYY-MM-DD)');

  const amenity = await prisma.amenity.findFirst({ where: { id, wingId: req.user.wing_id, isActive: true } });
  if (!amenity) return notFound(res, 'Amenity not found');

  const bookingDate = parseDateOnly(dateStr);
  const bookings = await prisma.amenityBooking.findMany({
    where: { amenityId: id, bookingDate, status: { in: ['PENDING', 'CONFIRMED'] } },
    select: { slotStart: true },
  });
  const countBySlot = new Map<string, number>();
  for (const b of bookings) countBySlot.set(b.slotStart, (countBySlot.get(b.slotStart) ?? 0) + 1);

  const slots = generateSlots(amenity.openTime, amenity.closeTime, amenity.slotMinutes).map((s) => ({
    ...s,
    bookedCount: countBySlot.get(s.start) ?? 0,
    capacity: amenity.capacityPerSlot,
    available: (countBySlot.get(s.start) ?? 0) < amenity.capacityPerSlot,
  }));

  return ok(res, slots);
}

const bookSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot_start: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function createBooking(req: Request, res: Response) {
  const { id: amenityId } = req.params;
  const parsed = bookSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const flatId = req.user.flat_id;
  if (!flatId) return badRequest(res, 'No flat associated with your account');

  const amenity = await prisma.amenity.findFirst({ where: { id: amenityId, wingId: req.user.wing_id, isActive: true } });
  if (!amenity) return notFound(res, 'Amenity not found');

  const slots = generateSlots(amenity.openTime, amenity.closeTime, amenity.slotMinutes);
  const slot = slots.find((s) => s.start === parsed.data.slot_start);
  if (!slot) return badRequest(res, 'Invalid slot');

  const bookingDate = parseDateOnly(parsed.data.date);

  const existingCount = await prisma.amenityBooking.count({
    where: { amenityId, bookingDate, slotStart: slot.start, status: { in: ['PENDING', 'CONFIRMED'] } },
  });
  if (existingCount >= amenity.capacityPerSlot) return badRequest(res, 'This slot is fully booked');

  try {
    const booking = await prisma.amenityBooking.create({
      data: {
        amenityId,
        flatId,
        bookedById: req.user.user_id,
        bookingDate,
        slotStart: slot.start,
        slotEnd: slot.end,
        status: amenity.requiresApproval ? 'PENDING' : 'CONFIRMED',
      },
    });
    return created(res, booking, amenity.requiresApproval ? 'Booking requested — awaiting approval' : 'Booking confirmed');
  } catch (err: any) {
    if (err.code === 'P2002') return badRequest(res, 'You already have a booking for this slot');
    throw err;
  }
}

export async function listMyBookings(req: Request, res: Response) {
  const bookings = await prisma.amenityBooking.findMany({
    where: { bookedById: req.user.user_id },
    include: { amenity: { select: { name: true } } },
    orderBy: [{ bookingDate: 'desc' }, { slotStart: 'desc' }],
  });
  return ok(res, bookings);
}

export async function cancelBooking(req: Request, res: Response) {
  const { id } = req.params;
  const booking = await prisma.amenityBooking.findUnique({ where: { id } });
  if (!booking) return notFound(res, 'Booking not found');
  if (booking.bookedById !== req.user.user_id) return forbidden(res, 'Not your booking');
  if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') return badRequest(res, 'Booking already inactive');

  const updated = await prisma.amenityBooking.update({ where: { id }, data: { status: 'CANCELLED' } });
  return ok(res, updated, 'Booking cancelled');
}

// Secretary — approval queue for amenities configured to require it.
export async function listPendingBookings(req: Request, res: Response) {
  const bookings = await prisma.amenityBooking.findMany({
    where: { status: 'PENDING', amenity: { wingId: req.user.wing_id } },
    include: {
      amenity: { select: { name: true } },
      flat: { select: { number: true } },
      bookedBy: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, bookings);
}

export async function approveBooking(req: Request, res: Response) {
  const { id } = req.params;
  const booking = await prisma.amenityBooking.findFirst({
    where: { id, status: 'PENDING', amenity: { wingId: req.user.wing_id } },
  });
  if (!booking) return notFound(res, 'Booking not found or not pending');

  const updated = await prisma.amenityBooking.update({ where: { id }, data: { status: 'CONFIRMED' } });
  return ok(res, updated, 'Booking approved');
}

const rejectSchema = z.object({ reason: z.string().min(1) });

export async function rejectBooking(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const booking = await prisma.amenityBooking.findFirst({
    where: { id, status: 'PENDING', amenity: { wingId: req.user.wing_id } },
  });
  if (!booking) return notFound(res, 'Booking not found or not pending');

  const updated = await prisma.amenityBooking.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: parsed.data.reason },
  });
  return ok(res, updated, 'Booking rejected');
}
