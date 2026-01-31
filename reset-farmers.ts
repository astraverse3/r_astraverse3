
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. Delete Stocks first (Foreign Key to Farmer)
    const deletedStocks = await prisma.stock.deleteMany({})
    console.log(`Deleted ${deletedStocks.count} stocks.`)

    // 2. Delete Farmers (Foreign Key to ProducerGroup)
    const deletedFarmers = await prisma.farmer.deleteMany({})
    console.log(`Deleted ${deletedFarmers.count} farmers.`)

    // 3. Delete ProducerGroups
    const deletedGroups = await prisma.producerGroup.deleteMany({})
    console.log(`Deleted ${deletedGroups.count} producer groups.`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
