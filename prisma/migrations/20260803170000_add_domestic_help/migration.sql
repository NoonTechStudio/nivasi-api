-- CreateEnum
CREATE TYPE "DomesticHelpRole" AS ENUM ('MAID', 'COOK', 'DRIVER', 'NANNY', 'WATCHMAN', 'OTHER');

-- CreateTable
CREATE TABLE "DomesticHelp" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "wingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "DomesticHelpRole" NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomesticHelp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DomesticHelp" ADD CONSTRAINT "DomesticHelp_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
