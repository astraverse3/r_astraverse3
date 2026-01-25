/*
  Warnings:

  - You are about to alter the column `bagNo` on the `Stock` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bagNo" INTEGER NOT NULL,
    "farmerName" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "weightKg" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Stock" ("bagNo", "certType", "createdAt", "farmerName", "id", "status", "updatedAt", "variety", "weightKg") SELECT "bagNo", "certType", "createdAt", "farmerName", "id", "status", "updatedAt", "variety", "weightKg" FROM "Stock";
DROP TABLE "Stock";
ALTER TABLE "new_Stock" RENAME TO "Stock";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
