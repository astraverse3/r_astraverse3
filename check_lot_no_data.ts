
import { prisma } from './lib/prisma'

async function check() {
    const stocks = await prisma.stock.findMany({
        where: {
            lotNo: {
                not: null
            }
        },
        take: 50,
        select: {
            id: true,
            lotNo: true,
            farmer: { select: { name: true } }
        },
        orderBy: { id: 'desc' }
    })

    console.log('--- Top 50 Lot Nos ---')
    stocks.forEach(s => console.log(`${s.id}: ${s.lotNo} [len:${s.lotNo?.length}]`))
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
