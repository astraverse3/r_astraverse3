'use client'

import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { AddMiscStockDialog } from './add-misc-stock-dialog'

interface Farmer {
    id: number
    name: string
    farmerNo: string | null
    group: {
        id: number
        name: string
        certType: string
        certNo: string
        cropYear: number
    } | null
}

interface Variety {
    id: number
    name: string
}

interface Props {
    farmers: Farmer[]
    varieties: Variety[]
    vendors: string[]
}

/**
 * 잡곡 탭 패널 (#5c 단계 — 헤더 액션 + 다이얼로그만, 본문은 placeholder)
 * #5d에서 본문을 목록 컴포넌트로 교체할 때 이 파일을 확장한다.
 */
export function MiscStockPanel({ farmers, varieties, vendors }: Props) {
    const { data: session } = useSession()
    // @ts-ignore
    const canStock = hasPermission(session?.user, 'STOCK_MANAGE')

    return (
        <div className="grid grid-cols-1 gap-2">
            {/* Header */}
            <section className="flex flex-col gap-2 px-1">
                <div className="flex items-center justify-end gap-2">
                    {canStock && (
                        <AddMiscStockDialog farmers={farmers} varieties={varieties} vendors={vendors} />
                    )}
                </div>
            </section>

            {/* Body — placeholder (목록·필터는 #5d) */}
            <div className="rounded-md border bg-white p-12 text-center">
                <p className="text-slate-500 text-sm">잡곡 원물재고 목록·필터는 다음 단계에서 추가됩니다.</p>
                <p className="text-slate-400 text-xs mt-2">우측 상단 [+ 잡곡 입고] 버튼으로 등록은 가능합니다.</p>
            </div>
        </div>
    )
}
