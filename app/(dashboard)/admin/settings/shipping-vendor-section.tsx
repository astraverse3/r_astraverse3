'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    createShippingVendor,
    moveShippingVendor,
    renameShippingVendor,
    toggleShippingVendorActive,
    type ShippingVendorRow,
} from '@/app/actions/shipping-vendor'

interface Props {
    vendors: ShippingVendorRow[]
}

export function ShippingVendorSection({ vendors }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [newName, setNewName] = useState('')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')

    // 순서 이동은 화면을 먼저 바꾸고 저장은 뒤에서 한다 → 목록을 로컬 상태로 들고 있는다
    const [rows, setRows] = useState(vendors)
    const [syncedFrom, setSyncedFrom] = useState(vendors)
    // 서버에서 새 목록이 내려오면(추가·이름수정·토글 후 refresh) 로컬을 갈아끼운다.
    // useEffect 대신 렌더 중 동기화 — 옛 목록이 한 프레임 비치지 않는다
    if (vendors !== syncedFrom) {
        setSyncedFrom(vendors)
        setRows(vendors)
    }

    // 연타해도 서버에는 누른 순서대로 하나씩 간다. 병렬로 나가면 sortOrder 맞바꾸기가 서로를 덮는다
    const saveQueue = useRef<Promise<unknown>>(Promise.resolve())

    const activeVendors = rows.filter((v) => v.active)
    const inactiveVendors = rows.filter((v) => !v.active)

    // 액션 결과가 실패면 토스트만 띄우고 화면은 그대로 둔다
    function run(action: () => Promise<{ success: boolean; error?: string }>, onDone?: () => void) {
        startTransition(async () => {
            const result = await action()
            if (!result.success) {
                toast.error(result.error || '처리에 실패했어요.')
                return
            }
            onDone?.()
            router.refresh()
        })
    }

    /**
     * 낙관적 순서 이동 — 로컬 배열에서 두 항목을 맞바꿔 즉시 반영하고, 저장은 큐에 실어 보낸다.
     * 실패하면 서버 상태를 다시 읽어 되돌린다 (여러 칸 옮긴 뒤라면 부분 롤백은 꼬인다).
     */
    function handleMove(
        vendor: ShippingVendorRow,
        direction: 'up' | 'down',
        index: number,
        siblings: ShippingVendorRow[],
    ) {
        const neighbor = siblings[direction === 'up' ? index - 1 : index + 1]
        if (!neighbor) return

        setRows((prev) => {
            const from = prev.findIndex((v) => v.id === vendor.id)
            const to = prev.findIndex((v) => v.id === neighbor.id)
            if (from < 0 || to < 0) return prev
            const next = [...prev]
            next[from] = prev[to]
            next[to] = prev[from]
            return next
        })

        saveQueue.current = saveQueue.current
            .then(() => moveShippingVendor(vendor.id, direction))
            .then((result) => {
                if (!result.success) {
                    toast.error(result.error || '순서 변경에 실패했어요.')
                    router.refresh()
                }
            })
    }

    function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        const name = newName.trim()
        if (!name) return
        run(() => createShippingVendor(name), () => setNewName(''))
    }

    function startEdit(vendor: ShippingVendorRow) {
        setEditingId(vendor.id)
        setEditingName(vendor.name)
    }

    function commitEdit(id: number) {
        const name = editingName.trim()
        if (!name || name === rows.find((v) => v.id === id)?.name) {
            setEditingId(null)
            return
        }
        run(() => renameShippingVendor(id, name), () => setEditingId(null))
    }

    function renderRow(vendor: ShippingVendorRow, index: number, siblings: ShippingVendorRow[]) {
        const isEditing = editingId === vendor.id

        return (
            <div
                key={vendor.id}
                className={`group flex items-center gap-2 h-8 pl-2.5 pr-1 rounded-lg ${
                    vendor.active ? 'hover:bg-slate-50' : 'bg-slate-50'
                }`}
            >
                <span className="w-3 shrink-0 text-[11px] tabular-nums text-slate-300">
                    {vendor.active ? index + 1 : '–'}
                </span>

                {isEditing ? (
                    <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => commitEdit(vendor.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit(vendor.id)
                            if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="h-7 flex-1 text-[12.5px]"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => startEdit(vendor)}
                        disabled={isPending}
                        className={`flex-1 min-w-0 text-left text-[12.5px] font-semibold truncate flex items-center gap-1.5 ${
                            vendor.active ? 'text-slate-700' : 'text-slate-400'
                        }`}
                    >
                        <span className="truncate">{vendor.name}</span>
                        <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                )}

                {/* 순서는 사용중 목록에서만 조정 — 미사용 업체는 어차피 등록 화면에 안 뜬다 */}
                {/* 저장을 기다리지 않으므로 isPending으로 막지 않는다. 끝단에서만 비활성 */}
                {vendor.active && (
                    <div className="flex items-center shrink-0 text-slate-300">
                        <button
                            type="button"
                            onClick={() => handleMove(vendor, 'up', index, siblings)}
                            disabled={index === 0}
                            className="p-0.5 hover:text-slate-600 disabled:opacity-25"
                            aria-label={`${vendor.name} 위로`}
                        >
                            <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleMove(vendor, 'down', index, siblings)}
                            disabled={index === siblings.length - 1}
                            className="p-0.5 hover:text-slate-600 disabled:opacity-25"
                            aria-label={`${vendor.name} 아래로`}
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => run(() => toggleShippingVendorActive(vendor.id))}
                    disabled={isPending}
                    className={`shrink-0 h-6 px-2 text-[11px] font-semibold rounded-md border transition-colors ${
                        vendor.active
                            ? 'border-slate-200 text-slate-500 hover:bg-white'
                            : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                    }`}
                >
                    {vendor.active ? '미사용' : '다시 사용'}
                </button>
            </div>
        )
    }

    return (
        <div>
            <div className="-mx-2">
                {activeVendors.length === 0 && (
                    <p className="text-[11px] text-slate-400 py-2 px-2">등록된 배송업체가 없습니다.</p>
                )}
                {activeVendors.map((vendor, index) => renderRow(vendor, index, activeVendors))}
            </div>

            {inactiveVendors.length > 0 && (
                <div className="-mx-2 mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[11px] text-slate-400 px-2 pb-1">
                        미사용 — 등록 화면에는 안 뜨지만 과거 발주서 묶음에는 그대로 남습니다.
                    </p>
                    {inactiveVendors.map((vendor, index) => renderRow(vendor, index, inactiveVendors))}
                </div>
            )}

            <form onSubmit={handleAdd} className="flex items-center gap-2 mt-2 pt-2.5 border-t border-slate-100">
                <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="업체명 (예: 부산아이스물류)"
                    className="h-[30px] flex-1 text-[12.5px]"
                />
                <Button type="submit" size="sm" variant="outline" disabled={isPending || !newName.trim()} className="h-[30px]">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    추가
                </Button>
            </form>
        </div>
    )
}
