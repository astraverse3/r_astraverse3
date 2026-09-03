'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Star, ChevronDown, Wheat, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { hasPermission } from '@/lib/permissions'
import { getVarietyTypeLabel } from '@/lib/variety-labels'
import { getDisplayMillingType } from '@/lib/milling-type-display'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import {
    createPackaging,
    togglePackagingActive,
    deleteProductType,
    toggleProductTypeActive,
} from '@/app/actions/product-type'
import { ProductTypeDialog } from './product-type-dialog'

type Variety = { id: number; name: string; type: string; category: string }
type Packaging = { id: number; name: string; active: boolean }
type ProductTypeRow = {
    id: number
    varietyId: number
    millingType: string
    packageType: string
    packagingId: number
    isDefault: boolean
    unitsPerBox: number | null
    active: boolean
    variety: { name: string; category: string; type: string }
    packaging: { name: string; active: boolean }
}

interface Props {
    packagings: Packaging[]
    productTypes: ProductTypeRow[]
    varieties: Variety[]
}

export function ProductTypePageClient({ packagings, productTypes, varieties }: Props) {
    const router = useRouter()
    const { data: session } = useSession()
    const canManage = hasPermission(
        session?.user as { role?: string; permissions?: string[] } | undefined,
        'OPERATION_MANAGE',
    )

    const [newPackaging, setNewPackaging] = useState('')
    const [adding, setAdding] = useState(false)

    const handleAddPackaging = async (e: React.FormEvent) => {
        e.preventDefault()
        const name = newPackaging.trim()
        if (!name) return
        setAdding(true)
        const result = await createPackaging(name)
        if (result.success) {
            setNewPackaging('')
            router.refresh()
        } else {
            toast.error(result.error || '포장지 등록에 실패했어요.')
        }
        setAdding(false)
    }

    const handleTogglePackaging = async (id: number) => {
        const result = await togglePackagingActive(id)
        if (result.success) router.refresh()
        else toast.error(result.error || '상태 변경에 실패했어요.')
    }

    const handleDeleteProductType = async (row: ProductTypeRow) => {
        const ok = await confirmDialog({
            description: `'${row.variety.name} / ${row.millingType} / ${row.packageType} / ${row.packaging.name}' 제품유형을 삭제할까요?`,
            destructive: true,
            confirmText: '삭제',
        })
        if (!ok) return
        const result = await deleteProductType(row.id)
        if (result.success) router.refresh()
        else toast.error(result.error || '삭제에 실패했어요.')
    }

    const handleToggleProductType = async (id: number) => {
        const result = await toggleProductTypeActive(id)
        if (result.success) router.refresh()
        else toast.error(result.error || '상태 변경에 실패했어요.')
    }

    // ── 탭 (벼 / 잡곡) ──
    const [tab, setTab] = useState<'rice' | 'misc'>('rice')
    const visibleTypes = productTypes.filter((r) =>
        tab === 'rice' ? r.variety.category === 'RICE' : r.variety.category === 'MISC_GRAIN',
    )

    // 벼 탭 — 품종별 그룹 (가나다순)
    const riceGroups = (() => {
        const m = new Map<string, ProductTypeRow[]>()
        for (const row of visibleTypes) {
            if (!m.has(row.variety.name)) m.set(row.variety.name, [])
            m.get(row.variety.name)!.push(row)
        }
        return [...m.entries()]
            .map(([name, rows]) => ({ name, type: rows[0].variety.type, rows }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    })()

    // 아코디언 펼침 상태 (기본 접힘)
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
    const isOpen = (name: string) => openGroups[name] ?? false
    const toggleGroup = (name: string) =>
        setOpenGroups((s) => ({ ...s, [name]: !(s[name] ?? false) }))

    // ── 공통 셀 (상태 토글 / 관리 버튼) — 벼·잡곡 양 탭에서 재사용 ──
    const statusButton = (row: ProductTypeRow) => (
        <button
            type="button"
            disabled={!canManage}
            onClick={() => canManage && handleToggleProductType(row.id)}
            className={`text-[11px] px-2 py-0.5 rounded-full ${row.active
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-400'
                } ${canManage ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        >
            {row.active ? '활성' : '비활성'}
        </button>
    )

    const actionButtons = (row: ProductTypeRow) =>
        canManage && (
            <div className="inline-flex items-center gap-0.5">
                <ProductTypeDialog
                    mode="edit"
                    varieties={varieties}
                    packagings={packagings}
                    productType={{
                        id: row.id,
                        varietyId: row.varietyId,
                        millingType: row.millingType,
                        packageType: row.packageType,
                        packagingId: row.packagingId,
                        isDefault: row.isDefault,
                        unitsPerBox: row.unitsPerBox,
                    }}
                />
                <button
                    type="button"
                    onClick={() => handleDeleteProductType(row)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                    title="삭제"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        )

    return (
        <div className="flex flex-col gap-5 pb-24 sm:pb-4 px-1.5 sm:px-0 pt-2">
            {/* 포장지 마스터 */}
            <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-800">포장지 마스터</h2>
                    <span className="text-[11px] text-slate-400">{packagings.length}종</span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {packagings.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            disabled={!canManage}
                            onClick={() => canManage && handleTogglePackaging(p.id)}
                            title={canManage ? (p.active ? '클릭 시 비활성화' : '클릭 시 활성화') : undefined}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${p.active
                                ? 'bg-blue-50 text-primary border-blue-100 hover:bg-blue-100'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:bg-slate-200'
                                } ${canManage ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            {p.name}
                        </button>
                    ))}
                    {packagings.length === 0 && (
                        <p className="text-xs text-slate-400">등록된 포장지가 없어요.</p>
                    )}
                </div>

                {canManage && (
                    <form onSubmit={handleAddPackaging} className="flex items-center gap-2 mt-3 max-w-sm">
                        <Input
                            value={newPackaging}
                            onChange={(e) => setNewPackaging(e.target.value)}
                            placeholder="새 포장지명 (예: 자연주의)"
                            className="h-9 text-sm"
                        />
                        <Button type="submit" size="sm" variant="outline" disabled={adding || !newPackaging.trim()}>
                            <Plus className="w-4 h-4 mr-1" />추가
                        </Button>
                    </form>
                )}
                <p className="text-[11px] text-slate-400 mt-2">
                    * 칩을 클릭하면 활성/비활성이 토글됩니다. 비활성 포장지는 등록 화면 드롭다운에서 숨겨집니다.
                </p>
            </section>

            {/* 제품유형(SKU) 카탈로그 */}
            <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-800">제품유형(SKU) 카탈로그</h2>
                    {canManage && (
                        <ProductTypeDialog mode="create" varieties={varieties} packagings={packagings} />
                    )}
                </div>

                {/* 탭 바 (벼 / 잡곡) */}
                <div className="flex items-center gap-1 border-b border-slate-200 mb-3">
                    {([['rice', '벼', Wheat], ['misc', '잡곡', Sprout]] as const).map(([v, label, Icon]) => {
                        const on = tab === v
                        return (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setTab(v)}
                                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold transition-all ${on ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${on ? 'scale-110' : ''}`} strokeWidth={on ? 2.4 : 1.8} />
                                <span className={on ? 'text-[14px]' : 'text-[13px]'}>{label}</span>
                                <span className={`absolute left-2 right-2 bottom-[-1px] h-[2.5px] rounded-full ${on ? 'bg-slate-900' : 'opacity-0'}`} />
                            </button>
                        )
                    })}
                </div>

                {/* 벼 탭 — 품종 아코디언 (도정 컬럼 O) */}
                {tab === 'rice' && (
                    <div className="flex flex-col gap-2">
                        {riceGroups.map((g) => {
                            const open = isOpen(g.name)
                            const activeN = g.rows.filter((r) => r.active).length
                            return (
                                <div key={g.name} className="rounded-lg border border-slate-200 overflow-hidden">
                                    {/* 그룹 헤더 */}
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(g.name)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-primary/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronDown
                                                className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
                                            />
                                            <span className="font-bold text-[14px] text-slate-900">{g.name}</span>
                                            {g.type && (
                                                <span className="text-[10px] px-1.5 h-4 inline-flex items-center border border-slate-200 text-slate-500 bg-white rounded">
                                                    {getVarietyTypeLabel(g.type)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                            <span>SKU <b className="text-slate-600">{g.rows.length}</b></span>
                                            <span className="text-slate-300">·</span>
                                            <span>활성 <b className="text-emerald-600">{activeN}</b></span>
                                        </div>
                                    </button>

                                    {/* 하위 SKU 테이블 (품종 컬럼 없음, 도정 컬럼 O) */}
                                    {open && (
                                        <div className="overflow-x-auto">
                                            <Table className="w-full text-sm border-collapse">
                                                <TableHeader>
                                                    <TableRow className="text-left text-[10px] text-slate-400 border-b border-slate-100 bg-white">
                                                        <TableHead className="text-left">도정</TableHead>
                                                        <TableHead className="text-left">규격</TableHead>
                                                        <TableHead className="py-1.5 px-2 font-medium">포장지</TableHead>
                                                        <TableHead className="py-1.5 px-2 font-medium text-center">기본</TableHead>
                                                        <TableHead className="py-1.5 px-2 font-medium text-center">상태</TableHead>
                                                        <TableHead className="py-1.5 px-3 font-medium text-right">관리</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {g.rows.map((row) => (
                                                        <TableRow
                                                            key={row.id}
                                                            className={`border-b border-slate-50 last:border-0 hover:bg-primary/5 transition-colors ${row.active ? '' : 'opacity-50'}`}
                                                        >
                                                            <TableCell className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">{getDisplayMillingType(row.millingType, g.type)}</TableCell>
                                                            <TableCell className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                                                {row.packageType}
                                                                {row.unitsPerBox != null && (
                                                                    <span className="ml-1.5 text-[10.5px] text-slate-400">{row.unitsPerBox}개/박스</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.packaging.name}</TableCell>
                                                            <TableCell className="py-2 px-2 text-center">
                                                                {row.isDefault && (
                                                                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 inline" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="py-2 px-2 text-center">{statusButton(row)}</TableCell>
                                                            <TableCell className="py-2 px-3 text-right whitespace-nowrap">{actionButtons(row)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {riceGroups.length === 0 && (
                            <p className="py-8 text-center text-xs text-slate-400">등록된 제품유형이 없어요.</p>
                        )}
                    </div>
                )}

                {/* 잡곡 탭 — 평면 테이블 (그룹화 X, 품종 컬럼 O, 도정 컬럼 X) */}
                {tab === 'misc' && (
                    <div className="overflow-x-auto -mx-1">
                        <Table className="w-full text-sm border-collapse">
                            <TableHeader>
                                <TableRow className="text-left text-[11px] text-slate-400 border-b border-slate-200">
                                    <TableHead >품종</TableHead>
                                    <TableHead >규격</TableHead>
                                    <TableHead >포장지</TableHead>
                                    <TableHead className="py-2 px-2 font-medium text-center">기본</TableHead>
                                    <TableHead className="py-2 px-2 font-medium text-center">상태</TableHead>
                                    <TableHead className="py-2 px-2 font-medium text-right">관리</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...visibleTypes]
                                    .sort((a, b) => a.variety.name.localeCompare(b.variety.name, 'ko'))
                                    .map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className={`border-b border-slate-50 hover:bg-primary/5 transition-colors ${row.active ? '' : 'opacity-50'}`}
                                        >
                                            <TableCell className="py-2 px-2 font-medium text-slate-800 whitespace-nowrap">{row.variety.name}</TableCell>
                                            <TableCell className="py-2 px-2 text-slate-600 whitespace-nowrap">
                                                {row.packageType}
                                                {row.unitsPerBox != null && (
                                                    <span className="ml-1.5 text-[10.5px] text-slate-400">{row.unitsPerBox}개/박스</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.packaging.name}</TableCell>
                                            <TableCell className="py-2 px-2 text-center">
                                                {row.isDefault && (
                                                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 inline" />
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2 px-2 text-center">{statusButton(row)}</TableCell>
                                            <TableCell className="py-2 px-2 text-right whitespace-nowrap">{actionButtons(row)}</TableCell>
                                        </TableRow>
                                    ))}
                                {visibleTypes.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-400">
                                            등록된 제품유형이 없어요.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </section>
        </div>
    )
}
