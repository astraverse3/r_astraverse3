'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Plus, Minus, Package, Trash2, Lock, Check, X } from 'lucide-react'
import { updatePackagingLogs, reopenMillingBatch, closeMillingBatch, getBatchOutputs, type MillingOutputInput } from '@/app/actions/milling'
import { listPackagings, suggestProductType } from '@/app/actions/product-type'
import { mergeUnseenRows } from '@/lib/packaging-diff'
import { PACKAGE_TEMPLATES, PKG_REMAINDER, PKG_TONBAG } from './packaging-constants'
import { SpecSummaryBand } from './spec-summary'
import { generateLotNo } from '@/lib/lot-generation'
import { getYieldRate } from '@/app/actions/settings'
import { DEFAULT_YIELD_RATES } from '@/lib/settings-constants'
import { useRouter } from 'next/navigation'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface Props {
    batchId: number
    millingType?: string
    totalInputKg?: number
    isClosed?: boolean
    initialOutputs?: MillingOutputInput[]
    stocks?: any[]
}

type LotGroup = {
    lotNo: string
    representativeStockId: number
    varietyId: number
    stockIds: number[]
    farmerName: string
    varietyName: string
    totalInputKg: number
}

function computeLotGroups(stocks: any[], millingType: string): LotGroup[] {
    const map = new Map<string, LotGroup>()
    for (const stock of stocks) {
        const isConventional = stock.farmer?.group?.certType === '일반'
        const farmerNo = stock.farmer?.farmerNo || '00'
        // 관행: farmerNo로 개별 그룹핑, 그 외: 로트번호로 그룹핑
        const groupKey = isConventional
            ? `관행-${farmerNo}`
            : generateLotNo({
                incomingDate: new Date(stock.incomingDate || Date.now()),
                varietyType: stock.variety?.type || 'URUCHI',
                varietyName: stock.variety?.name || '일반쌀',
                millingType,
                certNo: stock.farmer?.group?.certNo || '00',
                farmerGroupCode: stock.farmer?.group?.code || '00',
                farmerNo,
            })
        const displayLotNo = isConventional ? '관행' : groupKey
        if (!map.has(groupKey)) {
            map.set(groupKey, {
                lotNo: displayLotNo,
                representativeStockId: stock.id,
                varietyId: stock.variety?.id ?? stock.varietyId ?? 0,
                stockIds: [],
                farmerName: stock.farmerName || stock.farmer?.name || '알수없음',
                varietyName: stock.variety?.name || '',
                totalInputKg: 0,
            })
        }
        const group = map.get(groupKey)!
        group.totalInputKg += stock.weightKg
        group.stockIds.push(stock.id)
    }
    return Array.from(map.values())
}

// 다이얼로그 재진입 시 기존 라인의 포장지(packagingId)를 productType에서 평탄화 복원.
// 서버 행 id(`o.id`)도 이때 함께 실려 온다 — 저장이 그 행을 「고칠지 새로 만들지」를
// 가르는 열쇠라 잃어버리면 안 된다 (결정 #62). 아래 편집 함수들은 모두 `{ ...o }`로
// 기존 필드를 이어받으므로 id가 유지되고, 새로 추가하는 줄만 id가 없다.
function restoreOutputs(raw: MillingOutputInput[]): MillingOutputInput[] {
    return (raw ?? []).map(o => ({
        ...o,
        packagingId:
            o.packagingId ??
            (o as { productType?: { packagingId?: number | null } }).productType?.packagingId ??
            null,
    }))
}

// 저장이 막힌 이유는 여러 줄로 온다(어느 줄이 · 몇 개 차감됐는지 · 어떻게 풀는지 — 결정 #63).
// toast는 개행을 접어버리므로 whitespace를 살려 보여준다.
function toastBlocked(result: unknown, fallback: string) {
    const error = (result as { error?: unknown } | null)?.error
    const text = typeof error === 'string' && error.trim() ? error : fallback
    toast.error(<span className="whitespace-pre-line">{text}</span>)
}

