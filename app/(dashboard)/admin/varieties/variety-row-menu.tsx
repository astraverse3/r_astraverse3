'use client'

// 품종 목록 행의 ⋮ 메뉴 — 수정 / 삭제.
// 트리거·색상은 `sales/upload-row-menu.tsx` 패턴을 따른다(앱에 이미 있는 행 메뉴 정본).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { VarietyDialog } from './variety-dialog'
import { confirmAndDeleteVariety } from './delete-variety'
import type { AliasVariety } from '@/lib/variety-alias'

interface Variety {
    id: number
    name: string
    type: string
    aliases: string[]
}

export function VarietyRowMenu({ variety, varieties }: { variety: Variety; varieties: AliasVariety[] }) {
    const router = useRouter()
    const [editOpen, setEditOpen] = useState(false)

    const handleDelete = async () => {
        if (await confirmAndDeleteVariety(variety)) router.refresh()
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                        <span className="sr-only">품종 메뉴</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setEditOpen(true)}>
                        <Pencil className="w-3.5 h-3.5" />
                        수정
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleDelete}
                        className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        삭제
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* 🔴 열릴 때 새로 마운트된다 — useState 초기값이 늘 최신 품종 값으로 들어간다.
                (다이얼로그를 상시 마운트해 두면 저장 후 낡은 값이 남는다) */}
            {editOpen && (
                <VarietyDialog
                    mode="edit"
                    variety={variety}
                    varieties={varieties}
                    open
                    onOpenChange={setEditOpen}
                />
            )}
        </>
    )
}
