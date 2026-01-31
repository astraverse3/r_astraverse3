
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const result = await prisma.producerGroup.updateMany({
        where: {
            cropYear: 2026
        },
        data: {
            cropYear: 2024
        }
    })

    console.log(`Updated ${result.count} records from 2026 to 2024.`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
