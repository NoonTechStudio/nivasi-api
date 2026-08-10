import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { ok, created, badRequest, notFound, forbidden } from '../utils/response';
import { uploadPublicBuffer, deleteImage } from '../services/upload.service';

const MAX_PHOTOS = 5;

const createSchema = z.object({
  listing_type: z.enum(['SALE', 'RENT']),
  bhk_type: z.string().min(1, 'BHK configuration is required'),
  carpet_area: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().positive('Price must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  contact_phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
});

const updateSchema = createSchema.partial();

// A listing is user-facing and needs the wing/flat/photos context attached
// consistently across every read endpoint.
const listingInclude = {
  flat: { select: { number: true, floor: true } },
  createdBy: { select: { id: true, name: true, phone: true } },
  photos: { select: { id: true, url: true } },
} as const;

// Residents see their own listings (any status). Secretary sees everything
// pending review for their wing.
export async function listMyListings(req: Request, res: Response) {
  const userId = req.user.user_id;
  const listings = await prisma.resaleListing.findMany({
    where: { createdById: userId },
    include: listingInclude,
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, listings);
}

// Public feed — every approved listing in the resident's wing, visible to
// any Resident or Secretary once logged in.
export async function listApprovedListings(req: Request, res: Response) {
  const wingId = req.user.wing_id;
  if (!wingId) return badRequest(res, 'Wing not assigned.');

  const type = req.query.type as string | undefined;
  const where: any = { wingId, status: 'APPROVED' };
  if (type === 'SALE' || type === 'RENT') where.listingType = type;

  const listings = await prisma.resaleListing.findMany({
    where,
    include: listingInclude,
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, listings);
}

// Secretary-only queue of listings awaiting a decision.
export async function listPendingListings(req: Request, res: Response) {
  const wingId = req.user.wing_id;
  if (!wingId) return badRequest(res, 'Wing not assigned.');

  const listings = await prisma.resaleListing.findMany({
    where: { wingId, status: 'PENDING' },
    include: listingInclude,
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, listings);
}

export async function getListingById(req: Request, res: Response) {
  const { id } = req.params;
  const listing = await prisma.resaleListing.findUnique({ where: { id }, include: listingInclude });
  if (!listing) return notFound(res, 'Listing not found');

  const isOwner = listing.createdById === req.user.user_id;
  const isSecretary = req.user.role === 'WING_ADMIN';
  if (listing.status !== 'APPROVED' && !isOwner && !isSecretary) {
    return forbidden(res, 'This listing is not available');
  }
  return ok(res, listing);
}

export async function createListing(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const flatId = req.user.flat_id;
  const wingId = req.user.wing_id;
  const userId = req.user.user_id;
  if (!flatId || !wingId) return badRequest(res, 'No flat associated with your account');

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length > MAX_PHOTOS) return badRequest(res, `You can upload up to ${MAX_PHOTOS} photos`);

  const listing = await prisma.resaleListing.create({
    data: {
      wingId,
      flatId,
      createdById: userId,
      listingType: parsed.data.listing_type,
      bhkType: parsed.data.bhk_type,
      carpetArea: parsed.data.carpet_area,
      price: parsed.data.price,
      description: parsed.data.description,
      contactPhone: parsed.data.contact_phone,
    } as any,
  });

  if (files.length > 0) {
    try {
      const uploads = await Promise.all(files.map((f) => uploadPublicBuffer(f.buffer, `resale-listings/${listing.id}`)));
      await prisma.resaleListingPhoto.createMany({
        data: uploads.map((u) => ({ listingId: listing.id, publicId: u.publicId, url: u.secureUrl })),
      });
    } catch (err: any) {
      console.error('[createListing] Photo upload failed:', err.message);
      // Listing still gets created without photos rather than failing the whole submission.
    }
  }

  const full = await prisma.resaleListing.findUnique({ where: { id: listing.id }, include: listingInclude });
  return created(res, full, 'Listing submitted for approval');
}

// Owner can edit a listing while it's PENDING or after it was REJECTED —
// editing always resets it back to PENDING for a fresh review.
export async function updateListing(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const listing = await prisma.resaleListing.findUnique({ where: { id } });
  if (!listing) return notFound(res, 'Listing not found');
  if (listing.createdById !== req.user.user_id) return forbidden(res, 'Not your listing');
  if (listing.status === 'APPROVED') return badRequest(res, 'Approved listings cannot be edited. Remove and create a new one instead.');

  const data: any = {};
  if (parsed.data.listing_type) data.listingType = parsed.data.listing_type;
  if (parsed.data.bhk_type) data.bhkType = parsed.data.bhk_type;
  if (parsed.data.carpet_area !== undefined) data.carpetArea = parsed.data.carpet_area;
  if (parsed.data.price) data.price = parsed.data.price;
  if (parsed.data.description) data.description = parsed.data.description;
  if (parsed.data.contact_phone) data.contactPhone = parsed.data.contact_phone;

  const updated = await prisma.resaleListing.update({
    where: { id },
    data: { ...data, status: 'PENDING', rejectionReason: null, reviewedById: null, reviewedAt: null },
    include: listingInclude,
  });
  return ok(res, updated, 'Listing updated and resubmitted for approval');
}

export async function deleteListing(req: Request, res: Response) {
  const { id } = req.params;
  const listing = await prisma.resaleListing.findUnique({ where: { id }, include: { photos: true } });
  if (!listing) return notFound(res, 'Listing not found');
  if (listing.createdById !== req.user.user_id) return forbidden(res, 'Not your listing');

  await prisma.resaleListing.delete({ where: { id } });

  for (const photo of listing.photos) {
    deleteImage(photo.publicId).catch(() => {});
  }
  return ok(res, null, 'Listing removed');
}

export async function approveListing(req: Request, res: Response) {
  const { id } = req.params;
  const listing = await prisma.resaleListing.findUnique({ where: { id } });
  if (!listing) return notFound(res, 'Listing not found');
  if (listing.wingId !== req.user.wing_id) return forbidden(res, 'Not in your wing');
  if (listing.status !== 'PENDING') return badRequest(res, 'Only pending listings can be approved');

  const updated = await prisma.resaleListing.update({
    where: { id },
    data: { status: 'APPROVED', reviewedById: req.user.user_id, reviewedAt: new Date(), rejectionReason: null },
    include: listingInclude,
  });
  return ok(res, updated, 'Listing approved and now visible to all residents');
}

const rejectSchema = z.object({
  reason: z.string().min(1, 'Please share a reason for rejecting this listing'),
});

export async function rejectListing(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const listing = await prisma.resaleListing.findUnique({ where: { id } });
  if (!listing) return notFound(res, 'Listing not found');
  if (listing.wingId !== req.user.wing_id) return forbidden(res, 'Not in your wing');
  if (listing.status !== 'PENDING') return badRequest(res, 'Only pending listings can be rejected');

  const updated = await prisma.resaleListing.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: parsed.data.reason,
      reviewedById: req.user.user_id,
      reviewedAt: new Date(),
    },
    include: listingInclude,
  });
  return ok(res, updated, 'Listing rejected');
}
