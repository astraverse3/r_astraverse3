// 상태 표기 — 라벨과 색 (M1-2)
//
// 🔴 **판정은 여기 없다.** 상태를 정하는 건 `lib/purchase-order-matrix.ts`의 `cellStatusOf`
// 하나고, 심각도 순서는 `ROW_STATUS_ORDER`가 갖는다. 이 파일은 그 결과를 사람에게 보여줄
// 라벨과 색만 든다.
//
// 🔴 **매트릭스 행 · 건상세 줄 · 건목록 행이 같은 표를 쓴다.** 화면마다 색을 다시 고르면
// 같은 상태가 화면마다 달라 보인다 — 판정을 한 벌로 합쳐 놓고 표기를 세 벌로 두면
// 사용자에게는 결국 세 벌이다.

import type { CellStatus } from '@/lib/purchase-order-matrix'

export type StatusMeta = {
    label: string
    /** 점·범례 사각형 배경 */
    dot: string
    /** 라벨 글자색 */
    text: string
    /** 배지(글자+배경 한 벌) */
    badge: string
    /** 카드 테두리+배경 — 건상세 라인 카드가 쓴다 */
    card: string
}

export const STATUS_META: Record<CellStatus, StatusMeta> = {
    UNMATCHED: {
        label: '매칭실패',
        dot: 'bg-red-500',
        text: 'text-red-600',
        badge: 'bg-red-50 text-red-600',
        card: 'border-red-200 bg-red-50/50',
    },
    SHORTAGE: {
        label: '재고부족',
        dot: 'bg-orange-500',
        text: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-800',
        card: 'border-orange-200 bg-orange-50/50',
    },
    PARTIAL: {
        label: '부분',
        dot: 'bg-amber-500',
        text: 'text-amber-700',
        badge: 'bg-amber-50 text-amber-700',
        card: 'border-slate-200 bg-card',
    },
    PENDING: {
        label: '대기',
        dot: 'bg-slate-400',
        text: 'text-slate-500',
        badge: 'bg-slate-100 text-slate-500',
        card: 'border-slate-200 bg-card',
    },
    COMPLETED: {
        label: '완료',
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
        badge: 'bg-emerald-50 text-emerald-700',
        card: 'border-emerald-100 bg-emerald-50/40',
    },
}

/** 수량 글자색 — 건목록 우측 `차감/주문`이 쓴다(핸드오프 §3.1) */
export const QTY_TONE: Record<CellStatus, string> = {
    UNMATCHED: 'text-red-600',
    SHORTAGE: 'text-orange-700',
    PARTIAL: 'text-amber-700',
    PENDING: 'text-slate-500',
    COMPLETED: 'text-emerald-700',
}
