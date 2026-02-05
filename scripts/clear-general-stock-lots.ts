
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting General Rice Lot Removal...')

    // Find stocks where farmer has no group OR group cert is '일반'
    // AND lotNo is not null
    const stocks = await prisma.stock.findMany({
        where: {
            lotNo: { not: null },
            OR: [
                { farmer: { groupId: null } },
                { farmer: { group: { certType: '일반' } } }
            ]
        },
        include: {
            farmer: {
                include: { group: true }
            }
        }
    })

    console.log(`Found ${stocks.length} stocks to update.`)

    let updatedCount = 0
    for (const stock of stocks) {
        // Double check condition (though query should cover it)
        const isGeneral = !stock.farmer.group || stock.farmer.group.certType === '일반'

        if (isGeneral) {
            console.log(`Clearing LotNo for Stock ${stock.id} (${stock.farmer.name} - ${stock.farmer.group?.certType || 'No Group'})`)
            await prisma.stock.update({
                where: { id: stock.id },
                data: { lotNo: null }
            })
            updatedCount++
        }
    }

    console.log(`Successfully cleared LotNo for ${updatedCount} stocks.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
