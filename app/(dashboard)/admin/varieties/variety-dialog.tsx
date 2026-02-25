'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createVariety, updateVariety, deleteVariety, VarietyFormData } from '@/app/actions/admin'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

interface Props {
    mode: 'create' | 'edit'
    variety?: {
        id: number
        name: string
        type: string
    }
}

export function VarietyDialog({ mode, variety }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [name, setName] = useState(variety?.name || '')
    const [type, setType] = useState(variety?.type || 'URUCHI')
    const [loading, setLoading] = useState(false)

    // Ensure unique IDs for form inputs
    const nameId = `name-${variety?.id || 'new'}`

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const data: VarietyFormData = { name, type }
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

    const handleDelete = async () => {
        if (!variety || !confirm('정말 삭제하시겠습니까?')) return

        setLoading(true)
        const result = await deleteVariety(variety.id)
        if (result.success) {
            triggerDataUpdate()
            setOpen(false)
            router.refresh()
        } else {
            toast.error(result.error || '삭제에 실패했습니다.')
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {mode === 'create' ? (
                    <Button size="sm" className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                        <Plus className="w-4 h-4 mr-1.5" />
                        품종 등록
                    </Button>
                ) : (
                    <button
                        className="p-2 text-slate-400 hover:text-[#00a2e8] rounded-full hover:bg-[#00a2e8]/10 transition-colors"
                        title="수정"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? '품종 등록' : '품종 수정'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create' ? '새로운 벼 품종을 등록합니다.' : '등록된 품종 정보를 수정합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
                        <div className="flex gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="URUCHI"
                                    checked={type === 'URUCHI'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-[#00a2e8] w-4 h-4"
                                />
                                <span>메벼</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="GLUTINOUS"
                                    checked={type === 'GLUTINOUS'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-[#00a2e8] w-4 h-4"
                                />
                                <span>찰벼</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="INDICA"
                                    checked={type === 'INDICA'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-[#00a2e8] w-4 h-4"
                                />
                                <span>인디카</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="type"
                                    value="OTHER"
                                    checked={type === 'OTHER'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="accent-[#00a2e8] w-4 h-4"
                                />
                                <span>기타</span>
                            </label>
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between gap-2">
                        {mode === 'edit' && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDelete}
                                disabled={loading}
                                className="mr-auto text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                                <Trash2 className="w-4 h-4 mr-1.5" />
                                삭제
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
                            <Button type="submit" disabled={loading || !name.trim()} className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                                {loading ? '처리 중...' : '저장'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
