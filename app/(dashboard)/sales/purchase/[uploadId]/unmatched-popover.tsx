'use client'

// 매칭실패 셀 안내 팝오버 (계획서 `docs/plan/plan-발주서-수동지정-제거.md` 결정 Z)
//
// `cell-allocation-popover.tsx`의 `Body`가 매칭실패 셀일 때 이걸 띄운다.
// 여는 순간 `getUnmatchedCellOptions`로 「무엇이 왜 실패했나 + 몇 라인이 걸려 있나」를 받아 온다.
//
// 🔴 **여기서 아무것도 고치지 않는다**(2026-09-16). 품종을 고르고 SKU를 지정하던 기능은
//    철회됐다 — 입구가 둘이면 별칭이 중구난방이 되고, 실측상 매칭실패의 절반은 이름이 아니라
//    SKU 카탈로그 빈칸이라 지정으로 풀리지도 않았다. 푸는 길은 마스터 화면 → 「재매칭」 하나다.
//
// 🔴 사유마다 **갈 곳이 다르다**. 「매칭 실패」 한 줄로 뭉개면 품종 관리와 제품유형 관리 중
//    어디로 가야 할지 알 수 없다.
//
// 🔴 링크로 새 탭을 열지 않는다(D2e 2026-09-15 판단 유지) — 등록하고 와도 「재매칭」을 눌러야 해서
//    링크가 흐름을 완결시키지 못하고 이 화면을 떠났다 오게 만들 뿐이다. **메뉴 이름만 일러 준다.**

import { useEffect, useState } from 'react'
import { AlertCircle, Info } from 'lucide-react'
import {
    getUnmatchedCellOptions,
    type UnmatchedCellOptions,
} from '@/app/actions/purchase-order-assign'
import type { ActiveCell } from './cell-allocation-popover'

const fmt = (n: number) => n.toLocaleString()

/** 매처가 어디서 멈췄는지 — 사람 말로 한 줄. */
function failLabel(d: UnmatchedCellOptions): string {
    if (d.fail.reason === 'variety_unresolved') {
        return d.fail.varietyToken
            ? `「${d.fail.varietyToken}」이 어느 품종인지 몰라요.`
            : '품목명에서 품종을 읽지 못했어요.'
    }
    const what = [d.fail.varietyName, d.fail.millingType].filter(Boolean).join(' ')
    if (d.fail.reason === 'packaging_unresolved') {
        return `${what} ${d.packageType}에 맞는 포장지 「${d.rawPackaging ?? ''}」 제품유형이 없어요.`
    }
    return `${what} ${d.packageType} 제품유형이 등록돼 있지 않아요.`
}

/** 어느 마스터를 손봐야 풀리는가 — 사유가 갈리는 유일한 지점이다. */
function guide(d: UnmatchedCellOptions) {
    if (d.fail.reason === 'variety_unresolved') {
        return {
            menu: '품종 관리',
            what: (
                <>
                    이 이름을 해당 품종의 <b className="font-semibold text-slate-700">별칭</b>으로
                    등록해 주세요. 품종 자체가 없으면 품종부터 등록하고요.
                </>
            ),
        }
    }
    return {
        menu: '관리자 메뉴 › 제품유형 관리',
        what: (
            <>
                이 규격의 <b className="font-semibold text-slate-700">제품유형(SKU)</b>을 등록해
                주세요.
            </>
        ),
    }
}

export function UnmatchedBody({ cell }: { cell: ActiveCell }) {
    const [data, setData] = useState<UnmatchedCellOptions | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        getUnmatchedCellOptions(cell.itemIds).then((r) => {
            if (!alive) return
            if (r.success) setData(r.data)
            else setError(r.error)
        })
        return () => {
            alive = false
        }
    }, [cell.itemIds])

    if (error) return <p className="px-3.5 py-3 text-red-600">{error}</p>
    if (!data) return <p className="px-3.5 py-3 text-slate-400">불러오는 중…</p>

    const g = guide(data)

    return (
        <div className="flex flex-col">
            <div className="flex items-start gap-1.5 border-b border-slate-100 bg-red-50/60 px-3.5 py-2 text-[11px]">
                <AlertCircle className="mt-px h-3 w-3 shrink-0 text-red-500" />
                <span className="leading-snug text-red-700">{failLabel(data)}</span>
            </div>

            {/* 셀 하나가 아니라 열 전체가 막혀 있다 — 마스터를 고칠 값어치를 보여 준다 */}
            <p className="border-b border-slate-100 px-3.5 py-1.5 text-[11px] text-slate-500">
                이 품목 열{' '}
                <b className="text-foreground">
                    {fmt(data.scope.recipientCount)}수령인 · {fmt(data.scope.lineCount)}품목
                </b>{' '}
                ({fmt(data.scope.orderedQty)}개)이 같이 막혀 있어요
            </p>

            <div className="flex flex-col gap-2 px-3.5 py-3 text-[11px] leading-relaxed text-slate-600">
                <p>
                    <b className="font-bold text-slate-800">{g.menu}</b>에서 {g.what}
                </p>

                {/* 품종 관리에 가도 거절당할 이름이면 미리 말해 준다 — 헛걸음을 막는다 */}
                {data.fail.reason === 'variety_unresolved' && data.blockedByMilling && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-500">
                        <Info className="mt-px h-3 w-3 shrink-0 text-slate-400" />
                        <span>
                            「{data.fail.varietyToken}」처럼 도정이 섞인 이름은 별칭으로 등록할 수
                            없어요. 품목명을 바꾸거나 제품유형 쪽을 확인해 주세요.
                        </span>
                    </p>
                )}

                <p className="border-t border-slate-100 pt-2 text-slate-500">
                    등록한 뒤 위의 <b className="font-bold text-primary">재매칭</b>을 눌러 주세요.
                </p>
            </div>
        </div>
    )
}
