import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Fixing whitespace in farmer data...\n')

    const farmers = await prisma.farmer.findMany()

    let fixedCount = 0
    for (const farmer of farmers) {
        const updates: any = {}

        if (farmer.name !== farmer.name.trim()) {
            updates.name = farmer.name.trim()
        }
        if (farmer.farmerNo !== farmer.farmerNo.trim()) {
            updates.farmerNo = farmer.farmerNo.trim()
        }
        if (farmer.items && farmer.items !== farmer.items.trim()) {
            updates.items = farmer.items.trim()
        }
        if (farmer.phone && farmer.phone !== farmer.phone.trim()) {
            updates.phone = farmer.phone.trim()
        }

        if (Object.keys(updates).length > 0) {
            console.log(`Fixing Farmer ID ${farmer.id}: ${JSON.stringify(updates)}`)
            await prisma.farmer.update({
                where: { id: farmer.id },
                data: updates
            })
            fixedCount++
        }
    }

    console.log(`\n✅ Fixed ${fixedCount} farmers.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
