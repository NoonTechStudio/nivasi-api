/*
  Warnings:

  - A unique constraint covering the columns `[flatId,month,year]` on the table `MaintenanceBill` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[noticeId,userId]` on the table `NoticeSeen` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceBill_flatId_month_year_key" ON "MaintenanceBill"("flatId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeSeen_noticeId_userId_key" ON "NoticeSeen"("noticeId", "userId");
