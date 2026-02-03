
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Checking for groups with trailing spaces...')
    const groups = await prisma.producerGroup.findMany()

    let fixedCount = 0
    for (const g of groups) {
        if (g.name.trim() !== g.name) {
            console.log(`Fixing Group ID ${g.id}: '${g.name}' -> '${g.name.trim()}'`)
            await prisma.producerGroup.update({
                where: { id: g.id },
                data: { name: g.name.trim() }
            })
            fixedCount++
        }
    }

    if (fixedCount > 0) {
        console.log(`Fixed ${fixedCount} group names.`)
    } else {
        console.log('No groups with trailing spaces found.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
