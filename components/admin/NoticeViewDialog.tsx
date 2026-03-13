'use client'

import { Megaphone, X, User as UserIcon } from 'lucide-react'

interface Notice {
    id: number | string
    title: string
    content: string
    createdAt: Date | string
    authorName?: string | null
}

interface NoticeViewDialogProps {
    notice: Notice | null
    open: boolean
    onClose: () => void
}

export function NoticeViewDialog({ notice, open, onClose }: NoticeViewDialogProps) {
    if (!open || !notice) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 mb-4 pr-6 shrink-0">
                    <Megaphone className="w-5 h-5 text-[#ea580c] shrink-0" />
                    <h2 className="text-lg font-bold text-slate-900 break-words line-clamp-2">
                        {notice.title}
                    </h2>
                </div>
                
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap overflow-y-auto mb-6 px-1 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    {notice.content}
                </div>
                
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0 px-1">
                    <div className="flex items-center gap-3">
                        {notice.authorName && (
                            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                                    <UserIcon className="w-2.5 h-2.5 text-slate-500" />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 leading-none">
                                    {notice.authorName}
                                </span>
                            </div>
                        )}
                        <span className="text-[11px] font-medium text-slate-400">
                            {new Date(notice.createdAt).toLocaleDateString('ko-KR')} 등록
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    )
}
