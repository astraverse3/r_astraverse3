'use client'

import { Inbox } from 'lucide-react'
import type { PackageItem } from '@/app/actions/packages'

interface Props {
    items: PackageItem[]
}

/**
 * 벼 제품재고 패널 — #6a 시점에는 빈 셸.
 * #6b에서 품종 그룹 펼침 테이블·모바일 카드, #6c에서 검색·필터 추가 예정.
 */
export function RicePackagePanel({ items }: Props) {
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex items-center justify-between text-xs text-slate-500 px-2 pt-1">
                <span className="tabular-nums">검색결과 {totalCount.toLocaleString()}건</span>
                <span className="text-slate-400">— 본격 목록 UI는 #6b에서 추가 예정</span>
            </section>

            {/* #6b 자리 — 데이터 동작 확인용 임시 텍스트 덤프 */}
            {items.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Inbox className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600">아직 등록된 제품재고가 없어요.</p>
                </div>
            ) : (
                <pre className="text-[11px] text-slate-500 bg-slate-50 rounded-md p-3 overflow-x-auto max-h-[320px]">
                    {JSON.stringify(items.slice(0, 20), null, 2)}
                </pre>
            )}
        </div>
    )
}
