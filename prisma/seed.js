const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('ibsm8lbs', 10);

    const user = await prisma.user.upsert({
        where: { username: 'astraverse' },
        update: {},
        create: {
            username: 'astraverse',
            password: password,
            name: '문희준',
            department: '공장',
            position: '주임',
            phone: '01086549345',
            role: 'ADMIN',
        },
    });

    console.log({ user });

    // Mock Data for Stocks (2026)
    const varieties = ['신동진', '새청무', '친들', '동진찰'];
    const certTypes = ['일반', '무농약', '유기농'];
    const farmers = ['김철수', '이영희', '박민수', '최지훈', '정다은'];

    console.log('Seeding 2026 stocks...');
    for (let i = 1; i <= 10; i++) {
        await prisma.stock.create({
            data: {
                bagNo: 2000 + i,
                farmerName: farmers[Math.floor(Math.random() * farmers.length)],
                variety: varieties[Math.floor(Math.random() * varieties.length)],
                certType: certTypes[Math.floor(Math.random() * certTypes.length)],
                weightKg: Math.floor(Math.random() * (1000 - 800 + 1) + 800), // 800~1000kg
                status: 'AVAILABLE',
                productionYear: 2026,
            }
        });
    }
    console.log('2026 Stocks seeded.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
