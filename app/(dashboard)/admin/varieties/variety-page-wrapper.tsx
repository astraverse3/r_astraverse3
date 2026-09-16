'use client'

import { ReactNode, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { VarietyListClient } from './variety-list-client'
import { VarietyPageClient } from './variety-page-client'

interface Variety {
    id: number
    name: string
    type: string
    aliases: string[]
}

interface VarietyPageWrapperProps {
    varieties: Variety[]
    addDialogSlot: ReactNode
}

export function VarietyPageWrapper({
    varieties,
    addDialogSlot
}: VarietyPageWrapperProps) {
    // 검색은 상단 줄(등록 버튼 옆)에, 필터 결과는 목록에 — 두 컴포넌트가 나눠 쓰므로 상태는 여기 둔다
    const [q, setQ] = useState('')

    return (
        <VarietyPageClient
            addDialogSlot={addDialogSlot}
            searchSlot={
                <div className="relative flex-1 sm:max-w-[230px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <Input
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="품종명 · 별칭 검색"
                        className="h-[34px] pl-8"
                    />
                </div>
            }
        >
            <VarietyListClient varieties={varieties} q={q} onResetSearch={() => setQ('')} />
        </VarietyPageClient>
    )
}
