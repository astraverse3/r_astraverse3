interface SectionLoaderProps {
    /** 주 메시지 (예: '재고를 불러오는 중') */
    message?: string
    /** 보조 안내 문구 */
    description?: string
}

/**
 * 페이지/섹션 Suspense fallback용 브랜드 스피너.
 * 액션 처리 중 전체화면 오버레이가 필요하면 FullScreenLoader를 사용한다.
 */
export function SectionLoader({
    message = '불러오는 중',
    description = '잠시만 기다려 주세요',
}: SectionLoaderProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-[360px]">
            <div className="relative h-11 w-11" role="status" aria-label={message}>
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
                <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin motion-reduce:animate-none" />
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{message}</p>
                <p className="mt-1 text-xs text-slate-400">{description}</p>
            </div>
        </div>
    )
}
