import { Inbox } from 'lucide-react'

/**
 * 목록 빈 상태 공용 컴포넌트. (디자인 시스템 §5.3 빈 상태 + §7 친근체 카피)
 * 벼/잡곡/도정 목록에서 공유한다.
 *  - filtered=true: 검색·필터 결과 없음 (공통 카피)
 *  - filtered=false: 데이터 자체 없음 (emptyText로 도메인별 카피)
 */
export function EmptyState({ filtered, emptyText }: { filtered: boolean; emptyText: string }) {
    return (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-600">
                {filtered ? '조건에 맞는 결과가 없어요. 필터를 바꿔보세요.' : emptyText}
            </p>
        </div>
    )
}
