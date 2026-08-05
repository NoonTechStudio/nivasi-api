-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('PLUMBER', 'ELECTRICIAN', 'CLEANER', 'GARDENER', 'CONTRACTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorJobStatus" AS ENUM ('ASSIGNED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorJob" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "VendorJobStatus" NOT NULL DEFAULT 'ASSIGNED',
    "cost" DOUBLE PRECISION,
    "paymentMode" "PaymentMode",
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorJob" ADD CONSTRAINT "VendorJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
