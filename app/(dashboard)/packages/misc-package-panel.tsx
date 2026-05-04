'use client'

import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PackageItem } from '@/app/actions/packages'

interface Props {
    items: PackageItem[]
}

/**
 * 잡곡 제품재고 패널 — #6a 시점에는 빈 셸.
 * 헤더 액션의 [+ 포장하기] / [+ 매입 등록]은 비활성("준비중") — 활성화는 #7·#8.
 * #6b에서 그룹 펼침 테이블·모바일 카드, #6c에서 검색 추가.
 */
export function MiscPackagePanel({ items }: Props) {
    const totalCount = items.reduce(
        (sum, it) => sum + (it.type === 'group' ? it.rows.length : 1),
        0,
    )

    return (
        <div className="grid grid-cols-1 gap-2 px-1">
            <section className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="h-8 px-3"
                        title="준비중 (#7에서 활성화)"
                    >
                        + 포장하기
                    </Button>
                    <Button
                        size="sm"
                        disabled
                        className="h-8 px-3"
                        title="준비중 (#8에서 활성화)"
                    >
                        + 매입 등록
                    </Button>
                </div>
            </section>

            <section className="flex items-center justify-between text-xs text-slate-500 px-2 pt-1">
                <span className="tabular-nums">검색결과 {totalCount.toLocaleString()}건</span>
                <span className="text-slate-400">— 본격 목록 UI는 #6b에서 추가 예정</span>
            </section>

            {items.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Inbox className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600">아직 등록된 잡곡 제품재고가 없어요.</p>
                    <p className="text-xs text-slate-400">잡곡 포장(#7) · 매입 등록(#8) 다이얼로그가 머지되면 채워집니다.</p>
                </div>
            ) : (
                <pre className="text-[11px] text-slate-500 bg-slate-50 rounded-md p-3 overflow-x-auto max-h-[320px]">
                    {JSON.stringify(items.slice(0, 20), null, 2)}
                </pre>
            )}
        </div>
    )
}
