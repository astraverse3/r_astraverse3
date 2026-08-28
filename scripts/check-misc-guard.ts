/**
 * 잡곡 제품재고 차감 보호 검증 (읽기 전용) — docs/plan/plan-잡곡차감보호.md §6
 *
 * 잡곡은 `/packages` 잡곡 탭에서 수정·삭제할 수 있다. 차감(movement)이 붙은 행을
 * 지우거나 수량을 차감량 밑으로 줄이면 가용재고가 음수가 되고, 목록 필터
 * (`available <= 0`)에 걸려 **깨진 행이 화면에서 사라진다.**
 *
 *   1. 잡곡 행의 차감 노출 현황 — 지금 화면에서 건드릴 수 있는 차감 행이 몇 개인지
 *   2. 그 행들에 guard 판정을 걸어 본다 (삭제·축소·품종/규격 변경)
 *   3. 벼도 같은 기준으로 세어 비교 (벼는 제품재고에 수정/삭제 UI가 없다)
 *
 * D2(발주서 판매처리)가 가동되면 SALE 차감이 쌓인다 — 그 뒤 회귀 확인에도 쓴다.
 */
import { PrismaClient } from '@prisma/client'
import {
    guardDelete,
    guardCountChange,
    guardIdentityChange,
    deleteBlockedMessage,
    type GuardedPackage,
} from '../lib/package-guard'

const prisma = new PrismaClient()

const toGuarded = (r: {
    id: number
    packageType: string
    count: number
    repackId: number | null
    movements: { count: number }[]
}): GuardedPackage => ({
    id: r.id,
    packageType: r.packageType,
    count: r.count,
    movedCount: r.movements.reduce((s, m) => s + m.count, 0),
    repackId: r.repackId,
})

async function main() {
    const rows = await prisma.millingOutputPackage.findMany({
        where: { category: 'MISC_GRAIN' },
        select: {
            id: true, source: true, packageType: true, weightPerUnit: true, count: true,
            varietyId: true, purchaseVendor: true, repackId: true,
            variety: { select: { name: true } },
            stock: { select: { variety: { select: { name: true } } } },
            movements: { select: { count: true, type: true } },
        },
        orderBy: { id: 'asc' },
    })

    console.log(`=== 잡곡 제품재고 ${rows.length}행 ===`)
    for (const r of rows) {
        const g = toGuarded(r)
        const available = r.count - g.movedCount
        const name = r.variety?.name ?? r.stock?.variety.name ?? '—'
        console.log(
            `  #${r.id} [${r.source}] ${name} ${r.packageType} ${r.weightPerUnit}kg × ${r.count}` +
            `  차감 ${g.movedCount} → 가용 ${available}` +
            (r.repackId ? '  [재포장결과]' : '') +
            (available > 0 ? '  (목록에 보임)' : '  (소진돼 목록에서 빠짐)')
        )
    }

    const exposed = rows.filter(r => {
        const g = toGuarded(r)
        return (g.movedCount > 0 || r.repackId != null) && r.count - g.movedCount > 0
    })
    console.log(`\n화면에서 건드릴 수 있는 보호 대상 행: ${exposed.length}개`)

    // --- guard 판정 ---
    for (const r of exposed) {
        const g = toGuarded(r)
        console.log(`\n  #${r.id} ${g.packageType} × ${g.count} (차감 ${g.movedCount})`)

        const del = guardDelete(g)
        console.log(`    삭제        → ${del.ok ? '허용' : '차단'}`)
        if (!del.ok) {
            console.log(deleteBlockedMessage(g).split('\n').map(l => '      ' + l).join('\n'))
        }

        const shrink = guardCountChange(g, Math.max(0, g.movedCount - 1))
        console.log(`    차감량 밑 축소 → ${shrink.ok ? '허용 🔴' : '차단'}`)
        if (!shrink.ok) console.log(`      ${shrink.reason}`)

        const ident = guardIdentityChange(g, { packageType: '__다른규격__' }, { varietyId: r.varietyId })
        console.log(`    규격 변경     → ${ident.ok ? '허용 🔴' : '차단'}`)
    }

    // --- 벼 비교 ---
    const rice = await prisma.millingOutputPackage.findMany({
        where: { category: 'RICE' },
        select: { id: true, count: true, repackId: true, movements: { select: { count: true } } },
    })
    const riceExposed = rice.filter(r => {
        const used = r.movements.reduce((s, m) => s + m.count, 0)
        return used > 0 && r.count - used > 0
    })
    console.log(
        `\n(참고) 벼 제품재고 ${rice.length}행 중 부분 차감된 행: ${riceExposed.length}개` +
        ` — 제품재고에는 수정/삭제 UI가 없고, 도정관리 포장 수정은 lib/packaging-diff.ts가 막는다`
    )
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
