# 포장 입력 재설계 계획서

> 작성일: 2026-03-23
> 대상 파일: `add-packaging-dialog.tsx`, `app/actions/milling.ts`

---

## 배경 및 목적

기존 포장 입력 다이얼로그는 다중 생산자 배치 지원을 위해 자동 분배 알고리즘(`getBestStockIdForNewPackage`)을 추가하다가 복잡도가 높아졌다.
핵심 문제: 포장 1건당 `stockId`로 생산자를 연결해야 lotNo가 결정되는데, 이 연결을 숨겨진 자동 알고리즘으로 처리하니 예측 불가능하고 UX도 불명확함.

**재설계 목표:**
- lotNo 기반 그룹핑으로 섹션을 분리
- 각 섹션에 독립적인 입력 버튼 제공 → 자동 배분 제거
- 수율을 도정유형별로 정확히 적용

---

## 1. LotGroup 설계

### 그룹핑 키
`generateLotNo(stock, millingType)` 결과값을 키로 사용.
같은 lotNo = 같은 섹션 / 다른 lotNo = 다른 섹션 (동일 생산자여도 품종·입고일·작목반이 다르면 분리).

```ts
type LotGroup = {
  lotNo: string                  // 그룹 식별자 + 표시용
  representativeStockId: number  // 패키지에 저장될 stockId
  farmerName: string
  varietyName: string
  totalInputKg: number           // 이 그룹에 속한 stock들의 weightKg 합산
  stocks: Stock[]
}
```

### computeLotGroups 함수
```ts
function computeLotGroups(stocks: Stock[], millingType: string): LotGroup[] {
  const map = new Map<string, LotGroup>()
  for (const stock of stocks) {
    const lotNo = generateLotNo({ ...stock, millingType })
    if (!map.has(lotNo)) {
      map.set(lotNo, {
        lotNo,
        representativeStockId: stock.id,
        farmerName: stock.farmer?.name ?? '알수없음',
        varietyName: stock.variety?.name ?? '',
        totalInputKg: 0,
        stocks: [],
      })
    }
    const g = map.get(lotNo)!
    g.stocks.push(stock)
    g.totalInputKg += stock.weightKg
  }
  return Array.from(map.values())
}
```

---

## 2. 수율 함수

```ts
function getYieldRate(millingType: string): number {
  if (millingType.includes('현미'))                                  return 0.70
  if (millingType.includes('인디카'))                                return 0.65
  if (millingType === '칠분도미' || millingType === '오분도미')       return 0.69
  if (millingType.includes('백미'))                                  return 0.68
  return 0.68  // 기타
}
```

> 향후 관리자 설정 페이지에서 DB로 관리 예정. 지금은 하드코딩.

---

## 3. 상태 구조

기존 `outputs: MillingOutputInput[]` 유지.
각 output의 `stockId = group.representativeStockId`.

```ts
// 섹션에 패키지 추가
function addToGroup(group: LotGroup, template: { label: string; weight: number }) {
  const targetStockId = group.representativeStockId
  setOutputs(prev => {
    // 톤백/잔량은 항상 새 행
    if (template.label === '톤백' || template.label === '잔량') {
      return [...prev, { packageType: template.label, weightPerUnit: 0, count: 1, totalWeight: 0, stockId: targetStockId }]
    }
    // 동일 규격+동일 stockId 행이 있으면 count+1
    const idx = prev.findIndex(o => o.packageType === template.label && o.stockId === targetStockId)
    if (idx >= 0) {
      return prev.map((o, i) => i === idx
        ? { ...o, count: o.count + 1, totalWeight: (o.count + 1) * o.weightPerUnit }
        : o)
    }
    return [...prev, { packageType: template.label, weightPerUnit: template.weight, count: 1, totalWeight: template.weight, stockId: targetStockId }]
  })
}
```

---

## 4. UI 구조

### 단일 LotGroup (기존과 동일한 체감)
```
[포장 기록 관리]  백미  ·  투입 800kg
────────────────────────────────────────
규격 선택
[톤백][20kg][10kg][8kg][5kg][4kg][1kg][잔량][직접입력]

생산(포장) 내역
  홍길동  260113-11-1521-371          총 400kg
  ├ 20kg × 10    =  200kg  [-][10][+]  🗑
  └ 10kg × 20    =  200kg  [-][20][+]  🗑
────────────────────────────────────────
총 포장 400kg   [기록 저장]
```

