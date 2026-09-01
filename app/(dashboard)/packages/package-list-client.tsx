'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, PackageMinus, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PackageItem, PackageRow as PackageRowData } from '@/app/actions/packages'
import {
    PackageColumnHeader,
    PackageGroupRow,
    PackageSingleRow,
    type PackageRowActions,
    type PackageSelection,
} from './package-row'
import {
    MobilePackageGroupCard,
    MobilePackageSingleCard,
} from './mobile-package-card'
import { RepackDialog } from './repack-dialog'
import { DeductDialog } from './deduct-dialog'

/** 선택 모드 — 재포장·차감이 같은 체크박스 인프라를 나눠 쓴다 (계획서 D4). */
export type PackageSelectMode = 'repack' | 'deduct' | null

interface Props {
    items: PackageItem[]
    emptyMessage?: string
    emptyHint?: string
    /** 행 액션 콜백 — 미전달 시 메뉴 안 보임 (벼 탭은 이력만 전달, 잡곡 탭은 전부 전달) */
    onEditRow?: (row: PackageRowData) => void
    onDeleteRow?: (row: PackageRowData) => void
    /** 차감 이력 다이얼로그 열기 — 차감 이력이 있는 행에만 메뉴가 붙는다 (D6) */
    onHistoryRow?: (row: PackageRowData) => void
    /** 선택 모드 — 토글 버튼은 패널 상단 액션 라인(검색 버튼 옆)에 있다 */
    mode?: PackageSelectMode
    /** 재포장·차감이 끝나거나 취소될 때 패널의 mode를 내린다 */
    onExitSelectMode?: () => void
}

/** 재포장 동질성 키 (결정 #43 §3.2) — 품종·도정유형·출처가 같아야 함께 재포장할 수 있다. */
const identityKey = (row: PackageRowData): string =>
    `${row.varietyId}|${row.millingType}|${row.source}`

/**
 * 제품재고 목록 — 데스크톱 테이블 + 모바일 카드 통합 클라이언트.
 *  - 그룹 펼침 상태는 varietyId 기준 Set으로 관리
 *  - 빈 상태 메시지/힌트는 props로 주입 (벼/잡곡 패널이 컨텍스트 다르게 줌)
 *  - 재포장 선택 상태도 여기 한 곳에서만 관리하고 하위는 prop만 받는다 (결정 #43 R2)
 */
