'use client'

// 업로드 2단계 모달의 시트 행 — 표 한 줄 + 체크했을 때 펼쳐지는 배송·비고 블록.
// 시안 `docs/handoff/발주서판매처리/배송상차정보-시안.html`(배송 블록) ·
//      `docs/handoff/발주서판매처리/엑셀업로드-2단계-데스크탑.html`(시트 표)
//
// `upload-dialog.tsx`가 500줄을 넘겨 분리했다(계획서 plan-배송상차정보.md §5).

import { AlertTriangle, Check, Truck } from 'lucide-react'
import { CHANNEL_META, PURCHASE_CHANNELS } from '@/lib/purchase-channel'
import type { SheetPreview, ShippingVendorOption } from '@/app/actions/purchase-order-upload'
import type { PurchaseChannel } from '@prisma/client'

export const NOTE_MAX = 500

export type TimeSlot = 'UNKNOWN' | 'AM' | 'PM' | 'EXACT'

/** 시트별 사용자 입력 — 체크 여부 + 확정할 채널·발주일·배송·비고 */
export type SheetDraft = {
    checked: boolean
    channel: PurchaseChannel | ''
    orderDate: string // 'yyyy-mm-dd' 또는 ''
    note: string
    // 배송·상차 — 전부 비워도 등록된다(결정 #37)
    shippingVendorId: number | ''
    /** 사용자가 배송업체를 직접 고른 적이 있는가. 그 뒤로는 채널을 바꿔도 건드리지 않는다 */
    vendorTouched: boolean
    loadingDate: string
    loadingTimeSlot: TimeSlot
    loadingTime: string // 'HH:mm' — slot이 EXACT일 때만
}

const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
    UNKNOWN: '시간 미정',
    AM: '오전',
    PM: '오후',
    EXACT: '직접 입력',
}

