// 수율 필터 공유 헬퍼.
// 목록 조회(getMillingLogs)와 엑셀 다운로드(exportMillingLogs)가 동일하게 사용해
// 화면과 엑셀 결과가 어긋나지 않도록 한다.
//
// 수율은 DB 컬럼이 아니라 outputs 합산으로 계산하는 값이라 prisma where로 못 거른다.
// findMany 이후 post-query 필터로 사용한다.

import {
    DEFAULT_YIELD_RATES,
    DEFAULT_VARIETY_YIELD_RATES,
    varietyYieldKey,
} from './settings-constants'

type YieldFilterBatch = {
    isClosed: boolean
    totalInputKg: number
    outputs: { totalWeight: number }[]
}

/**
 * 배치가 수율 필터 조건에 맞는지 판정한다.
 * - yieldRate가 없거나 'ALL'이면 전부 통과
 * - 미마감(!isClosed) 배치는 수율이 확정 안 됐으므로 제외
 * - 구간 경계는 이하(<=)/이상(>=)
 */
export function matchesYieldFilter(batch: YieldFilterBatch, yieldRate?: string): boolean {
    if (!yieldRate || yieldRate === 'ALL') return true

    // 미마감 배치는 수율 미확정 → 제외
    if (!batch.isClosed) return false

    const productionSum = batch.outputs.reduce((sum, out) => sum + out.totalWeight, 0)
    const rate = batch.totalInputKg > 0 ? (productionSum / batch.totalInputKg) * 100 : 0

    switch (yieldRate) {
        case 'upto_50':
            return rate <= 50
        case 'upto_60':
            return rate <= 60
        case 'upto_70':
            return rate <= 70
        case 'over_70':
            return rate >= 70
        default:
            return true
    }
}

// ──────────────────────────────────────────────────────────
// 수율 등급 판정 — 화면 배지/글자색의 단일 원천
//
// 예전엔 화면마다 임계값을 따로 박아뒀다(도정목록 PC `>=70`, 모바일 `>=70/>=60`,
// 통계 테이블 `>=70`, 대시보드는 DEFAULT_YIELD_RATES 상수). 그래서 관리자 설정
// (`/admin/settings`)에서 기준값을 바꿔도 어느 화면에도 반영되지 않았고,
// 같은 수율이 화면마다 다른 색으로 보였다.
//
// 기준값은 도정구분마다 다르고(백미 68 · 현미 70 …), 인디카처럼 품종 계열로도 갈린다.
// 그래서 임계는 `millingType` + `varietyType`을 함께 봐야 한다 — getYieldTarget 참조.
// 기준값 자체는 서버에서 읽어(getYieldRates) YieldRatesProvider로 내려온다
// — app/(dashboard)/yield-rates-context.tsx
// ──────────────────────────────────────────────────────────

/** 기준값에서 몇 %p 아래까지를 경고로 볼지 (그 미만은 미달) */
export const YIELD_WARN_GAP = 5

export type YieldLevel = 'good' | 'warn' | 'bad'

/**
 * 이 배치에 적용할 기준 수율을 고른다.
 *
 * 인디카처럼 도정구분만으로 설명이 안 되는 계열이 있어 **품종 축이 도정구분보다 우선**한다.
 * 인디카 벼도 도정하면 millingType은 '백미'라, 품종 타입을 안 보면 메벼와 같은 기준(68)에
 * 걸려 멀쩡한 배치가 미달로 찍힌다(인디카 백미 실적 61.3%).
 *
 * 폴백 순서: 품종축 설정 → 품종축 기본 → 도정구분 설정 → 도정구분 기본 → 68
 *
 * @param varietyType Variety.type. 배치에 여러 품종이 섞이면 대표(첫 재고) 값을 넘긴다 —
 *                    화면의 도정구분 표시(getDisplayMillingType)와 같은 방식이다.
 */
export function getYieldTarget(
    millingType: string,
    rates: Record<string, number>,
    varietyType?: string | null,
): number {
    if (varietyType) {
        const key = varietyYieldKey(varietyType, millingType)
        const byVariety = rates[key] ?? DEFAULT_VARIETY_YIELD_RATES[key]
        if (byVariety !== undefined) return byVariety
    }
    return rates[millingType] ?? DEFAULT_YIELD_RATES[millingType] ?? 68
}

/**
 * 실측 수율을 기준값과 비교해 등급 판정한다.
 * - `good`: 기준값 이상
 * - `warn`: 기준값 미만 ~ (기준값 - YIELD_WARN_GAP) 이상
 * - `bad` : 그 미만
 */
export function getYieldLevel(
    yieldRate: number,
    millingType: string,
    rates: Record<string, number>,
    varietyType?: string | null,
): YieldLevel {
    const target = getYieldTarget(millingType, rates, varietyType)
    if (yieldRate >= target) return 'good'
    if (yieldRate >= target - YIELD_WARN_GAP) return 'warn'
    return 'bad'
}

/** 알약 배지용 (배경 + 글자색) */
export const YIELD_BADGE_CLASS: Record<YieldLevel, string> = {
    good: 'bg-primary/10 text-primary',
    warn: 'bg-amber-50 text-amber-600',
    bad: 'bg-red-50 text-red-500',
}

/** 글자색만 쓰는 자리용 */
export const YIELD_TEXT_CLASS: Record<YieldLevel, string> = {
    good: 'text-primary',
    warn: 'text-amber-600',
    bad: 'text-red-500',
}
