'use client'

// 묶음 목록 행의 ⋮ 메뉴 — 엑셀 다운로드(D5) / 비고 수정 / 묶음 삭제(차감 있으면 비활성).
// 시안 `docs/handoff/발주서판매처리/엑셀업로드-2단계-데스크탑.html` 묶음 목록 프레임.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Download, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { updateUploadNote } from '@/app/actions/purchase-order-upload'
import { deletePurchaseUpload, type UploadSummaryRow } from '@/app/actions/purchase-order'
import { exportPurchaseSheet } from '@/app/actions/purchase-order-export'

const NOTE_MAX = 500

/** `canManage`가 없으면 엑셀 다운로드만 남는다(백로그 §60 — 비고·삭제는 서버가 `OPERATION_MANAGE`로 막는다) */
export function UploadRowMenu({ row, canManage }: { row: UploadSummaryRow; canManage: boolean }) {
    const router = useRouter()
    const [noteOpen, setNoteOpen] = useState(false)
    const [note, setNote] = useState(row.note ?? '')
    const [saving, setSaving] = useState(false)
    const [exporting, setExporting] = useState(false)

    const handleSaveNote = async () => {
        setSaving(true)
        const res = await updateUploadNote(row.id, note.trim() === '' ? null : note.trim())
        setSaving(false)
        if (!res.success) {
            toast.error(res.error)
            return
        }
        toast.success('비고를 저장했어요.')
        setNoteOpen(false)
        router.refresh()
    }

    // 다운로드 방식은 제품재고 엑셀(`package-excel-buttons.tsx`)과 같다 — base64를 받아 링크로 저장
    const handleExport = async () => {
        // 메뉴는 누르는 즉시 닫힌다 — 조회 1~2초 동안 진행 표시는 토스트가 맡는다
        setExporting(true)
        const loading = toast.loading('엑셀 만드는 중…')
        const res = await exportPurchaseSheet(row.id)
        toast.dismiss(loading)
        setExporting(false)
        if (!res.success) {
            toast.error(res.error)
            return
        }
        const link = document.createElement('a')
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.data}`
        link.download = res.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleDelete = async () => {
        const ok = await confirmDialog({
            title: '시트 삭제',
            description: `${row.sheetName} 시트와 그 안의 발주 건·품목을 모두 삭제할까요?\n되돌릴 수 없어요.`,
            confirmText: '삭제',
            destructive: true,
        })
        if (!ok) return

        const res = await deletePurchaseUpload(row.id)
        if (!res.success) {
            toast.error(res.error)
            return
        }
        toast.success('시트를 삭제했어요.')
        router.refresh()
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                        <span className="sr-only">시트 메뉴</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                        disabled={exporting}
                        onClick={handleExport}
                        className="gap-2 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        엑셀 다운로드
                    </DropdownMenuItem>
                    {canManage && (
                        <>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setNoteOpen(true)}>
                                <Pencil className="w-3.5 h-3.5" />
                                비고 수정
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={!row.deletable}
                                onClick={handleDelete}
                                className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                시트 삭제
                            </DropdownMenuItem>
                            {!row.deletable && (
                                <p className="px-2 pt-1 pb-1.5 text-[10.5px] text-slate-400 leading-snug">
                                    차감된 품목이 있어 삭제할 수 없어요
                                </p>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>비고 수정</DialogTitle>
                        <DialogDescription>
                            {row.sheetName} — 보관 요청·여유 물량·배차 등 사람이 알아둘 점을 남겨요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <textarea
                            rows={4}
                            maxLength={NOTE_MAX}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="예) 신정동 40포는 창고 보관분에서 출고 — 신규 발주 아님"
                            className="w-full px-3 py-2.5 text-[13px] text-slate-700 placeholder:text-slate-300 resize-none focus:outline-none"
                        />
                        <div className="flex items-center justify-end px-3 py-1 bg-slate-50 border-t border-slate-100">
                            <span className="text-[10.5px] text-slate-400">
                                {note.length} / {NOTE_MAX}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setNoteOpen(false)} disabled={saving}>
                            취소
                        </Button>
                        <Button onClick={handleSaveNote} disabled={saving}>
                            {saving ? '저장 중…' : '저장'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
