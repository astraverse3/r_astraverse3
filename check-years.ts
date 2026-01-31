
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const groups = await prisma.producerGroup.findMany({
        select: {
            cropYear: true,
            name: true,
            code: true
        }
    })

    const yearCounts: Record<number, number> = {}
    groups.forEach(g => {
        yearCounts[g.cropYear] = (yearCounts[g.cropYear] || 0) + 1
    })

    console.log('Crop Year Distribution:', yearCounts)
    console.log('Total Groups:', groups.length)

    // Sample a few from each year
    console.log('Samples:')
    const samples: Record<number, any[]> = {}
    groups.forEach(g => {
        if (!samples[g.cropYear]) samples[g.cropYear] = []
        if (samples[g.cropYear].length < 3) samples[g.cropYear].push(`${g.name} (${g.code})`)
    })
    console.log(samples)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