export function PackageListClient({
    items,
    emptyMessage,
    emptyHint,
    onEditRow,
    onDeleteRow,
    onHistoryRow,
    mode = null,
    onExitSelectMode,
}: Props) {
    const router = useRouter()
    const selectMode = mode !== null
    // 선택 모드에서도 그룹은 접힌 채로 시작한다 — 품종이 많아 전부 펼치면
    // 오히려 찾기 어렵다. 필요한 그룹만 펼쳐서 고른다.
    const [openGroups, setOpenGroups] = useState<Set<number>>(new Set())
    const actions: PackageRowActions | undefined =
        onEditRow || onDeleteRow || onHistoryRow
            ? { onEdit: onEditRow, onDelete: onDeleteRow, onHistory: onHistoryRow }
            : undefined

    // -- 재포장·차감 선택 --
    const [selected, setSelected] = useState<Map<number, PackageRowData>>(new Map())
    const [dialogOpen, setDialogOpen] = useState(false)

    // 모드가 바뀌면 골라둔 것을 비운다. effect도 리마운트 key도 쓰지 않는다 —
    // effect는 lint(set-state-in-effect)에 걸리고, key로 리마운트하면 펼쳐둔 그룹까지 닫힌다.
    // React 공식 "prop이 바뀔 때 state 조정" 패턴(렌더 중 setState).
    const [lastMode, setLastMode] = useState(mode)
    if (lastMode !== mode) {
        setLastMode(mode)
        setSelected(new Map())
    }

    // 먼저 고른 행이 기준이 된다. 아직 아무것도 안 골랐으면 전부 고를 수 있다.
    // 동질성 제약은 **재포장 전용** — 차감은 아무 행이나 함께 고를 수 있다 (D4).
    const anchorKey = useMemo(() => {
        if (mode !== 'repack') return null
        const first = selected.values().next()
        return first.done ? null : identityKey(first.value)
    }, [mode, selected])

    // 선택 바에 표시할 동질성 기준 라벨 — 지금은 왜 다른 행이 안 눌리는지 툴팁을 봐야 안다
    const anchorLabel = useMemo(() => {
        if (mode !== 'repack') return null
        const first = selected.values().next()
        if (first.done) return null
        const r = first.value
        return [r.variety, r.millingTypeLabel, r.source === 'PURCHASED' ? '매입' : '도정산']
            .filter(v => v && v !== '—')
            .join(' · ')
    }, [mode, selected])

    const selection: PackageSelection | undefined = selectMode
        ? {
              selectedIds: new Set(selected.keys()),
              onToggleRow: row =>
                  setSelected(prev => {
                      const next = new Map(prev)
                      if (next.has(row.id)) next.delete(row.id)
                      else next.set(row.id, row)
                      return next
                  }),
              // 차감 완료 행(가용 0)은 두 모드 모두 금지 — 뺄 것도 나눌 것도 없다.
              isDisabled: row =>
                  row.available <= 0 ||
                  (anchorKey !== null && identityKey(row) !== anchorKey && !selected.has(row.id)),
              disabledReason:
                  mode === 'repack'
                      ? '품종·도정유형·출처가 같은 재고끼리만 함께 재포장할 수 있어요.'
                      : '이미 전량 차감된 재고예요.',
          }
        : undefined

    const toggle = (varietyId: number) => {
        setOpenGroups(prev => {
            const next = new Set(prev)
            if (next.has(varietyId)) next.delete(varietyId)
            else next.add(varietyId)
            return next
        })
    }

    if (items.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm text-slate-600">
                    {emptyMessage ?? '아직 등록된 제품재고가 없어요.'}
                </p>
                {emptyHint && <p className="text-xs text-slate-400">{emptyHint}</p>}
            </div>
        )
    }

    const selectedRows = Array.from(selected.values())
    // 전량 소진 기준 최대치 — 실제로 몇 개를 쓸지는 다이얼로그에서 정한다
    const maxKg = selectedRows.reduce((s, r) => s + r.weightPerUnit * r.available, 0)
    const maxCount = selectedRows.reduce((s, r) => s + r.available, 0)

    return (
        <>
            {selectMode && (
                <p className="px-1 text-[11.5px] text-slate-500">
                    {mode === 'repack'
                        ? '합칠·나눌 재고를 고르세요. 품종·도정유형·출처가 같아야 해요.'
                        : '재고에서 뺄 항목을 고르세요. 사유와 발생일은 다음 단계에서 정합니다.'}
                </p>
            )}

            {/* 모바일 카드 리스트 */}
            <section className="sm:hidden flex flex-col gap-2 px-1">
                {items.map(item =>
                    item.type === 'group' ? (
                        <MobilePackageGroupCard
                            key={`g-${item.varietyId}`}
                            item={item}
                            isOpen={openGroups.has(item.varietyId)}
                            onToggle={() => toggle(item.varietyId)}
                            actions={actions}
                            selection={selection}
                        />
                    ) : (
                        <MobilePackageSingleCard
                            key={`s-${item.id}`}
                            item={item}
                            actions={actions}
                            selection={selection}
                        />
                    ),
                )}
            </section>

            {/* 데스크톱 테이블 */}
            <section className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <PackageColumnHeader selectMode={selectMode} />
                <div className="divide-y divide-slate-100">
                    {items.map(item =>
                        item.type === 'group' ? (
                            <PackageGroupRow
                                key={`g-${item.varietyId}`}
                                item={item}
                                isOpen={openGroups.has(item.varietyId)}
                                onToggle={() => toggle(item.varietyId)}
                                actions={actions}
                                selection={selection}
                            />
                        ) : (
                            <PackageSingleRow
                                key={`s-${item.id}`}
                                item={item}
                                actions={actions}
                                selection={selection}
                            />
                        ),
                    )}
                </div>
            </section>

            {/* 선택 바 — 데스크톱: 목록 아래 sticky 전폭 바.
                fixed 중앙 정렬은 사이드바 256px을 포함한 윈도우 전체 폭 기준이라 콘텐츠 중앙과
                128px 어긋나고 마지막 행을 덮는다. sticky는 콘텐츠 열 안이라 정렬 계산이 없다.
                ⚠️ 조상에 overflow-hidden이 있으면 sticky가 죽는다 — 테이블 <section> 밖에 둘 것 */}
            {selectMode && selected.size > 0 && (
                <div className="hidden sm:flex sticky bottom-4 z-40 justify-end">
                    <div className="flex w-fit items-center gap-3 rounded-xl border border-primary/25 bg-white px-4 py-2.5 shadow-[0_-2px_12px_rgba(15,23,42,.07),0_6px_18px_rgba(15,23,42,.08)]">
                        <div className="flex items-baseline gap-2.5">
                            <span className="text-[13px] text-slate-700">
                                <b className="text-slate-900">{selected.size}건</b> 선택
                            </span>
                            <span className="text-slate-200">|</span>
                            {mode === 'repack' ? (
                                <span className="text-[12.5px] text-slate-500">
                                    최대{' '}
                                    <b className="tabular-nums text-slate-800">
                                        {maxKg.toLocaleString()}kg
                                    </b>
                                </span>
                            ) : (
                                <span className="text-[12.5px] text-slate-500">
                                    <b className="tabular-nums text-slate-800">
                                        {maxCount.toLocaleString()}개
                                    </b>{' '}
                                    · 총{' '}
                                    <span className="tabular-nums">
                                        {maxKg.toLocaleString()}kg
                                    </span>
                                </span>
                            )}
                            {anchorLabel && (
                                <span className="text-[11.5px] text-slate-400">{anchorLabel}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-slate-500"
                                onClick={() => setSelected(new Map())}
                            >
                                선택 해제
                            </Button>
                            <Button size="sm" className="h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                                {mode === 'repack' ? (
                                    <PackageOpen className="h-3.5 w-3.5" />
                                ) : (
                                    <PackageMinus className="h-3.5 w-3.5" />
                                )}
                                {mode === 'repack' ? '재포장하기' : '차감하기'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 모바일: 하단 탭바 위 floating pill */}
            {selectMode && selected.size > 0 && (
                <div className="sm:hidden fixed inset-x-0 bottom-16 z-40 px-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
                        <span className="text-[12.5px] text-slate-600">
                            <b className="text-slate-900">{selected.size}건</b> 선택 ·{' '}
                            {mode === 'repack' ? (
                                <span className="tabular-nums">최대 {maxKg.toLocaleString()}kg</span>
                            ) : (
                                <span className="tabular-nums">{maxCount.toLocaleString()}개</span>
                            )}
                        </span>
                        <Button size="sm" className="h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                            {mode === 'repack' ? (
                                <PackageOpen className="h-3.5 w-3.5" />
                            ) : (
                                <PackageMinus className="h-3.5 w-3.5" />
                            )}
                            {mode === 'repack' ? '재포장하기' : '차감하기'}
                        </Button>
                    </div>
                </div>
            )}

            {mode === 'deduct' ? (
                <DeductDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    rows={selectedRows}
                    onDone={() => {
                        setDialogOpen(false)
                        setSelected(new Map())
                        onExitSelectMode?.()
                        router.refresh()
                    }}
                />
            ) : (
                <RepackDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    packageIds={selectedRows.map(r => r.id)}
                    onDone={() => {
                        setDialogOpen(false)
                        setSelected(new Map())
                        onExitSelectMode?.()
                        router.refresh()
                    }}
                />
            )}
        </>
    )
}
