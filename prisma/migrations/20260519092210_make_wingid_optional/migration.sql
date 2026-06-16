-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_wingId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "societyId" DROP NOT NULL,
ALTER COLUMN "wingId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_wingId_fkey" FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
