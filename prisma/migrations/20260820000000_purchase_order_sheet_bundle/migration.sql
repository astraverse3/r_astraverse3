-- 발주서 판매처리 D1a — 통일양식 결정 #30·#31·#34·#35 대응.
-- 실DB의 PurchaseOrderUpload/PurchaseOrder/PurchaseOrderItem은 0건(2026-08-20 확인)이라
-- NOT NULL 컬럼을 백필 없이 추가한다. ProductType 68건은 nullable 컬럼이라 영향 없음.

-- 중복 감지 키 개정(#16): 파일명+발주일 → 파일명+시트명+발주일
-- DropIndex
DROP INDEX "PurchaseOrderUpload_fileName_orderDate_idx";

-- 박스 입수(#35) — 이마트 박스 환산표를 시스템이 생성. 미입력 SKU는 박스 칸 빈칸
-- AlterTable
ALTER TABLE "ProductType" ADD COLUMN     "unitsPerBox" INTEGER;

-- 톤백 요구 자루중량(#34) — 규격은 '톤백', 실제 kg은 이 컬럼으로 분리
-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "unitWeightKg" DOUBLE PRECISION;

-- 묶음 단위 = 시트 1장(#30) + 묶음 비고
-- AlterTable
ALTER TABLE "PurchaseOrderUpload" ADD COLUMN     "channel" "PurchaseChannel" NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "sheetName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderUpload_fileName_sheetName_orderDate_key" ON "PurchaseOrderUpload"("fileName", "sheetName", "orderDate");
