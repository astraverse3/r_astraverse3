# 통계 페이지 - 품종별 / 도정구분별 차트 구현 계획서

> 작성일: 2026-03-25
> 작업명: statistics-variety-millingtype

---

## 1. 작업 목표

통계 도정실적 페이지의 **품종별** / **도정구분별** 탭을 구현한다.
각 탭은 검색된 데이터를 기간별 마디포인트(X축) × 시리즈(품종 or 도정구분)로 집계하여
겹쳐진 막대그래프(투입/생산량) + 수율 라인을 시리즈별로 나란히 표시한다.

---

## 2. 현재 상태 분석

| 항목 | 현재 |
|------|------|
| `MainTab` 타입 | `period / variety / millingType` 3개 정의됨 |
| 탭 UI | 탭 버튼만 있음, variety / millingType 탭 콘텐츠 없음 |
| 차트 컴포넌트 | `MillingChart` — 단일 시리즈(기간별) 전용 |
| 서버 액션 | `getMillingStatistics` — 단일 시리즈 집계만 지원 |

---

## 3. 신규 설계

### 3-1. 데이터 구조 (Recharts 친화 flat 형식)

```typescript
// 각 기간 마디포인트 하나
type MultiSeriesPoint = {
  label: string         // X축
  tooltipLabel: string  // 툴팁
  [seriesKey: string]: any
  // 예: '서농22호_input', '서농22호_output', '서농22호_yield'
}

type MultiSeriesChartData = {
  periods: MultiSeriesPoint[]
  seriesNames: string[]   // 선택된 품종/도정구분 목록 (순서 유지)
  groupBy: GroupBy
}
```

### 3-2. 서버 액션 추가 (statistics.ts)

```typescript
// 품종별
getMillingStatsByVariety(params: VarietyStatsParams): Promise<MultiSeriesChartData>

// 도정구분별
getMillingStatsByMillingType(params: MillingTypeStatsParams): Promise<MultiSeriesChartData>
```

공통 params: `from, to, groupBy, varieties[], millingTypes[], cropYear?`
품종별 액션은 millingType 필터를 추가 지원, 도정구분별 액션은 variety 필터 추가 지원.

### 3-3. 차트 컴포넌트 — `MultiSeriesChart` (신규)

- 파일: `components/statistics/MultiSeriesChart.tsx`
- `MillingChart`와 별도로 제작 (기간별 컴포넌트에 영향 없음)
- 시리즈 수에 따라 `maxBarSize` 자동 조절

```
시리즈 1개: maxBarSize = 40
시리즈 2개: maxBarSize = 28
시리즈 3개: maxBarSize = 20
시리즈 4개: maxBarSize = 16
시리즈 5개: maxBarSize = 13
```

- 각 시리즈마다 `OverlappingBar` + `Line` 렌더링
- 시리즈별 색상 팔레트 (5색):

| 인덱스 | 투입(연한) | 생산(진한) | 수율 라인 |
|--------|-----------|-----------|----------|
| 0 | `rgba(0,162,232,0.18)` | `#00a2e8` | `#007cb3` |
| 1 | `rgba(34,197,94,0.18)` | `#22c55e` | `#16a34a` |
| 2 | `rgba(139,92,246,0.18)` | `#8b5cf6` | `#7c3aed` |
| 3 | `rgba(248,156,30,0.18)` | `#f89c1e` | `#d97706` |
| 4 | `rgba(239,68,68,0.18)` | `#ef4444` | `#dc2626` |

### 3-4. 탭 필터 UI 변경 (milling-stats-client.tsx)

**품종별 탭 필터:**
- 기간 선택 (기간별 탭과 동일)
- 품종 멀티셀렉 (기본값: `서농22호, 천지향1세, 하이아미` — 3개)
- **최대 선택 5개** 제한 (초과 시 비활성화 + 안내)
- 도정구분 필터(보조) — 전체 또는 선택
- 검색/초기화 버튼

**도정구분별 탭 필터:**
- 기간 선택 (기간별 탭과 동일)
- 도정구분 멀티셀렉 (기본값: `백미, 찹쌀, 현미` — 3개, 최대 4개 전체 선택 가능)
- 품종 필터(보조) — 전체 또는 선택
- 검색/초기화 버튼

**탭 전환 시 독립 상태:**
- 각 탭은 자체 `selectedVarieties`, `selectedMillingTypes`, `chartData` 상태를 가짐
- 탭 전환 시 다른 탭 데이터에 영향 없음

---

## 4. 변경 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `app/actions/statistics.ts` | 수정 | `getMillingStatsByVariety`, `getMillingStatsByMillingType` 함수 추가, `MultiSeriesChartData` 타입 추가 |
| `components/statistics/MultiSeriesChart.tsx` | 신규 | 멀티시리즈 차트 컴포넌트 |
| `app/(dashboard)/statistics/milling/milling-stats-client.tsx` | 수정 | 품종별/도정구분별 탭 필터 UI + 차트 연결 |

---

## 5. 단계별 작업 순서

1. **[Step 1]** `statistics.ts` — 타입 추가 + `getMillingStatsByVariety` 구현
2. **[Step 2]** `statistics.ts` — `getMillingStatsByMillingType` 구현
3. **[Step 3]** `MultiSeriesChart.tsx` — 컴포넌트 구현
4. **[Step 4]** `milling-stats-client.tsx` — 품종별 탭 UI + 데이터 연결
5. **[Step 5]** `milling-stats-client.tsx` — 도정구분별 탭 UI + 데이터 연결
6. **[Step 6]** 빌드 확인

---

## 6. 주요 결정 사항 및 트레이드오프

| 항목 | 결정 | 이유 |
|------|------|------|
| 최대 품종 선택 수 | 5개 | 그 이상은 막대가 너무 좁아져 가독성 저하 |
| 도정구분 최대 | 4개 (전체) | 실제 도정구분이 4종류이므로 제한 불필요 |
| 데이터 구조 | flat 피벗 형식 | Recharts `<Bar dataKey="..." />` 사용 편의 |
| 기간별 탭 | 변경 없음 | 기존 구현 그대로 유지, 영향 없음 |
| 차트 컴포넌트 | `MillingChart`와 분리 | 로직이 달라 합치면 복잡도만 증가 |
| 탭별 상태 독립 | 각 탭 별도 상태 | 탭 전환 시 검색 조건 유지되는 편이 사용성 좋음 |

---

## 7. 확인 필요 사항

- 기본값으로 설정한 `서농22호, 천지향1세, 하이아미` — DB에 실제로 존재하는 품종인지 확인 필요 (없으면 빈 차트로 표시)
- 도정구분 기본값 `백미, 찹쌀, 현미` — 실제 DB 도정구분 값과 일치 여부 확인 필요
