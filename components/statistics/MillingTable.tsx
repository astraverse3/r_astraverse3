'use client'

import React, { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as UiTableRow } from '@/components/ui/table'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MillingStockListDialog } from '@/app/(dashboard)/milling/stock-list-dialog'
import type { TableRow, OutputDetail } from '@/app/actions/statistics'
import { getYieldLevel, YIELD_BADGE_CLASS } from '@/lib/milling-yield'
import {
  STAT_HEAD,
  STAT_HEAD_ROW,
  STAT_LINK,
  STAT_TABLE,
  STAT_TABLE_CARD,
} from './table-styles'
import { useYieldRates } from '@/app/(dashboard)/yield-rates-context'

type Props = {
  data: TableRow[]
}

// 정렬 아이콘 — 쉬는 칸 slate-400, 정렬 중인 칸은 머리글과 같이 slate-800(작업지시 ⑫ C-8)
function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="w-3 h-3 text-slate-800" />
  if (sorted === 'desc') return <ChevronDown className="w-3 h-3 text-slate-800" />
  return <ChevronsUpDown className="w-3 h-3 text-slate-400" />
}

/** 숫자 칸 — 머리글·칸 모두 오른쪽 정렬(작업지시 ⑫ C-6) */
const RIGHT_COLUMNS = new Set(['inputKg', 'outputKg', 'yieldRate'])

