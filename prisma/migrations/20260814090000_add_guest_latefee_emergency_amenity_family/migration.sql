-- Wing: late fee settings
ALTER TABLE "Wing" ADD COLUMN "lateFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Wing" ADD COLUMN "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 5;

-- MaintenanceBill: frozen late fee amount
ALTER TABLE "MaintenanceBill" ADD COLUMN "lateFeeApplied" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- User: family member relation label
ALTER TABLE "User" ADD COLUMN "familyRelation" TEXT;

-- CreateEnum
CREATE TYPE "GuestInviteStatus" AS ENUM ('PENDING', 'USED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "GuestInvite" (
    "id" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "purpose" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "otpCode" TEXT NOT NULL,
    "status" "GuestInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdVisitorId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestInvite_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestInvite" ADD CONSTRAINT "GuestInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacityPerSlot" INTEGER NOT NULL DEFAULT 1,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AmenityBooking" (
    "id" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "slotStart" TEXT NOT NULL,
    "slotEnd" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmenityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmenityBooking_amenityId_bookingDate_slotStart_bookedById_key" ON "AmenityBooking"("amenityId", "bookingDate", "slotStart", "bookedById");

-- AddForeignKey
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmenityBooking" ADD CONSTRAINT "AmenityBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
