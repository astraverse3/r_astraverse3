# 작업일지

## 2026-04-08

### 재고분석 모바일 UI 개선 (바텀시트 팝업·차트·테이블) `feat`

**변경 파일:**
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 탭 바 우측: 모바일 전용 필터 버튼 추가 (`md:hidden`, 활성 필터 수 배지 포함)
  - PC 인라인 필터 바 `hidden md:block` 래퍼로 감싸기
  - 모바일 칩 영역 `md:hidden` 추가 (연산년산 + 활성 필터 칩 항상 표시)
  - 바텀시트 팝업 구현: 연산/인증구분/작목반/품종(체크박스 리스트)/생산자 섹션
  - 작목반·품종 팝업 필터: 버튼 그룹 → 스크롤 체크박스 리스트 (`max-h-[90px]`)
  - 차트: `barSize=14` 고정, 최대 10개 스크롤 영역(`maxHeight: 10×34px`)
  - 작목반별 차트: `truncateLabels` prop으로 4자 후 `…` 처리, 클릭 시 전체 표시
  - 테이블 3개: `text-sm` → `text-xs`, 모든 셀 `whitespace-nowrap`, `minWidth` 지정
  - 테이블 컨테이너 `mb-2` 추가 (하단 메뉴바 여백)
  - 모바일 칩 삭제: `removeChipCertType` / `removeChipGroup` / `removeChipVariety` / `removeChipFarmer` 핸들러 추가 → 즉시 fetch
- `components/statistics/StockChart.tsx`
  - `barSize=14` 고정 추가 (barCategoryGap 변경 시 막대 두께 불변)
  - `truncateLabels` prop 추가: true면 커스텀 TruncatedTick, false면 기본 recharts tick
  - `yAxisWidth`: truncate 시 68px 고정 / 일반 시 이름 길이 기준
  - `margin right` 60 → 48px
- `components/statistics/SummaryCards.tsx`
  - 카드 레이아웃: 라벨 + 값+단위 한 줄 배치 (컴팩트, `text-2xl` → `text-sm`)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` `StockSummaryCards`
  - 동일한 컴팩트 레이아웃 적용

---

## 2026-04-07

### 재고분석 차트·서머리카드·레이아웃 개편 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts`
  - `processRate` → `stockRate` 필드명 변경
  - 계산식 변경: 처리율(consumed+released/total) → 재고율(available/total)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 서머리카드 4번째: "생산자 수" → "재고율"
  - 카드 레이아웃: 모바일 2×2 / PC 우측 수직(md:w-48, h-[416px])
  - 테이블 "처리율" → "재고율" (전체 탭), 재고율 색상 반전(낮을수록 초록)
  - 인증 뱃지 색상 구분: 유기농(초록), 무농약(파랑), 일반(회색)
  - 차트 데이터 포인트 10 → 20개, "기타" 집계 제거
  - 레이아웃: 차트(좌, flex-1) + 서머리카드(우) flex row
  - 차트 컨테이너 고정 높이 416px + 내부 스크롤
- `components/statistics/StockChart.tsx`
  - Y축 너비 계산: ×13 max 200 → ×10 max 150 (한글 기준 최적화)
- `components/statistics/SummaryCards.tsx`
  - 수율분석 서머리카드 디자인 재고분석 스타일로 통일 (그라디언트→흰 배경+컬러 탑바)

---

### 재고분석 페이지 필터·UI 개선 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts`
  - `StockFilters`에 `varietyIds`, `farmerNames` 추가
  - `getStockVarietyOptions` Server Action 추가
  - `GroupStockRow`, `VarietyStockRow`에 `releasedKg` 필드 추가 및 집계 반영
  - 생산자 수 카드: 미처리 생산자 수 → 검색 조건 내 전체 생산자 수(`farmerMap.size`)
