/**
 * 포장 수정 diff 검증 (읽기 전용) — docs/plan/plan-포장수정-diff.md §6
 *
 * 실DB의 실제 행으로 diffPackaging의 판정을 확인한다. 쓰기는 하지 않는다.
 *   0. 유효성 규칙을 위반하는 기존 행이 있는지 전수 조사
 *   1. 예전 방식(전부 삭제 후 재생성)이 FK로 막히던 배치를 다시 센다
 *   2. 「아무것도 안 고치고 저장」 → create·update·delete가 전부 비어야 한다 (#65)
 *   3. 「전부 삭제」 → 차감된 줄이 이유와 함께 막혀야 한다 (#63)
 *   4. 「차감된 줄을 차감량 밑으로 축소」 → 막혀야 한다 (#63)
 *   5. 차감 없는 줄만 수정 → update 1줄만 발생해야 한다
 */
import { PrismaClient } from '@prisma/client'
import {
    diffPackaging,
    formatPackagingDiffErrors,
    type ExistingPackagingRow,
    type PackagingLine,
} from '../lib/packaging-diff'
import { MILLED_OUTPUT_ONLY } from '../lib/batch-outputs'

const prisma = new PrismaClient()

const toExisting = (r: {
    id: number
    packageType: string
    weightPerUnit: number
    count: number
    totalWeight: number
    stockId: number | null
    productType: { packagingId: number | null } | null
    movements: { count: number }[]
}): ExistingPackagingRow => ({
    id: r.id,
    packageType: r.packageType,
    weightPerUnit: r.weightPerUnit,
    count: r.count,
    totalWeight: r.totalWeight,
    stockId: r.stockId,
    packagingId: r.productType?.packagingId ?? null,
    movedCount: r.movements.reduce((s, m) => s + m.count, 0),
})

/** 화면이 기존 행을 그대로 되돌려보내는 입력 */
const echo = (r: ExistingPackagingRow): PackagingLine => ({
    id: r.id,
    packageType: r.packageType,
    weightPerUnit: r.weightPerUnit,
    count: r.count,
    totalWeight: r.totalWeight,
    stockId: r.stockId as number,
    packagingId: r.packagingId,
})

