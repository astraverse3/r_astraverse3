/**
 * 605행 소급 정리 — 2026-06-30까지의 벼 제품재고를 일괄 차감한다.
 *
 * 배경: 시스템에서 차감을 한 번도 하지 않아 현 제품재고가 실재고가 아니다.
 *       그 상태로 D2(발주서 매트릭스)를 켜면 FIFO가 이미 팔린 재고를 집는다.
 *       사용자 결정 = 「6월말까지는 전부 나갔다고 보고 턴다. 7월 이후는 실물 조사로 맞춘다」.
 *
 * 대상: category=RICE · createdAt < 커트 · 가용 > 0  → **전량**(가용 전부) 차감
 * 사유: type=OTHER · note='기능 오픈 전 일괄차감'
 *
 * 🔴 occurredAt = 2026-06-30T00:00:00Z (UTC 자정)
 *    앱 관례는 KST 자정(=UTC 전날 15:00)이지만 **표시가 UTC로 잘려 하루 밀린다**(백로그 §39).
 *    UTC 자정으로 넣으면 지금 표시(UTC slice)로도 06-30, §39를 고친 뒤(KST 변환)에도 06-30이다.
 *    양쪽 모두에서 맞는 유일한 값이라 이걸 쓴다.
 *
 * 사용법:
 *   npx tsx scripts/bulk-deduct-before-july.ts           # 검증 + 백업만 (dry-run)
 *   npx tsx scripts/bulk-deduct-before-july.ts --apply   # 실제 차감
 */
import { PrismaClient } from '@prisma/client'
import { availableOf } from '../lib/package-available'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const BACKUP_PATH = process.argv.find(a => a.startsWith('--backup='))?.slice(9)
    ?? `./.bulk-deduct-${new Date().toISOString().replace(/[:.]/g, '-')}.json`

/** 커트라인 — KST 2026-07-01 00:00 = UTC 2026-06-30 15:00 */
const CUT = new Date('2026-06-30T15:00:00.000Z')
/** 차감 발생일 — 위 주석 참조 */
const OCCURRED_AT = new Date('2026-06-30T00:00:00.000Z')
const NOTE = '기능 오픈 전 일괄차감'
/** 기존 일괄차감 14건과 같은 작업자 (백업 파일에서 확인) */
const CREATED_BY_ID = 'cmm03q15i0000l0a23fjolzk1'
const CREATED_NAME = '문희준'

function fail(msg: string): never {
    console.error(`\n🔴 중단: ${msg}`)
    process.exit(1)
}

