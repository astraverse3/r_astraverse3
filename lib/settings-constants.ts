export const DEFAULT_YIELD_RATES: Record<string, number> = {
    '백미': 68,
    '현미': 70,
    '오분도미': 69,
    '칠분도미': 69,
    '찹쌀': 68,
    '기타': 68,
};

// 저장값(도정 정도)만. '찹쌀'은 폐기 — 찰벼는 백미/현미로 저장하고 표시만 찹쌀/찰현미로 파생
// (lib/milling-type-display.ts, 계획서 plan-찰벼도정유형정리.md)
export const MILLING_TYPES = ['백미', '현미', '오분도미', '칠분도미', '기타'] as const;

// ──────────────────────────────────────────────────────────
// 품종 축 수율 기준값
//
// 인디카는 도정구분이 아니라 **품종 타입**(Variety.type)이다. 인디카 벼도 도정하면
// millingType은 '백미'로 저장되므로, 도정구분만으로는 기준값을 가를 수 없다.
// 실적(2026-09-10 기준, 마감 배치 안분): 인디카 백미 61.3% vs 메벼 백미 67.2%로
// 6%p 차이가 나 별도 기준이 필요하다.
//
// 찰벼(GLUTINOUS)는 백미 67.5%로 메벼 67.2%와 사실상 같아 넣지 않았다.
// 나중에 실적이 갈리면 아래 세 상수에 한 줄씩 추가하면 된다.
// ──────────────────────────────────────────────────────────

/** 품종 축으로 기준값을 따로 관리하는 Variety.type */
export const VARIETY_YIELD_TYPES = ['INDICA'] as const;

/** 품종 축에서 기준값을 정할 수 있는 도정구분 (인디카는 오분도미·칠분도미 실적이 없다) */
export const VARIETY_YIELD_MILLING_TYPES = ['백미', '현미'] as const;

export const VARIETY_TYPE_LABELS: Record<string, string> = {
    INDICA: '인디카',
};

/** 키 형식: `{VarietyType}_{도정구분}` — SystemConfig에는 `yield_rate_` 접두사가 붙는다 */
export const DEFAULT_VARIETY_YIELD_RATES: Record<string, number> = {
    'INDICA_백미': 61,   // 실적 61.3%
    'INDICA_현미': 65,   // 실적 없음 — 메벼의 백미→현미 상승폭(+4%p)을 적용한 추정치
};

/** 품종 축 기준값 키를 만든다 */
export function varietyYieldKey(varietyType: string, millingType: string): string {
    return `${varietyType}_${millingType}`;
}
