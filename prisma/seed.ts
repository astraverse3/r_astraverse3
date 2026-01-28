import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding data...')

    // 1. Create Varieties
    const varieties = [
        { name: '새청무', type: 'URUCHI' },
        { name: '백옥찰', type: 'GLUTINOUS' },
        { name: '신동진', type: 'URUCHI' },
        { name: '동진찰', type: 'GLUTINOUS' },
        { name: '흑미', type: 'BLACK' },
    ]

    for (const v of varieties) {
        await prisma.variety.upsert({
            where: { name: v.name },
            update: {},
            create: { name: v.name, type: v.type },
        })
    }

    // 2. Create Sample Farmer & Cert
    // 2. Create Sample Producer Group
    // 2. Create Sample Producer Group
    const group = await prisma.producerGroup.upsert({
        where: {
            code_cropYear: {
                code: '01',
                cropYear: 2025
            }
        },
        update: {},
        create: {
            name: '해남작목반',
            code: '01',
            certNo: '15-02-3-06',
            certType: '유기농',
            cropYear: 2025
        }
    })

    // 3. Create Sample Farmer linked to Group
    const farmer = await prisma.farmer.create({
        data: {
            name: '김철수',
            phone: '010-1234-5678',
            farmerNo: '1',
            items: '쌀, 현미',
            groupId: group.id
        }
    })

    console.log(`Created farmer: ${farmer.name}`)
    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
