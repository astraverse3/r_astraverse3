// 상태 표기 — 라벨과 색 (M1-2)
//
// 🔴 **판정은 여기 없다.** 상태를 정하는 건 `lib/purchase-order-matrix.ts`의 `cellStatusOf`
// 하나고, 심각도 순서는 `ROW_STATUS_ORDER`가 갖는다. 이 파일은 그 결과를 사람에게 보여줄
// 라벨과 색만 든다.
//
// 🔴 **매트릭스 행 · 건상세 줄 · 건목록 행이 같은 표를 쓴다.** 화면마다 색을 다시 고르면
// 같은 상태가 화면마다 달라 보인다 — 판정을 한 벌로 합쳐 놓고 표기를 세 벌로 두면
// 사용자에게는 결국 세 벌이다.

import type { CellStatus, MatrixSort } from '@/lib/purchase-order-matrix'

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

// ------------------------------------------------------
// 정렬 라벨 (2026-09-22 — 매트릭스와 건 목록이 갈려 있었다)
// ------------------------------------------------------

/**
 * 정렬 3종의 화면 라벨. **매트릭스 헤더와 모바일 건 목록이 같은 표를 쓴다.**
 *
 * 🔴 전에는 두 화면이 각자 들고 있었고 `needsWork`의 라벨이 **「작업필요」와 「작업 필요 먼저」로
 * 갈려 있었다.** 건 목록에는 「같은 3종」이라는 주석까지 있었는데 실제로는 달랐다 —
 * 그 주석을 믿고 한쪽만 고치면 차이가 더 벌어진다.
 *
 * 🔴 「먼저」를 붙인 이유: 폰 목록에는 **필터 칩 「작업필요 n」이 이미 떠 있어서**, 정렬까지
 * 「작업필요」면 같은 문구가 한 화면에 둘이 된다. 하나는 거르는 것이고 하나는 줄 세우는 것이다.
 * 나머지 둘(`발주처별`·`수령인 가나다`)처럼 **무엇으로 줄을 세우는지**가 드러나야 한다.
 *
 * 키·순서는 `lib`의 `MatrixSort`·`sortMatrixRows`가 갖는다 — 여기는 라벨만.
 */
export const MATRIX_SORTS: { key: MatrixSort; label: string }[] = [
    { key: 'vendor', label: '발주처별' },
    { key: 'recipient', label: '수령인 가나다' },
    { key: 'needsWork', label: '작업필요 먼저' },
]
