/**
 * 2026-10-01 직접 판매 60줄 → 「기타 · 기능 오픈 전 일괄차감」 일회성 정정 — 사용자 결정 2026-10-02.
 *
 * 대상: 10/1 11시대 이영명 · 차감 창 「판매」 · 거래처·메모 빈칸 · 60줄 · 약 89톤 (포장일 7/13부터)
 * 같은 시간대 앞뒤로 같은 사람이 「기타 · 기능 오픈 전 일괄차감」을 넣고 있었다.
 * 차감 창의 기본 사유가 「판매」(deduct-dialog.tsx)라 재고조사 정리분이 판매로 들어간 것으로 본다.
 * 그대로 두면 판매분석(docs/plan/plan-판매분석.md) 첫 화면이 이 하루 89톤에 묻힌다.
 *
 * 🔴 바꾸는 건 `type`(SALE → OTHER)과 `note`뿐이다. 개수·발생일·포장 행은 그대로라
 *    가용재고(count - Σmovements)는 변하지 않는다. 비판매는 원물 복원이 없으니(#19) 다른 연쇄도 없다.
 * 내용이 예상과 다르면 멈춘다. 바꾸기 전 저장소 밖 JSON으로 백업하고 감사로그를 남긴다.
 *
 * 사용법:
 *   npx tsx scripts/fix-direct-sale-2026-10-01.ts           # 확인만 (dry-run) — 차감 한 번 단위 목록
 *   npx tsx scripts/fix-direct-sale-2026-10-01.ts --apply   # 실제 정정 (🖐 이영명 님 확인 후)
 *
 * 🔴 DB 주소는 `.env.local`에서 직접 읽는다 — `.env`의 DIRECT_URL은 불완전하다(§82).
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync } from 'node:fs'
import { toKstDateTime } from '../lib/kst-date'

function dbUrl(): string {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
        const m = /^\s*DATABASE_URL\s*=\s*"?(.*?)"?\s*$/.exec(line)
        if (m && URL.canParse(m[1])) return m[1]
    }
    throw new Error('.env.local에 DATABASE_URL이 없다')
}

const prisma = new PrismaClient({ datasourceUrl: dbUrl() })
const APPLY = process.argv.includes('--apply')
const BACKUP = '../backup-직접판매정정-2026-10-01.json'
const NOTE = '기능 오픈 전 일괄차감'

// KST 2026-10-01 11:00 ~ 12:00
const CREATED_FROM = new Date('2026-10-01T02:00:00Z')
const CREATED_TO = new Date('2026-10-01T03:00:00Z')

const EXPECTED_ROWS = 60
const EXPECTED_KG = 89028

class Abort extends Error {}
function check(label: string, actual: unknown, expected: unknown) {
    const ok = actual === expected
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${String(actual)}${ok ? '' : ` (예상 ${String(expected)})`}`)
    if (!ok) throw new Abort(`${label} 불일치 — 중단`)
}

const WHERE = {
    type: 'SALE' as const,
    orderItemId: null,
    customer: null,
    note: null,
    createdName: '이영명',
    createdAt: { gte: CREATED_FROM, lt: CREATED_TO },
}

async function main() {
    const rows = await prisma.packageMovement.findMany({
        where: WHERE,
        include: {
            package: {
                select: {
                    id: true,
                    packageType: true,
                    weightPerUnit: true,
                    createdAt: true,
                    stock: { select: { variety: { select: { name: true } }, farmer: { select: { name: true } } } },
                    variety: { select: { name: true } },
                },
            },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const kg = Math.round(rows.reduce((s, r) => s + r.count * r.package.weightPerUnit, 0))

    console.log(`10/1 직접 판매 정정 확인 (${APPLY ? '실행' : 'dry-run'})`)
    check('대상 줄 수', rows.length, EXPECTED_ROWS)
    check('대상 중량(kg, 반올림)', kg, EXPECTED_KG)
    // 같은 시간대 판매 차감이 이 조건 밖에 따로 있으면(거래처를 적은 진짜 판매 등) 알려 준다
    const otherSales = await prisma.packageMovement.count({
        where: { type: 'SALE', orderItemId: null, createdAt: { gte: CREATED_FROM, lt: CREATED_TO }, NOT: { id: { in: rows.map(r => r.id) } } },
    })
    check('같은 시간대 다른 직접 판매(거래처·메모 있는 것)', otherSales, 0)

    // 차감 한 번(같은 createdAt) 단위로 — 담당자에게 확인받을 목록
    const batches = new Map<string, typeof rows>()
    for (const r of rows) {
        const key = toKstDateTime(r.createdAt)
        batches.set(key, [...(batches.get(key) ?? []), r])
    }
    console.log(`\n차감 ${batches.size}번:`)
    for (const [at, list] of batches) {
        const units = list.reduce((s, r) => s + r.count, 0)
        const batchKg = Math.round(list.reduce((s, r) => s + r.count * r.package.weightPerUnit, 0))
        console.log(`  ${at} · ${list.length}줄 · ${units.toLocaleString()}개 · ${batchKg.toLocaleString()}kg`)
        for (const r of list) {
            const variety = r.package.stock?.variety.name ?? r.package.variety?.name ?? '?'
            const farmer = r.package.stock?.farmer.name ?? '매입'
            console.log(`      #${r.package.id} ${variety} ${farmer} ${r.package.packageType} × ${r.count} (포장 ${toKstDateTime(r.package.createdAt).slice(0, 10)})`)
        }
    }

    if (!APPLY) {
        console.log(`\n정정하면: 위 ${rows.length}줄의 사유 「판매」 → 「기타」, 메모 「${NOTE}」. 개수·가용재고는 그대로`)
        console.log('dry-run — 바꾸지 않았다. `--apply`로 실행')
        return
    }

    writeFileSync(BACKUP, JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 2))
    console.log(`\n백업: ${BACKUP}`)

    const ids = rows.map(r => r.id)
    await prisma.$transaction(
        async tx => {
            const updated = await tx.packageMovement.updateMany({
                where: { ...WHERE, id: { in: ids } },
                data: { type: 'OTHER', note: NOTE },
            })
            if (updated.count !== EXPECTED_ROWS) throw new Abort(`정정 ${updated.count}줄 — 예상 ${EXPECTED_ROWS}, 롤백`)
            await tx.auditLog.create({
                data: {
                    action: 'UPDATE',
                    entity: 'PackageMovement',
                    entityId: ids.join(','),
                    userName: 'script',
                    details: { ids, from: 'SALE', to: 'OTHER', note: NOTE, kg },
                    description: `재고차감 사유 정정 ${rows.length}줄(${kg.toLocaleString()}kg): 판매 → 기타(${NOTE}) — 10/1 이영명 재고조사 정리분이 기본 사유 「판매」로 들어간 것 (사용자 결정 2026-10-02)`,
                },
            })
        },
        { timeout: 30_000 },
    )

    check('정정 뒤 남은 대상', await prisma.packageMovement.count({ where: WHERE }), 0)
    check('정정 뒤 기타로 바뀐 줄', await prisma.packageMovement.count({ where: { id: { in: ids }, type: 'OTHER', note: NOTE } }), EXPECTED_ROWS)
    console.log('완료 — 브라우저에서 새로고침')
}

main()
    .catch(e => {
        console.error(e instanceof Abort ? `중단: ${e.message}` : e)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
