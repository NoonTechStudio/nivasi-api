/*
  Warnings:

  - You are about to drop the column `userId` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `flatId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wingId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Vehicle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'CAR', 'AUTO', 'OTHER');

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_userId_fkey";

-- AlterTable
ALTER TABLE "Flat" ADD COLUMN     "familyMembers" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "userId",
ADD COLUMN     "flatId" TEXT NOT NULL,
ADD COLUMN     "wingId" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "VehicleType" NOT NULL;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
