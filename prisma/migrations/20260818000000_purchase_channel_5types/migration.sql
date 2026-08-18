-- 발주서 채널 5종(#26 통일양식) — 기존 enum에 3종 추가.
-- 시트명 prefix로 판별: 이마트_/택배_/서울급식_/해남급식_, 그 외 거래처명_ = 기업별.
-- 값 추가만 하는 비파괴 변경(기존 DELIVERY·EMART 데이터 영향 없음).
ALTER TYPE "PurchaseChannel" ADD VALUE IF NOT EXISTS 'MEAL_SEOUL';
ALTER TYPE "PurchaseChannel" ADD VALUE IF NOT EXISTS 'MEAL_HAENAM';
ALTER TYPE "PurchaseChannel" ADD VALUE IF NOT EXISTS 'CORPORATE';
