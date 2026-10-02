import { ChevronDown } from 'lucide-react'

/**
 * 「나머지 N곳 더 보기」 — 통계 합계 표(판매·재고)가 상위 20줄만 보일 때 표·모바일 목록 아래에 둔다.
 * `unit`은 세는 말(곳·명·종). 원장(수율 표)은 페이지/「20건 더 보기」라 이걸 쓰지 않는다
 */
export function ShowAllRow({ hidden, onShowAll, unit = '곳' }: { hidden: number; onShowAll: () => void; unit?: string }) {
  if (hidden <= 0) return null
  return (
    <button
      type="button"
      onClick={onShowAll}
      className="w-full h-11 flex items-center justify-center gap-1 border-t border-slate-100 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    >
      나머지 {hidden.toLocaleString('ko-KR')}{unit} 더 보기
      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
    </button>
  )
}
