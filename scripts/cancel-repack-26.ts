/**
 * 재포장 #26 일회성 되돌리기 — 사용자 요청 2026-10-01.
 *
 * 대상: 2026-10-01 11:18 이영명 · 서농22호 · 박오주 · 4kg 자연주의
 *   소스 #1450 132개(528kg) → 결과 #1511 57개(228kg), 손실 300kg
 * 사용자: 「이 작업을 되돌리고 싶어」.
 *
 * 앱의 `cancelRepack`(app/actions/repack.ts)은 화면에 연결하지 않은 보류 진입점이다(결정 #57).
 * 같은 조건(결과 행에 차감 0건)을 확인하고 같은 순서로 지운다:
 *   결과 행 삭제 → 소스 소진(REPACK movement) 삭제 → Repack 삭제.
 * 내용이 예상과 다르면 멈춘다. 지우기 전 전부 저장소 밖 JSON으로 백업하고 감사로그를 남긴다.
 *
 * 사용법:
 *   npx tsx scripts/cancel-repack-26.ts           # 확인만 (dry-run)
 *   npx tsx scripts/cancel-repack-26.ts --apply   # 실제 되돌리기
 *
 * 🔴 DB 주소는 `.env.local`에서 직접 읽는다 — `.env`의 DIRECT_URL은 불완전하다(§82).
 * ⚠️ 실행 뒤 화면은 캐시가 남아 있을 수 있다 — 브라우저에서 새로고침.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'node:fs'

function dbUrl(): string {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
        const m = /^\s*DATABASE_URL\s*=\s*"?(.*?)"?\s*$/.exec(line)
        if (m && URL.canParse(m[1])) return m[1]
    }
    throw new Error('.env.local에 DATABASE_URL이 없다')
}

const prisma = new PrismaClient({ datasourceUrl: dbUrl() })
const APPLY = process.argv.includes('--apply')
const BACKUP = '../backup-재포장26되돌리기-2026-10-01.json'

const REPACK_ID = 26
const SOURCE_ID = 1450
const RESULT_ID = 1511

class Abort extends Error {}
function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${String(actual)}${ok ? '' : ` (예상 ${String(expected)})`}`)
    if (!ok) throw new Abort(`${label} 불일치 — 중단`)
}

async function main() {
    const repack = await prisma.repack.findUnique({
        where: { id: REPACK_ID },
        include: {
            results: { include: { movements: true } },
            sources: true,
        },
    })
    if (!repack) throw new Abort(`재포장 #${REPACK_ID} 없음 — 이미 되돌려졌을 수 있다`)

    const source = await prisma.millingOutputPackage.findUnique({
        where: { id: SOURCE_ID },
        include: {
            movements: true,
            stock: { select: { variety: { select: { name: true } }, farmer: { select: { name: true } } } },
        },
    })
    if (!source) throw new Abort(`소스 #${SOURCE_ID} 없음`)

    console.log(`재포장 #${repack.id} 확인 (${APPLY ? '실행' : 'dry-run'})`)
    check('작업자', repack.createdName, '이영명')
    check('손실(kg)', repack.lossKg, 300)
    check('결과 행 수', repack.results.length, 1)
    const result = repack.results[0]
    check('결과 행 id', result.id, RESULT_ID)
    check('결과 규격', result.packageType, '4kg')
    check('결과 개수', result.count, 57)
    check('결과 행 차감 이력(0이어야 되돌릴 수 있다)', result.movements.length, 0)
    check('소스 소진 건수', repack.sources.length, 1)
    const mv = repack.sources[0]
    check('소진 대상 포장', mv.packageId, SOURCE_ID)
    check('소진 개수', mv.count, 132)
    check('소진 유형', mv.type, 'REPACK')
    check('소스 품종', source.stock?.variety.name, '서농22호')
    check('소스 생산자', source.stock?.farmer.name, '박오주')
    check('소스 포장 개수', source.count, 132)
    check('소스에 걸린 차감 (이 재포장 1건뿐)', source.movements.length, 1)

    if (!APPLY) {
        console.log(`\n되돌리면: 결과 #${RESULT_ID} 57개 삭제 · 소스 #${SOURCE_ID} 가용 0 → 132개 복원`)
        console.log('dry-run — 바꾸지 않았다. `--apply`로 실행')
        return
    }

    writeFileSync(BACKUP, JSON.stringify({ takenAt: new Date().toISOString(), repack, source }, null, 2))
    console.log(`\n백업: ${BACKUP}`)

    await prisma.$transaction(async tx => {
        await tx.millingOutputPackage.deleteMany({ where: { repackId: REPACK_ID } })
        await tx.packageMovement.deleteMany({ where: { repackId: REPACK_ID } })
        await tx.repack.delete({ where: { id: REPACK_ID } })
        await tx.auditLog.create({
            data: {
                action: 'DELETE',
                entity: 'Repack',
                entityId: String(REPACK_ID),
                userName: 'script',
                details: { resultCount: 1, sourceCount: 1, resultKg: result.totalWeight },
                description: `재포장 되돌리기: 결과 1행(${result.totalWeight}kg) 삭제, 소스 1건 복원 — 서농22호 박오주 4kg 132→57(손실 300kg), 화면에 되돌리기가 없어 스크립트로 (사용자 요청 2026-10-01)`,
            },
        })
    })

    const after = await prisma.millingOutputPackage.findUnique({
        where: { id: SOURCE_ID },
        include: { movements: true },
    })
    check('되돌린 뒤 재포장 행', await prisma.repack.count({ where: { id: REPACK_ID } }), 0)
    check('되돌린 뒤 결과 행', await prisma.millingOutputPackage.count({ where: { id: RESULT_ID } }), 0)
    check('되돌린 뒤 소스 가용', (after?.count ?? 0) - (after?.movements.reduce((s, m) => s + m.count, 0) ?? 0), 132)
    console.log('완료 — 브라우저에서 새로고침')
}

main()
    .catch(e => {
        console.error(e instanceof Abort ? `중단: ${e.message}` : e)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