- `app/(dashboard)/statistics/stock/page.tsx`
  - `getStockVarietyOptions` 초기 fetch 추가
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 탭 순서 변경: 품종별 → 작목반별 → 생산자별 (기본 탭: 품종별)
  - 품종 멀티셀렉트 드롭다운 필터 추가
  - 생산자 텍스트 검색 필터 추가 (쉼표 구분, trim 처리)
  - 초기화/검색 버튼 추가 (검색 버튼 클릭 시에만 조회)
  - 테이블 헤더 행 `bg-slate-50` 배경으로 데이터 행과 구분
  - 작목반·품종 테이블에 직접출고(kg) 열 추가
  - 차트 x축 가이드라인 추가 (`CartesianGrid`)
  - 최대 차트 표시 개수 15 → 10개
- `components/statistics/StockChart.tsx`
  - `CartesianGrid horizontal={false}` 추가 (x축 수직 가이드라인)
- `app/(dashboard)/milling/stock-list-dialog.tsx`
  - 컬럼 헤더 "농가명" → "생산자명"
- `app/actions/admin.ts`, `app/actions/excel.ts`, `app/actions/milling.ts`
  - UI 표시 용어 "농가" → "생산자" 전면 통일

---

## 2026-04-05

### 재고분석 통계 페이지 PC UI 구축 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts` (NEW)
  - `getStockStatistics`, `getStockProductionYears`, `getStockGroupOptions` Server Action
  - 농가별/작목반별/품종별 집계, 요약 카드 데이터 (Prisma include + JS Map 패턴)
