# 계획서: 도정구분별 통계 페이지

## 작업 목표

`/statistics/millingtype` 경로에 도정구분별 전용 통계 페이지를 신규 생성한다.

---

## 요구사항 정리

| 항목 | 내용 |
|------|------|
| 기간 기본값 | 6개월 (groupBy: month) |
| 품종 기본값 | 백옥찰, 서농22호, 천지향1세, 천지향5세, 새청무, 하이아미 (6개, 전체 필터) |
| 도정구분 기본값 | DB에서 전체 조회 → 전체 선택 |
| 차트 | 도정구분별 막대 1개씩 (MultiSeriesChart) |

---

## 변경 파일 및 범위

### 신규 생성 (2개)
1. `app/(dashboard)/statistics/millingtype/page.tsx`
   - 서버 컴포넌트
   - 초기 데이터: 6개월 기간 + 6개 품종 + 전체 도정구분
   - `getMillingTypeOptions()` + `getMillingStatsByMillingType()` 호출

2. `app/(dashboard)/statistics/millingtype/millingtype-stats-client.tsx`
   - 클라이언트 컴포넌트
   - 기간 선택 (QuickPeriod 버튼: 1w, 1m, 3m, 6m, 1y, 연산, 직접입력)
   - 품종 멀티선택 칩 (기본 6개, 최대 제한 없음)
   - 도정구분 멀티선택 칩 (기본 전체)
   - MultiSeriesChart 렌더링

### 수정 (3개)
3. `components/desktop-sidebar.tsx`
   - 통계 메뉴를 서브링크 2개로 확장
     - 도정실적 분석 → `/statistics/milling`
     - 도정구분별 → `/statistics/millingtype`

4. `components/mobile-nav.tsx`
   - `/statistics` href 유지 (기존과 동일, 변경 없음 or 최상위 통계로 라우트)

5. `components/breadcrumb-display.tsx`
   - `PATH_TITLE_MAP`에 `/statistics/millingtype` → `'도정구분별 분석'` 추가

---

## 단계별 접근 방식

### Step 1. 서버 컴포넌트 page.tsx
```
- resolveQuickPeriod('6m') → from, to, groupBy
- getMillingTypeOptions() → 전체 도정구분 목록
- getMillingStatsByMillingType({ from, to, groupBy, millingTypes: 전체, varieties: 6개 기본값 })
- initialData를 client에 전달
```

### Step 2. 클라이언트 컴포넌트 millingtype-stats-client.tsx
```
상태:
  - quickPeriod, from, to
  - cropYear (연산 선택)
  - selectedVarieties: 기본 6개
  - selectedMillingTypes: 전체 (DB 목록 기반)
  - availableMillingTypes: DB에서 받은 전체 목록
  - chartData: MultiSeriesChartData

이벤트:
  - handleQuickPeriod → fetchData
  - handleVarietyToggle → fetchData
  - handleMillingTypeToggle → fetchData
  - handleCropYear → fetchData
  - handleCustomDate → fetchData

렌더링:
  - QuickPeriod 버튼 + cropYear 선택기 + custom date picker
  - 품종 선택 칩 (6개 기본)
  - 도정구분 선택 칩 (전체 기본)
  - SummaryCards
  - MultiSeriesChart (seriesNames = millingTypes)
```

### Step 3. 네비게이션 수정
```
desktop-sidebar: 통계 섹션을 펼쳐서 서브링크 2개 표시
breadcrumb-display: millingtype 경로 이름 추가
```

---

## 기술 사항

- `getMillingStatsByMillingType` 이미 존재 → 신규 API 불필요
- `getMillingTypeOptions` 이미 존재 → 전체 도정구분 목록 조회 가능
- `MultiSeriesChart` 이미 존재 → 재사용
- `SummaryCards` 이미 존재 → 재사용
- 품종 최대 선택 수 제한 없음 (기존 milling 탭은 MAX 5, 이 페이지는 제한 없음)

---

## 확인 필요 사항

- 도정구분이 실제로 몇 개인지 (DB 기준) → `getMillingTypeOptions()` 결과에 따라 동적 처리
- 사이드바 통계 서브링크 열림/닫힘 방식 (항상 펼쳐진 상태로 구성 예정)
