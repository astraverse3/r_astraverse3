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
    const farmer = await prisma.farmer.create({
        data: {
            name: '김철수',
            phone: '010-1234-5678',
            certifications: {
                create: {
                    certType: '유기농',
                    certNo: '15102443',
                    personalNo: '371'
                }
            }
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
