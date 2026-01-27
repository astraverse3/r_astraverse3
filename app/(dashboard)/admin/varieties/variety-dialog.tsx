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

interface Props {
    mode: 'create' | 'edit'
    variety?: {
        id: number
        name: string
    }
    trigger?: React.ReactNode
}

export function VarietyDialog({ mode, variety, trigger }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [name, setName] = useState(variety?.name || '')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const data: VarietyFormData = { name }
        let result

        if (mode === 'create') {
            result = await createVariety(data)
        } else if (variety) {
            result = await updateVariety(variety.id, data)
        }

        if (result?.success) {
            setOpen(false)
            if (mode === 'create') setName('') // Reset only on create
            router.refresh()
        } else {
            alert(result?.error || '작업에 실패했습니다.')
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        if (!variety || !confirm('정말 삭제하시겠습니까?')) return

        setLoading(true)
        const result = await deleteVariety(variety.id)
        if (result.success) {
            setOpen(false)
            router.refresh()
        } else {
            alert(result.error || '삭제에 실패했습니다.')
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-1.5" />
                        품종 등록
                    </Button>
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
                        <Label htmlFor="name">품종명</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="예: 신동진"
                            required
                        />
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between gap-2">
                        {mode === 'edit' && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={loading}
                                className="mr-auto"
                            >
                                <Trash2 className="w-4 h-4 mr-1.5" />
                                삭제
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
                            <Button type="submit" disabled={loading || !name.trim()}>
                                {loading ? '처리 중...' : '저장'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