export function SheetRow({
    sheet,
    draft,
    selectable,
    vendors,
    onPatch,
}: {
    sheet: SheetPreview
    draft: SheetDraft
    selectable: boolean
    vendors: ShippingVendorOption[]
    onPatch: (next: Partial<SheetDraft>) => void
}) {
    const noChannel = draft.checked && draft.channel === ''
    return (
        <div
            className={`border-b border-slate-100 last:border-b-0 ${
                !selectable ? 'bg-slate-50/70' : draft.checked ? 'bg-blue-50/40' : ''
            }`}
        >
            <div className="grid grid-cols-[34px_minmax(0,1fr)] sm:grid-cols-[34px_minmax(0,1fr)_132px_128px_74px_minmax(0,180px)] items-center gap-2 py-2.5 px-2">
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        className="w-4 h-4 accent-blue-600 disabled:opacity-40"
                        checked={draft.checked}
                        disabled={!selectable}
                        onChange={(e) => onPatch({ checked: e.target.checked })}
                    />
                </div>
                <div className="min-w-0">
                    <p
                        className={`text-[13px] font-bold truncate ${
                            selectable ? 'text-slate-900' : 'text-slate-400'
                        }`}
                    >
                        {sheet.sheetName}
                    </p>
                    {/* 모바일에서는 컬럼이 접히므로 요약을 한 줄로 */}
                    <p className="sm:hidden text-[11px] text-slate-400">
                        {sheet.recognized
                            ? `${sheet.orderCount}건 / ${sheet.itemCount}라인`
                            : sheet.reason}
                    </p>
                </div>

                <div className="col-start-2 sm:col-start-auto">
                    {sheet.recognized ? (
                        <select
                            value={draft.channel}
                            disabled={!selectable}
                            onChange={(e) => onPatch({ channel: e.target.value as PurchaseChannel | '' })}
                            className={`w-full h-8 rounded-md border px-2 text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:text-slate-300 ${
                                draft.channel === ''
                                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                                    : 'border-slate-300 bg-white text-slate-700'
                            }`}
                        >
                            <option value="">채널 선택</option>
                            {PURCHASE_CHANNELS.map((c) => (
                                <option key={c} value={c}>
                                    {CHANNEL_META[c].label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-[12px] text-slate-300">—</span>
                    )}
                </div>

                <div className="col-start-2 sm:col-start-auto">
                    {sheet.recognized ? (
                        <input
                            type="date"
                            value={draft.orderDate}
                            disabled={!selectable}
                            onChange={(e) => onPatch({ orderDate: e.target.value })}
                            className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:text-slate-300"
                        />
                    ) : (
                        <span className="text-[12px] text-slate-300">—</span>
                    )}
                </div>

                <div className="hidden sm:block text-right text-[12.5px] text-slate-700">
                    {sheet.recognized ? `${sheet.orderCount} / ${sheet.itemCount}` : '—'}
                </div>

                <div className="col-start-2 sm:col-start-auto flex flex-wrap gap-1">
                    {sheet.alreadyUploaded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 text-[10.5px] font-bold">
                            <Check className="w-3 h-3" />
                            이미 적재됨
                        </span>
                    ) : !sheet.recognized ? (
                        <span className="hidden sm:inline text-[11px] text-slate-400 leading-tight">
                            {sheet.reason}
                        </span>
                    ) : noChannel ? (
                        <Warn>시트명에서 채널을 못 찾음 — 직접 선택</Warn>
                    ) : sheet.warnings.length > 0 ? (
                        sheet.warnings.map((w, i) => <Warn key={i}>{w}</Warn>)
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
                            <Check className="w-3 h-3" />
                            이상 없음
                        </span>
                    )}
                </div>
            </div>

            {draft.checked && (
                <div className="pl-2 sm:pl-[42px] pr-2 pb-3 space-y-2.5">
                    <ShippingBlock draft={draft} vendors={vendors} onPatch={onPatch} />

                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <textarea
                            rows={2}
                            maxLength={NOTE_MAX}
                            value={draft.note}
                            onChange={(e) => onPatch({ note: e.target.value })}
                            placeholder="비고 — 보관 요청·여유 물량·배차 등 사람이 알아둘 점"
                            className="w-full px-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none"
                        />
                        <div className="flex items-center justify-between px-3 py-1 bg-slate-50 border-t border-slate-100">
                            <span className="text-[10.5px] text-slate-400">이 묶음에 그대로 저장됩니다</span>
                            <span className="text-[10.5px] text-slate-400">
                                {draft.note.length} / {NOTE_MAX}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * 배송·상차 블록 — 배송업체 · 상차일 · 상차 시각.
 * 시각은 「시간 미정」이 기본이다(결정 #37 — 날짜는 알아도 시각은 대개 미정).
 */
function ShippingBlock({
    draft,
    vendors,
    onPatch,
}: {
    draft: SheetDraft
    vendors: ShippingVendorOption[]
    onPatch: (next: Partial<SheetDraft>) => void
}) {
    // 추천으로 채워진 값은 파란 테두리로 구분한다 — 사람이 고른 값과 구분돼야 손댈지 판단할 수 있다
    const autoFilled = draft.shippingVendorId !== '' && !draft.vendorTouched

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-[190px]">
                    <Field label="배송업체" hint={autoFilled ? '최근 이력에서 자동' : undefined} />
                    <div className="relative">
                        <Truck
                            className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                                autoFilled ? 'text-blue-600' : 'text-slate-400'
                            }`}
                        />
                        <select
                            value={draft.shippingVendorId}
                            onChange={(e) =>
                                onPatch({
                                    shippingVendorId: e.target.value === '' ? '' : Number(e.target.value),
                                    vendorTouched: true,
                                })
                            }
                            className={`w-full h-8 rounded-md border pl-7 pr-2 text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                                autoFilled
                                    ? 'border-blue-400 bg-blue-50/40 text-blue-800'
                                    : 'border-slate-300 bg-white text-slate-700'
                            }`}
                        >
                            <option value="">미지정</option>
                            {vendors.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="w-[150px]">
                    <Field label="상차일" />
                    <input
                        type="date"
                        value={draft.loadingDate}
                        onChange={(e) => onPatch({ loadingDate: e.target.value })}
                        className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </div>

                <div className="flex-1 min-w-[220px]">
                    <Field label="상차 시각" hint="몰라도 됩니다" />
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {(Object.keys(TIME_SLOT_LABEL) as TimeSlot[]).map((slot) => (
                            <button
                                key={slot}
                                type="button"
                                onClick={() => onPatch({ loadingTimeSlot: slot })}
                                className={`h-8 px-2.5 rounded-md border text-[11.5px] font-semibold transition-colors ${
                                    draft.loadingTimeSlot === slot
                                        ? 'border-slate-800 bg-slate-800 text-white'
                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                {TIME_SLOT_LABEL[slot]}
                            </button>
                        ))}
                        {draft.loadingTimeSlot === 'EXACT' && (
                            <input
                                type="time"
                                value={draft.loadingTime}
                                onChange={(e) => onPatch({ loadingTime: e.target.value })}
                                className="h-8 w-[104px] rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                        )}
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
                상차일은 비워도 등록됩니다 — 목록에 <b className="text-amber-700">배차 미정</b>으로 남고,
                나중에 그 자리에서 채우면 돼요.
            </p>
        </div>
    )
}

function Field({ label, hint }: { label: string; hint?: string }) {
    return (
        <span className="block text-[10.5px] font-bold text-slate-400 mb-1">
            {label}
            {hint && <span className="font-medium text-slate-300 ml-1">— {hint}</span>}
        </span>
    )
}

export function Warn({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10.5px] font-semibold">
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            {children}
        </span>
    )
}
