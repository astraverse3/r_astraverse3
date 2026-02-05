/*
  Warnings:

  - You are about to drop the column `certId` on the `Stock` table. All the data in the column will be lost.
  - You are about to drop the `FarmerCertification` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[groupId,farmerNo]` on the table `Farmer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `farmerNo` to the `Farmer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `Farmer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `farmerId` to the `Stock` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FarmerCertification" DROP CONSTRAINT "FarmerCertification_farmerId_fkey";

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_certId_fkey";

-- AlterTable
ALTER TABLE "Farmer" ADD COLUMN     "farmerNo" TEXT NOT NULL,
ADD COLUMN     "groupId" INTEGER NOT NULL,
ADD COLUMN     "items" TEXT;

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "certId",
ADD COLUMN     "farmerId" INTEGER NOT NULL,
ADD COLUMN     "lotNo" TEXT;

-- DropTable
DROP TABLE "FarmerCertification";

-- CreateTable
CREATE TABLE "ProducerGroup" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "certNo" TEXT NOT NULL,
    "cropYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProducerGroup_code_cropYear_key" ON "ProducerGroup"("code", "cropYear");

-- CreateIndex
CREATE UNIQUE INDEX "Farmer_groupId_farmerNo_key" ON "Farmer"("groupId", "farmerNo");

-- AddForeignKey
ALTER TABLE "Farmer" ADD CONSTRAINT "Farmer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProducerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "Farmer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
