-- 잡곡 재고관리 #1: Stock/Variety/MillingOutputPackage 확장
-- - StockCategory(RICE|MISC_GRAIN), SourceType(CONSIGNMENT|FARMER_MILLED), ProductSource(MILLED|PURCHASED) 신설
-- - 외부매입 잡곡은 Stock 미경유 → MillingOutputPackage에 source=PURCHASED + varietyId 직접 참조로 등록
-- - 도정산/매입 분기를 DB CHECK 제약 2개로 강제 (pkg_milled_has_source, pkg_purchased_required_fields)

-- CreateEnum
CREATE TYPE "StockCategory" AS ENUM ('RICE', 'MISC_GRAIN');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('CONSIGNMENT', 'FARMER_MILLED');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('MILLED', 'PURCHASED');

-- DropForeignKey
ALTER TABLE "MillingOutputPackage" DROP CONSTRAINT "MillingOutputPackage_batchId_fkey";

-- AlterTable: MillingOutputPackage — 출처 분기 + PURCHASED 전용 필드
ALTER TABLE "MillingOutputPackage" ADD COLUMN     "category" "StockCategory" NOT NULL DEFAULT 'RICE',
ADD COLUMN     "incomingDate" TIMESTAMP(3),
ADD COLUMN     "purchaseVendor" TEXT,
ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'MILLED',
ADD COLUMN     "varietyId" INTEGER,
ALTER COLUMN "batchId" DROP NOT NULL;

-- AlterTable: Stock — 카테고리 + 잡곡 입고 유형/원물중량/도정업체
ALTER TABLE "Stock" ADD COLUMN     "category" "StockCategory" NOT NULL DEFAULT 'RICE',
ADD COLUMN     "millingVendor" TEXT,
ADD COLUMN     "rawWeightKg" DOUBLE PRECISION,
ADD COLUMN     "sourceType" "SourceType";

-- AlterTable: Variety — 카테고리 (잡곡 품종 분리용)
ALTER TABLE "Variety" ADD COLUMN     "category" "StockCategory" NOT NULL DEFAULT 'RICE';

-- AddForeignKey
ALTER TABLE "MillingOutputPackage" ADD CONSTRAINT "MillingOutputPackage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MillingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingOutputPackage" ADD CONSTRAINT "MillingOutputPackage_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────
-- CHECK 제약 (계획서 §"null 허용 필드 일관성")
--   pkg_milled_has_source     : source=MILLED  → batchId 또는 stockId 중 하나 이상 존재
--   pkg_purchased_required_fields : source=PURCHASED → 매입처/품종/매입일 필수 + batch/stock null
--   기존 데이터(source=MILLED, batchId NOT NULL)는 모두 통과
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE "MillingOutputPackage"
  ADD CONSTRAINT "pkg_milled_has_source"
  CHECK ("source" <> 'MILLED' OR ("batchId" IS NOT NULL OR "stockId" IS NOT NULL));

ALTER TABLE "MillingOutputPackage"
  ADD CONSTRAINT "pkg_purchased_required_fields"
  CHECK (
    "source" <> 'PURCHASED' OR (
      "purchaseVendor" IS NOT NULL
      AND "varietyId"    IS NOT NULL
      AND "incomingDate" IS NOT NULL
      AND "batchId"      IS NULL
      AND "stockId"      IS NULL
    )
  );
