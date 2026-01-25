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
