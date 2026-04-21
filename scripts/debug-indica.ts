import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('=== 인디카 도정 현황 조사 ===\n')

    // 0. 최신 생산연도
    const latestStock = await prisma.stock.findFirst({
        orderBy: { productionYear: 'desc' },
        select: { productionYear: true }
    })
    const latestYear = latestStock?.productionYear || new Date().getFullYear()
    console.log(`최신 생산연도: ${latestYear}\n`)

    // 1. millingType 값 분포 (전체)
    console.log('--- [1] millingType 값 분포 (전체 배치) ---')
    const typeGroups = await prisma.millingBatch.groupBy({
        by: ['millingType'],
        _count: true,
        orderBy: { _count: { millingType: 'desc' } }
    })
    typeGroups.forEach(g => {
        console.log(`  "${g.millingType}" : ${g._count}건`)
    })

    // 2. INDICA 품종 목록
    console.log('\n--- [2] INDICA로 분류된 품종 목록 ---')
    const indicaVarieties = await prisma.variety.findMany({
        where: { type: 'INDICA' },
        select: { id: true, name: true, type: true }
    })
    if (indicaVarieties.length === 0) {
        console.log('  ⚠️ INDICA 타입 품종이 없습니다!')
    } else {
        indicaVarieties.forEach(v => {
            console.log(`  ID ${v.id}: ${v.name} (type=${v.type})`)
        })
    }

    // 3. 인디카 품종이 들어간 배치 조회
    console.log('\n--- [3] INDICA 품종 stock이 포함된 마감 배치 ---')
    const indicaBatches = await prisma.millingBatch.findMany({
        where: {
            isClosed: true,
            stocks: {
                some: { variety: { type: 'INDICA' } }
            }
        },
        select: {
            id: true,
            date: true,
            millingType: true,
            totalInputKg: true,
            stocks: {
                select: {
                    weightKg: true,
                    productionYear: true,
                    variety: { select: { name: true, type: true } }
                }
            },
            outputs: { select: { totalWeight: true } }
        },
        orderBy: { date: 'desc' }
    })

    console.log(`  총 ${indicaBatches.length}건 발견\n`)

    if (indicaBatches.length === 0) {
        console.log('  인디카 포함 배치가 없습니다.')
    } else {
        indicaBatches.forEach(b => {
            const dateStr = b.date?.toISOString().slice(0, 10) || '-'
            const totalOut = b.outputs.reduce((s, o) => s + o.totalWeight, 0)
            const rawYield = b.totalInputKg > 0 ? (totalOut / b.totalInputKg) * 100 : 0

            const varietyNames = b.stocks.map(s => `${s.variety.name}(${s.variety.type})`)
            const uniqueVarieties = Array.from(new Set(varietyNames))
            const isMixed = uniqueVarieties.length > 1

            console.log(
                `  [Batch ${b.id}] ${dateStr} | millingType="${b.millingType}" | ` +
                `투입=${b.totalInputKg}kg | 산출=${totalOut}kg | 수율=${rawYield.toFixed(2)}%`
            )
            console.log(`    품종: ${uniqueVarieties.join(', ')}${isMixed ? ' ⚠️ MIXED' : ''}`)
            b.stocks.forEach(s => {
                console.log(
                    `      - ${s.variety.name}(${s.variety.type}) ${s.weightKg}kg [year=${s.productionYear}]`
                )
            })
        })
    }

    // 4. 현재 dashboard 로직 시뮬레이션 (latestYear 기준)
    console.log(`\n--- [4] 대시보드 indicaYield 계산 시뮬레이션 (year=${latestYear}) ---`)
    const yearBatches = await prisma.millingBatch.findMany({
        where: {
            isClosed: true,
            stocks: { some: { productionYear: latestYear } }
        },
        select: {
            id: true,
            millingType: true,
            totalInputKg: true,
            stocks: { select: { weightKg: true, variety: { select: { name: true, type: true } } } },
            outputs: { select: { totalWeight: true } }
        }
    })

    let indicaIn = 0
    let indicaOut = 0
    let contributingBatches: number[] = []

    yearBatches.forEach(b => {
        const batchOut = b.outputs.reduce((s, o) => s + o.totalWeight, 0)
        const batchStockInput = b.stocks.reduce((s, st) => s + st.weightKg, 0)
        if (batchStockInput === 0) return
        if (b.millingType !== '백미') return

        b.stocks.forEach(st => {
            if (st.variety.type !== 'INDICA') return
            const ratio = st.weightKg / batchStockInput
            indicaIn += b.totalInputKg * ratio
            indicaOut += batchOut * ratio
            if (!contributingBatches.includes(b.id)) contributingBatches.push(b.id)
        })
    })

    const indicaYield = indicaIn > 0 ? (indicaOut / indicaIn) * 100 : 0
    console.log(`  기여 배치 ID: [${contributingBatches.join(', ')}] (${contributingBatches.length}건)`)
    console.log(`  indicaIn  = ${indicaIn.toFixed(2)}kg`)
    console.log(`  indicaOut = ${indicaOut.toFixed(2)}kg`)
    console.log(`  indicaYield = ${indicaYield.toFixed(2)}%`)

    // 5. millingType이 '인디카'인 배치는 전부 필터로 배제되는지 확인
    console.log('\n--- [5] millingType="인디카"로 저장된 배치 (현재 dashboard에서 배제됨) ---')
    const indicaTypeBatches = await prisma.millingBatch.findMany({
        where: { millingType: '인디카', isClosed: true },
        select: {
            id: true,
            date: true,
            totalInputKg: true,
            outputs: { select: { totalWeight: true } },
            stocks: { select: { variety: { select: { name: true, type: true } } } }
        }
    })
    console.log(`  총 ${indicaTypeBatches.length}건`)
    indicaTypeBatches.forEach(b => {
        const out = b.outputs.reduce((s, o) => s + o.totalWeight, 0)
        const y = b.totalInputKg > 0 ? (out / b.totalInputKg) * 100 : 0
        const vs = Array.from(new Set(b.stocks.map(s => `${s.variety.name}(${s.variety.type})`)))
        console.log(`  [Batch ${b.id}] ${b.date?.toISOString().slice(0, 10)} | 수율=${y.toFixed(2)}% | 품종=${vs.join(',')}`)
    })
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
