/**
 * 잡곡 원물 #2277(기장 · 박태일 · 2025년산 · 400kg) 일회성 삭제 — 사용자 결정 2026-09-30.
 *
 * 배경:
 *   2026-05-06 사용자 지시로 이 행의 status를 AVAILABLE → CONSUMED로 **직접** 바꿨다(포장 0건).
 *   앱의 `deleteMiscStock`은 「CONSUMED = 이미 포장됨」으로 보고 삭제를 막는다 → 화면에서 못 지운다.
 *   사용자: 「소진된 기장 건은 삭제 처리해줘. 26년산 기장부터 새로 재고 입고할 거야」.
 *
 * 앱 삭제와 같은 조건을 확인하고(잡곡 · 포장 0 · 도정/출고 연결 없음), 내용이 예상과 다르면 멈춘다.
 * 지우기 전 행 전체를 저장소 밖 JSON으로 백업하고, 감사로그를 남긴다(userName='script').
 *
 * 사용법:
 *   npx tsx scripts/delete-misc-stock-2277.ts           # 확인만 (dry-run)
 *   npx tsx scripts/delete-misc-stock-2277.ts --apply   # 실제 삭제
 *
 * ⚠️ 실행 뒤 화면은 캐시가 남아 있을 수 있다 — 브라우저에서 새로고침.
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const BACKUP = '../backup-잡곡원물2277삭제-2026-09-30.json'

const EXPECTED = { id: 2277, variety: '기장', farmer: '박태일', productionYear: 2025, weightKg: 400, status: 'CONSUMED' }

class Abort extends Error {}
function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${String(actual)}${ok ? '' : ` (예상 ${String(expected)})`}`)
    if (!ok) throw new Abort(`${label} 불일치 — 중단`)
}

async function main() {
    const row = await prisma.stock.findUnique({
        where: { id: EXPECTED.id },
        include: {
            variety: { select: { name: true } },
            farmer: { select: { name: true } },
            _count: { select: { outputPackages: true } },
        },
    })
    if (!row) throw new Abort(`#${EXPECTED.id} 없음 — 이미 지워졌을 수 있다`)

    console.log(`대상 #${row.id} 확인 (${APPLY ? '실행' : 'dry-run'})`)
    check('category', row.category, 'MISC_GRAIN')
    check('품종', row.variety.name, EXPECTED.variety)
    check('생산자', row.farmer.name, EXPECTED.farmer)
    check('생산연도', row.productionYear, EXPECTED.productionYear)
    check('입고 중량(kg)', row.weightKg, EXPECTED.weightKg)
    check('상태', row.status, EXPECTED.status)
    check('포장 행', row._count.outputPackages, 0)
    check('도정 배치 연결', row.batchId, null)
    check('출고 연결', row.releaseId, null)

    const backup = { takenAt: new Date().toISOString(), row }
    if (!APPLY) {
        console.log('\ndry-run — 지우지 않았다. `--apply`로 실행')
        return
    }

    writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
    console.log(`\n백업: ${BACKUP}`)

    await prisma.$transaction(async tx => {
        await tx.stock.delete({ where: { id: row.id } })
        await tx.auditLog.create({
            data: {
                action: 'DELETE',
                entity: 'Stock',
                entityId: String(row.id),
                userName: 'script',
                description: `잡곡 입고 삭제: ${row.farmer.name} - ${row.variety.name} (${row.weightKg}kg) — 5/6 수동 소진 처리된 25년산, 앱에서 삭제 불가라 스크립트로 (사용자 결정 2026-09-30)`,
            },
        })
    })
    const after = await prisma.stock.count({ where: { id: row.id } })
    check('삭제 후 남은 행', after, 0)
    console.log('완료 — 브라우저에서 새로고침')
}

main()
    .catch(e => {
        console.error(e instanceof Abort ? `중단: ${e.message}` : e)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