// ── 포장 내역 팝업 (AddPackagingDialog 읽기전용 레이아웃 동일 적용) ──
function PackagingPopup({ row, onClose }: { row: TableRow; onClose: () => void }) {
  const total = row.outputDetails.reduce((s, d) => s + d.totalWeight, 0)

  // 로트번호(또는 관행 farmerName) 기준으로 그룹핑
  type Group = { key: string; farmerName: string | null; varietyName: string | null; lotNo: string | null; isConventional: boolean; items: OutputDetail[] }
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const o of row.outputDetails) {
      const key = o.isConventional ? `관행-${o.farmerName}` : (o.lotNo ?? 'none')
      if (!map.has(key)) {
        map.set(key, { key, farmerName: o.farmerName, varietyName: o.varietyName, lotNo: o.lotNo, isConventional: o.isConventional, items: [] })
      }
      map.get(key)!.items.push(o)
    }
    return Array.from(map.values())
  }, [row.outputDetails])

  const isMultiGroup = groups.length > 1

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>포장 기록 관리</DialogTitle>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary/20 text-primary">
              {row.millingType}
            </span>
            <span className="text-[13px] font-bold text-slate-700">
              총 투입: {row.inputKg.toLocaleString()}kg
            </span>
          </div>
        </DialogHeader>

        {/* 그룹 목록 */}
        <div className="py-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {groups.map(group => {
            const groupTotal = group.items.reduce((s, o) => s + o.totalWeight, 0)
            return (
              <div key={group.key} className={`rounded-xl border overflow-hidden ${isMultiGroup ? 'border-stone-200' : 'border-transparent'}`}>
                {/* 그룹 헤더 */}
                {(isMultiGroup || group.farmerName) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border-b border-stone-100">
                    <span className="text-[12px] font-bold text-stone-700 shrink-0">{group.farmerName ?? '-'}</span>
                    {group.varietyName && (
                      <span className="text-stone-400 text-[11px]">{group.varietyName}</span>
                    )}
                    {group.isConventional ? (
                      <span className="font-mono text-[11px] text-stone-400 bg-white border border-stone-200 rounded px-1.5 py-0.5 shrink-0">관행</span>
                    ) : group.lotNo ? (
                      <span
                        title={group.farmerName ?? ''}
                        className="font-mono text-[11px] text-stone-500 bg-white border border-stone-200 rounded px-1.5 py-0.5 shrink-0 cursor-default"
                      >
                        {group.lotNo}
                      </span>
                    ) : null}
                  </div>
                )}

                {/* 패키지 목록 */}
                <div className="divide-y divide-stone-100">
                  {group.items.length === 0 && (
                    <div className="text-center text-[12px] text-stone-300 py-4">포장 내역 없음</div>
                  )}
                  {group.items.map((o, i) => (
                    <div key={i} className="grid grid-cols-[52px_1fr_92px] items-center gap-1 px-3 py-1.5">
                      {/* 규격 badge */}
                      <Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-100 px-1.5 py-0 rounded text-[11px] justify-center">
                        {o.packageType}
                      </Badge>
                      {/* 수량 */}
                      <span className="text-[12px] font-mono font-bold text-stone-600 text-center">{o.count}개</span>
                      {/* 중량 */}
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-[13px] font-bold text-stone-600">
                          {(o.packageType === '톤백' || o.packageType === '잔량')
                            ? o.weightPerUnit.toLocaleString()
                            : (o.weightPerUnit * o.count).toLocaleString()
                          } kg
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* 소계 (그룹이 여러 개일 때만) */}
                  {isMultiGroup && (
                    <div className="flex justify-end items-center gap-1.5 px-3 py-1.5 bg-stone-50/70">
                      <span className="text-[11px] text-stone-400">소계</span>
                      <span className="text-[12px] font-bold text-stone-600">{groupTotal.toLocaleString()} kg</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 푸터 */}
        <div className="pt-3 border-t flex justify-between items-center">
          <div className="text-[13px] text-slate-500">
            총 <span className="font-bold text-slate-900">{row.outputDetails.length}</span>건
          </div>
          <div className="text-[13px] text-slate-500">
            합계{' '}
            <span className="text-xl font-black text-slate-900 ml-1">
              {total.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
            </span>
            {' '}<span className="text-[13px] font-medium text-slate-500">kg</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── 생산자 요약 표시 ──────────────────────────────
function farmersSummary(farmers: string): string {
  const list = farmers.split(', ').map(s => s.trim()).filter(Boolean)
  if (list.length > 1) return `${list[0]} 외 ${list.length - 1}명`
  return list[0] ?? '-'
}

// ── 메인 테이블 ───────────────────────────────────
export function MillingTable({ data }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [inputPopup, setInputPopup] = useState<TableRow | null>(null)
  const [outputPopup, setOutputPopup] = useState<TableRow | null>(null)

  const yieldRates = useYieldRates()

  const columns = useMemo<ColumnDef<TableRow>[]>(() => [
    {
      accessorKey: 'date',
      header: '날짜',
      cell: info => <span className="text-slate-600 font-mono text-xs tabular-nums">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'millingType',
      header: '도정종류',
      cell: info => (
        <Badge variant="outline" className="text-[11px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5 font-bold">
          {info.getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'varieties',
      header: '품종',
      cell: info => <span className="text-slate-800">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'farmers',
      header: '생산자',
      cell: info => {
        const val = info.getValue() as string
        return (
          <span className="text-slate-600 text-xs" title={val}>
            {farmersSummary(val)}
          </span>
        )
      },
    },
    {
      accessorKey: 'inputKg',
      header: '투입량 (kg)',
      cell: info => {
        const row = info.row.original
        return (
          <button
            onClick={e => { e.stopPropagation(); setInputPopup(row) }}
            className={`tabular-nums text-slate-600 ${STAT_LINK}`}
          >
            {(info.getValue() as number).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
          </button>
        )
      },
    },
    {
      accessorKey: 'outputKg',
      header: '생산량 (kg)',
      cell: info => {
        const row = info.row.original
        return (
          <button
            onClick={e => { e.stopPropagation(); setOutputPopup(row) }}
            className={`tabular-nums font-semibold text-slate-800 ${STAT_LINK}`}
          >
            {(info.getValue() as number) > 0
              ? (info.getValue() as number).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
              : <span className="text-slate-400 no-underline">-</span>
            }
          </button>
        )
      },
    },
    {
      accessorKey: 'yieldRate',
      header: '수율 (%)',
      cell: info => {
        const val = info.getValue() as number
        return val > 0 ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            YIELD_BADGE_CLASS[getYieldLevel(val, info.row.original.millingType, yieldRates, info.row.original.stockDetails?.[0]?.varietyType)]
          }`}>
            {Math.round(val)}%
          </span>
        ) : <span className="text-slate-300">-</span>
      },
    },
    {
      accessorKey: 'remarks',
      header: '비고',
      cell: info => (
        <span className="text-slate-500 text-xs line-clamp-1">
          {(info.getValue() as string | null) ?? '-'}
        </span>
      ),
    },
  ], [yieldRates])

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table — React Compiler 미사용이라 해당 없음
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <>
      <div className={STAT_TABLE_CARD}>
        {/* 카드 머리 — 이 표는 위 탭과 따로 돈다(탭은 차트만 바꾼다). 판매·재고 표엔 없다(작업지시 ⑫ C-2) */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-baseline gap-2">
          <h3 className="text-[13px] font-semibold text-slate-800">도정 상세 내역</h3>
          <span className="text-xs text-slate-500 tabular-nums">{data.length.toLocaleString('ko-KR')}건</span>
        </div>

        <div className="overflow-x-auto">
          <Table className={STAT_TABLE}>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <UiTableRow key={hg.id} className={STAT_HEAD_ROW}>
                  {hg.headers.map(header => (
                    <TableHead
                      key={header.id}
                      className={`${STAT_HEAD} cursor-pointer select-none ${RIGHT_COLUMNS.has(header.column.id) ? 'text-right' : ''} ${
                        header.column.getIsSorted() ? 'text-slate-800' : ''
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={`flex items-center gap-1 ${RIGHT_COLUMNS.has(header.column.id) ? 'justify-end' : ''}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon sorted={header.column.getIsSorted()} />
                      </div>
                    </TableHead>
                  ))}
                </UiTableRow>
              ))}
            </TableHeader>
            <TableBody>
              {/* 비면 부모가 표를 숨긴다 — 「없다」는 차트 자리 한 곳에서만(백로그 §97) */}
              {table.getRowModel().rows.map(row => (
                <UiTableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className={RIGHT_COLUMNS.has(cell.column.id) ? 'text-right' : ''}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </UiTableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 페이지네이션 */}
        <div className="h-11 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 tabular-nums">
          <span>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              data.length
            )} / {data.length}건
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="이전 쪽"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-1 font-semibold text-slate-700">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="다음 쪽"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 투입 목록 팝업 — 도정관리 MillingStockListDialog 재사용 */}
      {inputPopup && (
        <MillingStockListDialog
          batchId={inputPopup.id}
          millingType={inputPopup.millingType}
          date={inputPopup.date}
          remarks={inputPopup.remarks}
          stocks={inputPopup.stockDetails.map(s => ({
            id: s.id,
            bagNo: s.bagNo,
            farmerName: s.farmerName,
            variety: { name: s.varietyName, type: s.varietyType },
            certType: s.certType,
            weightKg: s.weightKg,
          }))}
          varieties={inputPopup.varieties}
          canDelete={false}
          open={!!inputPopup}
          onOpenChange={open => !open && setInputPopup(null)}
        />
      )}

      {/* 포장 내역 팝업 */}
      {outputPopup && (
        <PackagingPopup
          row={outputPopup}
          onClose={() => setOutputPopup(null)}
        />
      )}
    </>
  )
}
