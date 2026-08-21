'use client'

// 발주서 묶음 목록 — 묶음 = 시트 1장(#30). 채널 필터칩 + 테이블.
// 시안 `docs/handoff/발주서판매처리/엑셀업로드-2단계-데스크탑.html` 묶음 목록 프레임.
// 행 클릭은 매트릭스(D2) 연결 전까지 비활성 — 커서·호버 배경도 두지 않는다.

import { useState } from 'react'
import { Package, MessageSquareText } from 'lucide-react'
import { CHANNEL_META, PURCHASE_CHANNELS } from '@/lib/purchase-channel'
import { UploadRowMenu } from './upload-row-menu'
import type { UploadSummaryRow } from '@/app/actions/purchase-order'
import type { PurchaseChannel } from '@prisma/client'

const GRID = 'grid grid-cols-[92px_minmax(0,1fr)_56px_44px] sm:grid-cols-[104px_minmax(0,1fr)_60px_216px_84px_112px_40px] items-center gap-2 px-3'

export function UploadTable({ rows }: { rows: UploadSummaryRow[] }) {
    const [channel, setChannel] = useState<PurchaseChannel | 'ALL'>('ALL')
    const filtered = channel === 'ALL' ? rows : rows.filter((r) => r.channel === channel)
    const usedChannels = PURCHASE_CHANNELS.filter((c) => rows.some((r) => r.channel === c))

    return (
        <div className="flex flex-col gap-3">
            {usedChannels.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Chip active={channel === 'ALL'} onClick={() => setChannel('ALL')}>
                        전체 {rows.length}
                    </Chip>
                    {usedChannels.map((c) => (
                        <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>
                            {CHANNEL_META[c].label} {rows.filter((r) => r.channel === c).length}
                        </Chip>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div
                    className={`${GRID} bg-slate-50 border-b border-slate-200 text-[11.5px] font-bold text-slate-400 py-2.5`}
                >
                    <div>채널</div>
                    <div>시트명</div>
                    <div className="text-right">수령처</div>
                    <div className="hidden sm:block">진행</div>
                    <div className="hidden sm:block">매칭실패</div>
                    <div className="hidden sm:block">업로드</div>
                    <div />
                </div>

                {filtered.map((r) => (
                    <div key={r.id} className="border-b border-slate-100 last:border-b-0">
                        <div className={`${GRID} py-2.5`}>
                            <div>
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${CHANNEL_META[r.channel].badge}`}
                                >
                                    {CHANNEL_META[r.channel].label}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13.5px] font-bold text-slate-900 truncate">{r.sheetName}</p>
                                <p className="text-[10.5px] text-slate-400 truncate">{r.fileName}</p>
                            </div>
                            <div className="text-right text-[13px] text-slate-700">{r.orderCount}</div>
                            <div className="hidden sm:flex items-center gap-1 flex-wrap">
                                <ProgressBadges row={r} />
                            </div>
                            <div className="hidden sm:block">
                                {r.unmatched > 0 ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10.5px] font-bold border border-red-200">
                                        {r.unmatched}
                                    </span>
                                ) : (
                                    <span className="text-[12px] text-slate-300">—</span>
                                )}
                            </div>
                            <div className="hidden sm:block text-[12px] text-slate-500">{r.createdAt}</div>
                            <div className="flex justify-center">
                                <UploadRowMenu row={r} />
                            </div>
                        </div>

                        {/* 모바일에서 접힌 컬럼 요약 + 비고 */}
                        <div className="sm:hidden px-3 pb-2.5 flex items-center gap-1.5 flex-wrap">
                            <ProgressBadges row={r} />
                            {r.unmatched > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10.5px] font-bold border border-red-200">
                                    매칭실패 {r.unmatched}
                                </span>
                            )}
                            <span className="text-[11px] text-slate-400">{r.createdAt}</span>
                        </div>

                        {r.note && (
                            <div className="px-3 pb-2.5 flex items-start gap-1.5">
                                <MessageSquareText className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-px" />
                                <p className="text-[11.5px] text-slate-500 whitespace-pre-wrap">{r.note}</p>
                            </div>
                        )}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                            <Package className="w-6 h-6 text-slate-400" strokeWidth={1.8} />
                        </div>
                        <p className="text-sm text-slate-500">
                            {rows.length === 0
                                ? '아직 올린 발주서가 없어요. 발주서 등록으로 시작해 보세요.'
                                : '이 채널의 묶음이 없어요.'}
                        </p>
                    </div>
                )}
            </div>

            <p className="text-[11.5px] text-slate-400 px-1">
                묶음 1건 = 시트 1장 · 매트릭스 차감 화면은 다음 단계에서 연결됩니다.
            </p>
        </div>
    )
}

function ProgressBadges({ row }: { row: UploadSummaryRow }) {
    const { pending, partial, completed } = row.statusCount
    const total = pending + partial + completed
    if (total > 0 && completed === total) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-bold">
                전체 완료
            </span>
        )
    }
    return (
        <>
            {completed > 0 && <Badge tone="emerald">완료 {completed}</Badge>}
            {partial > 0 && <Badge tone="amber">부분 {partial}</Badge>}
            {pending > 0 && <Badge tone="slate">대기 {pending}</Badge>}
        </>
    )
}

const TONE = {
    emerald: 'bg-emerald-50 text-emerald-700 [&>span]:bg-emerald-500',
    amber: 'bg-amber-50 text-amber-700 [&>span]:bg-amber-500',
    slate: 'bg-slate-100 text-slate-500 [&>span]:bg-slate-400',
} as const

function Badge({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold ${TONE[tone]}`}
        >
            <span className="w-1.5 h-1.5 rounded-full" />
            {children}
        </span>
    )
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`h-8 px-3 rounded-full text-[12.5px] font-semibold transition-colors ${
                active
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
        >
            {children}
        </button>
    )
}
