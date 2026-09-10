# 계획서 — 도정구분별 수율 기준값 전 화면 반영

작성일: 2026-09-10

## 1. 배경 · 문제

관리자 설정(`/admin/settings`)의 「도정구분별 수율 기준값」은 **저장은 정상**이다.
`SystemConfig`에 `yield_rate_{도정구분}` 키로 upsert되고 `requireAdmin()` 가드도 걸려 있다.

문제는 **읽는 쪽이 갈라져 있어서 설정값이 거의 반영되지 않는다**는 것이다.
수율 기준값을 쓰는 곳을 전수 grep한 결과:

| # | 위치 | 현재 기준값 출처 | 설정 반영 |
|---|---|---|---|
| 1 | `app/(dashboard)/milling/add-packaging-dialog.tsx:250` | `getYieldRate()` → DB | ✅ 유일 |
| 2 | `app/(dashboard)/_components/recent-logs-list.tsx:34` | `DEFAULT_YIELD_RATES` 상수 | ❌ |
| 3 | `app/(dashboard)/milling/milling-table-row.tsx:172` | `>= 70` 하드코딩 | ❌ |
| 4 | `app/(dashboard)/milling/mobile-milling-card.tsx:161` | `>= 70` / `>= 60` 하드코딩 | ❌ |
| 5 | `components/statistics/MillingTable.tsx:236` | `>= 70` 하드코딩 | ❌ |
| 6 | `app/actions/statistics.ts:162` | `yield_rate_target` — **존재하지 않는 키** | ❌ 죽은 코드 |

### 6번을 따로 짚는 이유
관리자 화면은 `yield_rate_백미` 식으로 **도정구분별로** 저장하는데,
통계는 `yield_rate_target`이라는 **단일 키**를 찾는다. 그 키를 쓰는 코드가 저장·소비 어디에도 없다.
→ `findUnique`는 언제나 `null` → `targetYieldRate`는 항상 `68` 고정.
게다가 그렇게 만든 값을 **화면에서 아무도 쓰지 않는다**(`grep targetYieldRate` 결과 statistics.ts 내부 3줄이 전부).
즉 통계에는 목표수율 표시 기능 자체가 없다.

### 부수 문제 — 배지 색상 규칙이 4곳 제각각

| 위치 | 규칙 |
|---|---|
| recent-logs-list | `<=60` 빨강 / `>=기준` 파랑 / 그 외 기본 (3단계) |
| milling-table-row | `>=70` primary / 그 외 회색 (2단계) |
| mobile-milling-card | `>=70` primary / `>=60` amber / 그 외 빨강 (3단계) |
| MillingTable(통계) | `>=70` 파랑 / 그 외 회색 (2단계) |

같은 수율이 화면마다 다른 색으로 보인다. 기준값을 설정에서 가져오려면 어차피 이 4곳을 다 건드려야 하므로,
**판정 로직을 단일 원천 순수함수로 묶는다.**

## 2. 목표

- 관리자 설정에서 기준값을 바꾸면 **대시보드 · 도정목록(PC/모바일) · 통계**에 전부 반영된다.
- 수율 등급 판정이 `lib/`의 순수함수 **한 곳**에서만 이뤄진다(단위테스트 대상).
- 통계의 죽은 `yield_rate_target` 경로를 정리한다.

## 3. 범위 밖 (건드리지 않음)

- `lib/milling-yield.ts`의 `matchesYieldFilter` 구간(50/60/70) — 이건 **검색 필터 선택지**이지 기준값이 아니다.
- 차트 Y축 눈금 `YIELD_TICKS = [55,60,65,70,75]` — 축 눈금이지 기준값이 아니다.
- `lib/lot-generation.ts:5`의 `getYieldRate` — export만 되고 **호출처가 없는 죽은 코드**.
  삭제는 별도 요청으로 넘긴다(수술적 변경 원칙). 단 §7에 백로그로 남긴다.
- `app/actions/dashboard.ts`의 수율 **계산**(uruchiYield 등) — 실측값이라 기준값과 무관.

## 4. 설계

### 4.1 단일 원천 순수함수 — `lib/milling-yield.ts`에 추가

```ts
export type YieldLevel = 'good' | 'warn' | 'bad'

/** 실측 수율을 도정구분별 기준값과 비교해 등급 판정 */
export function getYieldLevel(
    yieldRate: number,
    millingType: string,
    rates: Record<string, number>,
): YieldLevel
```

- `rates[millingType]` 없으면 `DEFAULT_YIELD_RATES[millingType]` → 없으면 68로 폴백.
- 판정: `>= 기준` → `good` / `>= 기준 - WARN_GAP` → `warn` / 그 미만 → `bad`
- **`WARN_GAP`은 결정 필요** — §6 참조.
- 기존 `matchesYieldFilter`와 같은 파일에 두어 수율 판정 로직을 한 파일에 모은다.
- 순수함수이므로 `lib/milling-yield.test.ts` 신설해 경계값 테스트(`npm test` = `tsx --test "lib/**/*.test.ts"`).

