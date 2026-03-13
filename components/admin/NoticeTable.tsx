'use client'

import { useState } from 'react'
import { NoticeDialog } from './NoticeDialog'
import { NoticeViewDialog } from './NoticeViewDialog'
import { deleteNotice, updateNotice } from '@/app/actions/notice'
import { triggerDataUpdate } from '@/components/last-updated'
import { Pencil, Trash2, Plus, Megaphone, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

interface Notice {
    id: number
    title: string
    content: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    author?: { name: string | null } | null
}

export function NoticeTable({ notices }: { notices: Notice[] }) {
    const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
    const [viewingNotice, setViewingNotice] = useState<Notice | null>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    const handleDelete = async (notice: Notice) => {
        if (!confirm(`정말로 이 공지를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return

        const result = await deleteNotice(notice.id)
        if (result.success) {
            triggerDataUpdate()
            toast.success('공지가 삭제되었습니다.')
        } else {
            toast.error('삭제에 실패했습니다.')
        }
    }

    const handleToggleActive = async (notice: Notice, currentActive: boolean) => {
        const result = await updateNotice(notice.id, { isActive: !currentActive })
        if (result.success) {
            triggerDataUpdate()
            toast.success(currentActive ? '공지가 비활성화되었습니다.' : '공지가 활성화되었습니다.')
        } else {
            toast.error('상태 변경에 실패했습니다.')
        }
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        })
    }

    return (
        <>
            <div className="flex items-center justify-between mb-3 px-1 sm:px-0">
                <span className="text-[13px] font-bold text-[#00a2e8]">총 {notices.length}건</span>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
                    aria-label="새 공지 작성"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">새 공지 작성</span>
                </button>
            </div>

            {/* 모바일 카드 뷰 */}
            <div className="block lg:hidden space-y-3">
                {notices.map((notice) => (
                    <div key={notice.id} className={`bg-white rounded-xl border overflow-hidden transition-colors ${notice.isActive ? 'border-[#fed7aa]' : 'border-slate-200'}`}>
                        {/* Header: 활성화 토글, 날짜, 액션 */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={notice.isActive}
                                    onCheckedChange={() => handleToggleActive(notice, notice.isActive)}
                                />
                                <span className={`text-[11px] font-bold ${notice.isActive ? 'text-[#ea580c]' : 'text-slate-400'}`}>
                                    {notice.isActive ? '표시됨' : '숨김'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-slate-400">{formatDate(notice.createdAt)}</span>
                                <div className="flex items-center gap-0.5">
                                    <button onClick={() => setEditingNotice(notice)} className="p-1.5 text-slate-400 hover:text-[#00a2e8] transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(notice)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Title & Content */}
                        <div className="px-3 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                            onClick={() => setViewingNotice({
                                ...notice,
                                authorName: notice.author?.name
                            } as any)}
                        >
                            <div className="flex gap-2 items-start mb-1.5">
                                {notice.isActive && <Megaphone className="w-4 h-4 text-[#ea580c] shrink-0 mt-[2px]" />}
                                <h3 className={`font-bold text-sm ${notice.isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                                    {notice.title}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed ml={notice.isActive ? '6' : '0'}">
                                {notice.content}
                            </p>
                        </div>
                    </div>
                ))}

                {notices.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                        등록된 공지사항이 없습니다.
                    </div>
                )}
            </div>

            {/* 데스크톱 테이블 뷰 */}
            <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="text-center px-4 py-3 w-20">상태</th>
                            <th className="text-left px-5 py-3 border-l border-slate-100">제목 및 내용</th>
                            <th className="text-center px-5 py-3 w-32 border-l border-slate-100 text-slate-500">작성자</th>
                            <th className="text-center px-5 py-3 w-40 border-l border-slate-100">작성일</th>
                            <th className="text-center px-4 py-3 w-24 border-l border-slate-100">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {notices.map((notice) => (
                            <tr key={notice.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3.5 text-center">
                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                        <Switch
                                            checked={notice.isActive}
                                            onCheckedChange={() => handleToggleActive(notice, notice.isActive)}
                                        />
                                        <span className={`text-[10px] font-bold ${notice.isActive ? 'text-[#ea580c]' : 'text-slate-400'}`}>
                                            {notice.isActive ? '표시됨' : '숨김'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 border-l border-slate-100 cursor-pointer group/cell hover:bg-slate-50/80 transition-colors"
                                    onClick={() => setViewingNotice({
                                        ...notice,
                                        authorName: notice.author?.name
                                    } as any)}
                                >
                                    <div className="flex items-start gap-2 max-w-xl">
                                        {notice.isActive && <Megaphone className="w-4 h-4 text-[#ea580c] shrink-0 mt-0.5" />}
                                        <div className="flex flex-col gap-1 w-full overflow-hidden">
                                            <p className={`font-bold text-sm ${notice.isActive ? 'text-slate-900' : 'text-slate-600'} group-hover/cell:text-[#00a2e8] transition-colors truncate`}>
                                                {notice.title}
                                            </p>
                                            <p className="text-[13px] text-slate-500 truncate">
                                                {notice.content}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 border-l border-slate-100">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                                            <UserIcon className="w-3 h-3 text-slate-400" />
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-700 truncate max-w-[80px]">
                                            {notice.author?.name || '-'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-400 text-center border-l border-slate-100 whitespace-nowrap">
                                    {formatDate(notice.createdAt)}
                                </td>
                                <td className="px-4 py-3.5 border-l border-slate-100">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => setEditingNotice(notice)}
                                            title="수정"
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#00a2e8] transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(notice)}
                                            title="삭제"
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {notices.length === 0 && (
                    <div className="text-center py-16 text-slate-400 text-sm">
                        등록된 공지사항이 없습니다.
                    </div>
                )}
            </div>

            {/* 공지사항 생성/수정 대화상자 */}
            <NoticeDialog
                notice={editingNotice}
                open={isCreateOpen || !!editingNotice}
                onClose={() => {
                    setIsCreateOpen(false)
                    setEditingNotice(null)
                }}
            />

            {/* 공지사항 상세 보기 대화상자 */}
            <NoticeViewDialog
                notice={viewingNotice}
                open={!!viewingNotice}
                onClose={() => setViewingNotice(null)}
            />
        </>
    )
}
