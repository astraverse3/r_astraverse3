
import { prisma } from './lib/prisma'

async function find() {
    const stocks = await prisma.stock.findMany({
        where: {
            variety: {
                name: '천지향'
            },
            bagNo: 2
        },
        include: {
            farmer: {
                include: {
                    group: true
                }
            },
            variety: true
        }
    })

    console.log(`Found ${stocks.length} records for "천지향" #2:`)
    stocks.forEach(s => {
        console.log(`
    ID: ${s.id}
    Year: ${s.productionYear}
    Farmer: ${s.farmer.name} (Group: ${s.farmer.group?.name || 'None'})
    Status: ${s.status}
    Weight: ${s.weightKg}kg
    LotNo: ${s.lotNo || 'N/A'}
    IncomingDate: ${s.incomingDate.toISOString().split('T')[0]}
    `)
    })
}

find()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