- `app/(dashboard)/statistics/stock/page.tsx` (NEW)
  - 서버 컴포넌트, Promise.all로 초기 데이터 + 필터 옵션 동시 fetch
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` (NEW)
  - 필터(연산·작목반), 요약 카드 4개, 탭 3개(농가별/작목반별/품종별)
  - useTransition + Server Action으로 리필터링
- `components/statistics/StockChart.tsx` (NEW)
  - Recharts `BarChart layout="vertical"` 가로 스택 막대 차트
  - 도정완료(초록) / 직접출고(보라) / 미처리(주황) 스택
- `components/desktop-sidebar.tsx`
  - 통계 서브메뉴에 재고분석(`/statistics/stock`) 항목 추가

---

## 2026-04-03

### 수율분석 포장내역 팝업 소계 위치 수정 + 스크롤 잘림 수정 `fix`

**변경 파일:**
- `components/statistics/MillingTable.tsx`
  - 포장내역 팝업 그룹 헤더에 있던 소계를 아이템 목록 하단으로 이동
  - 그룹이 여러 개일 때만 각 그룹 하단에 소계 행 표시
- `app/(dashboard)/layout.tsx`
  - 모바일 하단 padding `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` → `+1rem` 추가
  - 마지막 스크롤 시 nav바에 가리는 문제 해결

---

## 2026-03-31

### 수율분석 페이지 모바일 팝업 필터 UI 완성 `fix`

**커밋:** `60a0b2e` (팝업 레이아웃 최종), `e8449de`, `f9334c0`, `a3128ac` 외 다수

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
  - 모바일 필터를 바텀시트 팝업으로 전환 (PC 인라인 필터는 유지)
  - 팝업 위치: `fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)]` — 네비바 위
  - 팝업 높이: `max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)]` — 헤더·네비 침범 방지
  - 스크롤 영역: `flex-1 min-h-0 overflow-y-auto` — 콘텐츠 크기에 맞게
  - 팝업 기간 섹션: 달력 아이콘 제거, '25년산' 표기, 날짜 2열 grid 입력
  - 팝업 내 필터 변경 시 fetch 지연 (`showFilter` 체크)
  - 하단 버튼: 초기화 + 검색 우측 정렬
  - 선택 칩: 종류별 이어붙이기 (품종: A* B*, 기간: ...) 한 줄 나열
- `components/statistics/SummaryCards.tsx` — 모바일 2×2 그리드, 레이블·값 한 줄 컴팩트
- `components/statistics/MillingChart.tsx` — 모바일 isMobile 반응형 (YAxis 숨김, 폰트/dot 축소, h-[260px] 명시)
- `components/statistics/MultiSeriesChart.tsx` — 동일한 isMobile 패턴 적용

**주요 수정 사항:**
- `top` + `bottom` 동시 고정 → 패널 강제 확장 버그: `top` 제거 + `max-h` calc로 해결
- 차트 안 보임: `min-h`로는 ResponsiveContainer 동작 안 함 → 부모에 `h-[260px]` 명시로 해결

---

### 수율분석 페이지 모바일 UI 반응형 적용 `feat`

**커밋:** `e88fa05`

**변경 파일:**
- `components/statistics/SummaryCards.tsx` — 모바일 2×2 그리드 (`grid-cols-2 md:flex md:flex-col`)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
  - 빠른기간 버튼 행을 `overflow-x-auto` 가로 스크롤로 전환
  - 필터 바를 3행 구조로 재설계 (기간 / 드롭다운 / 생산자+버튼)
  - 차트+카드 레이아웃: 모바일 `flex-col-reverse`(카드 위→차트 아래), PC `md:flex-row`

---

## 2026-03-30

### 모바일 네비게이션 바 전면 재설계 `feat`

**변경 파일:**
- `components/mobile-header.tsx` — `relative` 클래스 제거로 헤더 여백 버그 수정, 그라데이션 라인 색상 slate 계열로 변경
- `components/mobile-nav.tsx` — 전면 재설계
  - 통계 메뉴 서브메뉴 추가 (hover 시 팝업, 수율분석/도정구분별)
  - SVG Goo Filter 적용 (feGaussianBlur + feColorMatrix) — 물방울 liquid 이동 효과
  - Leading/Trailing 두 원으로 액체처럼 늘어나는 blob 애니메이션
  - 낙관적 active 상태 (클릭 즉시 애니메이션, 페이지 로딩과 분리)
  - 비활성: 아이콘 + 텍스트(두 글자) 표시 / 활성: 파란 원 + 흰 아이콘, 텍스트 숨김
  - 최종 디자인: 흰 배경, slate-300 테두리, rounded-full, 파란 blob
- `app/(dashboard)/layout.tsx` — MobileNav variant prop 임시 비교 후 단일 컴포넌트로 복원

**주요 동작:**
- 메뉴 이동 시 파란 원이 liquid 물방울처럼 자연스럽게 이동
- 통계 탭 hover/클릭 시 서브메뉴 팝업 (수율분석, 도정구분별)
- 메뉴 레이블 두 글자 통일 (홈·재고·도정·출고·통계)

---

### 모바일 헤더·네비 그라데이션 라인 적용 + 통계 모바일 UI 계획서 작성 `feat/docs`

**변경 파일:**
- `components/mobile-header.tsx` — border-b 제거, 하단 2px 그라데이션 라인 추가 (`#6366f1→#3b82f6→#06b6d4` 반복), 헤더 하단 인디고 glow shadow
- `components/mobile-nav.tsx` — nav에 `relative` 추가, 상단 2px 그라데이션 라인 추가 (투명→인디고→시안→인디고→투명)
- `docs/plan-stats-mobile.md` — 수율분석 모바일 UI 구현 7단계 계획서 신규 작성
- `docs/plan-statistics.md` — 개발 상태 체크리스트 추가 (완료 5단계 표시)
- `docs/plan-packaging-redesign.md` — 모든 체크리스트 완료 표시
- `public/preview/option-a.html` — 다크 크롬 시안 (헤더 #1e293b)
- `public/preview/option-b.html` — 블루 헤더 시안 (헤더 gradient blue)
- `public/preview/option-c.html` — 레이어드 그레이 시안
- `public/preview/option-stitch.html` — Google Stitch 시안2 HTML
- `public/preview/option-gradient.html` — G1/G2/G3 그라데이션 방식 비교 시안

**주요 동작:**
- 모바일 헤더 하단, 하단 네비 상단에 인디고-블루-시안 그라데이션 라인으로 컨텐츠 영역과 시각적 구분
- G2 방식 채택: 흰 헤더 유지 + 2px 그라데이션 라인 (로고 흰 배경 PNG와 어울림)
- 통계 모바일 UI 계획서 작성 (SummaryCards 그리드, 차트 레이아웃, 필터 반응형, 테이블 스크롤)

---

## 2026-03-26

### 수율분석 통계 개선 (도정구분별 탭 완성 + 생산자 필터 버그 수정) `feat/fix` — `170b7d1`

**커밋 목록:**
- `1da03fb` — fix: fetchCurrent overrides 타입에 groupBy 추가 (빌드 에러)
- `b24de31` — feat: 도정구분별 통계 페이지 신규 추가 (이후 탭으로 통합)
- `ee04a3d` — fix: 사이드바 통계 서브메뉴 → 수율분석 단일 링크로 정리
- `bccceee` — feat: 수율분석 도정구분별 탭 기본값 업데이트
- `d27f765` — fix: 품종별/도정구분별 탭 생산자 필터 미전달 버그 수정
- `4650ad1` — fix: 탭 전환 시 생산자 검색 필터 초기화
- `170b7d1` — fix: 탭 필터 변경 시 테이블·요약카드 미동기 버그 수정

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 도정구분별 탭 기본값(품종 6개·도정구분 전체), 탭 전환 시 생산자 초기화, fetchVariety/fetchMillingType에 farmers 연결 + 테이블 동기화
- `app/actions/statistics.ts` — getMillingStatsByVariety·getMillingStatsByMillingType에 farmers 파라미터 추가
- `components/desktop-sidebar.tsx` — 통계 서브메뉴 → 수율분석 단일 항목
- `components/breadcrumb-display.tsx` — 수율분석 경로명 반영

**주요 동작:**
- 도정구분별 탭: 품종 기본 6개(백옥찰·서농22호·천지향1세·천지향5세·새청무·하이아미), 도정구분 DB 전체 선택
- 생산자 검색 필터가 3개 탭 모두 정상 동작
- 탭 전환 시 생산자 검색어·칩 자동 초기화
- 품종별/도정구분별 탭에서 필터 변경 시 차트 + 테이블 + 요약카드 동시 업데이트

---

### 도정구분별 통계 페이지 신규 추가 `feat` — `b24de31`
**변경 파일:**
- `app/(dashboard)/statistics/millingtype/page.tsx` — 신규 서버 컴포넌트 (6개월 기본, 전체 도정구분 조회)
- `app/(dashboard)/statistics/millingtype/millingtype-stats-client.tsx` — 신규 클라이언트 컴포넌트 (필터 + MultiSeriesChart + SummaryCards)
- `components/desktop-sidebar.tsx` — 통계 메뉴를 서브링크 2개로 분리 (도정실적 분석 / 도정구분별 분석)
- `components/breadcrumb-display.tsx` — millingtype 경로 브레드크럼 추가

**주요 동작:**
- `/statistics/millingtype` 신규 페이지 생성
- 기간 기본: 6개월 / 품종 기본: 백옥찰·서농22호·천지향1세·천지향5세·새청무·하이아미
- 도정구분 전체 선택 (DB distinct 조회 기반, 동적)
- 품종/도정구분 토글 → 즉시 fetch, 드롭다운에 전체선택·전체해제 버튼

---

### 통계 UX 개선 (기간버튼 즉시fetch · 기본기간 6개월 · 품종별 차트 개선) `feat`
**커밋:** (이번)

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 기간 버튼 클릭 시 즉시 fetch, 기본 기간 6개월, 기본 품종 서농22→서농22호 수정, 초기화 기준 6개월
- `app/(dashboard)/statistics/milling/page.tsx` — 서버 초기 fetch 6개월 기준으로 변경
- `components/statistics/MultiSeriesChart.tsx` — X축 월별 레이블 단축(2511), Y축 allowDataOverflow 추가(55~75 정상 표시), 빈값 유령막대(점선 outline), 빈값 있는 시리즈에 ghost bar 추가

**주요 동작:**
- 빠른기간 버튼(연산/1년/6개월 등) 클릭 → 검색 버튼 없이 즉시 fetch
- 기본 기간 6개월로 변경 (연산 기준 → 실데이터 구간 중심)
- 품종별 차트 Y축 수율 55%~75% 정상 범위 표시
- 빈값 구간에 점선 outline ghost bar → 시리즈 구분 가능

---

### 통계 차트 개선 + 도정 투입내역 삭제 버그 수정 `feat/fix`
**커밋:** `7de3dda`

**변경 파일:**
- `components/statistics/MillingChart.tsx` — 막대폭 동적 조절(포인트 수 기반), X축 월별 레이블 단축(`2025-04` → `2504`)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 기간별 탭 품종 기본값 하이아미·서농22·천지향1세·새청무 적용
- `app/(dashboard)/statistics/milling/page.tsx` — 서버 초기 fetch에 동일 품종 기본값 추가
- `app/actions/milling.ts` — `removeStockFromMilling` 수정: stock 삭제 후 남은 stocks 합산해 `totalInputKg` 업데이트 (목록 투입량 미반영 버그 수정)

**주요 동작:**
- 막대폭: `480 / 포인트수` 기준, 최소 12px ~ 최대 56px 동적 계산
- 월별 X축: `yyyy-MM` → `YYMM` (day/week는 기존 유지)
- 기간별 품종 기본값: 페이지 로드 시 + 초기화 시 동일하게 적용
- 투입내역 삭제 시 `millingBatch.totalInputKg` 자동 재계산 → 목록 정합성 확보

---

## 2026-03-25 (세션2)

### 통계 품종별/도정구분별 차트 구현 + 수율 보간 `feat`
**커밋:** `7de3dda` (2026-03-26 커밋에 포함)

**변경 파일:**
- `app/actions/statistics.ts` — `MultiSeriesChartData` 타입, `getMillingStatsByVariety`, `getMillingStatsByMillingType` 추가. `generateAllBucketKeys()`로 빈 버킷 포함 전체 기간 생성, `hasData` 플래그 반환
- `components/statistics/MultiSeriesChart.tsx` — 신규. 5색 팔레트, 시리즈별 겹침막대+수율 라인, 막대폭 자동조절
- `components/statistics/MillingChart.tsx` — 보간 처리(좌우 평균), 실선/점선 이중 라인, Y축 수율 55-75로 변경
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 검색 바 공통화, 품종별/도정구분별 탭 연결, 기본값(서농22호·천지향1세·하이아미 / 백미·찹쌀·현미), 품종 최대 5개 제한

**주요 동작:**
- 품종별/도정구분별 탭 전환 시 기본값 자동 적용 후 fetch
- 데이터 없는 기간 포인트: 좌우 값 평균으로 보간, 점선(4-4 dash)으로 표시
- 수율 Y축: 55/60/65/70/75 (진폭 확대)
- 품종별 생산량: 동일 배치 내 투입 비율로 안분

---

## 2026-03-25

### 통계 기본 기간 연산(cropYear) 기준으로 변경 `feat`
**커밋:** `2e2270f`

- 통계 페이지 기본 기간을 1개월에서 현재 연산 기준으로 변경
- `page.tsx` 초기 fetch + `milling-stats-client.tsx` quickPeriod 기본값 `cropYear`로

**변경 파일:** `statistics/milling/page.tsx`, `statistics/milling/milling-stats-client.tsx`

---

### 활동로그 도정작업 상태변경 상세내역 추가 `feat`
**커밋:** `8d51266`

- `updateMillingBatchStatus` 호출 시 변경 전 배치 정보 조회 후 `details`에 포함
- 활동로그 UI에서 상세내역 버튼(FileText) 표시 가능해짐
- 기록 항목: 변경전/후 상태, 도정일, 도정구분, 투입량, 비고

**변경 파일:** `app/actions/milling.ts`

---

### 모바일 멀티셀렉트 터치 스크롤 수정 `fix`
**커밋:** `43425b1`

- Popover 내부 스크롤 컨테이너에 `touch-pan-y`, `overscroll-contain`, `onTouchMove stopPropagation` 추가
- iOS 모바일에서 터치 이벤트가 부모로 전파되어 스크롤 안 되던 문제 해결

**변경 파일:** `components/ui/multi-select.tsx`

---

### 통계 도정실적 페이지 기능·UI 개선 `feat`
**커밋:** `94c5f72`

**변경 파일:** `statistics/milling/milling-stats-client.tsx`, `actions/statistics.ts`, `components/statistics/MillingChart.tsx`, `components/statistics/MillingTable.tsx`, `components/statistics/SummaryCards.tsx`

**필터 기능:**
- 기간검색 탭에 생산자 텍스트 검색 추가 (쉼표로 다중 검색, Enter 지원)
- 검색 버튼 클릭 시에만 그래프 반영 (기존 자동 fetch → 수동 검색 방식)
- 검색 조건 칩 표기 — 기간(항상)/품종/도정구분/생산자 전부 칩으로 표시
- 초기화 버튼 추가 (기간 1개월·백미 기본값으로 리셋)

**그래프:**
- 범례 투입량·생산량 아이콘 두께 통일
- 좌측 Y축 단위 kg → t(톤) 변경, 툴팁도 t 단위 표시

**요약 카드:** 각 카드에 색상별 그라데이션 배경 추가

**상세 테이블:**
- 생산자 컬럼 "XXX 외 N명" 요약 표시 (title로 전체 이름 확인 가능)
- 투입목록 팝업 → `MillingStockListDialog` 재사용 (도정관리와 동일 화면)
- 포장내역 팝업 → `AddPackagingDialog` 스타일 동일 적용 (로트 그룹 헤더 구조)
- 로트번호 hover 시 생산자명 tooltip 표시
- 수율 표시 → 도정관리 목록 동일 스타일 (70%↑ 파란 배지, 미만 회색)

---

### 검색필터 멀티셀렉트 + 다중 생산자 검색 `feat`
**커밋:** `226b90a`

**신규:** `components/ui/multi-select.tsx` (Popover + 체크박스 멀티셀렉트 공통 컴포넌트)

**재고:** 년도·인증·품종 멀티셀렉트 전환
**도정:** 품종·도정구분 멀티셀렉트 전환
**생산자관리:** 인증·년도 멀티셀렉트 전환
**공통:** 생산자 텍스트 필드에서 쉼표(,)로 여러 생산자 동시 검색, 모든 텍스트 입력 앞뒤 공백 trim

**버그 수정:**
- `getStocksByGroup` 라인 608 `isNaN` 함수를 Prisma 필터값으로 전달하던 버그 → 그룹 클릭 시 하위목록 미표시 원인
- `getStockGroups` 멀티값 `parseInt('2025,2026')` 파싱 오류 → 검색결과 0건 원인

**변경 파일:** `components/ui/multi-select.tsx`, `stocks/stock-filters.tsx`, `stocks/active-filters.tsx`, `milling/milling-filters.tsx`, `milling/active-milling-filters.tsx`, `admin/farmers/farmer-filters.tsx`, `admin/farmers/page.tsx`, `actions/stock.ts`, `actions/milling.ts`, `actions/admin.ts`

---

### 포장 다이얼로그 단일 생산자 헤더 표시 `feat`
**커밋:** `bdd4c74`

- 단일 생산자 도정 시에도 포장 다이얼로그 상단에 생산자명 + 로트번호(또는 "관행") 표시
- 예상 생산량 계산은 다중 생산자일 때만 유지

---

### 관행 농가 로트번호 처리 개선 `fix`
**커밋:** `fed7f90`

**배경:** 관행(certType=일반) 농가는 인증이 없어 로트번호가 의미 없음.
관행 그룹의 certNo가 `-`(대시)로 저장되어 포장 저장 시 `251118-18---9915` 같은
잘못된 로트번호가 생성되는 버그 발견.

**변경 내용:**
| 파일 | 내용 |
|------|------|
| `app/actions/milling.ts` | 포장 저장 시 관행이면 lotNo = null |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 관행 농가를 farmerNo 기준 개별 그룹핑, "관행" 표시 |
| `app/actions/milling-excel.ts` | 로트번호 컬럼 추가, 관행이면 "관행" |
| `app/actions/statistics.ts` | OutputDetail에 isConventional 추가, group 쿼리 포함 |
| `components/statistics/MillingTable.tsx` | 관행이면 "관행" 표시 |
| `app/(dashboard)/stocks/stock-table-row.tsx` | 관행이면 "관행" 표시 |
| `app/(dashboard)/stocks/stock-list-client.tsx` | 관행이면 "관행" 표시 |

**DB 정리:** 잘못 생성된 MillingOutputPackage.lotNo 7건 → null (id: 277, 278, 279, 370, 375, 376, 377)

---

## 2026-03-24

### 도정실적 통계 페이지 신규 + 대시보드/포장 버그 수정 `feat`
**커밋:** `e2a3e09`

**변경 내용:**
- 도정실적 통계 페이지 신규 (`/statistics/milling`)
  - 요약 카드 4개 (총 투입량/생산량/수율/도정횟수)
  - 기간별 콤보 차트 (투입/생산 OverlappingBar + 수율 라인)
  - 상세 테이블 (생산자 열, 투입량/생산량 클릭 팝업)
- 포장 입력 예상생산량 수율 DB 연동
- 대시보드 최근도정내역: 생산량 클릭 포장내역 팝업, 수율 색상 개선
- 대시보드/포장 버그 수정 (stockId, lotNo, group 필드 누락)

---

## 2026-03-23

### 포장 입력 재설계 — lotNo 기반 생산자별 섹션 분리 `refactor`
**커밋:** `9defc62`

**변경 파일:**
- `app/(dashboard)/milling/add-packaging-dialog.tsx` — `computeLotGroups`로 lotNo 기준 섹션 분리, 자동배분 제거, 섹션별 독립 버튼
- `lib/lot-generation.ts` — `getYieldRate()` 추가 (백미 68% / 현미 70% / 인디카 65% / 분도미 69%)
- `app/actions/milling.ts` — `updatePackagingLogs` fallback 로직 명시적 정리
- 도정유형 명칭 통일: `7분도미` → `칠분도미`, `5분도미` → `오분도미` (소스코드 전체 6개 파일)
- `scripts/migrate-milling-type.ts` — DB 도정유형 명칭 통일 마이그레이션 스크립트

**주요 동작:**
- 다중 생산자 배치 시 lotNo별 섹션으로 분리 표시
- 각 섹션에 독립 규격 버튼 → 버튼 클릭 시 해당 생산자 섹션에만 추가
- 예상 생산량 = 투입량 × 수율(도정유형별)

---

### 모바일 포장내역 팝업 버그 수정 `fix`
**커밋:** `6a96ef0`, `d9908dc`

- `stocks prop` 누락으로 포장내역 팝업이 열리지 않던 버그 수정
- 모바일에서 포장 다이얼로그 저장 버튼이 잘리던 레이아웃 버그 수정

---

### 사이드바 메뉴 개편 및 관리자 설정 페이지 추가 `feat`
**커밋:** `1073aae`

- 품종/생산자 관리를 사이드바 상단 독립 메뉴로 승격
- 관리자 설정(`admin/settings`) 페이지 신규 — 도정유형별 수율 기준값 DB 관리
- `SystemConfig` Prisma 모델 추가, `getYieldRates` / `setYieldRate` Server Action

---

### 도정내역 기본 조회기간 1주→1달, 수율 설정화면 2열 레이아웃 `fix`
**커밋:** `47cf836`