### 다중 LotGroup
```
[포장 기록 관리]  백미  ·  총 투입 1,200kg
────────────────────────────────────────
┌─ 홍길동 · 삼광  260113-11-1521-371
│  투입 700kg  →  예상 476kg
│  [톤백][20kg][10kg][8kg][5kg][4kg][1kg][잔량]
│  ├ 20kg × 20 = 400kg
│  소계 400kg
└──────────────────────────────────────

┌─ 김철수 · 삼광  260115-11-1521-382
│  투입 500kg  →  예상 340kg
│  [톤백][20kg][10kg][8kg][5kg][4kg][1kg][잔량]
│  ├ 20kg × 10 = 200kg
│  소계 200kg
└──────────────────────────────────────

총 포장 600kg   [기록 저장]
```

- 버튼이 **섹션 안**에 위치 → 클릭 시 해당 그룹에 추가
- 생산자 재배정 Select 없음 (명시적 섹션으로 대체)
- 예상 중량은 가이드 표시 전용 (초과해도 저장 가능)

---

## 5. Server Action 수정 (milling.ts)

### updatePackagingLogs 보강
```ts
// 기존: 잘못된 stockId도 batch.stocks[0]으로 fallback
const targetStock = batch.stocks.find(s => s.id === output.stockId) || batch.stocks[0]

// 변경: stockId 없으면 명시적으로 batch.stocks[0] 사용, 있는데 잘못된 경우는 에러
const targetStock = output.stockId
  ? batch.stocks.find(s => s.id === output.stockId) ?? batch.stocks[0]
  : batch.stocks[0]
```

실질적 동작은 같지만, 향후 유효성 검증 추가 시 분기점 명확히.

---

## 6. 도정유형 명칭 통일 (7분도미 → 칠분도미, 5분도미 → 오분도미)

### 6-1. 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `app/(dashboard)/_components/recent-logs-list.tsx` | 색상 맵 키 변경 |
| `app/(dashboard)/milling/add-form.tsx` | 선택 버튼 목록 변경 |
| `app/(dashboard)/milling/milling-filters.tsx` | Select 옵션 변경 |
| `app/(dashboard)/milling/mobile-milling-card.tsx` | 색상 맵 키 변경 |
| `app/(dashboard)/milling/stock-list-dialog.tsx` | 레거시맵 + 버튼 목록 변경 |
| `app/(dashboard)/stocks/start-milling-dialog.tsx` | 선택 버튼 목록 변경 |

### 6-2. DB 마이그레이션 SQL

```sql
-- 기존 혼재 데이터 정리
UPDATE "MillingBatch"
SET "millingType" = '칠분도미'
WHERE "millingType" IN ('7분도미', '7분도', '칠분도');

UPDATE "MillingBatch"
SET "millingType" = '오분도미'
WHERE "millingType" IN ('5분도미', '5분도', '오분도');
```

> 마이그레이션 실행 후 `stock-list-dialog.tsx`의 레거시맵은 제거.

---

## 7. 변경 파일 전체 목록

| 파일 | 변경 내용 |
|------|-----------|
| `lib/lot-generation.ts` | `getYieldRate()` 함수 추가 |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 전면 재작성 |
| `app/actions/milling.ts` | `updatePackagingLogs` fallback 정리 |
| `app/(dashboard)/_components/recent-logs-list.tsx` | 명칭 통일 |
| `app/(dashboard)/milling/add-form.tsx` | 명칭 통일 |
| `app/(dashboard)/milling/milling-filters.tsx` | 명칭 통일 |
| `app/(dashboard)/milling/mobile-milling-card.tsx` | 명칭 통일 |
| `app/(dashboard)/milling/stock-list-dialog.tsx` | 명칭 통일 + 레거시맵 제거 |
| `app/(dashboard)/stocks/start-milling-dialog.tsx` | 명칭 통일 |

---

## 8. 작업 순서

- [ ] 1. DB 마이그레이션 실행 (칠분도미/오분도미 통일)
- [ ] 2. 소스코드 명칭 통일 (위 파일 일괄 변경)
- [ ] 3. `lib/lot-generation.ts`에 `getYieldRate()` 추가
- [ ] 4. `add-packaging-dialog.tsx` — `computeLotGroups`, `addToGroup` 구현
- [ ] 5. 다이얼로그 렌더링 — LotGroup 섹션 구조로 변경
- [ ] 6. `milling.ts` — fallback 정리
- [ ] 7. 빌드 확인

---

## 9. 향후 과제 (이번 작업 범위 외)

- 관리자 설정 페이지: 도정유형별 기대수율 DB 관리
- 수율 함수를 DB 설정값으로 교체
