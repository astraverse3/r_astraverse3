/**
 * 제품판매·잡곡 제품재고 테스트 데이터 일회성 초기화 — 계획서 `docs/plan/plan-판매잡곡재고초기화.md`
 *
 * 지우는 것 (한 트랜잭션):
 *   1. 발주서 3테이블 전부(묶음·건·라인)와 그 판매 차감(orderItemId≠null)
 *   2. 잡곡 제품재고 전부(도정산·매입)
 *   3. 벼 재포장 #16·#17 — 새청무 톤백 10개 → 10kg·5kg → 10,050kg 톤백 1개 (결정 B1)
 *
 * 옮겨 적는 것 (결정 A1):
 *   사용자가 「기능 오픈 전 일괄차감」으로 0을 만든 벼 행(★)은 테스트 판매분을 같은 사유로
 *   옮겨 적어 0을 유지한다. 안 그러면 사용자가 「비었다」고 판단한 행이 목록에 되살아난다.
 *
 * 벼 제품재고·일괄차감·나머지 재포장·잡곡 원물·마스터(품종·SKU)는 건드리지 않는다.
 *
 * 사용법:
 *   npx tsx scripts/reset-sales-and-misc-packages.ts           # 백업 + 검증만 (dry-run)
 *   npx tsx scripts/reset-sales-and-misc-packages.ts --apply   # 실제 실행
 */
import { PrismaClient } from '@prisma/client'
import { availableOf } from '../lib/package-available'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const BACKUP_PATH = process.argv.find(a => a.startsWith('--backup='))?.slice(9)
    ?? `../backup-판매잡곡초기화-2026-09-29${APPLY ? '' : '-dryrun'}.json`

const BULK_NOTE = '기능 오픈 전 일괄차감'

/** 2026-09-29 실측(계획서 §2). 하나라도 어긋나면 그사이 누가 앱을 쓴 것이다 → 중단. */
const EXPECTED = {
    uploads: 5,
    orders: 76,
    items: 126,
    orderMovements: 99,
    miscPackages: 11,
    ricePackages: 702,
    movements: 685,
    repacks: 13,
    starIds: [827, 828, 830, 831, 836, 837, 838, 872, 1083, 1475, 1480],
    starCount: 153,
}

/** 결정 B1 — #16 소스 pkg#1443(톤백×10) → 결과 1457·1458 → #17 소스 → 결과 1459 */
const REVERT = { repackIds: [16, 17], sourceId: 1443, sourceCount: 10, resultIds: [1457, 1458, 1459] }

type StarRow = {
    packageId: number
    saleCount: number
    occurredAt: Date
    createdById: string | null
    createdName: string | null
}

/** 중단 신호. `process.exit`를 쓰면 `$disconnect()`를 못 부른다 — throw로 finally까지 간다. */
class Abort extends Error {}

function fail(msg: string): never {
    throw new Abort(msg)
}

