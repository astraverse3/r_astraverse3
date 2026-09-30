// 포장 다이얼로그의 「규격별 합계」 밴드 — 계산과 표시를 한 자리에 둔다.
//
// 여러 생산자를 함께 투입한 배치는 화면이 로트별로 쪼개져 있어 규격별 총량이 안 보인다.
// 그걸 헤더에 한 줄로 얹는 것이 이 밴드다.

import { compareSpec } from '@/lib/package-spec'
import { PKG_REMAINDER } from './packaging-constants'

type SummaryLine = { packageType: string; count: number; weight: number }

/** 합계 계산에 필요한 필드만. 실제 인자는 `MillingOutputInput`이라 더 넓다. */
type CountableOutput = { packageType: string; count: number; totalWeight: number }

/**
 * 규격별 합계 — 전체 생산자 합산. 톤백 → 무게 내림차순 → 잔량으로 세운다(`compareSpec`, §88 — 고정 버튼에 없는 907g 같은 SKU 규격도 무게 자리에 들어간다).
 *
 * 수량·중량이 **둘 다** 비어 있는 줄은 아직 입력 중인 빈 줄이라 세지 않는다.
 */
export function computeSpecSummary(outputs: CountableOutput[]): SummaryLine[] {
    const map = new Map<string, { count: number; weight: number }>()
    for (const o of outputs) {
        if (!o.count && !o.totalWeight) continue
        const cur = map.get(o.packageType) ?? { count: 0, weight: 0 }
        cur.count += o.count || 0
        cur.weight += o.totalWeight || 0
        map.set(o.packageType, cur)
    }
    return [...map.entries()]
        .map(([packageType, v]) => ({ packageType, ...v }))
        .sort((a, b) => compareSpec(a.packageType, b.packageType))
}

/**
 * 노출 조건까지 이 안에서 판단한다 — 부르는 쪽마다 조건을 다시 쓰면 어긋난다.
 * 단일 생산자 · 단일 규격이면 아래 목록과 같은 내용이라 생략한다.
 */
export function SpecSummaryBand({
    outputs,
    isMultiGroup,
}: {
    outputs: CountableOutput[]
    isMultiGroup: boolean
}) {
    const summary = computeSpecSummary(outputs)
    if (summary.length === 0) return null
    if (!isMultiGroup && summary.length < 2) return null

    return (
        // 표시는 §87 T3(디자이너 B안) — 11px 미만 없음 · stone 대신 slate · 그라데이션·그림자 없음
        <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">규격별 합계</div>
            <div className="flex flex-wrap gap-1.5">
                {summary.map(s => (
                    <div key={s.packageType} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-semibold ${s.packageType === PKG_REMAINDER ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'}`}>
                            {s.packageType}
                        </span>
                        <span className="text-[13px] text-slate-700 font-mono tabular-nums">
                            {s.count.toLocaleString()}<span className="text-[11px] text-slate-500 font-sans ml-px">개</span>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-[13px] font-bold text-slate-900 font-mono tabular-nums">
                            {s.weight.toLocaleString()}<span className="text-[11px] text-slate-500 font-sans ml-px">kg</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
