-- 배송·상차 정보 S1 — 계획서 `docs/plan/plan-배송상차정보.md` 결정 #36·#37·#38·#39.
-- 추가되는 컬럼은 전부 nullable이거나 DEFAULT가 있어 기존 묶음에 백필이 필요 없다(결정 #37).
-- 배송업체는 삭제하지 않고 active=false로 숨기므로(결정 #39) FK는 ON DELETE SET NULL.
-- channel+createdAt 인덱스는 「최근 3건 최빈값」 추천 조회용(결정 #38).

-- CreateEnum
CREATE TYPE "LoadingTimeSlot" AS ENUM ('UNKNOWN', 'AM', 'PM', 'EXACT');

-- AlterTable
ALTER TABLE "PurchaseOrderUpload" ADD COLUMN     "loadingDate" TIMESTAMP(3),
ADD COLUMN     "loadingTime" TEXT,
ADD COLUMN     "loadingTimeSlot" "LoadingTimeSlot" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "shippingVendorId" INTEGER;

-- CreateTable
CREATE TABLE "ShippingVendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingVendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingVendor_name_key" ON "ShippingVendor"("name");

-- CreateIndex
CREATE INDEX "PurchaseOrderUpload_loadingDate_idx" ON "PurchaseOrderUpload"("loadingDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderUpload_channel_createdAt_idx" ON "PurchaseOrderUpload"("channel", "createdAt");

-- AddForeignKey
ALTER TABLE "PurchaseOrderUpload" ADD CONSTRAINT "PurchaseOrderUpload_shippingVendorId_fkey" FOREIGN KEY ("shippingVendorId") REFERENCES "ShippingVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

