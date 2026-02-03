
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Searching for Farmer: 최길순')

    // 1. Search by Farmer Name
    const farmers = await prisma.farmer.findMany({
        where: { name: { contains: '최길순' } },
        include: { group: true }
    })

    console.log(`Found ${farmers.length} farmers matching '최길순':`)
    farmers.forEach(f => {
        console.log(`- ID: ${f.id}, Name: '[${f.name}]', Group: '[${f.group.name}]', FarmerNo: ${f.farmerNo}`)
    })

    // 2. Search by Group Name
    const groups = await prisma.producerGroup.findMany({
        where: { name: { contains: '최길순' } }
    })
    console.log(`\nFound ${groups.length} groups matching '최길순':`)
    groups.forEach(g => {
        console.log(`- ID: ${g.id}, Name: '[${g.name}]', Code: ${g.code}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
