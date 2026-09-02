// 포장 다이얼로그의 「규격별 합계」 밴드 — 계산과 표시를 한 자리에 둔다.
//
// 여러 생산자를 함께 투입한 배치는 화면이 로트별로 쪼개져 있어 규격별 총량이 안 보인다.
// 그걸 헤더에 한 줄로 얹는 것이 이 밴드다.

import { PACKAGE_TEMPLATES, PKG_REMAINDER } from './packaging-constants'

type SummaryLine = { packageType: string; count: number; weight: number }

/** 합계 계산에 필요한 필드만. 실제 인자는 `MillingOutputInput`이라 더 넓다. */
type CountableOutput = { packageType: string; count: number; totalWeight: number }

/**
 * 규격별 합계 — 전체 생산자 합산. 규격 템플릿 순서로 세운다(템플릿에 없는 규격은 뒤로).
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
    const order = PACKAGE_TEMPLATES.map(t => t.label)
    return [...map.entries()]
        .map(([packageType, v]) => ({ packageType, ...v }))
        .sort((a, b) => {
            const ia = order.indexOf(a.packageType), ib = order.indexOf(b.packageType)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
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
        <div className="mt-2 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 shadow-sm px-3 py-2.5">
            <div className="text-[10.5px] font-semibold text-slate-400 tracking-wide mb-1.5">규격별 합계</div>
            <div className="flex flex-wrap gap-1.5">
                {summary.map(s => (
                    <div key={s.packageType} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${s.packageType === PKG_REMAINDER ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-100 text-stone-600'}`}>
                            {s.packageType}
                        </span>
                        <span className="text-[12px] font-bold text-slate-600 font-mono tabular-nums">
                            {s.count.toLocaleString()}<span className="text-[9px] text-slate-400 ml-px">개</span>
                        </span>
                        <span className="text-slate-200">|</span>
                        <span className="text-[12px] font-black text-slate-800 font-mono tabular-nums">
                            {s.weight.toLocaleString()}<span className="text-[9px] text-slate-400 ml-px">kg</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
