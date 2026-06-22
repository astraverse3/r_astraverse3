-- CreateEnum
CREATE TYPE "PurchaseChannel" AS ENUM ('DELIVERY', 'EMART');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('SALE', 'GIFT', 'LOST', 'DAMAGED', 'OTHER');

-- CreateTable
CREATE TABLE "PurchaseOrderUpload" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "uploadedName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "uploadId" INTEGER,
    "channel" "PurchaseChannel" NOT NULL,
    "orderDate" TIMESTAMP(3),
    "vendor" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "rawItemName" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "rawPackaging" TEXT,
    "orderedQty" INTEGER NOT NULL,
    "productTypeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageMovement" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "type" "MovementType" NOT NULL,
    "orderItemId" INTEGER,
    "customer" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderUpload_fileName_orderDate_idx" ON "PurchaseOrderUpload"("fileName", "orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_uploadId_idx" ON "PurchaseOrder"("uploadId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendor_recipient_idx" ON "PurchaseOrder"("vendor", "recipient");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_orderId_idx" ON "PurchaseOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productTypeId_idx" ON "PurchaseOrderItem"("productTypeId");

-- CreateIndex
CREATE INDEX "PackageMovement_packageId_idx" ON "PackageMovement"("packageId");

-- CreateIndex
CREATE INDEX "PackageMovement_orderItemId_idx" ON "PackageMovement"("orderItemId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PurchaseOrderUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageMovement" ADD CONSTRAINT "PackageMovement_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "MillingOutputPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageMovement" ADD CONSTRAINT "PackageMovement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