export function AddPackagingDialog({
    batchId,
    millingType = '백미',
    totalInputKg,
    isClosed,
    initialOutputs = [],
    stocks = [],
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    trigger,
}: Props & { open?: boolean; onOpenChange?: (open: boolean) => void; trigger?: React.ReactNode }) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const [outputs, setOutputs] = useState<MillingOutputInput[]>(() => restoreOutputs(initialOutputs))
    const [isLoading, setIsLoading] = useState(false)
    // 열릴 때의 서버 재조회 상태 (P3). 최신을 못 받은 동안에는 쓰기를 막는다 —
    // 낡은 값으로 저장하면 서버 diff가 화면에 없던 행을 지운다.
    const [outputsLoading, setOutputsLoading] = useState(false)
    const [outputsFailed, setOutputsFailed] = useState(false)
    // 마지막으로 서버에서 받은 = 「내가 본」 상태. baseline(P4)과 변경 여부 판정의 기준이다.
    const [serverOutputs, setServerOutputs] = useState<MillingOutputInput[]>([])
    // 충돌로 거부돼 남의 줄을 합친 뒤 띄우는 배너와, 그 줄들의 강조 표시
    const [conflictNotice, setConflictNotice] = useState<string | null>(null)
    const [incomingIds, setIncomingIds] = useState<Set<number>>(new Set())
    const [customWeights, setCustomWeights] = useState<Record<string, string>>({})
    const [customInputs, setCustomInputs] = useState<Record<string, boolean>>({})
    // 활성 포장지 목록 (라인별 드롭다운 옵션)
    const [packagings, setPackagings] = useState<{ id: number; name: string }[]>([])
    const scrollRef = useRef<HTMLDivElement>(null)
    // 규격 버튼 클릭 후 방금 추가/증가한 행의 입력칸으로 포커스 이동(맨아래 스크롤 대신)
    const pendingFocus = useRef<{ index: number; field: 'count' | 'weight' } | null>(null)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'OPERATION_MANAGE')

    // 저장·마감·초기화를 막는 조건. 재조회가 끝나기 전이거나 실패했으면 쓰기를 열지 않는다.
    const writeBlocked = isLoading || outputsLoading || outputsFailed

    // 「내가 본 행」 집합 — 서버가 이걸로 「내가 지운 행」과 「못 본 행」을 가른다 (P4).
    const baselineIds = serverOutputs
        .map(o => o.id)
        .filter((id): id is number => id !== undefined)

    /**
     * 저장에 보낼 줄만 고른다 (P5 · 2026-09-01 사고).
     *
     * 예전엔 `outputs.filter(o => o.count > 0)` 한 줄이었다. 수량이 안 채워진 줄은
     * **경고 없이** payload에서 빠졌고, 그게 기존 행이면 서버 diff가 「지운 것」으로 읽어
     * 삭제까지 갔다. 조용히 지우느니 저장을 막는다.
     *
     * 막을 수 없으면 null. 호출부는 그대로 돌아간다.
     */
    const collectValidOutputs = async (): Promise<MillingOutputInput[] | null> => {
        const emptyExisting = outputs.filter(o => o.id !== undefined && o.count <= 0)
        if (emptyExisting.length > 0) {
            toast.warning(
                `${emptyExisting.map(o => o.packageType).join(', ')} 줄의 개수를 입력해 주세요. 지우려면 휴지통을 눌러 주세요.`
            )
            return null
        }
        // 새로 추가만 하고 수량을 안 넣은 줄 — 버리는 건 맞지만 말은 해준다.
        const dropped = outputs.filter(o => o.id === undefined && o.count <= 0)
        if (dropped.length > 0) {
            toast.info(`개수가 없는 ${dropped.length}줄은 저장하지 않았습니다.`)
        }
        const valid = outputs.filter(o => o.count > 0)
        if (valid.length === 0) {
            // 서버에도 아무것도 없으면 저장할 게 없다.
            if (serverOutputs.length === 0) {
                toast.warning('포장 내역을 입력해주세요.')
                return null
            }
            // 🔴 서버엔 있는데 화면을 다 비웠다 = 「전부 지우겠다」는 뜻이다.
            // 예전엔 이때 저장 버튼이 비활성이라 **마지막 한 줄은 휴지통으로 지울 방법이
            // 아예 없었다**(2026-09-02 실사용 중 발견). 확인 한 번으로 길을 열어준다.
            const okToClear = await confirmDialog({
                description: '포장 기록을 모두 지웁니다. 계속할까요?',
                destructive: true,
                confirmText: '모두 삭제',
            })
            if (!okToClear) return null
        }
        return valid
    }

    /**
     * 저장 실패 공통 처리 (P4).
     *
     * 🔴 충돌이면 **내 입력을 그대로 둔 채** 남의 줄만 합쳐 보여주고 baseline을 갱신한다.
     * 다시 저장을 누르면 통과한다 — 거부는 한 번뿐인 확인 단계여야 하고,
     * 재입력을 요구해선 안 된다(2026-09-01 사고 후반부가 정확히 그것이었다).
     */
    const handleSaveFailure = (
        result: { error?: string; conflict?: unknown[] },
        fallback: string,
    ) => {
        if (!result.conflict) {
            toastBlocked(result, fallback)
            return
        }
        const fresh = restoreOutputs(result.conflict as MillingOutputInput[])
        const { merged, incomingIds: ids } = mergeUnseenRows(outputs, fresh)
        setOutputs(merged)
        setIncomingIds(new Set(ids))
        setServerOutputs(fresh)
        setConflictNotice(result.error || '다른 사람이 포장을 추가했습니다. 확인 후 다시 저장해 주세요.')
    }

    const lotGroups = computeLotGroups(stocks, millingType)
    const isMultiGroup = lotGroups.length > 1
    // DB에서 수율 조회 (없으면 기본값으로 시작, 비동기로 교체)
    const [yieldRate, setYieldRate] = useState<number>(
        (DEFAULT_YIELD_RATES[millingType ?? ''] ?? 68) / 100
    )
    useEffect(() => {
        if (!millingType) return
        getYieldRate(millingType).then(rate => setYieldRate(rate / 100))
    }, [millingType])

    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = (newOpen: boolean) => {
        if (isControlled) setControlledOpen?.(newOpen)
        else setInternalOpen(newOpen)
    }

    // 🔴 열릴 때마다 **서버에서 최신 행을 다시 읽는다** (P3 · 2026-09-01 사고).
    //
    // 예전엔 페이지가 로드될 때 받은 스냅샷(`initialOutputs`)만 봤다. 그래서 탭을 켜둔 채
    // 두면 화면이 낡고, 그 상태로 저장하면 화면에 없던 행을 서버 diff가 「지운 것」으로 읽어
    // 조용히 삭제했다. 동시에 열어둘 필요도 없이 탭 하나만 오래 켜두면 성립한다.
    //
    // ⚠️ deps에서 `initialOutputs`를 일부러 뺐다 — 열려 있는 동안 prop이 갱신되면
    // **입력 중인 값을 덮어써서** 그게 또 「입력 날림」이 된다. 열리는 순간에만 맞춘다.
    useEffect(() => {
        if (!open) return
        // 서버 응답 전까지는 스냅샷을 보여준다(빈 화면 깜빡임 방지). 곧 최신으로 교체된다.
        setOutputs(restoreOutputs(initialOutputs))
        setConflictNotice(null)
        setIncomingIds(new Set())
        let cancelled = false
        setOutputsLoading(true)
        setOutputsFailed(false)
        getBatchOutputs(batchId).then(res => {
            if (cancelled) return
            setOutputsLoading(false)
            // 🔴 조용히 넘어가지 않는다. 못 읽은 채로 저장하면 남의 행을 지운다.
            if (!res.success) {
                setOutputsFailed(true)
                toast.error('포장 내역을 불러오지 못했습니다. 창을 닫고 다시 열어 주세요.')
                return
            }
            const fresh = restoreOutputs(res.data as MillingOutputInput[])
            setOutputs(fresh)
            setServerOutputs(fresh)
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, batchId])

    // outputs 변경 후, 대기 중인 포커스 대상 입력칸을 화면에 보이게 하고 포커스+전체선택
    useEffect(() => {
        const target = pendingFocus.current
        if (!target) return
        pendingFocus.current = null
        requestAnimationFrame(() => {
            const el = scrollRef.current?.querySelector<HTMLInputElement>(
                `[data-${target.field}-index="${target.index}"]`
            )
            if (!el) return
            el.scrollIntoView({ block: 'nearest' })
            el.focus()
            el.select()
        })
    }, [outputs])

    // 활성 포장지 목록 lazy fetch (라인별 드롭다운 옵션)
    useEffect(() => {
        if (!open) return
        let cancelled = false
        listPackagings().then(res => {
            if (cancelled || !res.success || !res.data) return
            setPackagings(res.data.filter(p => p.active).map(p => ({ id: p.id, name: p.name })))
        })
        return () => {
            cancelled = true
        }
    }, [open])

    // 초기화는 위 재조회 effect가 맡는다 — 여기서 낡은 prop으로 다시 채우면 그걸 덮어쓴다.
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
    }

    const handleReopenAndOpen = async () => {
        if (!(await confirmDialog('마감된 작업을 다시 수정하시겠습니까?'))) return
        setIsLoading(true)
        const result = await reopenMillingBatch(batchId)
        setIsLoading(false)
        if (result.success) {
            triggerDataUpdate()
            // 닫힌 상태에서 눌렀으면 아래 setOpen(true)가 재조회 effect를 깨운다.
            // 낡은 initialOutputs로 채우던 줄은 뺐다 — 그게 최신 조회를 덮어썼다.
            setOpen(true)
            router.refresh()
        } else {
            toast.error((result as any).error || '마감 해제 실패')
        }
    }

    const handleCloseBatch = async () => {
        // `outputs`는 restoreOutputs를 거친 값이라 원본(initialOutputs)과 직접 비교하면
        // packagingId 키 하나 때문에 **아무것도 안 고쳐도 항상 「변경됨」**이 됐다.
        // 같은 가공을 거친 값끼리 맞대야 뜻이 맞는다.
        // 기준은 **서버에서 마지막으로 받은 값**이다. 낡은 prop(initialOutputs)과 맞대면
        // 재조회(P3)로 화면이 갱신된 것만으로 「변경됨」이 돼 불필요한 저장이 돈다.
        const hasUnsavedChanges = JSON.stringify(outputs) !== JSON.stringify(serverOutputs)
        if (hasUnsavedChanges) {
            const validOutputs = await collectValidOutputs()
            if (!validOutputs) return
            if (!(await confirmDialog('포장 데이터를 저장하고 마감하시겠습니까?'))) return
            setIsLoading(true)
            const saveResult = await updatePackagingLogs(batchId, validOutputs, baselineIds)
            if (!saveResult.success) {
                setIsLoading(false)
                handleSaveFailure(saveResult, '포장 기록 저장에 실패했습니다.')
                return
            }
        } else {
            if (!(await confirmDialog('작업을 마감하시겠습니까?'))) return
            setIsLoading(true)
        }
        const result = await closeMillingBatch(batchId)
        setIsLoading(false)
        if (result.success) {
            triggerDataUpdate()
            setOpen(false)
            router.refresh()
        } else {
            toast.error((result as any).error || '마감 실패')
        }
    }

    const handleClearPackaging = async () => {
        if (!(await confirmDialog({ description: '포장 기록을 모두 삭제하시겠습니까?', destructive: true, confirmText: '삭제' }))) return
        setIsLoading(true)
        const result = await updatePackagingLogs(batchId, [], baselineIds)
        setIsLoading(false)
        if (result.success) {
            setOutputs([])
            setServerOutputs([])
            triggerDataUpdate()
            router.refresh()
        } else {
            handleSaveFailure(result, '포장 기록 삭제에 실패했습니다.')
        }
    }

    const addToGroup = (group: LotGroup, template: { label: string; weight: number }) => {
        const stockId = group.representativeStockId
        const label = template.label
        // 톤백·잔량은 포장지 입력 없음(톤백=서버에서 '톤백' 강제, 잔량=SKU 미부여).
        // → 수량 대신 중량(kg) 입력칸으로 포커스.
        if (label === PKG_TONBAG || label === PKG_REMAINDER) {
            pendingFocus.current = { index: outputs.length, field: 'weight' }
            setOutputs(prev => [...prev, {
                packageType: label,
                weightPerUnit: 0,
                count: 1,
                totalWeight: 0,
                stockId,
                packagingId: null,
            }])
            return
        }
        // 기존 동일 라인이 있으면 수량만 증가(포장지 유지). 해당 행 수량칸으로 포커스.
        const existingIndex = outputs.findIndex(o => o.packageType === label && o.stockId === stockId)
        if (existingIndex !== -1) {
            pendingFocus.current = { index: existingIndex, field: 'count' }
            setOutputs(prev => prev.map(o => (o.packageType === label && o.stockId === stockId)
                ? { ...o, count: o.count + 1, totalWeight: (o.count + 1) * o.weightPerUnit }
                : o))
            return
        }
        // 신규 라인: 행을 먼저 즉시 추가하고(포장지 미지정으로 시작), 수량칸으로 포커스.
        // 서버 왕복(기본 포장지 추천)이 행 추가를 블로킹하지 않도록 낙관적으로 그린다.
        pendingFocus.current = { index: outputs.length, field: 'count' }
        setOutputs(prev => [...prev, {
            packageType: label,
            weightPerUnit: template.weight,
            count: 1,
            totalWeight: template.weight,
            stockId,
            packagingId: null,
        }])
        // (품종+도정+규격) 기본 포장지 추천은 백그라운드로 조회 → 응답이 오면 해당 라인의
        // 포장지가 아직 미지정일 때만 채운다(사용자가 먼저 골랐으면 그 선택을 유지).
        suggestProductType(group.varietyId, millingType, label).then(res => {
            const defaultPackagingId = res.success && res.data ? (res.data.default?.packagingId ?? null) : null
            if (defaultPackagingId == null) return
            setOutputs(prev => prev.map(o =>
                (o.packageType === label && o.stockId === stockId && o.packagingId == null)
                    ? { ...o, packagingId: defaultPackagingId }
                    : o))
        })
    }

    const setPackaging = (index: number, packagingId: number | null) => {
        setOutputs(prev => prev.map((o, i) => i === index ? { ...o, packagingId } : o))
    }

    const handleCustomAdd = (group: LotGroup) => {
        const raw = customWeights[group.lotNo]
        const weight = parseFloat(raw)
        if (weight > 0) {
            addToGroup(group, { label: `${weight}kg`, weight })
            setCustomWeights(prev => ({ ...prev, [group.lotNo]: '' }))
            setCustomInputs(prev => ({ ...prev, [group.lotNo]: false }))
        } else {
            toast.warning('올바른 무게를 입력해주세요.')
        }
    }

    const updateCount = (index: number, delta: number) => {
        setOutputs(prev => prev.map((o, i) => {
            if (i !== index) return o
            const newCount = Math.max(0, o.count + delta)
            return { ...o, count: newCount, totalWeight: newCount * o.weightPerUnit }
        }))
    }

    const setCount = (index: number, count: number) => {
        setOutputs(prev => prev.map((o, i) => {
            if (i !== index) return o
            const validCount = isNaN(count) ? 0 : Math.max(0, count)
            return { ...o, count: validCount, totalWeight: validCount * o.weightPerUnit }
        }))
    }

    const setWeight = (index: number, weight: number) => {
        setOutputs(prev => prev.map((o, i) => {
            if (i !== index) return o
            const validWeight = isNaN(weight) ? 0 : Math.max(0, weight)
            return { ...o, weightPerUnit: validWeight, totalWeight: o.count * validWeight }
        }))
    }

    const removePackage = (index: number) => {
        setOutputs(prev => prev.filter((_, i) => i !== index))
    }

    async function handleSubmit() {
        const validOutputs = await collectValidOutputs()
        if (!validOutputs) return
        setIsLoading(true)
        const result = await updatePackagingLogs(batchId, validOutputs, baselineIds)
        setIsLoading(false)
        if (result.success) {
            triggerDataUpdate()
            setOpen(false)
            setOutputs([])
            router.refresh()
        } else {
            handleSaveFailure(result, '포장 기록 저장에 실패했습니다.')
        }
    }

    // 그룹에 속한 outputs 필터 — 그룹의 모든 stockId로 매칭 (대표 stock이 정렬에 따라 바뀌어도 안 깨짐).
    // stockIds가 비어있으면(stocks 없는 fallback 그룹) 전체 output을 노출한다.
    const getGroupOutputs = (group: LotGroup) => {
        const ids = new Set(group.stockIds)
        return outputs
            .map((o, i) => ({ o, i }))
            .filter(({ o }) => ids.size === 0 || ids.has(o.stockId as number))
    }

    // 단일 그룹이면 stocks가 없어도 빈 그룹 하나로 처리
    const displayGroups: LotGroup[] = lotGroups.length > 0
        ? lotGroups
        : [{ lotNo: '', representativeStockId: 0, varietyId: 0, stockIds: [], farmerName: '', varietyName: '', totalInputKg: totalInputKg ?? 0 }]

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {trigger !== undefined ? trigger : (
                isClosed ? (
                    <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); handleReopenAndOpen() }} disabled={isLoading}>
                        <Package className="mr-2 h-4 w-4" /> 마감완료
                    </Button>
                ) : (
                    <Button variant="outline" size="sm">
                        <Package className="mr-2 h-4 w-4" /> 포장하기
                    </Button>
                )
            )}

            <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90dvh] px-4 sm:px-6">
                <DialogHeader>
                    <DialogTitle>포장 기록 관리</DialogTitle>
                    <div className="flex items-center gap-2 mt-1.5">
                        {millingType && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary/20 text-primary">
                                {millingType}
                            </span>
                        )}
                        <span className="text-[13px] font-bold text-slate-700">
                            총 투입: {totalInputKg?.toLocaleString()}kg
                        </span>
                    </div>
                </DialogHeader>

                {/* 충돌 배너 (P4) — 내가 못 본 행을 합쳤을 때. 토스트가 아니라 **안 사라지는 배너**다:
                    현장에서 몇 초 뒤 사라지는 알림은 놓친다. 모달도 아니다 — 무엇이 들어왔는지
                    가려버리기 때문이다. 아래 목록에서 합쳐진 줄이 강조돼 보인다. */}
                {conflictNotice && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[12px] font-semibold text-amber-800 whitespace-pre-line">{conflictNotice}</p>
                    </div>
                )}

                {/* 규격별 합계 밴드 — 노출 조건은 컴포넌트가 스스로 판단한다 */}
                <SpecSummaryBand outputs={outputs} isMultiGroup={isMultiGroup} />

                <div ref={scrollRef} className="py-4 space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {displayGroups.map((group) => {
                        const groupOutputs = getGroupOutputs(group)
                        const groupTotal = groupOutputs.reduce((sum, { o }) => sum + (o.totalWeight || 0), 0)
                        const expectedKg = Math.round(group.totalInputKg * yieldRate)

                        return (
                            <div key={group.lotNo || 'single'} className={`rounded-xl border overflow-hidden ${isMultiGroup ? 'border-stone-200' : 'border-transparent'}`}>
                                {/* 그룹 헤더 — 모바일: LOT은 1줄 인라인, 입력→예상은 2번째 줄 우측 정렬 / PC: 모두 1줄 */}
                                {(isMultiGroup || group.farmerName) && (
                                    <div className="bg-stone-50 border-b border-stone-100 px-3 py-2">
                                        {/* 첫줄: 생산자·품종(좌) / 투입→예상(우). 데스크탑은 로트번호도 인라인 */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-bold text-stone-700 shrink-0">{group.farmerName}</span>
                                            {group.varietyName && (
                                                <span className="text-stone-400 text-[11px] shrink-0">{group.varietyName}</span>
                                            )}
                                            {group.lotNo && (
                                                <span className="hidden sm:inline-block font-mono text-[11px] text-stone-500 bg-white border border-stone-200 rounded px-1.5 py-0.5 shrink-0">
                                                    {group.lotNo}
                                                </span>
                                            )}
                                            <div className="flex-1" />
                                            {isMultiGroup && (
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {/* 투입량·화살표는 데스크탑만, 예상은 공통 */}
                                                    <span className="hidden sm:inline text-[11px] text-stone-500">
                                                        {group.totalInputKg.toLocaleString()}kg
                                                    </span>
                                                    <span className="hidden sm:inline text-stone-300 text-[10px]">→</span>
                                                    <span className="text-[11px] font-bold text-primary">
                                                        예상 {expectedKg.toLocaleString()}kg
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {/* 모바일: 로트번호 풀폭 둘째줄 */}
                                        {group.lotNo && (
                                            <span className="sm:hidden block w-full font-mono text-[11.5px] text-stone-500 bg-white border border-stone-200 rounded px-1.5 py-0.5 mt-1.5">
                                                {group.lotNo}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* 규격 버튼 (편집 가능할 때만) */}
                                {!isClosed && canManage && (
                                    <div className="px-3 pt-3 pb-3 space-y-1.5 border-b border-stone-200">
                                        {!isMultiGroup && (
                                            <Label className="text-[12px] text-stone-500 block">규격 선택</Label>
                                        )}
                                        {/* 규격 버튼: 모바일 5열 2행, 데스크탑 10열 1행 */}
                                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                                            {PACKAGE_TEMPLATES.map(t => (
                                                <Button key={t.label} variant="secondary"
                                                    className="h-7 w-full px-0 text-[11px] hover:bg-stone-200 transition-colors"
                                                    onClick={() => addToGroup(group, t)}>
                                                    {t.label}
                                                </Button>
                                            ))}
                                            <Button variant="outline"
                                                className="h-7 w-full px-0 text-[11px] border-dashed border-stone-300 hover:bg-stone-100 text-stone-500"
                                                onClick={() => setCustomInputs(prev => ({ ...prev, [group.lotNo]: true }))}>
                                                기타
                                            </Button>
                                        </div>
                                        {/* 직접입력 확장 영역 */}
                                        {customInputs[group.lotNo] && (
                                            <div className="flex items-center gap-2 pt-1">
                                                <Input
                                                    type="number"
                                                    value={customWeights[group.lotNo] ?? ''}
                                                    onChange={(e) => setCustomWeights(prev => ({ ...prev, [group.lotNo]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCustomAdd(group)
                                                        if (e.key === 'Escape') setCustomInputs(prev => ({ ...prev, [group.lotNo]: false }))
                                                    }}
                                                    placeholder="무게 입력"
                                                    autoFocus
                                                    className="flex-1 h-9 text-[13px] text-right"
                                                />
                                                <span className="text-[12px] text-stone-500 font-bold shrink-0">kg</span>
                                                <Button className="h-9 px-4 text-[13px] shrink-0" onClick={() => handleCustomAdd(group)}>
                                                    추가
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-stone-400"
                                                    onClick={() => setCustomInputs(prev => ({ ...prev, [group.lotNo]: false }))}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 컬럼 헤더 힌트 (데스크탑 전용) */}
                                {groupOutputs.length > 0 && (
                                    <div className="hidden sm:grid grid-cols-[40px_140px_1fr_58px_24px] gap-1 px-3 pt-1.5 pb-0.5">
                                        <span className="text-[9px] font-semibold text-stone-300 text-center tracking-tight">규격</span>
                                        <span className="text-[9px] font-semibold text-stone-300 tracking-tight">포장지</span>
                                        <span className="text-[9px] font-semibold text-stone-300 text-center tracking-tight">수량</span>
                                        <span className="text-[9px] font-semibold text-stone-300 text-right tracking-tight">중량</span>
                                        <span />
                                    </div>
                                )}

                                {/* 포장 목록 */}
                                <div className="divide-y divide-stone-100">
                                    {groupOutputs.length === 0 && (
                                        <div className="text-center text-[12px] text-stone-300 py-4">
                                            {!isClosed && canManage ? '위 버튼으로 추가하세요' : '포장 내역 없음'}
                                        </div>
                                    )}
                                    {groupOutputs.map(({ o, i }) => (
                                        // 충돌로 합쳐 들어온 줄은 배경으로 짚어준다 — 어느 줄이 남의 것인지
                                        // 보이지 않으면 배너만으로는 확인이 되지 않는다 (P4).
                                        <div key={i} className={`px-2 sm:px-3 py-1.5 ${o.id !== undefined && incomingIds.has(o.id) ? 'bg-amber-50' : ''}`}>
                                          {/* 모바일: 36/1fr/64/58/22 — 데스크탑: 40/140/1fr/64/24 (반응형 1행 유지) */}
                                          <div className="grid grid-cols-[36px_1fr_88px_58px_22px] sm:grid-cols-[40px_120px_1fr_64px_24px] items-center gap-1">
                                            {/* 1. 규격 badge (잔량=노랑) */}
                                            <Badge variant="secondary" className={`w-full justify-center px-0 py-0.5 rounded text-[11px] ${o.packageType === PKG_REMAINDER ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' : 'bg-stone-100 text-stone-600 hover:bg-stone-100'}`}>
                                                {o.packageType}
                                            </Badge>

                                            {/* 2. 포장지 — 잔량=—, 톤백=고정, 그 외 드롭다운(기본 자동) */}
                                            {o.packageType === PKG_TONBAG ? (
                                                <span className="text-[11px] text-stone-400 pl-0.5 truncate">포장지: 톤백</span>
                                            ) : o.packageType === PKG_REMAINDER ? (
                                                <span className="text-[11px] text-stone-300 pl-0.5">—</span>
                                            ) : isClosed || !canManage ? (
                                                <span className="text-[11px] text-stone-400 truncate">
                                                    {packagings.find(p => p.id === o.packagingId)?.name ?? '미지정'}
                                                </span>
                                            ) : (
                                                <select
                                                    value={o.packagingId ?? ''}
                                                    onChange={(e) => setPackaging(i, e.target.value ? Number(e.target.value) : null)}
                                                    className="h-7 w-full min-w-0 truncate rounded-md border border-stone-200 bg-white pl-2 pr-5 text-[11px] text-stone-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
                                                    style={{
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a8a29e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: 'right 5px center',
                                                    }}
                                                >
                                                    <option value="">포장지 미지정</option>
                                                    {packagings.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {/* 3. 수량 stepper (입력 동작 유지) */}
                                            {isClosed || !canManage ? (
                                                <span className="text-[12px] font-mono font-bold text-stone-700 text-center">{o.count}</span>
                                            ) : (
                                                <div className="flex items-center justify-center">
                                                    <Button variant="ghost" size="icon" className="h-[22px] w-[22px] shrink-0 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full" onClick={() => updateCount(i, -1)}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        data-count-index={i}
                                                        value={o.count === 0 ? '' : o.count}
                                                        onChange={(e) => setCount(i, parseInt(e.target.value))}
                                                        onFocus={(e) => e.target.select()}
                                                        className="w-11 h-6 text-center text-[12px] font-bold bg-transparent border-none shadow-none font-mono px-0"
                                                    />
                                                    <Button variant="ghost" size="icon" className="h-[22px] w-[22px] shrink-0 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full" onClick={() => updateCount(i, 1)}>
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}

                                            {/* 4. 중량 */}
                                            <div className="flex items-center gap-0.5 justify-end">
                                                {(o.packageType === '톤백' || o.packageType === '잔량') ? (
                                                    isClosed || !canManage ? (
                                                        <span className="text-[12px] font-bold text-stone-700 whitespace-nowrap">{o.weightPerUnit.toLocaleString()}<span className="text-[9px] text-stone-400 ml-px">kg</span></span>
                                                    ) : (
                                                        <>
                                                            <Input
                                                                type="number"
                                                                data-weight-index={i}
                                                                value={o.weightPerUnit}
                                                                onChange={(e) => setWeight(i, parseFloat(e.target.value))}
                                                                onFocus={(e) => e.target.select()}
                                                                className="h-6 w-11 text-right text-[11px] border-stone-200 rounded px-1"
                                                            />
                                                            <span className="text-[9px] text-stone-400">kg</span>
                                                        </>
                                                    )
                                                ) : (
                                                    <span className="text-[12px] font-bold text-stone-700 whitespace-nowrap">{(o.weightPerUnit * o.count).toLocaleString()}<span className="text-[9px] text-stone-400 ml-px">kg</span></span>
                                                )}
                                            </div>

                                            {/* 5. 삭제 */}
                                            {!isClosed && canManage ? (
                                                <Button variant="ghost" size="icon" className="h-[22px] w-[22px] mx-auto text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-full" onClick={() => removePackage(i)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            ) : <div />}
                                          </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 그룹 소계 (다중일 때만) */}
                                {isMultiGroup && groupOutputs.length > 0 && (
                                    <div className="flex justify-end px-3 py-1.5 bg-stone-50 border-t border-stone-100">
                                        <span className="text-[12px] text-stone-500">
                                            소계 <span className={`font-bold ${groupTotal > expectedKg ? 'text-amber-600' : 'text-stone-700'}`}>
                                                {groupTotal.toLocaleString()}
                                            </span>
                                            <span className="text-stone-400"> / {expectedKg.toLocaleString()} kg</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                {canManage && (
                    <div className="pt-3 border-t space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="text-[13px] font-medium">
                                총 포장:{' '}
                                <span className="font-bold text-[15px] sm:text-lg">
                                    {outputs.reduce((sum, o) => sum + o.totalWeight, 0).toLocaleString()} kg
                                </span>
                            </div>
                            {/* 저장 버튼은 화면에도 서버에도 아무것도 없을 때만 막는다 —
                                화면만 비었다면 「전부 지우겠다」는 뜻이라 저장이 열려 있어야 한다.
                                (예전엔 화면이 비면 무조건 막혀 마지막 한 줄을 지울 방법이 없었다) */}
                            {isClosed ? (
                                <Button variant="outline" onClick={handleReopenAndOpen} disabled={isLoading}>
                                    <Lock className="mr-1 h-3 w-3" /> 마감 해제
                                </Button>
                            ) : (
                                <Button onClick={handleSubmit} disabled={writeBlocked || (outputs.length === 0 && serverOutputs.length === 0)}>
                                    {isLoading ? '저장 중...' : outputsLoading ? '불러오는 중...' : '기록 저장'}
                                </Button>
                            )}
                        </div>

                        {!isClosed && (
                            <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-auto p-0 px-2 py-1 text-[12px] font-semibold"
                                    disabled={writeBlocked}
                                    onClick={handleCloseBatch}
                                >
                                    <Lock className="mr-1 h-3 w-3" /> 작업 마감
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-auto p-0 px-2 py-1 ml-auto text-[12px] font-semibold"
                                    disabled={writeBlocked || serverOutputs.length === 0}
                                    onClick={handleClearPackaging}
                                >
                                    <Trash2 className="mr-1 h-3 w-3" /> 포장 초기화
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