async function main() {
    const batches = await prisma.millingBatch.findMany({
        select: {
            id: true,
            outputs: {
                where: MILLED_OUTPUT_ONLY,
                select: {
                    id: true,
                    packageType: true,
                    weightPerUnit: true,
                    count: true,
                    totalWeight: true,
                    stockId: true,
                    productType: { select: { packagingId: true } },
                    movements: { select: { count: true, type: true } },
                },
            },
        },
        orderBy: { id: 'asc' },
    })

    // --- 0. 유효성 위반 행 (있어도 안 건드리면 통과해야 한다) ---
    const allRows = batches.flatMap(b => b.outputs.map(o => ({ batchId: b.id, ...toExisting(o) })))
    const invalid = allRows.filter(
        r => !r.packageType?.trim() || !(r.weightPerUnit > 0) || !Number.isInteger(r.count) || r.count <= 0
    )
    console.log(`도정 포장 행 ${allRows.length}개 중 유효성 위반: ${invalid.length}개`)
    for (const r of invalid) {
        console.log(
            `  #${r.id} 배치${r.batchId} ${r.packageType || '(빈값)'} ${r.weightPerUnit}kg × ${r.count}` +
            (r.movedCount > 0 ? `  ※차감 ${r.movedCount}` : '')
        )
    }

    // --- 1. 예전 방식이 막히던 배치 ---
    const blocked: { batchId: number; rows: ExistingPackagingRow[] }[] = []
    for (const b of batches) {
        const rows = b.outputs.map(toExisting)
        if (rows.some(r => r.movedCount > 0)) blocked.push({ batchId: b.id, rows })
    }
    console.log(`전체 배치 ${batches.length}개`)
    console.log(`차감된 포장이 있는 배치: ${blocked.length}개  (예전 방식이면 저장이 통째로 실패하던 대상)`)

    const byType = new Map<string, number>()
    for (const b of batches) {
        for (const o of b.outputs) {
            for (const m of o.movements) byType.set(m.type, (byType.get(m.type) ?? 0) + 1)
        }
    }
    console.log(`  차감 유형: ${[...byType].map(([t, n]) => `${t}=${n}건`).join(' · ') || '없음'}`)

    // --- 2. 「아무것도 안 고치고 저장」 — 전 배치 ---
    let noopFail = 0
    for (const b of batches) {
        const rows = b.outputs.map(toExisting)
        if (rows.length === 0) continue
        const r = diffPackaging(rows, rows.map(echo))
        if (!r.ok) {
            noopFail++
            console.log(`  ✗ 배치 #${b.id}: 그대로 저장이 막힘\n${formatPackagingDiffErrors(r.errors)}`)
            continue
        }
        if (r.toCreate.length || r.toUpdate.length || r.toDelete.length) {
            noopFail++
            console.log(
                `  ✗ 배치 #${b.id}: 안 고쳤는데 쓰기가 발생 ` +
                `(create ${r.toCreate.length} / update ${r.toUpdate.length} / delete ${r.toDelete.length})`
            )
        }
    }
    console.log(
        noopFail === 0
            ? `\n[2] 안 고치고 저장 → 전 배치(${batches.length}개)에서 쓰기 0건 ✔ (id·createdAt 보존)`
            : `\n[2] 안 고치고 저장 → ${noopFail}개 배치에서 불필요한 쓰기 ✗`
    )

    if (blocked.length === 0) {
        console.log('\n차감된 포장이 있는 배치가 없어 [3][4]는 건너뜁니다.')
        return
    }

    // --- 3. 「전부 삭제」 ---
    const sample = blocked[0]
    console.log(`\n[3] 배치 #${sample.batchId} 전부 삭제 시도 (포장 ${sample.rows.length}줄)`)
    const del = diffPackaging(sample.rows, [])
    if (del.ok) {
        console.log('  ✗ 막히지 않았다 — 차감된 줄이 지워질 뻔했다')
    } else {
        console.log(formatPackagingDiffErrors(del.errors).split('\n').map(l => '  ' + l).join('\n'))
    }

    // --- 4. 차감된 줄을 차감량 밑으로 축소 ---
    const moved = sample.rows.find(r => r.movedCount > 0)!
    console.log(
        `\n[4] 배치 #${sample.batchId}의 ${moved.packageType} ${moved.count}개(${moved.movedCount}개 차감됨)를 ` +
        `${Math.max(0, moved.movedCount - 1)}개로 축소 시도`
    )
    const shrink = diffPackaging(
        sample.rows,
        sample.rows.map(r =>
            r.id === moved.id
                ? { ...echo(r), count: Math.max(0, moved.movedCount - 1) }
                : echo(r)
        )
    )
    if (shrink.ok) {
        console.log('  ✗ 막히지 않았다 — 가용 재고가 음수가 될 뻔했다')
    } else {
        console.log(formatPackagingDiffErrors(shrink.errors).split('\n').map(l => '  ' + l).join('\n'))
    }

    // --- 5. 차감 없는 줄만 고치기 ---
    const free = sample.rows.find(r => r.movedCount === 0)
    if (free) {
        console.log(`\n[5] 같은 배치에서 차감 없는 줄(${free.packageType} ${free.count}개)만 수량 +1`)
        const edit = diffPackaging(
            sample.rows,
            sample.rows.map(r =>
                r.id === free.id
                    ? { ...echo(r), count: r.count + 1, totalWeight: (r.count + 1) * r.weightPerUnit }
                    : echo(r)
            )
        )
        console.log(
            edit.ok
                ? `  ✔ 통과 — update ${edit.toUpdate.length}줄만 발생 (delete ${edit.toDelete.length}, create ${edit.toCreate.length})`
                : `  ✗ 막힘\n${formatPackagingDiffErrors(edit.errors)}`
        )
    } else {
        console.log('\n[5] 이 배치엔 차감 없는 줄이 없어 건너뜁니다.')
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