function check(label: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected)
    const tail = ok ? '' : ` (예상 ${JSON.stringify(expected)})`
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${tail}`)
    if (!ok) fail(`${label} 값이 실측과 다르다. 그사이 누가 앱을 썼을 수 있다.`)
}

const byNumber = (a: number, b: number) => a - b

/**
 * ★ = 발주서 판매가 걸려 있고, 사용자 일괄차감으로 가용이 0이 된 벼 행.
 * 옮겨 적는 차감은 그 행의 가장 최근 일괄차감을 따른다(발생일·작업자).
 */
async function loadStarRows(): Promise<StarRow[]> {
    const rows = await prisma.millingOutputPackage.findMany({
        where: {
            category: 'RICE',
            AND: [
                { movements: { some: { orderItemId: { not: null } } } },
                { movements: { some: { note: BULK_NOTE } } },
            ],
        },
        select: {
            id: true,
            count: true,
            movements: {
                select: { count: true, orderItemId: true, note: true, occurredAt: true, createdById: true, createdName: true },
                orderBy: { occurredAt: 'desc' },
            },
        },
        orderBy: { id: 'asc' },
    })
    return rows.flatMap(p => {
        if (availableOf(p) !== 0) return []
        const saleCount = p.movements.filter(m => m.orderItemId !== null).reduce((a, m) => a + m.count, 0)
        const latestBulk = p.movements.find(m => m.note === BULK_NOTE)!
        return [{
            packageId: p.id,
            saleCount,
            occurredAt: latestBulk.occurredAt,
            createdById: latestBulk.createdById,
            createdName: latestBulk.createdName,
        }]
    })
}

async function loadSnapshot() {
    const uploads = await prisma.purchaseOrderUpload.findMany({
        include: { orders: { include: { items: true } } },
        orderBy: { id: 'asc' },
    })
    const orderMovements = await prisma.packageMovement.findMany({
        where: { orderItemId: { not: null } },
        orderBy: { id: 'asc' },
    })
    const miscPackages = await prisma.millingOutputPackage.findMany({
        where: { category: 'MISC_GRAIN' },
        include: { movements: true, stock: { select: { id: true, status: true } } },
        orderBy: { id: 'asc' },
    })
    const repacks = await prisma.repack.findMany({
        where: { id: { in: REVERT.repackIds } },
        include: { sources: true, results: { include: { movements: true } } },
        orderBy: { id: 'asc' },
    })
    const revertSource = await prisma.millingOutputPackage.findUnique({
        where: { id: REVERT.sourceId },
        include: { movements: true },
    })
    const starRows = await loadStarRows()
    return { uploads, orderMovements, miscPackages, repacks, revertSource, starRows }
}

type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>

function backup(s: Snapshot) {
    try {
        writeFileSync(BACKUP_PATH, JSON.stringify({ takenAt: new Date().toISOString(), ...s }, null, 2), 'utf8')
    } catch (e) {
        fail(`백업 파일을 쓰지 못했다 — ${(e as Error).message}`)
    }
    console.log(`백업 저장: ${BACKUP_PATH}\n`)
}

async function verifyTotals(s: Snapshot) {
    const [orders, items, ricePackages, movements, repacks] = await Promise.all([
        prisma.purchaseOrder.count(),
        prisma.purchaseOrderItem.count(),
        prisma.millingOutputPackage.count({ where: { category: 'RICE' } }),
        prisma.packageMovement.count(),
        prisma.repack.count(),
    ])
    const ordersInUploads = s.uploads.reduce((a, u) => a + u.orders.length, 0)
    const itemsInUploads = s.uploads.reduce((a, u) => a + u.orders.reduce((b, o) => b + o.items.length, 0), 0)

    check('발주서 묶음', s.uploads.length, EXPECTED.uploads)
    check('발주서 건', orders, EXPECTED.orders)
    check('  묶음에 속한 건(고아 없음)', ordersInUploads, EXPECTED.orders)
    check('발주서 라인', items, EXPECTED.items)
    check('  묶음에 속한 라인(고아 없음)', itemsInUploads, EXPECTED.items)
    check('발주서 판매 차감', s.orderMovements.length, EXPECTED.orderMovements)
    check('잡곡 제품재고', s.miscPackages.length, EXPECTED.miscPackages)
    check('벼 제품재고', ricePackages, EXPECTED.ricePackages)
    check('차감 전체', movements, EXPECTED.movements)
    check('재포장 전체', repacks, EXPECTED.repacks)
}

function verifyMisc(s: Snapshot) {
    const nonOrder = s.miscPackages.flatMap(p => p.movements).filter(m => m.orderItemId === null).length
    check('잡곡 행에 걸린 발주서 외 차감', nonOrder, 0)
    check('잡곡 행 중 재포장 결과', s.miscPackages.filter(p => p.repackId !== null).length, 0)
    const consumed = s.miscPackages.filter(p => p.stock?.status === 'CONSUMED').length
    console.log(`  · 잡곡 포장이 가리키는 원물 중 CONSUMED: ${consumed}건 (복원 대상, 0 예상)`)
}

function verifyStar(s: Snapshot) {
    check('★ 행(일괄차감으로 0이 된 판매 행)', s.starRows.map(r => r.packageId), EXPECTED.starIds)
    check('★ 옮겨 적을 개수', s.starRows.reduce((a, r) => a + r.saleCount, 0), EXPECTED.starCount)
    const noAuthor = s.starRows.filter(r => r.createdById === null).length
    console.log(`  · 작업자 없는 일괄차감을 따르는 ★ 행: ${noAuthor}행`)
}

function verifyRevert(s: Snapshot) {
    const [r16, r17] = s.repacks
    check('되돌릴 재포장', s.repacks.map(r => r.id), REVERT.repackIds)
    check('#16 소스', r16.sources.map(m => [m.packageId, m.count]), [[REVERT.sourceId, REVERT.sourceCount]])
    check('#16·#17 결과 행', s.repacks.flatMap(r => r.results.map(p => p.id)), REVERT.resultIds)
    check('#17 소스 = #16 결과',
        r17.sources.map(m => m.packageId).sort(byNumber),
        r16.results.map(p => p.id).sort(byNumber))
    const strayOnResults = s.repacks.flatMap(r => r.results).flatMap(p => p.movements)
        .filter(m => m.repackId !== 17).length
    check('결과 행에 걸린 #17 외 차감', strayOnResults, 0)
    const strayOnSource = s.revertSource?.movements.filter(m => m.repackId !== 16).length ?? -1
    check(`원본 pkg#${REVERT.sourceId}에 걸린 #16 외 차감`, strayOnSource, 0)
}

