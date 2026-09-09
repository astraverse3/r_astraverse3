/**
 * 제품재고 차감 테스트 데이터 일회성 정리 — 계획서 `docs/plan/plan-차감테스트데이터정리.md`
 *
 * 지우는 것 (3종, 한 트랜잭션):
 *   1. PackageMovement 전건        — 차감 이력(판매·비판매·재포장 소진)
 *   2. MillingOutputPackage 중 repackId≠null — 재포장으로 생긴 결과 행
 *   3. Repack 전건
 *
 * 🔴 movement(소진)와 결과 행은 **반드시 짝으로** 지운다. 한쪽만 지우면
 *    `lib/package-guard.ts`가 막으려던 사고가 그대로 난다 — 재고가 증발하거나 두 배가 된다.
 *
 * 원물·도정 관계는 건드리지 않는다. 결과 행이 가진 batchId·stockId는 부모를 가리키는
 * 참조일 뿐이라, 자식을 지워도 배치·원물·원래 포장 행은 그대로 남는다(계획서 §7).
 *
 * 사용법:
 *   npx tsx scripts/cleanup-test-movements.ts           # 검증 + 백업만 (dry-run)
 *   npx tsx scripts/cleanup-test-movements.ts --apply   # 실제 삭제
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const BACKUP_PATH = process.argv.find(a => a.startsWith('--backup='))?.slice(9)
    ?? `./.cleanup-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`

function fail(msg: string): never {
    console.error(`\n🔴 중단: ${msg}`)
    process.exit(1)
}

async function main() {
    console.log(APPLY ? '=== 실행 모드 (--apply) ===\n' : '=== DRY-RUN (삭제하지 않는다) ===\n')

    // ---------------------------------------------------------------
    // 1. 백업 — 되돌릴 수 있는 유일한 수단이다. 실패하면 즉시 중단한다.
    // ---------------------------------------------------------------
    const movements = await prisma.packageMovement.findMany({ orderBy: { id: 'asc' } })
    const repacks = await prisma.repack.findMany({ orderBy: { id: 'asc' } })
    const resultRows = await prisma.millingOutputPackage.findMany({
        where: { repackId: { not: null } },
        orderBy: { id: 'asc' },
    })

    try {
        mkdirSync(dirname(BACKUP_PATH), { recursive: true })
        writeFileSync(
            BACKUP_PATH,
            JSON.stringify({ takenAt: new Date().toISOString(), movements, repacks, resultRows }, null, 2),
            'utf8',
        )
    } catch (e) {
        fail(`백업 파일을 쓰지 못했다 — ${(e as Error).message}`)
    }
    console.log(`백업 저장: ${BACKUP_PATH}`)
    console.log(`  movements ${movements.length}건 · repacks ${repacks.length}건 · 결과 행 ${resultRows.length}행\n`)

    // ---------------------------------------------------------------
    // 2. 사전 검증 — 하나라도 어긋나면 중단
    // ---------------------------------------------------------------
    console.log('--- 사전 검증 ---')

    const fromOrder = movements.filter(m => m.orderItemId !== null).length
    console.log(`  발주서 경로 movement: ${fromOrder}건 (0이어야 한다)`)
    if (fromOrder !== 0) fail('발주서에 묶인 차감이 있다. 계획서 범위 밖이므로 사람이 판단해야 한다.')

    const repackResultCount = await prisma.millingOutputPackage.count({ where: { repackId: { not: null } } })
    console.log(`  repackId≠null 재고 행: ${repackResultCount}행 · 백업에 담은 결과 행: ${resultRows.length}행`)
    if (repackResultCount !== resultRows.length) fail('결과 행 수가 백업과 어긋난다. 동시에 누가 쓰고 있을 수 있다.')

    const orphanResults = resultRows.filter(p => !repacks.some(r => r.id === p.repackId)).length
    console.log(`  Repack이 없는 고아 결과 행: ${orphanResults}행 (0이어야 한다)`)
    if (orphanResults !== 0) fail('가리키는 Repack이 없는 결과 행이 있다.')

    const orderRefs = await prisma.purchaseOrderItem.count({
        where: { movements: { some: { packageId: { in: resultRows.map(r => r.id) } } } },
    })
    console.log(`  결과 행을 참조하는 발주서 라인: ${orderRefs}건 (0이어야 한다)`)
    if (orderRefs !== 0) fail('발주서가 재포장 결과 행을 참조하고 있다.')

    const totalPkgBefore = await prisma.millingOutputPackage.count()
    const expectedAfter = totalPkgBefore - resultRows.length
    console.log(`  제품재고 ${totalPkgBefore}행 → 삭제 후 ${expectedAfter}행 예상`)
    console.log('  ✅ 사전 검증 통과\n')

    if (!APPLY) {
        console.log('DRY-RUN이므로 여기서 멈춘다. 실제로 지우려면 --apply 를 붙인다.')
        return
    }

    // ---------------------------------------------------------------
    // 3. 삭제 — deleteMany 3회. 🔴 루프 안 개별 삭제 금지(Neon 왕복 250~300ms)
    // ---------------------------------------------------------------
    console.log('--- 삭제 ---')
    const deleted = await prisma.$transaction(async (tx) => {
        // movement를 먼저 지우면 재포장 연쇄(결과 행이 다른 재포장의 소스인 경우)가 풀린다.
        const mv = await tx.packageMovement.deleteMany({})
        const pkg = await tx.millingOutputPackage.deleteMany({ where: { repackId: { not: null } } })
        const rp = await tx.repack.deleteMany({})
        return { mv: mv.count, pkg: pkg.count, rp: rp.count }
    }, { timeout: 30_000 })

    console.log(`  PackageMovement ${deleted.mv}건 삭제`)
    console.log(`  재포장 결과 재고 ${deleted.pkg}행 삭제`)
    console.log(`  Repack ${deleted.rp}건 삭제\n`)

    // 감사로그 1건 (46건 개별로는 남기지 않는다)
    await prisma.auditLog.create({
        data: {
            action: 'DELETE',
            entity: 'PackageMovement',
            entityId: null,
            userName: '시스템(정리 스크립트)',
            description:
                `제품재고 차감 테스트 데이터 일괄 정리 — movement ${deleted.mv}건 · ` +
                `재포장 결과 재고 ${deleted.pkg}행 · Repack ${deleted.rp}건 삭제`,
            details: { backupPath: BACKUP_PATH, movements: deleted.mv, resultRows: deleted.pkg, repacks: deleted.rp },
        },
    })

    // ---------------------------------------------------------------
    // 4. 사후 검증
    // ---------------------------------------------------------------
    console.log('--- 사후 검증 ---')
    const afterMv = await prisma.packageMovement.count()
    const afterRp = await prisma.repack.count()
    const afterPkg = await prisma.millingOutputPackage.count()
    const afterResults = await prisma.millingOutputPackage.count({ where: { repackId: { not: null } } })

    console.log(`  PackageMovement ${afterMv}건 (0이어야 한다)`)
    console.log(`  Repack ${afterRp}건 (0이어야 한다)`)
    console.log(`  제품재고 ${afterPkg}행 (${expectedAfter}행이어야 한다)`)
    console.log(`  repackId≠null 행 ${afterResults}행 (0이어야 한다)`)

    const ok = afterMv === 0 && afterRp === 0 && afterPkg === expectedAfter && afterResults === 0
    console.log(ok ? '\n✅ 사후 검증 통과' : '\n🔴 사후 검증 실패 — 백업으로 확인이 필요하다')

    // 🔴 스크립트는 revalidatePath를 거치지 않는다 — 앱 경로(차감·취소)만 캐시를 턴다.
    // 새로고침 전까지 화면은 삭제 전 스냅샷을 보여주고, `qty > available`로 판정하는
    // 「차감 이력」 ⋮ 메뉴가 남아 있다(다이얼로그는 열 때 새로 조회하므로 비어 있다).
    console.log('\n📌 브라우저를 새로고침해야 화면에 반영된다 (Ctrl+Shift+R).')
    if (!ok) process.exitCode = 1
}

main()
    .catch(e => { console.error(e); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