### 4.2 설정값 공급 경로 — Context Provider

소비처 4곳이 전부 **클라이언트 컴포넌트**라 DB 값을 직접 못 읽는다. 세 가지 안 중:

| 안 | 내용 | 판단 |
|---|---|---|
| A | 페이지마다 `getYieldRates()` 호출 → props 전달 | `/milling`은 page → wrapper → list-client → row/card로 **4단계 drilling**. ❌ |
| B | **layout에 Provider, 서버에서 1회 조회** | 소비 화면 3개가 전부 `(dashboard)` 그룹 → 한 곳에서 커버. 쿼리 1회. ✅ |
| C | 클라이언트 `useEffect` fetch | 화면마다 요청 + 초기 깜빡임. ❌ |

**B안 채택.**

- 신설: `app/(dashboard)/yield-rates-context.tsx` (`'use client'`, `YieldRatesProvider` + `useYieldRates()`)
  - 기존 `raw-stocks/milling-cart-context.tsx`와 같은 패턴을 따른다.
- `app/(dashboard)/layout.tsx`를 `async`로 바꿔 `getYieldRates()` 호출 → Provider에 주입.
  - 인증: `middleware.ts` matcher가 `/login`·정적파일 제외 **전 경로**를 `withAuth`로 막고 있어
    layout 렌더 시점엔 이미 세션이 있다 → `getYieldRates()` 내부 `requireSession()` 통과 안전.
  - `MillingCartProvider` **바깥**에 배치(서버 데이터 → 클라 상태 순서).
- `useYieldRates()`는 Provider 없이 호출되면 `DEFAULT_YIELD_RATES`를 반환(통계 컴포넌트가 그룹 밖에서 재사용될 여지 대비).

### 4.3 소비처 4곳 교체

| 파일 | 변경 |
|---|---|
| `recent-logs-list.tsx` | `getYieldColor` → `useYieldRates()` + `getYieldLevel()`, 색은 level→class 매핑 |
| `milling-table-row.tsx:172` | `yieldRate >= 70` → `getYieldLevel(...)` |
| `mobile-milling-card.tsx:161` | 3단 하드코딩 → `getYieldLevel(...)` |
| `components/statistics/MillingTable.tsx:236` | `val >= 70` → `getYieldLevel(...)`, `millingType`은 같은 row에 이미 있음(`TableRow.millingType`) |

- level→Tailwind class 매핑도 헬퍼로 뽑되, **배지형(bg+text)과 텍스트형(text만)** 두 벌이 필요하다
  (recent-logs-list는 글자색만, 나머지는 알약 배지). 두 개 상수 맵으로 둔다.

### 4.4 통계의 죽은 코드 정리 — `app/actions/statistics.ts`

`yield_rate_target` 쿼리 + `targetYieldRate` 타입/반환 **삭제**.
소비처가 없어 화면 영향 0. (통계에 목표선을 실제로 그리는 건 신규 기능이므로 §6에서 별도 확인.)

## 5. 작업 단계

1. `lib/milling-yield.ts` — `getYieldLevel` + level→class 맵 추가
2. `lib/milling-yield.test.ts` 신설 — 경계값(기준 정확히, 기준-1, warn 경계, 폴백, 빈 rates) 테스트
3. `app/(dashboard)/yield-rates-context.tsx` 신설
4. `app/(dashboard)/layout.tsx` — async화 + Provider 주입
5. 소비처 4곳 교체 (§4.3)
6. `app/actions/statistics.ts` — 죽은 `targetYieldRate` 제거
7. 검증: `npx tsc --noEmit` + `npm run lint` + `npm test`
   → 화면 확인은 사용자 브라우저(dev 서버 상시 기동, `next build` 금지)

**변경 파일 8개** (신설 3 / 수정 5)

## 6. 결정 사항 (2026-09-10 승인)

1. **`WARN_GAP` = 5** — 상대값 채택. 경고 하한은 `기준 - 5`p.
   → 백미(기준 68): 63 미만 `bad` / 63~67.9 `warn` / 68 이상 `good`
   → 현미(기준 70): 65 미만 / 65~69.9 / 70 이상
2. **통계 목표수율** — 죽은 `yield_rate_target` 코드만 삭제. 목표선 표시는 하지 않음.
3. **배지 색 통일 승인** — 기준이 통일되므로 도정목록 PC/모바일 겉모습이 바뀌는 것 수용.

## 7. 백로그로 남기는 것

- `lib/lot-generation.ts:5` 죽은 `getYieldRate` 삭제 (주석에 "향후 DB 값으로 교체 예정"이라 적혀 있으나 이미 settings 액션이 그 역할을 함)
- `DEFAULT_YIELD_RATES`에 남아 있는 `'찹쌀'` 키 — `MILLING_TYPES`에서는 폐기됐는데 상수엔 남아 있음
