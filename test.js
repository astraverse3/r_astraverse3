const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.millingBatch.findMany({ include: { stocks: { include: { variety: true } }, outputs: true } }).then(b => {
    const closed = b.filter(x => x.isClosed && x.stocks.some(s => s.variety.name.includes('백옥찰') || s.variety.name.includes('천지향')));
    closed.forEach(c => {
        const outW = c.outputs.reduce((s, o) => s + o.totalWeight, 0);
        console.log(`ID: ${c.id}, MillingType: ${c.millingType}, Date: ${c.date}, TotalInput: ${c.totalInputKg}, Outputs: ${outW}`);
        c.stocks.forEach(s => console.log(`  - Stock: ${s.variety.name} (${s.variety.type}) - ${s.weightKg}kg`));
    });
}).finally(() => p.$disconnect());
