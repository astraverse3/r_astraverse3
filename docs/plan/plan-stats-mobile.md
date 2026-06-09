# 계획서: 수율분석 페이지 모바일 UI 구현

> 작성일: 2026-03-30
> 작업명: stats-mobile

---

## 배경 및 목표

수율분석 페이지(`/statistics/milling`)는 PC 전용으로 설계되어 모바일에서 레이아웃이 깨진다.
Tailwind 반응형 유틸리티(`md:`)를 활용해 모바일/PC 모두 자연스럽게 동작하도록 개선한다.

---

## 현재 문제점

| 영역 | 문제 |
|------|------|
| 필터 바 | 모든 요소가 한 줄 `flex` → 모바일에서 가로 넘침 |
| 빠른기간 버튼 | 7개 버튼이 줄바꿈 없이 나열 → 모바일에서 찌그러짐 |
| 날짜 직접입력 | `border-l pl-3` 인라인 배치 → 모바일 너비 부족 |
| 차트 + 요약카드 | `flex gap-4` 가로 배치, 카드 `w-48 shrink-0` → 모바일에서 카드가 너무 좁음 |
| 요약카드 | 세로 4개 → 모바일에서는 2×2 그리드가 적합 |
| 테이블 | 컬럼 수 많음 → 모바일에서 가로 스크롤 필요 |

---

## 설계

### 1. 필터 바 (`milling-stats-client.tsx`)

**빠른기간 버튼 행**
- 모바일: `overflow-x-auto` + `flex-nowrap` → 가로 스크롤
- PC: 기존 `flex flex-wrap` 유지

```
mobile: [연산][1년][6개월][3개월][1개월][1주][📅] ← 가로 스크롤
pc:     기존 그대로
```

**품종/도정구분 드롭다운 + 생산자 검색 행**
- 모바일: 한 줄에 드롭다운 2개 + 생산자 검색 풀너비(아래 행)
- PC: 기존 한 줄 유지

```
mobile:
  [품종 ▼] [도정구분 ▼]           ← 1행
  [생산자명___________] [검색][초기화]  ← 2행

pc: 기존 한 줄 (구분선 포함)
```

**날짜 직접입력**
- 모바일: `flex-col` 세로 배치
- PC: 기존 인라인 유지

**적용된 조건 칩 행**
- 변경 없음 (`flex-wrap` 이미 적용됨)

---

### 2. 차트 + 요약카드 레이아웃 (`milling-stats-client.tsx`)

```
mobile: 요약카드(상단) → 차트(하단) 세로 배치
pc:     차트(좌) + 요약카드(우 w-48) 가로 배치 (기존)
```

```tsx
// 변경 전
<div className="flex gap-4 items-stretch">
  <div className="flex-1 min-w-0"> {/* 차트 */} </div>
  <div className="w-48 shrink-0"> {/* 카드 */} </div>
</div>

// 변경 후
<div className="flex flex-col-reverse md:flex-row gap-4 md:items-stretch">
  <div className="flex-1 min-w-0"> {/* 차트 */} </div>
  <div className="md:w-48 md:shrink-0"> {/* 카드 */} </div>
</div>
```

> `flex-col-reverse`: 모바일에서 카드가 위, 차트가 아래 (카드 먼저 보임)

---

### 3. 요약카드 (`SummaryCards.tsx`)

```
mobile: 2×2 그리드
pc:     세로 4개 (기존)
```

```tsx
// 변경 전
<div className="flex flex-col gap-3 h-full">

// 변경 후
<div className="grid grid-cols-2 gap-3 md:flex md:flex-col md:h-full">
```

---

### 4. 상세 테이블 (`MillingTable.tsx`)

- 테이블 래퍼에 `overflow-x-auto` 추가 → 모바일 가로 스크롤
- 컬럼 최소 너비(`min-w-[...]`) 지정으로 찌그러짐 방지

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `app/(dashboard)/statistics/milling/milling-stats-client.tsx` | 필터 바 반응형, 차트+카드 레이아웃 반응형 |
| `components/statistics/SummaryCards.tsx` | 모바일 2×2 그리드 |
| `components/statistics/MillingTable.tsx` | 테이블 가로 스크롤 래퍼 |

---

## 작업 순서

- [x] 1. `SummaryCards.tsx` — 2×2 그리드 적용 (2026-03-31)
- [x] 2. `milling-stats-client.tsx` — 차트+카드 레이아웃 반응형 (2026-03-31)
- [x] 3. `milling-stats-client.tsx` — 빠른기간 버튼 가로스크롤 (2026-03-31)
- [x] 4. `milling-stats-client.tsx` — 바텀시트 팝업 필터로 전환 (2026-03-31)
- [x] 5. `milling-stats-client.tsx` — 날짜 직접입력 팝업 내 반응형 (2026-03-31)
- [x] 6. `MillingTable.tsx` — 가로 스크롤 래퍼 (2026-03-31)
- [x] 7. `MillingChart.tsx` / `MultiSeriesChart.tsx` — isMobile 반응형 (dot 축소, h 명시) (2026-03-31)
