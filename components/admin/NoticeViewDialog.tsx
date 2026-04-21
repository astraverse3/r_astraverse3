'use client'

import { Megaphone, X, User as UserIcon, List, ArrowLeft, Inbox } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Notice {
    id: number | string
    title: string
    content: string
    createdAt: Date | string
    authorName?: string | null
}

interface NoticeViewDialogProps {
    notice: Notice | null
    notices?: Notice[] // 전체 목록 (있으면 목록 모드 활성화)
    open: boolean
    onClose: () => void
}

type ViewMode = 'detail' | 'list'

export function NoticeViewDialog({ notice, notices, open, onClose }: NoticeViewDialogProps) {
    const [mode, setMode] = useState<ViewMode>('detail')
    const [selected, setSelected] = useState<Notice | null>(notice)

    // 팝업이 새로 열릴 때마다 상세 모드 + 전달받은 공지로 초기화
    useEffect(() => {
        if (open) {
            setMode('detail')
            setSelected(notice)
        }
    }, [open, notice])

    if (!open) return null

    const hasList = Array.isArray(notices) && notices.length > 0
    const current = selected ?? notice

    const openListMode = () => setMode('list')
    const openDetail = (n: Notice) => {
        setSelected(n)
        setMode('detail')
    }

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

                {mode === 'detail' && current && (
                    <>
                        <div className="flex items-center gap-2 mb-4 pr-6 shrink-0">
                            <Megaphone className="w-5 h-5 text-[#ea580c] shrink-0" />
                            <h2 className="text-lg font-bold text-slate-900 break-words line-clamp-2">
                                {current.title}
                            </h2>
                        </div>

                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap overflow-y-auto mb-6 px-1 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                            {current.content}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0 px-1 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                {current.authorName && (
                                    <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm shrink-0">
                                        <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                                            <UserIcon className="w-2.5 h-2.5 text-slate-500" />
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-700 leading-none">
                                            {current.authorName}
                                        </span>
                                    </div>
                                )}
                                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                                    {new Date(current.createdAt).toLocaleDateString('ko-KR')} 등록
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {hasList && (
                                    <button
                                        onClick={openListMode}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#fed7aa] hover:bg-[#fff7ed] text-[#c2410c] rounded-lg text-xs font-bold transition-all shadow-sm"
                                    >
                                        <List className="w-3.5 h-3.5" />
                                        <span>전체 목록</span>
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {mode === 'list' && hasList && (
                    <>
                        <div className="flex items-center gap-2 mb-4 pr-6 shrink-0">
                            <Megaphone className="w-5 h-5 text-[#ea580c] shrink-0" />
                            <h2 className="text-lg font-bold text-slate-900">
                                공지사항 <span className="text-sm font-semibold text-slate-400 ml-1">({notices!.length})</span>
                            </h2>
                        </div>

                        <div className="flex flex-col gap-2 overflow-y-auto mb-4 -mx-1 px-1 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                            {notices!.map((n) => {
                                const isActive = current?.id === n.id
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => openDetail(n)}
                                        className={`text-left p-3 rounded-lg border transition-all ${
                                            isActive
                                                ? 'border-[#fed7aa] bg-[#fff7ed] ring-1 ring-[#fed7aa]'
                                                : 'border-slate-200 bg-white hover:border-[#fed7aa] hover:bg-[#fffaf5]'
                                        }`}
                                    >
                                        <div className="font-bold text-[13px] text-slate-900 line-clamp-1 mb-1">
                                            {n.title}
                                        </div>
                                        <div className="text-[11px] text-slate-500 line-clamp-2 mb-1.5">
                                            {n.content}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                            {n.authorName && (
                                                <span className="font-medium">{n.authorName}</span>
                                            )}
                                            <span>{new Date(n.createdAt).toLocaleDateString('ko-KR')}</span>
                                        </div>
                                    </button>
                                )
                            })}
                            {notices!.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <Inbox className="w-8 h-8 mb-2" />
                                    <span className="text-sm">등록된 공지사항이 없습니다</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0 px-1">
                            <button
                                onClick={() => setMode('detail')}
                                disabled={!current}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>상세로</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all shadow-sm"
                            >
                                닫기
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
