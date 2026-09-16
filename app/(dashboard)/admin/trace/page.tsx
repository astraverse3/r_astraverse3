import { TraceView } from './trace-view'

export const metadata = {
    title: '네비게이션 덫 | MILL LOG',
}

/** 🔴 임시 계측 화면. 원인 확정 후 제거 — `docs/plan/plan-네비게이션-덫.md` §7. */
export default function AdminTracePage() {
    return (
        <div className="space-y-3 px-1.5 sm:px-0 pb-8 sm:pb-0">
            <TraceView />
        </div>
    )
}
