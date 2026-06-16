-- CreateEnum
CREATE TYPE "DeliveryHandling" AS ENUM ('CABIN_DROP', 'HELPER_DELIVERY', 'DIRECT_DELIVERY');

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "deliveryHandling" "DeliveryHandling";