/** 🔴 지운 개수가 스냅샷과 다르면 throw → 전부 롤백. 사이에 끼어든 쓰기를 잡는다. */
function expectCount(label: string, actual: number, expected: number) {
    if (actual !== expected) throw new Error(`${label} ${actual}건 (예상 ${expected}) — 롤백`)
}

async function applyChanges(s: Snapshot) {
    const uploadIds = s.uploads.map(u => u.id)
    const miscIds = s.miscPackages.map(p => p.id)
    const stockIds = [...new Set(s.miscPackages.flatMap(p => (p.stockId === null ? [] : [p.stockId])))]
    const starCount = s.starRows.reduce((a, r) => a + r.saleCount, 0)

    return prisma.$transaction(async (tx) => {
        // 1. ★ 행 — 판매분을 일괄차감으로 옮겨 적는다(판매를 지우기 전에 써야 가용이 0에서 안 벗어난다)
        const star = await tx.packageMovement.createMany({
            data: s.starRows.map(r => ({
                packageId: r.packageId,
                count: r.saleCount,
                type: 'OTHER' as const,
                note: BULK_NOTE,
                occurredAt: r.occurredAt,
                createdById: r.createdById,
                createdName: r.createdName,
            })),
        })
        expectCount('★ 일괄차감 생성', star.count, EXPECTED.starIds.length)

        // 2. 발주서 판매 차감 → 건(라인 Cascade) → 묶음
        const sales = await tx.packageMovement.deleteMany({ where: { id: { in: s.orderMovements.map(m => m.id) } } })
        expectCount('발주서 판매 차감 삭제', sales.count, EXPECTED.orderMovements)
        const leftSales = await tx.packageMovement.count({ where: { orderItemId: { not: null } } })
        expectCount('남은 발주서 차감', leftSales, 0)
        const orders = await tx.purchaseOrder.deleteMany({ where: { uploadId: { in: uploadIds } } })
        expectCount('발주서 건 삭제', orders.count, EXPECTED.orders)
        const uploads = await tx.purchaseOrderUpload.deleteMany({ where: { id: { in: uploadIds } } })
        expectCount('발주서 묶음 삭제', uploads.count, EXPECTED.uploads)

        // 3. 재포장 #16·#17 — 소진 차감을 먼저 지워야 결과 행이 FK에서 풀린다
        const repackMv = await tx.packageMovement.deleteMany({ where: { repackId: { in: REVERT.repackIds } } })
        expectCount('재포장 소진 차감 삭제', repackMv.count, 3)
        const repackRows = await tx.millingOutputPackage.deleteMany({ where: { id: { in: REVERT.resultIds } } })
        expectCount('재포장 결과 행 삭제', repackRows.count, REVERT.resultIds.length)
        const repacks = await tx.repack.deleteMany({ where: { id: { in: REVERT.repackIds } } })
        expectCount('재포장 삭제', repacks.count, REVERT.repackIds.length)

        // 4. 잡곡 제품재고 → 원물 상태 복원(deleteMiscPackage와 같은 규칙)
        const misc = await tx.millingOutputPackage.deleteMany({ where: { id: { in: miscIds } } })
        expectCount('잡곡 제품재고 삭제', misc.count, EXPECTED.miscPackages)
        const restored = await tx.stock.updateMany({
            where: { id: { in: stockIds }, status: 'CONSUMED' },
            data: { status: 'AVAILABLE' },
        })

        await tx.auditLog.create({
            data: {
                action: 'DELETE',
                entity: 'PurchaseOrderUpload',
                entityId: null,
                userName: '시스템(정리 스크립트)',
                description:
                    `제품판매·잡곡 제품재고 테스트 데이터 초기화 — 발주서 ${uploads.count}묶음·${orders.count}건 · ` +
                    `판매 차감 ${sales.count}건 · 잡곡 제품재고 ${misc.count}행 · 재포장 #16·#17 되돌림 · ` +
                    `★ 벼 ${star.count}행 판매분 ${starCount}개를 일괄차감으로 옮김`,
                details: {
                    backupPath: BACKUP_PATH,
                    uploads: uploadIds,
                    salesDeleted: sales.count,
                    miscPackages: miscIds,
                    revertedRepacks: REVERT.repackIds,
                    starRows: s.starRows.map(r => ({ packageId: r.packageId, count: r.saleCount })),
                    stocksRestored: restored.count,
                },
            },
        })
        return { star: star.count, sales: sales.count, orders: orders.count, uploads: uploads.count,
            repackMv: repackMv.count, repackRows: repackRows.count, repacks: repacks.count,
            misc: misc.count, restored: restored.count }
    }, { timeout: 30_000 })
}

