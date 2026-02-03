
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting Stock reset...')
    const deleteResult = await prisma.stock.deleteMany({})
    console.log(`Deleted ${deleteResult.count} stock records.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
