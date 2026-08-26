'use client'

// 묶음 목록의 「상차」 셀 — 표시 + 그 자리에서 채우기 (계획서 plan-배송상차정보.md §4-S4).
// 「배차 미정」은 눌러서 채우는 버튼이다. 등록 모달을 다시 열 필요가 없어야 한다.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Plus, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { updateUploadLoading } from '@/app/actions/purchase-order-upload'
import type { ShippingVendorOption } from '@/app/actions/purchase-order-upload'
import type { LoadingDisplay, LoadingInfo, LoadingTimeSlot } from '@/lib/loading-schedule'

const SLOT_LABEL: Record<LoadingTimeSlot, string> = {
    UNKNOWN: '시간 미정',
    AM: '오전',
    PM: '오후',
    EXACT: '직접 입력',
}

export function LoadingCell({
    uploadId,
    loading,
    display,
    shippingVendorId,
    vendors,
}: {
    uploadId: number
    loading: LoadingInfo
    display: LoadingDisplay
    shippingVendorId: number | null
    vendors: ShippingVendorOption[]
}) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className="text-left min-w-0" onClick={(e) => e.stopPropagation()}>
                    <LoadingLabel display={display} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[300px] p-3">
                <LoadingForm
                    uploadId={uploadId}
                    loading={loading}
                    shippingVendorId={shippingVendorId}
                    vendors={vendors}
                    onDone={() => setOpen(false)}
                />
            </PopoverContent>
        </Popover>
    )
}

function LoadingLabel({ display }: { display: LoadingDisplay }) {
    if (display.tone === 'unset') {
        return (
            <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-dashed border-amber-300 bg-amber-50 text-amber-700 text-[11.5px] font-bold">
                <Plus className="w-3 h-3" />
                배차 미정
            </span>
        )
    }
    if (display.tone === 'done') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                <Check className="w-3 h-3 shrink-0" />
                {display.label}
            </span>
        )
    }
    // 오늘 나가는 건은 눈에 먼저 들어와야 한다
    if (display.tone === 'today') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-600 text-white text-[11.5px] font-bold">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">
                    {display.label}
                    {display.vendorName && ` · ${display.vendorName}`}
                </span>
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
            <Truck className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">
                {display.label}
                {display.vendorName && ` · ${display.vendorName}`}
            </span>
        </span>
    )
}

function LoadingForm({
    uploadId,
    loading,
    shippingVendorId,
    vendors,
    onDone,
}: {
    uploadId: number
    loading: LoadingInfo
    shippingVendorId: number | null
    vendors: ShippingVendorOption[]
    onDone: () => void
}) {
    const router = useRouter()
    const [vendorId, setVendorId] = useState<number | ''>(shippingVendorId ?? '')
    const [date, setDate] = useState(loading.loadingDate ?? '')
    const [slot, setSlot] = useState<LoadingTimeSlot>(loading.loadingTimeSlot)
    const [time, setTime] = useState(loading.loadingTime ?? '')
    const [saving, setSaving] = useState(false)

    const needsTime = slot === 'EXACT' && time === ''

    const handleSave = async () => {
        setSaving(true)
        const res = await updateUploadLoading(uploadId, {
            shippingVendorId: vendorId === '' ? null : vendorId,
            loadingDate: date === '' ? null : date,
            loadingTimeSlot: slot,
            loadingTime: slot === 'EXACT' ? time : null,
        })
        setSaving(false)

        if (!res.success) {
            toast.error(res.error)
            return
        }
        onDone()
        router.refresh()
    }

    return (
        <div className="space-y-2.5">
            <div>
                <Label>배송업체</Label>
                <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                    <option value="">미지정</option>
                    {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                            {v.name}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <Label>상차일</Label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
            </div>

            <div>
                <Label>상차 시각</Label>
                <div className="flex items-center gap-1 flex-wrap">
                    {(Object.keys(SLOT_LABEL) as LoadingTimeSlot[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSlot(s)}
                            className={`h-7 px-2 rounded-md border text-[11px] font-semibold transition-colors ${
                                slot === s
                                    ? 'border-slate-800 bg-slate-800 text-white'
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            {SLOT_LABEL[s]}
                        </button>
                    ))}
                </div>
                {slot === 'EXACT' && (
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="mt-1.5 h-8 w-[104px] rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                )}
            </div>

            <div className="flex items-center gap-2 pt-1">
                <span className="text-[10.5px] text-slate-400">비워두면 배차 미정으로 남아요</span>
                <Button
                    type="button"
                    size="sm"
                    className="ml-auto h-7"
                    onClick={handleSave}
                    disabled={saving || needsTime}
                >
                    {saving ? '저장 중…' : '저장'}
                </Button>
            </div>
        </div>
    )
}

function Label({ children }: { children: React.ReactNode }) {
    return <span className="block text-[10.5px] font-bold text-slate-400 mb-1">{children}</span>
}
