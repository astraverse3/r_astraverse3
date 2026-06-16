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
