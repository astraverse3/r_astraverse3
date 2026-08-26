-- 재고 재포장 (결정 #43) — 분할·병합·규격변경을 하나의 행위로.
--   분할     톤백 1,004kg×1 → 1,000kg×1 + 4kg×1
--   규격변경  잔량 4kg×1     → 1kg×4
--   병합     잔량 10행 84kg → 20kg×4 + 잔량 4kg
--
-- 설계 핵심: 가용재고 공식(count - SUM(movements.count))을 바꾸지 않는다.
--   소스 소진 = PackageMovement(type=REPACK) → 기존 공식이 자동 반영
--   결과 생성 = MillingOutputPackage(repackId)
--   Repack 이 둘을 묶는다
--
-- 전부 비파괴: enum 값 추가 + nullable 컬럼 추가 + 신규 테이블. 기존 데이터 영향 없음.

-- 재포장 소진 유형 추가 (기존 SALE/GIFT/LOST/DAMAGED/OTHER 영향 없음)
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'REPACK';

-- CreateTable
CREATE TABLE "Repack" (
    "id" SERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "lossKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repack_pkey" PRIMARY KEY ("id")
);

-- 재포장으로 생겨난 결과 행 (원래부터 있던 행은 null)
-- AlterTable
ALTER TABLE "MillingOutputPackage" ADD COLUMN     "repackId" INTEGER;

-- 재포장으로 소진된 소스 (type=REPACK일 때만)
-- AlterTable
ALTER TABLE "PackageMovement" ADD COLUMN     "repackId" INTEGER;

-- CreateIndex
CREATE INDEX "Repack_occurredAt_idx" ON "Repack"("occurredAt");

-- CreateIndex
CREATE INDEX "MillingOutputPackage_repackId_idx" ON "MillingOutputPackage"("repackId");

-- CreateIndex
CREATE INDEX "PackageMovement_repackId_idx" ON "PackageMovement"("repackId");

-- AddForeignKey
ALTER TABLE "MillingOutputPackage" ADD CONSTRAINT "MillingOutputPackage_repackId_fkey" FOREIGN KEY ("repackId") REFERENCES "Repack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageMovement" ADD CONSTRAINT "PackageMovement_repackId_fkey" FOREIGN KEY ("repackId") REFERENCES "Repack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
