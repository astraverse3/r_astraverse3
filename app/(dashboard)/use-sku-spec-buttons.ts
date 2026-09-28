'use client'

// 「만들 규격」 버튼 = 고정 목록 + 그 품종·도정의 SKU 규격 (백로그 §48 · `docs/plan/plan-규격버튼-SKU연동.md`)
//
// 도정 포장(`milling/add-packaging-dialog.tsx`)과 재포장(`packages/repack-dialog.tsx`)이 **같이 쓴다** —
// 한쪽만 SKU 규격을 보여 주면 907g을 한 경로로만 만들 수 있고, 다른 쪽은 「기타」 우회로
// `0.907kg` 같은 엉뚱한 SKU를 만들게 된다(저장 때 `findOrCreateProductType`이 조합을 새로 만든다).

import { useCallback, useEffect, useState } from 'react'
import { listSkuSpecs } from '@/app/actions/product-type'
import { mergeSpecButtons } from '@/lib/package-spec'

type SpecButton = { label: string; weight: number | null }

/**
 * @returns `specsOf(varietyId)` — 그 품종의 버튼 목록. SKU 규격이 아직 안 왔으면 고정 목록 그대로다
 *          (늦게 와도 버튼이 늘 뿐이라 다이얼로그 로딩을 막지 않는다).
 */
export function useSkuSpecButtons<T extends SpecButton>(
    open: boolean,
    varietyIds: readonly number[],
    millingType: string | undefined,
    base: readonly T[],
) {
    // 의존성은 배열이 아니라 **내용 키** — 부르는 쪽이 매 렌더 새 배열을 만든다
    const ids = [...new Set(varietyIds)].filter(n => n > 0).sort((a, b) => a - b)
    const key = `${ids.join(',')}|${millingType ?? ''}`

    // 🔴 받은 값에 「어느 품종·도정 것인지」를 붙여 둔다 — 다른 재고로 다시 열면 옛 버튼이 잠깐 뜬다
    const [got, setGot] = useState<{ key: string; byVariety: Record<number, string[]> } | null>(null)

    useEffect(() => {
        const [idPart, mt] = key.split('|')
        if (!open || !idPart || !mt) return
        let alive = true
        void listSkuSpecs(idPart.split(',').map(Number), mt).then(res => {
            if (alive) setGot({ key, byVariety: res.success ? res.data : {} })
        })
        return () => {
            alive = false
        }
    }, [open, key])

    return useCallback(
        (varietyId: number) =>
            mergeSpecButtons(base, got?.key === key ? (got.byVariety[varietyId] ?? []) : []),
        [base, got, key],
    )
}
