'use client'

import { useState, useEffect } from 'react'
import { createNotice, updateNotice } from '@/app/actions/notice'
import { triggerDataUpdate } from '@/components/last-updated'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { X, Megaphone } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface Notice {
    id: number
    title: string
    content: string
    isActive: boolean
}

interface NoticeDialogProps {
    notice?: Notice | null
    open: boolean
    onClose: () => void
}

export function NoticeDialog({ notice, open, onClose }: NoticeDialogProps) {
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setTitle(notice?.title || '')
            setContent(notice?.content || '')
            setIsActive(notice?.isActive ?? true)
        }
    }, [open, notice])

    if (!open) return null

    const handleSave = async () => {
        if (!title.trim()) return toast.error('공지 제목을 입력해주세요.')
        if (!content.trim()) return toast.error('공지 내용을 입력해주세요.')

        setLoading(true)
        try {
            let result
            if (notice) {
                result = await updateNotice(notice.id, { title, content, isActive })
            } else {
                result = await createNotice({ title, content, isActive })
            }

            if (result.success) {
                triggerDataUpdate()
                toast.success(notice ? '공지가 수정되었습니다.' : '공지가 등록되었습니다.')
                onClose()
            } else {
                toast.error('저장에 실패했습니다.')
            }
        } catch {
            toast.error('오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-[#ea580c]" />
                    <h2 className="text-lg font-bold text-slate-900">
                        {notice ? '공지사항 수정' : '새 공지 작성'}
                    </h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="전광판에 노출될 짧은 제목"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c] focus:border-transparent transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">상세 내용</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="사용자가 팝업을 열었을 때 볼 상세 내용"
                            rows={5}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c] focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                            <p className="text-sm font-bold text-slate-800">대시보드 노출 상태</p>
                            <p className="text-[11px] text-slate-500">활성화 시 전광판에 즉시 표시됩니다.</p>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                        취소
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={loading} className="bg-[#ea580c] hover:bg-[#c2410c] text-white">
                        {loading ? '저장 중...' : '저장'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
