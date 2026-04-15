# 통계 페이지 정리 & 리팩토링 결과보고서

> 작성일: 2026-04-15
> 계획서: [plan-stats-cleanup.md](./plan-stats-cleanup.md)
> 종합 리뷰 기반 우선순위 액션 후속 작업

---

## 작업 요약

프로젝트 종합 리뷰(2026-04-15)에서 도출한 우선순위 항목 중 다음 3건 처리:

1. **README.md 갱신** — Next.js 보일러플레이트 → 프로젝트 고유 정보로 교체
2. **공유 MultiSelectDropdown 컴포넌트 신설** — stock·milling 두 페이지에서 사용
3. **800줄 초과 파일 리팩토링** — `_parts/` 폴더로 분리

> 출고 페이지 month/destination 탭은 사용자 의도로 비활성 상태이므로 건드리지 않음.
> 테스트 프레임워크 도입(#4)은 본 작업 제외, 별도 논의 예정.

---

## 변경 통계

### 800줄 제한 위반 해소

| 파일 | 이전 | 이후 | 절감 |
|------|------|------|------|
| `app/(dashboard)/statistics/stock/stock-stats-client.tsx` | **999** | **560** | -439 |
| `app/(dashboard)/statistics/milling/milling-stats-client.tsx` | **945** | **694** | -251 |

두 파일 모두 800줄 미만으로 정상화. 전역 코딩 원칙(파일 800줄 / 함수 50줄) 준수.

### 신규 파일

| 파일 | 줄수 | 용도 |
|------|------|------|
| `components/statistics/MultiSelectDropdown.tsx` | 121 | 공유 멀티셀렉트 드롭다운 (제네릭 `<T>`) |
| `app/(dashboard)/statistics/stock/_parts/utils.ts` | 23 | `formatKg`, `toChartItems`, `CERT_TYPE_OPTIONS`, `StockTab` |
| `app/(dashboard)/statistics/stock/_parts/stock-tables.tsx` | 182 | 3개 테이블 + 2개 뱃지 + 차트 범례 |
| `app/(dashboard)/statistics/stock/_parts/stock-summary-cards.tsx` | 73 | 요약 카드 (PC·모바일 분기) |
| `app/(dashboard)/statistics/stock/_parts/stock-filter-sheet.tsx` | 199 | 모바일 필터 바텀시트 |
| `app/(dashboard)/statistics/milling/_parts/constants.ts` | 24 | 상수, `MainTab` 타입 |
| `app/(dashboard)/statistics/milling/_parts/milling-filter-sheet.tsx` | 230 | 모바일 필터 바텀시트 |

### 수정 파일

- `README.md` — 프로젝트 소개, 스택, 폴더 구조, 셋업 가이드, 코딩 원칙, 보안 안내
- `docs/plan-stats-cleanup.md` — 출고 제외, MultiSelectDropdown 승격 반영
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`

---

## 주요 결정 사항

### 1. MultiSelectDropdown 디자인 통일

stock과 milling이 시각적으로 다른 인라인 드롭다운을 쓰고 있었음 (stock은 `{id,name}` 객체+네이티브 체크박스, milling은 string+커스텀 ✓ 마크). 통합 시 다음 디자인으로 결정:

- **체크박스**: 네이티브 (`<input type="checkbox">`) — 접근성·표준성
- **활성 색상**: `activeClass` prop 주입 (기본 파랑) — stock의 인증/작목반/품종이 각각 다른 색 사용 가능
- **외부 클릭 닫기**: 컴포넌트 내장 (`useRef` + `mousedown`)
- **추가 옵션 prop**: `maxSelect`, `maxSelectHint`, `onClearAll`, `minWidth` — milling의 5개 제한·전체해제 등 흡수
- **트리거 카운트**: `placeholder (n)` 텍스트 (활성 색상에 의존하지 않는 단순 표기)

이 컴포넌트로 stock 3곳(인증/작목반/품종), milling 2곳(품종/도정구분) 모두 갈아끼움.

### 2. `_parts/` 폴더 컨벤션

각 페이지 폴더 안에 `_parts/` 서브폴더를 두어 분할 파일 보관. Next.js App Router에서 `_` 프리픽스 폴더는 라우트로 잡히지 않으므로 안전.

### 3. 분리 대상 선정 원칙

- **상태/핸들러/메인 렌더는 메인 파일에 유지** (응집도 우선)
- **재사용성이 없는 부속 컴포넌트만 분리**: 테이블, 요약카드, 필터시트 등
- 분리 대상에서 fetch 로직·상태 관리는 빼고 prop drilling으로 데이터만 전달

### 4. milling의 인라인 드롭다운 통합

milling은 원래 ref 기반 인라인 JSX로 드롭다운을 직접 작성하고 있었음. 공유 컴포넌트 도입으로 다음이 함께 정리됨:
- `useRef`/`useEffect`/외부 클릭 핸들러 제거
- `showVarietyDrop`/`showTypeDrop` 상태 제거
- import에서 `useRef`, `useEffect`, `ChevronDown` 제거

---

## 검증

- ✅ `npx tsc --noEmit` 통과 (타입 에러 0)
- ✅ `npx eslint` — 에러 0, 경고 3건 (모두 기존 dead code, 본 작업과 무관)
  - `getMobilePeriodLabel` / `getMobilePeriodSub` (milling, 원래부터 미사용)
  - `resolveGroupBy` (milling/page.tsx, 원래부터 미사용)
- ✅ `npm run build` 통과 (38.3초 컴파일, 19개 페이지 생성)

---

## 확인 필요 사항

브라우저에서 직접 검증해야 할 항목:

1. **/statistics/milling**
   - PC: 품종/도정구분 드롭다운 정상 동작 (열기·닫기·다중선택·외부 클릭 닫기)
   - PC: 품종 드롭다운에서 품종별 탭일 때 5개 초과 시 disabled 시각화
   - 모바일: 필터 시트 정상 동작 (기간/품종/도정구분/생산자, 초기화·검색)

2. **/statistics/stock**
   - PC: 인증/작목반/품종 드롭다운 정상 동작 (각각 다른 색상 활성화 확인)
   - 모바일: 필터 시트 정상 동작 (연산/인증/작목반/품종/생산자)
   - 테이블 3종(생산자/작목반/품종) 정상 렌더

3. **공통**: 칩 제거, 초기화, 검색 동작, isPending 인디케이터

---

## 후속 권장 작업

- **테스트 프레임워크 도입** (vitest 추천) — 본 리팩토링으로 분리된 컴포넌트는 단위 테스트 작성에 유리해짐
- **기존 dead code 정리** — `getMobilePeriodLabel`, `getMobilePeriodSub`, `resolveGroupBy` import (별도 작업)
- **CSP enforcing 전환** — 2026-04-14 보안 작업의 후속 (1~2주 모니터링 후)

---

## 추가 조치 (2026-04-15 당일 UX 정비)

검증 중 사용자가 보고한 이슈 3건에 대한 후속 조치.

### 수율분석 (milling) 필터 기본값 재정비

**문제:** 도정구분별 탭(품종 6개) → 품종별 탭(max 5개) 전환 시 `selectedVarieties`가 이월되어 6개 상태 유지 → 품종별 탭 max 제한과 충돌, 미선택 품종이 모두 disabled로 표시.

**조치:**
- `DEFAULT_PERIOD_VARIETIES`: 4개 → 5개 (천지향5세 추가)
- `DEFAULT_VARIETIES`: 3개 → 5개 (천지향5세만 제외한 5개)
- `handleTabChange`: 이전 탭 필터 이월 금지, 각 탭 기본값으로 **강제 리셋**
  - 기간 필터(날짜/빠른기간/연산)는 유지
  - 품종·도정구분·생산자는 리셋

### 재고분석 (stock) "(전체)" 라벨

**문제:** 빈 필터 = 전체 조회인데 드롭다운 트리거가 단순 "품종"만 표시되어 혼동.

**조치:**
- 공유 `MultiSelectDropdown`에 `emptyLabel` prop 추가 (옵셔널)
- stock의 인증/작목반/품종 드롭다운에 `emptyLabel="(전체)"` 적용 → "품종 (전체)" 표시
- milling은 의미가 달라 적용하지 않음

### 추가 검증

- ✅ `npx tsc --noEmit` 통과
