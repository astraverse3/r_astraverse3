'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { MILLING_TYPES } from '@/lib/settings-constants'
import { upsertProductType } from '@/app/actions/product-type'

export type VarietyOption = { id: number; name: string }
export type PackagingOption = { id: number; name: string; active: boolean }

export type ProductTypeEdit = {
    id: number
    varietyId: number
    millingType: string
    packageType: string
    packagingId: number
    isDefault: boolean
}

interface Props {
    mode: 'create' | 'edit'
    varieties: VarietyOption[]
    packagings: PackagingOption[]
    productType?: ProductTypeEdit
}

export function ProductTypeDialog({ mode, varieties, packagings, productType }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [varietyId, setVarietyId] = useState<number | ''>(productType?.varietyId ?? '')
    const [millingType, setMillingType] = useState(productType?.millingType ?? '백미')
    const [packageType, setPackageType] = useState(productType?.packageType ?? '')
    const [packagingId, setPackagingId] = useState<number | ''>(productType?.packagingId ?? '')
    const [isDefault, setIsDefault] = useState(productType?.isDefault ?? false)

    // 수정 시 비활성 포장지가 현재 SKU에 묶여 있으면 옵션에 포함되도록 유지
    const packagingOptions = packagings.filter(
        (p) => p.active || p.id === productType?.packagingId,
    )

    const reset = () => {
        setVarietyId('')
        setMillingType('백미')
        setPackageType('')
        setPackagingId('')
        setIsDefault(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (varietyId === '' || packagingId === '' || !packageType.trim()) {
            toast.error('품종·규격·포장지를 모두 입력해주세요.')
            return
        }
        setLoading(true)

        const result = await upsertProductType({
            id: productType?.id,
            varietyId: Number(varietyId),
            millingType,
            packageType: packageType.trim(),
            packagingId: Number(packagingId),
            isDefault,
        })

        if (result.success) {
            setOpen(false)
            if (mode === 'create') reset()
            router.refresh()
        } else {
            toast.error(result.error || '저장에 실패했어요.')
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {mode === 'create' ? (
                    <Button size="sm" className="bg-[#8dc540] hover:bg-[#7db037] text-white px-2.5 sm:px-4">
                        <Plus className="w-4 h-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">제품유형 등록</span>
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
                    <DialogTitle>{mode === 'create' ? '제품유형 등록' : '제품유형 수정'}</DialogTitle>
                    <DialogDescription>
                        품종·도정·규격·포장지 조합으로 SKU를 정의합니다.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pt-variety">품종</Label>
                        <select
                            id="pt-variety"
                            value={varietyId}
                            onChange={(e) => setVarietyId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a2e8]/40"
                            required
                        >
                            <option value="">선택하세요</option>
                            {varieties.map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="pt-milling">도정 구분</Label>
                            <select
                                id="pt-milling"
                                value={millingType}
                                onChange={(e) => setMillingType(e.target.value)}
                                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a2e8]/40"
                            >
                                {MILLING_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pt-package">규격</Label>
                            <Input
                                id="pt-package"
                                value={packageType}
                                onChange={(e) => setPackageType(e.target.value)}
                                placeholder="예: 10kg"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pt-packaging">포장지</Label>
                        <select
                            id="pt-packaging"
                            value={packagingId}
                            onChange={(e) => setPackagingId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a2e8]/40"
                            required
                        >
                            <option value="">선택하세요</option>
                            {packagingOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}{!p.active ? ' (비활성)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                            type="checkbox"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                            className="accent-[#00a2e8] w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">이 조합(품종+도정+규격)의 기본 포장지로 지정</span>
                    </label>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>취소</Button>
                        <Button type="submit" disabled={loading} className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                            {loading ? '처리 중...' : '저장'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