async function verifyAfter(s: Snapshot) {
    console.log('--- 사후 검증 ---')
    const [uploads, orders, items, orderMv, misc, rice, movements, repacks] = await Promise.all([
        prisma.purchaseOrderUpload.count(),
        prisma.purchaseOrder.count(),
        prisma.purchaseOrderItem.count(),
        prisma.packageMovement.count({ where: { orderItemId: { not: null } } }),
        prisma.millingOutputPackage.count({ where: { category: 'MISC_GRAIN' } }),
        prisma.millingOutputPackage.count({ where: { category: 'RICE' } }),
        prisma.packageMovement.count(),
        prisma.repack.count(),
    ])
    const rows = await prisma.millingOutputPackage.findMany({
        select: { id: true, count: true, movements: { select: { count: true } } },
    })
    const avail = new Map(rows.map(p => [p.id, availableOf(p)]))

    const expectedMovements = EXPECTED.movements + EXPECTED.starIds.length - EXPECTED.orderMovements - 3
    const results = [
        ['발주서 묶음·건·라인', [uploads, orders, items], [0, 0, 0]],
        ['발주서 판매 차감', orderMv, 0],
        ['잡곡 제품재고', misc, 0],
        ['벼 제품재고', rice, EXPECTED.ricePackages - REVERT.resultIds.length],
        ['차감 전체', movements, expectedMovements],
        ['재포장 전체', repacks, EXPECTED.repacks - REVERT.repackIds.length],
        ['★ 행 가용', s.starRows.map(r => avail.get(r.packageId)), s.starRows.map(() => 0)],
        ['가용 음수 행', [...avail.values()].filter(v => v < 0).length, 0],
        [`원본 pkg#${REVERT.sourceId} 가용`, avail.get(REVERT.sourceId), REVERT.sourceCount],
    ] as const
    let ok = true
    for (const [label, actual, expected] of results) {
        const pass = JSON.stringify(actual) === JSON.stringify(expected)
        ok &&= pass
        console.log(`  ${pass ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${pass ? '' : ` (예상 ${JSON.stringify(expected)})`}`)
    }
    return ok
}

async function main() {
    console.log(APPLY ? '=== 실행 모드 (--apply) ===\n' : '=== DRY-RUN (바꾸지 않는다) ===\n')

    const s = await loadSnapshot()
    backup(s)

    console.log('--- 사전 검증 ---')
    await verifyTotals(s)
    verifyMisc(s)
    verifyStar(s)
    verifyRevert(s)
    console.log('  ✅ 사전 검증 통과\n')

    if (!APPLY) {
        console.log('DRY-RUN이므로 여기서 멈춘다. 실제로 하려면 --apply 를 붙인다.')
        return
    }

    console.log('--- 실행 ---')
    const done = await applyChanges(s)
    console.log(`  ★ 일괄차감 ${done.star}건 생성 · 발주서 판매 차감 ${done.sales}건 삭제`)
    console.log(`  발주서 건 ${done.orders}건(라인 Cascade) · 묶음 ${done.uploads}건 삭제`)
    console.log(`  재포장 소진 ${done.repackMv}건 · 결과 행 ${done.repackRows}행 · Repack ${done.repacks}건 삭제`)
    console.log(`  잡곡 제품재고 ${done.misc}행 삭제 · 원물 상태 복원 ${done.restored}건\n`)

    const ok = await verifyAfter(s)
    console.log(ok ? '\n✅ 사후 검증 통과' : '\n🔴 사후 검증 실패 — 백업으로 확인이 필요하다')

    // 🔴 스크립트는 revalidatePath를 거치지 않는다 — 화면은 새로고침 전까지 옛 스냅샷이다(9/9 교훈).
    console.log('\n📌 브라우저를 새로고침해야 화면에 반영된다 (Ctrl+Shift+R).')
    if (!ok) process.exitCode = 1
}

main()
    .catch(e => {
        console.error(e instanceof Abort ? `\n🔴 중단: ${e.message}` : e)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
