'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createVariety, updateVariety, VarietyFormData } from '@/app/actions/admin'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { getProductCode } from '@/lib/lot-generation'
import { AliasEditor } from './alias-editor'
import type { AliasVariety } from '@/lib/variety-alias'
import { confirmAndDeleteVariety } from './delete-variety'

interface Props {
    mode: 'create' | 'edit'
    variety?: {
        id: number
        name: string
        type: string
        aliases?: string[]
    }
    /** 전체 품종 목록 — 별칭 충돌 검사용. 수정 모드에서만 쓴다 */
    varieties?: AliasVariety[]
    /**
     * 외부 제어 — 행 ⋯ 메뉴가 여닫는 수정 모드에서 쓴다.
     * 넘어오면 자체 트리거를 렌더하지 않는다(메뉴 안에 트리거를 두면 Radix 포커스 복귀가 얽힌다).
     */
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function VarietyDialog({ mode, variety, varieties, open: controlledOpen, onOpenChange }: Props) {
    const router = useRouter()
    const isControlled = onOpenChange !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const open = isControlled ? !!controlledOpen : internalOpen
    const [name, setName] = useState(variety?.name || '')
    const [type, setType] = useState(variety?.type || 'URUCHI')
    const [aliases, setAliases] = useState<string[]>(variety?.aliases ?? [])
    const [loading, setLoading] = useState(false)

    const setOpen = (next: boolean) => {
        if (isControlled) onOpenChange!(next)
        else setInternalOpen(next)
    }

    // 🔴 열 때마다 현재 값으로 되돌린다. useState 초기값은 최초 마운트 때만 먹으므로,
    //    저장 후 목록이 갱신돼도 다이얼로그 상태는 낡은 채 남는다(별칭은 배열 통째 저장이라 특히 위험).
    const handleOpenChange = (next: boolean) => {
        if (next) {
            setName(variety?.name || '')
            setType(variety?.type || 'URUCHI')
            setAliases(variety?.aliases ?? [])
        }
        setOpen(next)
    }

    // Ensure unique IDs for form inputs
    const nameId = `name-${variety?.id || 'new'}`

    /**
     * 🔴 로트 품목코드는 **품종명 문자열**과 곡종으로 정해진다(`getProductCode`).
     * 「검정보리」→「블랙보리」처럼 이름을 바꾸면 215가 21로 조용히 바뀐다(41종 중 18종이 이름에 의존).
     * 막을 일은 아니다 — 정당한 개명일 수 있으니 — 바뀐다는 걸 보여 주고 확인만 받는다.
     */
    const confirmProductCodeChange = async (): Promise<boolean> => {
        if (mode !== 'edit' || !variety) return true

        const pairs = (['백미', '현미'] as const).map(mt => ({
            mt,
            before: getProductCode(variety.type, variety.name, mt),
            after: getProductCode(type, name.trim(), mt),
        })).filter(p => p.before !== p.after)

        if (pairs.length === 0) return true

        const lines = pairs.map(p => `${p.mt} ${p.before} → ${p.after}`).join(' · ')
        return confirmDialog({
            title: '로트 품목코드가 바뀝니다',
            description: `${lines}\n\n앞으로 만들어질 로트번호에 반영됩니다. 이미 만들어진 로트는 그대로입니다.`,
            confirmText: '저장',
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!(await confirmProductCodeChange())) return

        setLoading(true)

        const data: VarietyFormData = mode === 'edit' ? { name, type, aliases } : { name, type }
        let result

        if (mode === 'create') {
            result = await createVariety(data)
        } else if (variety) {
            result = await updateVariety(variety.id, data)
        }

        if (result?.success) {
            setOpen(false)
            if (mode === 'create') {
                setName('')
                setType('URUCHI')
            }
            triggerDataUpdate()
            router.refresh()
        } else {
            toast.error(result?.error || '작업에 실패했습니다.')
        }
        setLoading(false)
    }

    // 🔴 확인 문구(별칭 동반 소멸 경고)는 `delete-variety.ts` 한 곳에만 있다 —
    //    행 ⋯ 메뉴의 삭제도 같은 함수를 부른다.
    const handleDelete = async () => {
        if (!variety) return

        setLoading(true)
        if (await confirmAndDeleteVariety(variety)) {
            setOpen(false)
            router.refresh()
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {/* 수정 모드는 행 ⋯ 메뉴가 외부에서 연다 — 자체 트리거는 등록 버튼뿐 */}
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button size="sm" className="px-2.5 sm:px-4">
                        <Plus className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">품종 등록</span>
                    </Button>
                </DialogTrigger>
            )}
            {/* 🔴 flex flex-col — 기본 grid는 내용이 길어지면 푸터가 잘린다 */}
            <DialogContent className="flex flex-col max-h-[88vh]">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? '품종 등록' : '품종 수정'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create' ? '새로운 품종을 등록합니다.' : '등록된 품종 정보를 수정합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4 min-h-0 overflow-y-auto">
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>품종명</Label>
                        <Input
                            id={nameId}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="예: 천지향"
                            required
                        />
                    </div>
                    <div className="space-y-3">
                        <Label>곡종 구분</Label>
                        {/* 🔴 한 줄에 7개 — text-sm(크기 미지정이면 16px 상속) + 좁은 gap이라야 들어간다 */}
                        <div className="flex flex-wrap gap-x-3 gap-y-2.5">
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="URUCHI"
                                    checked={type === 'URUCHI'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>메벼</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="GLUTINOUS"
                                    checked={type === 'GLUTINOUS'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>찰벼</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="INDICA"
                                    checked={type === 'INDICA'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>인디카</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="BLACK"
                                    checked={type === 'BLACK'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>흑미</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="MISC_GRAIN"
                                    checked={type === 'MISC_GRAIN'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>잡곡</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="OTHER"
                                    checked={type === 'OTHER'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>기타</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                                <input
                                    type="radio"
                                    name="type"
                                    value="PURCHASED"
                                    checked={type === 'PURCHASED'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span>매입</span>
                            </label>
                        </div>
                    </div>
                    {mode === 'edit' && variety && varieties && (
                        <div className="pt-2 border-t border-slate-100">
                            <AliasEditor
                                aliases={aliases}
                                onChange={setAliases}
                                target={{ id: variety.id, name }}
                                varieties={varieties}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between w-full pt-4 border-t border-slate-100 mt-2">
                        {mode === 'edit' ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDelete}
                                disabled={loading}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                                <Trash2 className="w-4 h-4 mr-1.5" />
                                삭제
                            </Button>
                        ) : (
                            <div />
                        )}
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>취소</Button>
                            <Button type="submit" disabled={loading || !name.trim()}>
                                {loading ? '처리 중...' : '저장'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
