# 통계 페이지 정리 & 리팩토링 계획

> 작성일: 2026-04-15
> 상태: 승인됨 (2026-04-15)

---

## 작업 목표

프로젝트 종합 리뷰(2026-04-15) 결과 도출된 우선순위 액션 중 다음 2건을 처리한다.

1. **800줄 초과 파일 리팩토링** — `stock-stats-client.tsx` (999줄), `milling-stats-client.tsx` (945줄)
2. **README 갱신** — Next.js 보일러플레이트 → 프로젝트 고유 정보로 교체

> ❌ **출고 페이지 탭 활성화는 제외**: month·destination 탭은 사용자가 의도적으로 막아둔 상태. 건드리지 않는다.

테스트 프레임워크 도입(#4)은 이번 작업에서 제외하고, 위 2건 완료 후 별도로 논의한다.

---

## 작업 1: 800줄 초과 파일 리팩토링

### 원칙 (사용자 글로벌 규칙)
- 파일 최대 800줄
- 함수 최대 50줄
- 수술적 변경: 동작 변경 없이 분할만, 인접 코드 정리는 별도 작업

### 분할 전략

두 파일 모두 다음과 같은 공통 구조를 가진다:
1. 상단: 타입 정의, 상수, 유틸 함수
2. 중단: 내부 컴포넌트 (`MultiSelectDropdown`, 요약 카드 등)
3. 하단: 메인 클라이언트 컴포넌트 (`useState`/`useTransition`/렌더링)

→ **상태 관리 로직과 렌더링은 메인 파일에 유지**(자연스럽게 응집해야 함), **부가 컴포넌트와 유틸만 외부 파일로 분리**.

### 공유 컴포넌트 승격 결정
- ✅ **MultiSelectDropdown은 공유 컴포넌트로 승격** (사용자 승인 2026-04-15)
- 위치: `components/statistics/MultiSelectDropdown.tsx`
- 제네릭 시그니처로 정의 (`<T extends string | number>`)하여 stock의 `MultiOption<T>`, milling의 string 옵션, output의 `VarietyOption` 모두 수용

### 폴더 컨벤션
각 페이지 폴더 안에 같은 위치(`_parts/`)에 분할 파일을 둔다. Next.js App Router에서 `_` 프리픽스 폴더는 라우트로 잡히지 않는다.

```
app/(dashboard)/statistics/stock/
├── page.tsx
├── stock-stats-client.tsx        ← 메인 (800줄 이하)
└── _parts/
    ├── multi-select-dropdown.tsx
    ├── stock-filter-sheet.tsx    ← 모바일 필터 팝업
    ├── stock-summary-cards.tsx   ← (있을 경우)
    └── utils.ts                  ← formatKg, toChartItems 등
```

### 작업 1-1: stock-stats-client.tsx (999 → ~700줄 목표)

#### 분리 대상 (예상)
| 분리 파일 | 내용 | 추정 줄수 |
|----------|------|----------|
| `_parts/multi-select-dropdown.tsx` | 제네릭 MultiSelectDropdown 컴포넌트 | ~80 |
| `_parts/stock-filter-sheet.tsx` | 모바일 바텀시트 필터 팝업 | ~120 |
| `_parts/utils.ts` | `formatKg`, `toChartItems`, 상수 | ~30 |
| `stock-stats-client.tsx` | 메인 컴포넌트 (상태/핸들러/렌더) | ~700 |

* 정확한 분리 지점은 파일 전체를 읽고 결정. 위 표는 예상치.
* 타입은 `_parts/utils.ts` 또는 별도 `_parts/types.ts`로 추출 검토.

### 작업 1-2: milling-stats-client.tsx (945 → ~700줄 목표)

#### 분리 대상 (예상)
| 분리 파일 | 내용 | 추정 줄수 |
|----------|------|----------|
| `_parts/multi-select-dropdown.tsx` | (재사용 가능하면 stock과 공유 검토) | ~80 |
| `_parts/milling-filter-sheet.tsx` | 모바일 바텀시트 필터 팝업 | ~150 |
| `_parts/utils.ts` | 상수, 헬퍼 (`emptyMultiSeries`, `MAIN_TABS` 등) | ~50 |
| `milling-stats-client.tsx` | 메인 컴포넌트 | ~650 |

#### 공유 컴포넌트 검토
- `MultiSelectDropdown`은 두 파일 모두에 비슷한 형태로 존재 → 진짜 시그니처가 같으면 `components/statistics/MultiSelectDropdown.tsx`로 승격 검토
- 다만 prop 타입(제네릭 `<T>` vs `VarietyOption`)이 다를 수 있음. **읽어보고 결정**, 무리한 통합은 하지 않음 (사용자 원칙: "3개 비슷한 라인이 섣부른 추상화보다 낫다")

### 검증
- 분리 후 `npm run build` 또는 `tsc --noEmit`로 타입 에러 0건 확인
- 데브서버에서 두 페이지 PC/모바일 모두 정상 동작 확인 (필터, 차트, 탭 전환)

### 위험도
중간. 코드 이동량이 크지만 동작 변경 없는 순수 리팩토링.

---

## 작업 2: README.md 갱신

### 현황
[README.md](README.md) 37줄 — `create-next-app` 보일러플레이트 그대로

### 갱신 내용
- 프로젝트 소개: Milling-Log = 도정공장 운영관리 PWA
- 주요 기능: 도정 기록, 농가/재고 관리, 출고 관리, 통계 분석, 사용자/감사 로그
- 스택: Next.js 16, React 19, TypeScript, Prisma + PostgreSQL(Neon), NextAuth(카카오), Tailwind 4, PWA(next-pwa)
- 개발 환경 셋업 (의존성 설치, `.env` 변수, Prisma 마이그레이션, 개발 서버 실행)
- 폴더 구조 요약
- 배포: Vercel
- 기여 가이드: `docs/plan-*.md` 작성 → 승인 → 작업 → `docs/report-*.md` + `docs/worklog.md` 업데이트

### 위험도
없음.

---

## 작업 순서

1. README.md 갱신 (가장 가벼움, 워밍업)
2. 공유 `MultiSelectDropdown.tsx` 컴포넌트 작성
3. milling-stats-client.tsx 리팩토링 (분리 + 공유 컴포넌트 사용)
4. stock-stats-client.tsx 리팩토링 (분리 + 공유 컴포넌트 사용)
5. 타입 체크 (`tsc --noEmit`) + 데브서버 통합 확인
6. 결과보고서 작성 (`docs/report-stats-cleanup-2026-04-15.md`)
7. worklog.md 업데이트

---

## 변경 파일 (예상)

| 구분 | 파일 |
|------|------|
| 신규 | `components/statistics/MultiSelectDropdown.tsx` (공유 컴포넌트) |
| 신규 | `app/(dashboard)/statistics/stock/_parts/stock-filter-sheet.tsx` |
| 신규 | `app/(dashboard)/statistics/stock/_parts/utils.ts` |
| 신규 | `app/(dashboard)/statistics/milling/_parts/milling-filter-sheet.tsx` |
| 신규 | `app/(dashboard)/statistics/milling/_parts/utils.ts` |
| 수정 | `app/(dashboard)/statistics/stock/stock-stats-client.tsx` |
| 수정 | `app/(dashboard)/statistics/milling/milling-stats-client.tsx` |
| 수정 | `README.md` |
| 신규 | `docs/report-stats-cleanup-2026-04-15.md` |
| 수정 | `docs/worklog.md` |
