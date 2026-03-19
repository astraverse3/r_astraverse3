-- AlterTable
ALTER TABLE "MillingOutputPackage" ADD COLUMN "stockId" INTEGER;

-- AddForeignKey
ALTER TABLE "MillingOutputPackage" ADD CONSTRAINT "MillingOutputPackage_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