async function main() {
    console.log(APPLY ? '=== 실행 모드 (--apply) ===\n' : '=== DRY-RUN (차감하지 않는다) ===\n')

    const rows = await prisma.millingOutputPackage.findMany({
        where: { category: 'RICE', createdAt: { lt: CUT } },
        select: {
            id: true, createdAt: true, packageType: true, count: true, totalWeight: true,
            lotNo: true, source: true, category: true,
            movements: { select: { count: true } },
        },
        orderBy: { id: 'asc' },
    })

    const targets = rows.filter(r => availableOf(r) > 0)
    const totalQty = targets.reduce((s, r) => s + availableOf(r), 0)
    const totalKg = targets.reduce((s, r) => s + availableOf(r) * (r.totalWeight / r.count), 0)

    console.log(`커트라인: ${CUT.toISOString()} (KST 2026-07-01 00:00)`)
    console.log(`대상 조회: ${rows.length}행 중 가용>0 인 ${targets.length}행`)
    console.log(`  ${totalQty.toLocaleString()}개 · ${(totalKg / 1000).toFixed(1)}톤\n`)

    // 백업 — 되돌리려면 여기 담긴 packageId·count가 있어야 한다
    try {
        mkdirSync(dirname(BACKUP_PATH), { recursive: true })
        writeFileSync(BACKUP_PATH, JSON.stringify({
            takenAt: new Date().toISOString(),
            cut: CUT.toISOString(), occurredAt: OCCURRED_AT.toISOString(), note: NOTE,
            targets: targets.map(r => ({ ...r, available: availableOf(r) })),
        }, null, 2), 'utf8')
    } catch (e) {
        fail(`백업 파일을 쓰지 못했다 — ${(e as Error).message}`)
    }
    console.log(`백업 저장: ${BACKUP_PATH}\n`)

    // --- 사전 검증 ---
    console.log('--- 사전 검증 ---')
    const notRice = targets.filter(r => r.category !== 'RICE').length
    console.log(`  벼(RICE)가 아닌 행: ${notRice}행 (0이어야 한다 — 잡곡은 따로 본다)`)
    if (notRice !== 0) fail('잡곡이 대상에 섞였다.')

    const afterCut = targets.filter(r => r.createdAt >= CUT).length
    console.log(`  커트라인 이후 행: ${afterCut}행 (0이어야 한다)`)
    if (afterCut !== 0) fail('커트라인 이후 행이 대상에 들어왔다.')

    const nonPositive = targets.filter(r => availableOf(r) <= 0).length
    console.log(`  가용<=0 행: ${nonPositive}행 (0이어야 한다)`)
    if (nonPositive !== 0) fail('가용이 없는 행이 대상에 들어왔다.')

    const keep = await prisma.millingOutputPackage.count({ where: { category: 'RICE', createdAt: { gte: CUT } } })
    console.log(`  7월 이후로 남길 벼 재고: ${keep}행`)
    console.log('  ✅ 사전 검증 통과\n')

    if (!APPLY) {
        console.log('DRY-RUN이므로 여기서 멈춘다. 실제로 차감하려면 --apply 를 붙인다.')
        return
    }

    // --- 차감 ---
    // 🔴 루프 안 INSERT 금지 — createMany 한 번으로 끝낸다 (Neon 왕복 250~300ms)
    console.log('--- 차감 ---')
    const created = await prisma.$transaction(async (tx) => {
        const r = await tx.packageMovement.createMany({
            data: targets.map(t => ({
                packageId: t.id,
                count: availableOf(t),
                type: 'OTHER' as const,
                note: NOTE,
                occurredAt: OCCURRED_AT,
                createdById: CREATED_BY_ID,
                createdName: CREATED_NAME,
            })),
        })
        return r.count
    }, { timeout: 30_000 })
    console.log(`  PackageMovement ${created}건 생성\n`)

    await prisma.auditLog.create({
        data: {
            action: 'CREATE', entity: 'PackageMovement', entityId: null,
            userId: CREATED_BY_ID, userName: CREATED_NAME,
            description: `605행 소급 정리 — 2026-06-30까지 벼 제품재고 ${created}행 일괄차감 (${totalQty.toLocaleString()}개)`,
            details: { backupPath: BACKUP_PATH, cut: CUT.toISOString(), rows: created, qty: totalQty, note: NOTE },
        },
    })

    // --- 사후 검증 ---
    console.log('--- 사후 검증 ---')
    const after = await prisma.millingOutputPackage.findMany({
        where: { category: 'RICE' },
        select: { id: true, createdAt: true, count: true, totalWeight: true, movements: { select: { count: true } } },
    })
    const beforeCutLive = after.filter(r => r.createdAt < CUT && availableOf(r) > 0).length
    const afterCutLive = after.filter(r => r.createdAt >= CUT && availableOf(r) > 0)
    const liveKg = afterCutLive.reduce((s, r) => s + availableOf(r) * (r.totalWeight / r.count), 0)

    console.log(`  6월말 이전 가용>0 행: ${beforeCutLive}행 (0이어야 한다)`)
    console.log(`  7월 이후 남은 벼 재고: ${afterCutLive.length}행 · ${(liveKg / 1000).toFixed(1)}톤`)
    const negative = after.filter(r => availableOf(r) < 0).length
    console.log(`  가용이 음수인 행: ${negative}행 (0이어야 한다 — 데이터 손상 신호)`)

    const ok = beforeCutLive === 0 && negative === 0
    console.log(ok ? '\n✅ 사후 검증 통과' : '\n🔴 사후 검증 실패 — 백업으로 확인이 필요하다')
    console.log('\n📌 브라우저를 새로고침해야 화면에 반영된다 (Ctrl+Shift+R).')
    if (!ok) process.exitCode = 1
}

main()
    .catch(e => { console.error(e); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
