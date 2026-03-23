import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration for MillingOutputPackage.stockId...')
  
  // Find all packages where stockId is null
  const packages = await prisma.millingOutputPackage.findMany({
    where: { stockId: null },
    include: {
      batch: {
        include: {
          stocks: true
        }
      }
    }
  })

  console.log(`Found ${packages.length} packages to migrate.`)

  let updatedCount = 0
  let failedCount = 0

  for (const pkg of packages) {
    if (pkg.batch.stocks.length > 0) {
      // Assign the first stock's ID to this package
      const primaryStock = pkg.batch.stocks[0]
      try {
        await prisma.millingOutputPackage.update({
          where: { id: pkg.id },
          data: { stockId: primaryStock.id }
        })
        updatedCount++
      } catch (err) {
        console.error(`Failed to update package ${pkg.id}:`, err)
        failedCount++
      }
    } else {
      console.warn(`Package ${pkg.id} has no stocks in its batch (${pkg.batchId})`)
      failedCount++
    }
  }

  console.log(`Migration completed. Updated: ${updatedCount}, Failed: ${failedCount}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
