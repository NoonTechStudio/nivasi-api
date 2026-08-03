-- CreateEnum
CREATE TYPE "UtilityCategory" AS ENUM ('WATER', 'DRAINAGE', 'GARDEN', 'ELECTRICITY', 'PARKING', 'OTHER');

-- CreateEnum
CREATE TYPE "UtilityFrequency" AS ENUM ('ONCE', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "UtilityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "UtilityService" (
    "id" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "category" "UtilityCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "assignedToName" TEXT,
    "assignedToPhone" TEXT,
    "frequency" "UtilityFrequency" NOT NULL DEFAULT 'MONTHLY',
    "scheduleDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedCost" DOUBLE PRECISION,
    "status" "UtilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityServiceLog" (
    "id" TEXT NOT NULL,
    "utilityServiceId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountPaid" DOUBLE PRECISION,
    "paymentMode" "PaymentMode",
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityServiceLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UtilityService" ADD CONSTRAINT "UtilityService_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityServiceLog" ADD CONSTRAINT "UtilityServiceLog_utilityServiceId_fkey" FOREIGN KEY ("utilityServiceId") REFERENCES "UtilityService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
