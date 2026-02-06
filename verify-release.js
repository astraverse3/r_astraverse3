const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- Release Logic Verification ---')

    // 1. Create a dummy Stock
    const stock = await prisma.stock.create({
        data: {
            bagNo: 9999,
            weightKg: 800,
            status: 'AVAILABLE',
            variety: { connect: { id: 1 } }, // Assuming variety ID 1 exists
            farmer: { connect: { id: 1 } } // Assuming farmer ID 1 exists
        }
    })
    console.log('1. Created dummy stock:', stock.id)

    // 2. Create Release via Transaction (Simulating Server Action logic)
    // I can't call the server action directly here easily because it's a Next.js server action file.
    // So I will replicate the logic to ensure the schema/transaction works.

    const date = new Date()
    const destination = 'Test Center'
    const purpose = 'Test Purpose'

    const result = await prisma.$transaction(async (tx) => {
        const release = await tx.stockRelease.create({
            data: {
                date,
                destination,
                purpose,
                stocks: {
                    connect: [{ id: stock.id }]
                }
            }
        })

        await tx.stock.update({
            where: { id: stock.id },
            data: {
                status: 'RELEASED',
                releaseId: release.id
            }
        })

        return release
    })
    console.log('2. Created Release Record:', result)

    // 3. Verify Stock Status
    const updatedStock = await prisma.stock.findUnique({
        where: { id: stock.id },
        include: { release: true }
    })
    console.log('3. Updated Stock Status:', updatedStock.status)
    console.log('4. Linked Release ID:', updatedStock.releaseId)

    if (updatedStock.status === 'RELEASED' && updatedStock.releaseId === result.id) {
        console.log('--- Verification SUCCESS ---')
    } else {
        console.error('--- Verification FAILED ---')
    }

    // Cleanup
    await prisma.stock.delete({ where: { id: stock.id } })
    await prisma.stockRelease.delete({ where: { id: result.id } })
    console.log('5. Cleanup Complete')
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
