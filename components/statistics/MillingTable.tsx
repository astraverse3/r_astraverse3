'use client'

import React, { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { TableRow, StockDetail, OutputDetail } from '@/app/actions/statistics'

type Props = {
  data: TableRow[]
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="w-3 h-3" />
  if (sorted === 'desc') return <ChevronDown className="w-3 h-3" />
  return <ChevronsUpDown className="w-3 h-3 opacity-40" />
}

// ── 투입 목록 팝업 ────────────────────────────────
function StockPopup({ row, onClose }: { row: TableRow; onClose: () => void }) {
  const total = row.stockDetails.reduce((s, d) => s + d.weightKg, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-800">투입 목록</h3>
            <p className="text-xs text-slate-400 mt-0.5">{row.date} · {row.millingType}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">생산자</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">품종</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">중량 (kg)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">톤백 번호</th>
              </tr>
            </thead>
            <tbody>
              {row.stockDetails.map((s, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{s.farmerName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{s.varietyName}</td>
                  <td className="px-4 py-2.5 text-right text-blue-600 font-medium">
                    {s.weightKg.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-400">#{s.bagNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-400">{row.stockDetails.length}건</span>
          <span className="text-sm font-bold text-blue-600">
            합계 {total.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kg
          </span>
        </div>
      </div>
    </div>
  )
}

// ── 포장 내역 팝업 ────────────────────────────────
function OutputPopup({ row, onClose }: { row: TableRow; onClose: () => void }) {
  const total = row.outputDetails.reduce((s, d) => s + d.totalWeight, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-800">포장 내역</h3>
            <p className="text-xs text-slate-400 mt-0.5">{row.date} · {row.millingType}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">포장형태</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">단위(kg)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">수량</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">합계(kg)</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">로트번호</th>
              </tr>
            </thead>
            <tbody>
              {row.outputDetails.map((o, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{o.packageType}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{o.weightPerUnit}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{o.count}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">
                    {o.totalWeight.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{o.lotNo ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-400">{row.outputDetails.length}건</span>
          <span className="text-sm font-bold text-emerald-600">
            합계 {total.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kg
          </span>
        </div>
      </div>
    </div>
  )
}

// ── 메인 테이블 ───────────────────────────────────
export function MillingTable({ data }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [inputPopup, setInputPopup] = useState<TableRow | null>(null)
  const [outputPopup, setOutputPopup] = useState<TableRow | null>(null)

  const columns = useMemo<ColumnDef<TableRow>[]>(() => [
    {
      accessorKey: 'date',
      header: '날짜',
      cell: info => <span className="text-slate-600">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'millingType',
      header: '도정종류',
      cell: info => (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'varieties',
      header: '품종',
      cell: info => <span className="text-slate-500 text-xs">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'farmers',
      header: '생산자',
      cell: info => <span className="text-slate-500 text-xs">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'inputKg',
      header: '투입량 (kg)',
      cell: info => {
        const row = info.row.original
        return (
          <button
            onClick={e => { e.stopPropagation(); setInputPopup(row) }}
            className="font-medium text-blue-600 underline decoration-dotted underline-offset-2 hover:text-blue-800 transition-colors"
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
            className="font-medium text-emerald-600 underline decoration-dotted underline-offset-2 hover:text-emerald-800 transition-colors"
          >
            {(info.getValue() as number).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
          </button>
        )
      },
    },
    {
      accessorKey: 'yieldRate',
      header: '수율 (%)',
      cell: info => {
        const val = info.getValue() as number
        const color = val >= 68 ? 'text-emerald-600' : val >= 60 ? 'text-amber-600' : 'text-red-500'
        return <span className={`font-bold ${color}`}>{val.toFixed(1)}%</span>
      },
    },
    {
      accessorKey: 'remarks',
      header: '비고',
      cell: info => <span className="text-slate-400 text-xs">{(info.getValue() as string | null) ?? '-'}</span>,
    },
  ], [])

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
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">도정 상세 내역</h3>
          <p className="text-xs text-slate-400 mt-0.5">총 {data.length}건</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="bg-slate-50">
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon sorted={header.column.getIsSorted()} />
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-slate-400 text-sm">
                    조회된 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="px-5 py-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
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
              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-700">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 팝업 */}
      {inputPopup && <StockPopup row={inputPopup} onClose={() => setInputPopup(null)} />}
      {outputPopup && <OutputPopup row={outputPopup} onClose={() => setOutputPopup(null)} />}
    </>
  )
}
