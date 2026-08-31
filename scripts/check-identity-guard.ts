/**
 * 정체(품종·규격·단중·포장지) 변경 보호 노출 현황 — 읽기 전용
 *   계획서: docs/plan/plan-백로그19-20.md §6 · 백로그 §19
 *
 * 새 규칙이 **기존 데이터를 인질로 잡지 않는지**를 본다.
 * `d18487e` 때 「전 줄 유효성」이 배치 #73을 통째로 잠근 전례가 있다.
 *
 *   1. 차감이 붙은 행이 몇 개이고, 그중 단중 입력칸이 열려 있는(잔량·톤백) 게 몇 개인지
 *   2. 그 행들이 속한 배치를 **안 건드리고 저장할 수 있는지** (diffPackaging echo 시뮬레이션)
 *   3. 단중을 실제로 바꾸려 하면 막히는지
 */
import { PrismaClient } from '@prisma/client'
import { diffPackaging, type ExistingPackagingRow } from '../lib/packaging-diff'
import { movedCountOf } from '../lib/package-available'

const prisma = new PrismaClient()

const OPEN_WEIGHT = ['잔량', '톤백'] // 화면에 단중 입력칸이 열려 있는 규격

async function main() {
    const rows = await prisma.millingOutputPackage.findMany({
        where: { repackId: null },
        select: {
            id: true, batchId: true, source: true, category: true,
            packageType: true, weightPerUnit: true, count: true, totalWeight: true,
            stockId: true, productType: { select: { packagingId: true } },
            movements: { select: { count: true } },
        },
    })

    const deducted = rows.filter(r => movedCountOf(r) > 0)
    const openWeight = deducted.filter(r => OPEN_WEIGHT.includes(r.packageType))

    console.log('=== 1. 차감 노출 현황 ===')
    console.log(`전체 포장 행: ${rows.length}`)
    console.log(`차감된 행: ${deducted.length}`)
    console.log(`  그중 단중 입력칸이 열린 규격(잔량·톤백): ${openWeight.length}`)
    const bySpec = new Map<string, number>()
    for (const r of deducted) bySpec.set(r.packageType, (bySpec.get(r.packageType) ?? 0) + 1)
    console.log(`  규격별: ${[...bySpec].map(([k, v]) => `${k}(${v})`).join(' ')}`)

    const batchIds = [...new Set(deducted.map(r => r.batchId).filter((b): b is number => b != null))]
    console.log(`영향 배치: ${batchIds.length}개`)

    // -- 2. 안 건드리면 통과해야 한다 (회귀 방지의 핵심) --
    console.log('\n=== 2. 안 건드리고 저장 (echo) — 전부 통과해야 정상 ===')
    let locked = 0
    for (const batchId of batchIds) {
        const batchRows = rows.filter(r => r.batchId === batchId)
        const existing: ExistingPackagingRow[] = batchRows.map(r => ({
            id: r.id, packageType: r.packageType, weightPerUnit: r.weightPerUnit,
            count: r.count, totalWeight: r.totalWeight, stockId: r.stockId,
            packagingId: r.productType?.packagingId ?? null, movedCount: movedCountOf(r),
        }))
        const echo = existing.map(e => ({
            id: e.id, packageType: e.packageType, weightPerUnit: e.weightPerUnit,
            count: e.count, totalWeight: e.totalWeight, stockId: e.stockId as number,
            packagingId: e.packagingId,
        }))
        const r = diffPackaging(existing, echo)
        if (!r.ok) {
            locked++
            console.log(`  🔴 배치 #${batchId} 잠김: ${r.errors.map(e => e.code).join(',')}`)
        }
    }
    console.log(locked === 0 ? `  ✅ ${batchIds.length}개 배치 전부 통과 — 인질 없음` : `  🔴 ${locked}개 배치가 잠겼다`)

    // -- 3. 단중을 실제로 바꾸면 막혀야 한다 --
    console.log('\n=== 3. 단중 변경 시도 — 막혀야 정상 ===')
    let blocked = 0
    for (const r of openWeight) {
        const existing: ExistingPackagingRow[] = [{
            id: r.id, packageType: r.packageType, weightPerUnit: r.weightPerUnit,
            count: r.count, totalWeight: r.totalWeight, stockId: r.stockId,
            packagingId: r.productType?.packagingId ?? null, movedCount: movedCountOf(r),
        }]
        const res = diffPackaging(existing, [{
            id: r.id, packageType: r.packageType, weightPerUnit: r.weightPerUnit + 7,
            count: r.count, totalWeight: (r.weightPerUnit + 7) * r.count,
            stockId: r.stockId as number, packagingId: r.productType?.packagingId ?? null,
        }])
        if (!res.ok && res.errors.some(e => e.code === 'IDENTITY_BLOCKED')) blocked++
        else console.log(`  🔴 #${r.id} (${r.packageType}) 안 막힘`)
    }
    console.log(`  ${blocked}/${openWeight.length} 차단됨`)
}

main().finally(() => prisma.$disconnect())
