'use client'

// 엑셀 업로드 2단계 모달 (#31) — 시안 `docs/handoff/발주서판매처리/엑셀업로드-2단계-데스크탑.html`
//   1단계: 파일 선택 → previewPurchaseOrder(파싱만)
//   2단계: 시트 표에서 올릴 시트 체크 + 채널·발주일·비고 확정 → uploadPurchaseOrder
// 파싱 결과는 표시용일 뿐이고, 적재는 같은 파일을 다시 보내 서버가 재파싱한다(조작 방지).

import { useRef, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from '@/components/ui/dialog'
import { CHANNEL_META, PURCHASE_CHANNELS } from '@/lib/purchase-channel'
import {
    previewPurchaseOrder,
    uploadPurchaseOrder,
    type SheetPreview,
    type UploadSelection,
} from '@/app/actions/purchase-order-upload'
import type { PurchaseChannel } from '@prisma/client'

const NOTE_MAX = 500

/** 시트별 사용자 입력 — 체크 여부 + 확정할 채널·발주일·비고 */
type SheetDraft = {
    checked: boolean
    channel: PurchaseChannel | ''
    orderDate: string // 'yyyy-mm-dd' 또는 ''
    note: string
}

/**
 * 한 번에 한 장만 올리는 게 대부분이라, 발주일이 가장 늦은 시트 하나만 기본 체크한다.
 * 발주일은 시트명에서 뽑은 값이라 비어 있을 수 있고, 그때는 목록에서 뒤에 오는 시트를 최신으로 본다.
 * 채널을 못 뽑은 시트는 어차피 그대로는 등록할 수 없어 후보에서 뺀다.
 */
function buildDrafts(sheets: SheetPreview[]): Record<string, SheetDraft> {
    const candidates = sheets.filter(
        (s) => s.recognized && !s.alreadyUploaded && s.suggestedChannel !== null,
    )
    const latest = candidates.reduce<SheetPreview | null>(
        (best, s) => (best === null || (s.suggestedOrderDate ?? '') >= (best.suggestedOrderDate ?? '') ? s : best),
        null,
    )

    return Object.fromEntries(
        sheets.map((s) => [
            s.sheetName,
            {
                checked: s.sheetName === latest?.sheetName,
                channel: s.suggestedChannel ?? '',
                orderDate: s.suggestedOrderDate ?? '',
                note: '',
            },
        ]),
    )
}

export function UploadDialog() {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [sheets, setSheets] = useState<SheetPreview[] | null>(null)
    const [drafts, setDrafts] = useState<Record<string, SheetDraft>>({})
    const [busy, setBusy] = useState<'preview' | 'upload' | null>(null)

    const reset = () => {
        setFile(null)
        setSheets(null)
        setDrafts({})
        setBusy(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleOpenChange = (next: boolean) => {
        setOpen(next)
        if (!next) reset()
    }

    const runPreview = async (picked: File) => {
        setBusy('preview')
        const fd = new FormData()
        fd.append('file', picked)
        const res = await previewPurchaseOrder(fd)
        setBusy(null)

        if (!res.success) {
            toast.error(res.error)
            reset()
            return
        }
        setFile(picked)
        setSheets(res.sheets)
        setDrafts(buildDrafts(res.sheets))
    }

    const patch = (sheetName: string, next: Partial<SheetDraft>) =>
        setDrafts((prev) => ({ ...prev, [sheetName]: { ...prev[sheetName], ...next } }))

    const selectable = (s: SheetPreview) => s.recognized && !s.alreadyUploaded
    const checkedSheets = (sheets ?? []).filter((s) => drafts[s.sheetName]?.checked)
    const missingChannel = checkedSheets.filter((s) => drafts[s.sheetName].channel === '')
    const totalLines = checkedSheets.reduce((n, s) => n + s.itemCount, 0)
    const canSubmit = checkedSheets.length > 0 && missingChannel.length === 0 && busy === null

    const handleSubmit = async () => {
        if (!file || !canSubmit) return
        const selections: UploadSelection[] = checkedSheets.map((s) => {
            const d = drafts[s.sheetName]
            return {
                sheetName: s.sheetName,
                channel: d.channel as PurchaseChannel,
                orderDate: d.orderDate === '' ? null : d.orderDate,
                note: d.note.trim() === '' ? null : d.note.trim(),
            }
        })

        setBusy('upload')
        const fd = new FormData()
        fd.append('file', file)
        const res = await uploadPurchaseOrder(fd, selections)
        setBusy(null)

        if (!res.success) {
            toast.error('duplicate' in res ? res.message : res.error)
            return
        }
        const { bundleCount, orderCount, itemCount, failed } = res.summary
        toast.success(
            `묶음 ${bundleCount}건 등록 — 수령처 ${orderCount} · 라인 ${itemCount}` +
                (failed > 0 ? ` (매칭실패 ${failed})` : ''),
        )
        if (res.warnings.length > 0) {
            toast.warning(res.warnings.slice(0, 3).join('\n'), { duration: 8000 })
        }
        handleOpenChange(false)
        router.refresh()
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" className="px-2.5 sm:px-4">
                    <Upload className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">발주서 등록</span>
                </Button>
            </DialogTrigger>
            {/* 시트 선택 중 바깥을 클릭해 닫히면 채널·발주일 입력이 통째로 날아간다 — X·취소로만 닫는다 */}
            <DialogContent
                className={`flex flex-col overflow-hidden ${
                    sheets
                        ? 'sm:max-w-[880px] max-h-[calc(100dvh-4rem)]'
                        : 'sm:max-w-[560px]'
                }`}
                onInteractOutside={(e) => {
                    if (sheets) e.preventDefault()
                }}
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle>{sheets ? '올릴 시트 선택' : '발주서 등록'}</DialogTitle>
                    <DialogDescription>
                        {sheets
                            ? '체크한 시트마다 묶음 1건이 생성됩니다.'
                            : '시트 1개 = 묶음 1건 · 파일을 올리면 시트 목록을 보여드려요.'}
                    </DialogDescription>
                </DialogHeader>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                        const picked = e.target.files?.[0]
                        if (picked) void runPreview(picked)
                    }}
                />

                {!sheets ? (
                    <DropZone
                        busy={busy === 'preview'}
                        onPick={() => fileInputRef.current?.click()}
                        onFile={(picked) => void runPreview(picked)}
                    />
                ) : (
                    <>
                        <FileCard
                            file={file}
                            sheets={sheets}
                            onReselect={() => fileInputRef.current?.click()}
                        />
                        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200">
                            <div className="hidden sm:grid grid-cols-[34px_minmax(0,1fr)_132px_128px_74px_minmax(0,180px)] sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 py-2 px-2 gap-2">
                                <div />
                                <div>시트명</div>
                                <div>채널</div>
                                <div>발주일</div>
                                <div className="text-right">건 / 라인</div>
                                <div>확인 필요</div>
                            </div>
                            {sheets.map((s) => (
                                <SheetRow
                                    key={s.sheetName}
                                    sheet={s}
                                    draft={drafts[s.sheetName]}
                                    selectable={selectable(s)}
                                    onPatch={(next) => patch(s.sheetName, next)}
                                />
                            ))}
                        </div>
                        <p className="text-[11.5px] text-slate-400 leading-relaxed px-1 shrink-0">
                            회색 행은 체크할 수 없어요 — 미인식(발주서 양식 아님)이거나 이미 적재된 시트예요.
                            경고는 등록을 막지 않아요. 채널은 필수, 발주일은 비워도 등록됩니다.
                        </p>
                    </>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 shrink-0">
                    {sheets && (
                        <span className="text-[12px] text-slate-500">
                            {missingChannel.length > 0 ? (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    채널을 선택하지 않은 시트가 {missingChannel.length}개 있어요
                                </span>
                            ) : (
                                <>
                                    <b className="text-slate-900">{checkedSheets.length}</b>개 시트 → 묶음{' '}
                                    <b className="text-slate-900">{checkedSheets.length}</b>건 · 라인{' '}
                                    <b className="text-slate-900">{totalLines}</b>
                                </>
                            )}
                        </span>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => handleOpenChange(false)}
                        disabled={busy !== null}
                    >
                        취소
                    </Button>
                    {sheets && (
                        <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                            {busy === 'upload' ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4 mr-1.5" />
                            )}
                            {checkedSheets.length}건 등록
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DropZone({
    busy,
    onPick,
    onFile,
}: {
    busy: boolean
    onPick: () => void
    onFile: (file: File) => void
}) {
    const [dragging, setDragging] = useState(false)

    // 드롭 영역 밖에 떨어뜨리면 브라우저가 파일을 열어버리므로, 영역 안에서는 기본 동작을 막는다
    const accept = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
    }

    return (
        <div className="py-2">
            <div
                onDragOver={(e) => {
                    accept(e)
                    if (!busy) setDragging(true)
                }}
                onDragEnter={accept}
                onDragLeave={(e) => {
                    accept(e)
                    setDragging(false)
                }}
                onDrop={(e) => {
                    accept(e)
                    setDragging(false)
                    if (busy) return
                    const picked = e.dataTransfer.files?.[0]
                    if (picked) onFile(picked)
                }}
                className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 h-48 transition-colors ${
                    dragging ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60'
                }`}
            >
                {busy ? (
                    <>
                        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                        <p className="text-[13px] font-semibold text-slate-500">시트를 읽는 중…</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-300">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                            <p className="text-[13.5px] font-bold text-slate-700">발주서 엑셀 파일을 선택하세요</p>
                            <p className="text-[11.5px] text-slate-400 mt-1">
                                .xlsx · 여러 시트가 담긴 파일을 그대로 올리면 돼요
                            </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={onPick}>
                            파일 선택
                        </Button>
                    </>
                )}
            </div>
            <p className="text-[11.5px] text-slate-400 mt-3 leading-relaxed">
                다음 단계에서 <b>어느 시트를 올릴지</b> 고르고, 시트별로 채널·발주일·비고를 확정해요.
            </p>
        </div>
    )
}

function FileCard({
    file,
    sheets,
    onReselect,
}: {
    file: File | null
    sheets: SheetPreview[]
    onReselect: () => void
}) {
    const recognized = sheets.filter((s) => s.recognized).length
    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
            <div className="w-8 h-9 rounded bg-[#1d6f42] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                XLS
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">{file?.name}</p>
                <p className="text-[11px] text-slate-400">
                    {file ? `${Math.round(file.size / 1024).toLocaleString()} KB · ` : ''}
                    시트 {sheets.length}개 (인식 {recognized} · 제외 {sheets.length - recognized})
                </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0" onClick={onReselect}>
                다시 선택
            </Button>
        </div>
    )
}

function SheetRow({
    sheet,
    draft,
    selectable,
    onPatch,
}: {
    sheet: SheetPreview
    draft: SheetDraft
    selectable: boolean
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
                <div className="pl-[42px] pr-2 pb-3">
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

function Warn({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10.5px] font-semibold">
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            {children}
        </span>
    )
}

