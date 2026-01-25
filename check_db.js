const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const stocks = await prisma.stock.count();
        const batches = await prisma.millingBatch.count();
        console.log(`STOCKS_COUNT:${stocks}`);
        console.log(`BATCHES_COUNT:${batches}`);
    } catch (error) {
        console.error('ERROR:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
