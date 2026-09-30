'use client'

// 포장 다이얼로그 하단 바 — 3상태: 편집 / 마감됨 / 조회 전용 (백로그 §87 T3 · 작업지시 ④ C5 · ⑤ P6)
//
// 🔴 **표시만 한다.** 막는 조건(`disabled`)과 핸들러는 전부 다이얼로그가 계산해 넘긴다 — 여기서 새로 판단하지 말 것.
// 모바일·PC 모두 한 줄이다(모바일은 문구를 줄이고 총 포장을 두 줄로 쌓는다 — ④ C5 / PC는 문구 그대로 — ⑤ P6). CSS로 가르니 버튼이 DOM에 두 벌 있다.

import { Button } from '@/components/ui/button'
import { Lock, Trash2 } from 'lucide-react'

type Props = {
    canManage: boolean
    isClosed: boolean
    totalKg: number
    isLoading: boolean
    outputsLoading: boolean
    saveDisabled: boolean
    closeDisabled: boolean
    clearDisabled: boolean
    onSave: () => void
    onClose: () => void
    onClear: () => void
    onReopen: () => void
}

export function PackagingFooter(p: Props) {
    const saving = p.isLoading ? '저장 중...' : p.outputsLoading ? '불러오는 중...' : null

    return (
        <>
            {/* 모바일 — 한 줄. 넘치면 초기화를 아이콘만 남긴다(글자 축소 금지, 작업지시 ④ C5) */}
            <div className="sm:hidden pt-2.5 border-t flex items-center gap-2">
                <div className="min-w-0 mr-auto">
                    <div className="text-[11px] leading-4 text-slate-500">총 포장</div>
                    <div className="text-base leading-5 font-mono font-bold tabular-nums text-slate-900 truncate">
                        {p.totalKg.toLocaleString()}<span className="ml-0.5 font-sans text-[12px] font-normal text-slate-500">kg</span>
                    </div>
                </div>
                {!p.canManage ? (
                    <span className="text-[12px] text-slate-500 shrink-0">조회 전용</span>
                ) : p.isClosed ? (
                    <Button variant="outline" className="h-11 shrink-0 border-slate-300 text-slate-800" onClick={p.onReopen} disabled={p.isLoading}>
                        <Lock className="size-3.5" /> 마감 해제
                    </Button>
                ) : (
                    <>
                        {/* 테두리 없는 글자 버튼 — 누르면 confirm이 한 번 더 막는다 */}
                        <Button type="button" variant="ghost" className="h-10 shrink-0 gap-1 px-2 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                            disabled={p.clearDisabled} onClick={p.onClear}>
                            <Trash2 className="size-[13px]" /> 초기화
                        </Button>
                        <Button type="button" variant="outline" className="h-10 shrink-0 gap-1 px-3 text-[13px] font-semibold border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-800"
                            disabled={p.closeDisabled} onClick={p.onClose}>
                            <Lock className="size-[13px]" /> 마감
                        </Button>
                        <Button className="h-10 shrink-0 px-4 text-sm font-semibold" onClick={p.onSave} disabled={p.saveDisabled}>
                            {saving ?? '저장'}
                        </Button>
                    </>
                )}
            </div>

            {/* PC — 한 줄, 문구는 줄이지 않는다(작업지시 ⑤ P6). 초기화와 저장 사이에 마감이 끼어 둘이 떨어져 있다 */}
            <div className="hidden sm:flex pt-4 border-t items-center gap-2">
                <div className="mr-auto whitespace-nowrap text-[13px] text-slate-600">
                    총 포장
                    <b className="ml-1 font-mono text-lg tabular-nums text-slate-900">{p.totalKg.toLocaleString()}</b>
                    <span className="ml-0.5 text-slate-500">kg</span>
                </div>
                {!p.canManage ? (
                    <span className="text-[12px] text-slate-500">조회 전용</span>
                ) : p.isClosed ? (
                    <Button variant="outline" className="h-9 gap-1.5 px-4 text-sm font-semibold border-slate-300 text-slate-800" onClick={p.onReopen} disabled={p.isLoading}>
                        <Lock className="size-[13px]" /> 마감 해제
                    </Button>
                ) : (
                    <>
                        <Button type="button" variant="ghost" className="h-9 gap-1.5 px-3 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                            disabled={p.clearDisabled} onClick={p.onClear}>
                            <Trash2 className="size-[13px]" /> 포장 초기화
                        </Button>
                        <Button type="button" variant="outline" className="h-9 gap-1.5 px-3 text-[13px] font-semibold border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-800"
                            disabled={p.closeDisabled} onClick={p.onClose}>
                            <Lock className="size-[13px]" /> 작업 마감
                        </Button>
                        <Button className="h-9 px-4 text-sm font-semibold" onClick={p.onSave} disabled={p.saveDisabled}>
                            {saving ?? '기록 저장'}
                        </Button>
                    </>
                )}
            </div>
        </>
    )
}
