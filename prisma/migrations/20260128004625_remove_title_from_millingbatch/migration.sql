-- CreateTable
CREATE TABLE "Stock" (
    "id" SERIAL NOT NULL,
    "bagNo" INTEGER NOT NULL,
    "farmerName" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "productionYear" INTEGER NOT NULL DEFAULT 2024,
    "certType" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "batchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillingBatch" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "millingType" TEXT NOT NULL DEFAULT '백미',
    "remarks" TEXT,
    "totalInputKg" DOUBLE PRECISION NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MillingOutputPackage" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "packageType" TEXT NOT NULL,
    "weightPerUnit" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL,
    "totalWeight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MillingOutputPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variety" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variety_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Variety_name_key" ON "Variety"("name");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MillingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MillingOutputPackage" ADD CONSTRAINT "MillingOutputPackage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MillingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
