'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { ChevronRight, Inbox } from 'lucide-react'
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from '@/components/ui/table'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { toast } from 'sonner'
import {
    deleteMiscStock,
    type MiscStockGroup,
    type GetMiscStocksParams,
} from '@/app/actions/misc-stock'
import { MiscStockTableRow, MiscStockMobileCard, CERT_BADGE_CLASS } from './misc-stock-table-row'
import { AddMiscStockDialog, type MiscStockEditTarget } from './add-misc-stock-dialog'
import { triggerDataUpdate } from '@/components/last-updated'

interface Farmer {
    id: number
    name: string
    farmerNo: string | null
    group: { id: number; name: string; certType: string; certNo: string; cropYear: number } | null
}

interface Props {
    initialStocks: any[]
    filters: GetMiscStocksParams
    farmers: Farmer[]
    varieties: { id: number; name: string }[]
    millingVendors: string[]
    sproutingVendors: string[]
}

// 잡곡 데이터 규모가 작아 일괄 fetch + 클라이언트 그룹핑(생산자 패턴) 채택.
// 펼침/접힘은 클라이언트 토글만, 서버 fetch 추가 없음.
export function MiscStockListClient({
    initialStocks,
    filters,
    farmers,
    varieties,
    millingVendors,
    sproutingVendors,
}: Props) {
    // 삭제 즉시 반영용 — 서버 데이터 재요청 없이 hide
    const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set())
    // 다중 그룹의 사용자 토글 상태 (단일 건 그룹은 isMulti=false로 항상 펼침)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

    const [editTarget, setEditTarget] = useState<MiscStockEditTarget | null>(null)
    const [editOpen, setEditOpen] = useState(false)

    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'STOCK_MANAGE')

    // 새 데이터가 들어오면 hide 마스크 리셋
    useEffect(() => {
        setHiddenIds(new Set())
    }, [initialStocks])

    // 클라이언트 그룹핑 — 서버 getMiscStockGroups 로직 이식
    const groups = useMemo<MiscStockGroup[]>(() => {
        const visible = initialStocks.filter(s => !hiddenIds.has(s.id))
        const grouped: Record<string, MiscStockGroup & { _farmerIds: Set<number> }> = {}

        visible.forEach((stock: any) => {
            const certType = stock.farmer?.group?.certType || '일반'
            const variety = stock.variety?.name || 'Unknown'
            const key = `${stock.productionYear}-${variety}-${certType}`

            if (!grouped[key]) {
                grouped[key] = {
                    key,
                    year: stock.productionYear,
                    variety,
                    certType,
                    totalWeight: 0,
                    remainingTotal: 0,
                    count: 0,
                    farmerSetSize: 0,
                    items: [],
                    _farmerIds: new Set(),
                } as any
            }
            grouped[key].totalWeight += stock.weightKg
            grouped[key].remainingTotal += stock.remainingKg ?? stock.weightKg
            grouped[key].count += 1
            grouped[key].items.push(stock)
            if (stock.farmer?.id) grouped[key]._farmerIds.add(stock.farmer.id)
        })

        return Object.values(grouped)
            .map(g => {
                const { _farmerIds, ...rest } = g as any
                return { ...rest, farmerSetSize: _farmerIds.size } as MiscStockGroup
            })
            .sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year
                const aIsGeneral = a.certType === '일반'
                const bIsGeneral = b.certType === '일반'
                if (aIsGeneral && !bIsGeneral) return 1
                if (!aIsGeneral && bIsGeneral) return -1
                if (a.variety !== b.variety) return a.variety.localeCompare(b.variety, 'ko')
                return a.certType.localeCompare(b.certType, 'ko')
            })
    }, [initialStocks, hiddenIds])

    const handleEdit = (stock: any) => {
        setEditTarget({
            id: stock.id,
            productionYear: stock.productionYear,
            weightKg: stock.weightKg,
            rawWeightKg: stock.rawWeightKg ?? null,
            incomingDate: stock.incomingDate,
            actualFarmer: stock.actualFarmer ?? null,
            sourceType: stock.sourceType ?? null,
            millingVendor: stock.millingVendor ?? null,
            farmerId: stock.farmerId ?? stock.farmer?.id,
            varietyId: stock.varietyId ?? stock.variety?.id,
            farmer: { group: stock.farmer?.group ? { certType: stock.farmer.group.certType, cropYear: stock.farmer.group.cropYear } : null },
        })
        setEditOpen(true)
    }

    const handleDelete = async (stock: any) => {
        if (!confirm(`이 잡곡 입고를 삭제하시겠습니까?\n${stock.variety.name} / ${stock.farmer.name} / ${stock.weightKg}kg`)) return
        const result = await deleteMiscStock(stock.id)
        if (result.success) {
            toast.success('삭제되었습니다.')
            triggerDataUpdate()
            setHiddenIds(prev => new Set(prev).add(stock.id))
        } else {
            toast.error(result.error || '삭제에 실패했습니다.')
        }
    }

    // #7a: 다이얼로그 자리만. #7b에서 misc-package-dialog 마운트로 교체.
    const handlePackage = () => {
        toast.info('포장 다이얼로그는 #7b에서 활성화돼요.')
    }

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const filterCount = Object.keys(filters).filter(k => {
        const v = (filters as any)[k]
        return v !== undefined && v !== '' && v !== 'ALL' && !(typeof v === 'object' && Object.keys(v).length === 0)
    }).length

    return (
        <section className="overflow-hidden md:bg-white md:rounded-xl md:shadow-sm md:border md:border-slate-200">
            {/* Desktop */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="w-[40px] py-2 px-1 text-center"></TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px] hidden sm:table-cell">년도</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[80px]">품종</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[140px]">생산자</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[80px] hidden md:table-cell">입고일</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">Lot</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[80px]">유형</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[50px]">번호</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[70px]">원료(kg)</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[70px]">입고(kg)</TableHead>
                            <TableHead className="py-2 px-1 text-right text-xs font-bold text-slate-500 w-[70px]">재고(kg)</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[60px]">상태</TableHead>
                            <TableHead className="py-2 px-1 text-center text-xs font-bold text-slate-500 w-[40px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.length > 0 ? (
                            groups.map(group => {
                                const isMulti = group.count > 1
                                const isExpanded = expandedGroups.has(group.key)
                                const isOpen = !isMulti || isExpanded

                                return (
                                    <Fragment key={group.key}>
                                        {/* Summary Row — handoff §4.2.6 (단일 건은 헤더 안 보임)
                                            펼침 시 헤더와 서브를 같은 bg-slate-50/60 톤으로 통일 → 한 묶음 시각화.
                                            primary 액센트 사용 X (§4.2.6 NOTE). */}
                                        {isMulti && (
                                            <TableRow
                                                className={`cursor-pointer font-bold text-slate-800 h-12 border-y border-slate-200/70 ${
                                                    isExpanded
                                                        ? 'bg-slate-50/60 hover:bg-slate-100/60'
                                                        : 'bg-slate-50 hover:bg-slate-100'
                                                }`}
                                                onClick={() => toggleGroup(group.key)}
                                            >
                                                <TableCell className="text-center">
                                                    <ChevronRight
                                                        className={`w-3.5 h-3.5 mx-auto text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center text-sm tabular-nums hidden sm:table-cell">{group.year}</TableCell>
                                                <TableCell className="text-center text-sm">{group.variety}</TableCell>
                                                <TableCell className="text-sm text-slate-600 tabular-nums">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <span>{group.farmerSetSize}명</span>
                                                        <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-md border text-[10px] ${CERT_BADGE_CLASS[group.certType] ?? CERT_BADGE_CLASS['일반']}`}>
                                                            {group.certType}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell"></TableCell>
                                                <TableCell></TableCell>
                                                <TableCell></TableCell>
                                                <TableCell className="text-right text-sm tabular-nums">{group.count}개</TableCell>
                                                <TableCell></TableCell>
                                                <TableCell className="text-right text-sm text-slate-500 tabular-nums">
                                                    {group.totalWeight.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-primary font-semibold tabular-nums">
                                                    {Math.round(group.remainingTotal).toLocaleString()}
                                                </TableCell>
                                                <TableCell></TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        )}

                                        {/* Detail Rows — 단일 건 그룹은 무조건 표시, 다중은 isExpanded일 때만
                                            inExpandedGroup: 다중 그룹의 서브행만 묶음 톤(slate-50/60). 단일 건은 흰 배경(낱개). */}
                                        {isOpen && group.items.map((stock: any) => (
                                            <MiscStockTableRow
                                                key={stock.id}
                                                stock={stock}
                                                canManage={canManage}
                                                inExpandedGroup={isMulti}
                                                onEdit={() => handleEdit(stock)}
                                                onDelete={() => handleDelete(stock)}
                                                onPackage={handlePackage}
                                            />
                                        ))}
                                    </Fragment>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={13} className="py-16">
                                    <EmptyState filtered={filterCount > 0} />
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex flex-col min-h-[40vh] py-3 gap-3 bg-transparent">
                {groups.length > 0 ? (
                    groups.map(group => {
                        const isMulti = group.count > 1
                        const isExpanded = expandedGroups.has(group.key)

                        // 단일 건 그룹은 헤더 카드 없이 상세 카드만 표시 (border 없음)
                        if (!isMulti) {
                            return (
                                <div key={group.key} className="flex flex-col gap-1.5">
                                    {group.items.map((stock: any) => (
                                        <MiscStockMobileCard
                                            key={stock.id}
                                            stock={stock}
                                            canManage={canManage}
                                            onEdit={() => handleEdit(stock)}
                                            onDelete={() => handleDelete(stock)}
                                            onPackage={() => handlePackage(stock)}
                                        />
                                    ))}
                                </div>
                            )
                        }

                        return (
                            <div key={group.key} className="flex flex-col gap-2">
                                <div
                                    className={`flex flex-col p-3 rounded-xl border border-slate-200 bg-white transition-colors ${
                                        isExpanded ? 'shadow-md' : 'shadow-sm'
                                    }`}
                                    onClick={() => toggleGroup(group.key)}
                                >
                                    <div className="flex items-center justify-between mb-1.5 gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-[#2a2a2a] text-[15px] leading-none">{group.variety}</span>
                                            <span className="text-[11px] text-slate-500 font-medium bg-white border border-slate-200 px-1 py-0.5 rounded shadow-sm leading-none whitespace-nowrap">
                                                {group.year}년
                                            </span>
                                        </div>
                                        <ChevronRight
                                            className={`text-slate-400 h-5 w-5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </div>

                                    <div className="flex items-end justify-between mt-1">
                                        <div className="text-[12px] text-slate-600 font-medium whitespace-nowrap inline-flex items-center gap-1.5">
                                            <span>생산자 <span className="font-bold text-slate-800 tabular-nums">{group.farmerSetSize}명</span></span>
                                            <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded text-[10px] border whitespace-nowrap leading-none ${CERT_BADGE_CLASS[group.certType] ?? CERT_BADGE_CLASS['일반']}`}>
                                                {group.certType}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2.5 text-right w-full justify-end">
                                            <div className="text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                                                {group.count}건
                                            </div>
                                            <div className="text-[17px] font-black text-primary tracking-tight leading-none whitespace-nowrap tabular-nums">
                                                {group.totalWeight.toLocaleString()}<span className="text-[11px] font-bold ml-0.5 opacity-70">kg</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* §4.2.7 모바일: 펼친 그룹은 bg-slate-50/70 묶음 컨테이너, 카드 자체는 흰 배경 유지 */}
                                {isExpanded && (
                                    <div className="flex flex-col gap-1.5 p-2 mx-1 mb-2 rounded-lg bg-slate-50/70">
                                        {group.items.map((stock: any) => (
                                            <MiscStockMobileCard
                                                key={stock.id}
                                                stock={stock}
                                                canManage={canManage}
                                                onEdit={() => handleEdit(stock)}
                                                onDelete={() => handleDelete(stock)}
                                                onPackage={handlePackage}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200">
                        <EmptyState filtered={filterCount > 0} />
                    </div>
                )}
            </div>

            {/* Edit Dialog (controlled) — 행 액션 메뉴에서 트리거 */}
            {editTarget && (
                <AddMiscStockDialog
                    farmers={farmers}
                    varieties={varieties}
                    millingVendors={millingVendors}
                    sproutingVendors={sproutingVendors}
                    editTarget={editTarget}
                    open={editOpen}
                    onOpenChange={(o) => {
                        setEditOpen(o)
                        if (!o) setEditTarget(null)
                    }}
                />
            )}
        </section>
    )
}

// §5.3 빈 상태 + §7 친근체 카피
function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600">
                {filtered ? '조건에 맞는 결과가 없어요. 필터를 바꿔보세요.' : '아직 등록된 잡곡 재고가 없어요.'}
            </p>
        </div>
    )
}
