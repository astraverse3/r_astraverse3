-- CreateTable
CREATE TABLE "Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bagNo" TEXT NOT NULL,
    "farmerName" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MillingBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "totalInputKg" REAL NOT NULL,
    "totalRiceKg" REAL NOT NULL,
    "yieldRate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MillingOutputPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "packageType" TEXT NOT NULL,
    "weightPerUnit" REAL NOT NULL,
    "count" INTEGER NOT NULL,
    "totalWeight" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MillingOutputPackage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MillingBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
