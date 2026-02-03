
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting Lot Number Fix (Merging Group-Farmer hyphen)...')

    // 1. Fix Stocks
    const stocks = await prisma.stock.findMany({
        where: { lotNo: { not: null } }
    })

    let stockCount = 0
    for (const stock of stocks) {
        if (stock.lotNo) {
            const parts = stock.lotNo.split('-')
            // Old format: YYMMDD-Prod-Cert-Group-Farmer (5 parts)
            // New format: YYMMDD-Prod-Cert-GroupFarmer (4 parts)
            if (parts.length === 5) {
                const newLotNo = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}${parts[4]}`
                console.log(`Fixing Stock ${stock.id}: ${stock.lotNo} -> ${newLotNo}`)
                await prisma.stock.update({
                    where: { id: stock.id },
                    data: { lotNo: newLotNo }
                })
                stockCount++
            }
        }
    }
    console.log(`Fixed ${stockCount} stocks.`)

    // 2. Fix Milling Outputs
    const outputs = await prisma.millingOutputPackage.findMany({
        where: { lotNo: { not: null } }
    })

    let outputCount = 0
    for (const output of outputs) {
        if (output.lotNo) {
            const parts = output.lotNo.split('-')
            if (parts.length === 5) {
                const newLotNo = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}${parts[4]}`
                console.log(`Fixing Output ${output.id}: ${output.lotNo} -> ${newLotNo}`)
                await prisma.millingOutputPackage.update({
                    where: { id: output.id },
                    data: { lotNo: newLotNo }
                })
                outputCount++
            }
        }
    }
    console.log(`Fixed ${outputCount} milling outputs.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
