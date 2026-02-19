
import { prisma } from './lib/prisma'

async function find() {
    // 1. First, list all varieties to see what's actually there
    const varieties = await prisma.variety.findMany({
        where: { name: { contains: '천지' } }
    })
    console.log('Varieties matching "천지":', varieties)

    // 2. Try finding stock with bagNo 2 and partial variety name
    const stocks = await prisma.stock.findMany({
        where: {
            variety: {
                name: { contains: '천지' }
            },
            bagNo: 2
        },
        include: {
            farmer: { include: { group: true } },
            variety: true
        }
    })

    console.log(`\nFound ${stocks.length} records for "천지" #2:`)
    stocks.forEach(s => {
        console.log(`
    Stock ID: ${s.id}
    Variety: ${s.variety.name}
    BagNo: ${s.bagNo}
    Farmer: ${s.farmer.name}
    Weight: ${s.weightKg}kg
    Status: ${s.status}
    LotNo: ${s.lotNo}
    `)
    })
}

find()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
