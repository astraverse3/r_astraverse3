# 계획서 — 날짜가 하루 전날로 뜬다 (백로그 §39)

- 작성: 2026-09-28
- 상태: **승인 대기**

## 1. 목표

날짜를 **읽어서 `yyyy-mm-dd`로 만드는 모든 곳**을 KST 기준 공용 헬퍼 하나로 바꾼다.
저장된 데이터는 건드리지 않는다.

## 2. 실측 — 저장은 두 가지가 섞여 있다 (2026-09-28, 읽기 전용 조회)

| 필드 | UTC 자정 | KST 자정 (UTC 15:00) | 그 외 시각 |
|---|---:|---:|---:|
| `Stock.incomingDate` (원물 입고일) | 2,117 | – | – |
| `MillingBatch.date` (도정일) | 202 | – | – |
| `PurchaseOrder.orderDate` | 76 | – | – |
| `PurchaseOrderUpload.orderDate` / `loadingDate` | 5 / 4 | – | – |
| `PackageMovement.occurredAt` (차감 발생일) | 467 (소급 정리분) | **102** | 116 (KST 09~24시) |
| `StockRelease.date` (원물 출고일) | – | **9** | 7 (KST 09~24시) |
| `MillingOutputPackage.incomingDate` (매입일) | 1 | **1** | – |
| `MillingOutputPackage.createdAt` (포장일) | – | – | 713 (전부 KST 09~24시) |
| `Repack.occurredAt` | – | – | 13 (전부 KST 09~24시) |

**KST 자정으로 저장된 112행만 지금 하루 전날로 보인다.** 나머지는 UTC 자정이거나 낮 시간이라
UTC로 잘라도 같은 날이 나온다. 다만 이건 **우연**이라서 KST 00~09시에 만든 행은 똑같이 밀린다.

### 🔴 핵심 — 읽기를 KST로 바꾸면 두 규칙이 다 맞다

KST 하루는 `[UTC 전날 15:00, UTC 당일 15:00)`이다. 이 구간 안에
UTC 자정(= KST 09:00)도, KST 자정도, 낮 시간도 모두 **같은 날짜**로 들어간다.
→ **데이터 이전은 필요 없다.** 저장 규칙이 섞인 건 그대로 두고 읽는 쪽만 고친다.

## 3. 범위 — 네 부류

### A. 서버에서 날짜를 문자열로 만드는 곳 (`toISOString().slice/split`) — 15곳

| 위치 | 값 |
|---|---|
| `app/actions/package-movement.ts:408` | 차감 발생일 (**102행 지금 틀림**) |
| `app/actions/purchase-order.ts:101·111` | 상차일 · 발주일 (목록) |
| `app/actions/purchase-order-matrix.ts:179·184` | 발주일 · 상차일 (매트릭스 — 목록과 **반드시 같이**) |
| `lib/purchase-order-allocation.ts:105·115` | 중복 비교 키 발주일 |
| `app/actions/packages.ts:341·952·1163` | 원물 입고일 · 매입일 · 매입일(엑셀) |
| `app/actions/packages.ts:1165` | 포장일자(엑셀, `createdAt`) |
| `app/actions/misc-stock.ts:552` | 잡곡 입고일자(엑셀) |
| `app/actions/milling.ts:855` | 도정일(엑셀) |

### B. 클라이언트에서 `toISOString()`으로 날짜 입력칸을 채우는 곳 — 10곳

브라우저는 KST지만 `toISOString()`은 UTC라서 같은 결함이 생긴다.

- **「오늘」 기본값 5곳**: `misc-purchase-dialog.tsx:41` · `raw-stocks/add-stock-dialog.tsx:232` ·
  `add-misc-stock-dialog.tsx:117·183` · `start-milling-dialog.tsx:48`
  → **KST 00~09시에 열면 어제 날짜가 들어간다.**
- **수정 다이얼로그 5곳**: `milling/stock-list-dialog.tsx:105·128` · `raw-stocks/edit-stock-dialog.tsx:181` ·
  `add-misc-stock-dialog.tsx:134` · `start-milling-dialog.tsx:53`
  → 지금은 UTC 자정 데이터라 맞게 보인다. 🔴 하지만 KST 자정 행을 열면 **하루 전 날짜가 입력칸에 들어가고,
  그대로 저장하면 데이터가 하루 밀린다.** 표시 결함이 아니라 **데이터 오염** 경로라서 같이 막는다.

### C. 서버의 로컬시간 의존 코드 — **개발 PC(KST)와 Vercel(UTC)이 다르게 동작**

개발 서버에서는 재현이 안 되고 실서버에서만 틀리는 부류다.

| 위치 | 내용 |
|---|---|
| `app/actions/packages.ts:118` `toIsoDate` | `getFullYear/getMonth/getDate` → 로컬(=Vercel UTC) |
| `lib/package-where.ts:42·53` `parseLocalDate`·`nextDay` | 포장일자 **검색 범위**가 실서버에선 UTC 하루 → KST 자정 매입 행이 검색에서 빠진다 |
| `milling-excel.ts:132` · `milling.ts:960·1000` · `release-excel.ts:53` | `toLocaleDateString('ko-KR')`에 `timeZone` 없음 |
| `app/actions/audit.ts:104` | 감사로그 엑셀 「일시」가 실서버에선 **9시간 이르게** 찍힌다 |
| `app/actions/output-statistics.ts:55` `toMonthKey` | 월 경계 |

### D. 파일명 날짜 7곳 (선택)

`audit_logs_2026-09-28.xlsx` 같은 것들. 헬퍼가 생기면 한 줄씩 바꾸는 거라서 **같이 하는 걸 추천**한다.
실제 피해는 새벽에 받은 파일 이름이 어제 날짜로 붙는 정도다.

### 이번에 **안 하는 것** (백로그로 남김)

- `app/actions/statistics.ts` 버킷 생성(date-fns `format`, `setHours`) — 통계 전체 흐름이라 범위가 크다.
  대상 데이터(`MillingBatch.date`)가 전부 UTC 자정이라 지금은 맞게 나온다.
- `lib/production-year.ts`의 `now.getMonth()` — 달이 바뀌는 날 새벽 9시간만 어긋난다.
- **저장 규칙 통일** — 2장대로 읽기만 고치면 되니 필요 없다.

## 4. 단계

### 1단계 — 공용 헬퍼 `lib/kst-date.ts` + 테스트

```ts
toKstDate(d: Date | string): string          // 'yyyy-mm-dd' (KST)
todayKst(now?: Date): string                 // 오늘 (KST)
kstDayRange(ymd: string): { gte: Date; lt: Date } | null   // KST 하루 [00:00, 다음날 00:00)
toKstMonth(d: Date): string                  // 'yyyy-mm'
formatKstKo(d: Date, withTime?: boolean): string  // ko-KR 표기 + timeZone: 'Asia/Seoul'
```

- 🔴 **프로세스 시간대에 기대지 않는다** — `getTime() + 9h` 후 `getUTC*`만 쓴다(한국은 서머타임이 없다).
- `lib/loading-schedule.ts`의 `todayIsoKst`는 **이 헬퍼에 위임**하고 export는 유지한다(호출부 5곳 그대로).
- 테스트: UTC 자정 / KST 자정 / KST 08:59 / KST 09:00 / 23:59 / 월말 / 연말 / 윤년 2·29 / 잘못된 형식.
  **`TZ=UTC`와 `TZ=Asia/Seoul` 두 번 돌려서** 결과가 같은지 확인한다(실서버·개발 PC 차이 재현).

### 2단계 — A (서버 문자열 15곳)

발주서 목록·매트릭스·중복키는 **한 커밋에서 같이** 바꾼다(`purchase-order-matrix.ts:176` 주석이 경고한 그대로).
그 주석은 삭제한다.

### 3단계 — B (클라이언트 10곳)

오늘 기본값은 `todayKst()`, 수정 다이얼로그는 `toKstDate()`를 쓴다.

### 4단계 — C (로컬시간 의존)

`package-where`는 `kstDayRange`로 바꾼다. 🔴 **목록 표시(`toIsoDate`)와 검색 범위가 같은 기준이어야 한다**
(주석이 이미 경고하고 있다). 두 곳을 **같이** 바꾼다.

### 5단계 — D (파일명, 승인 시)

### 6단계 — 백로그 §39 정리 · 보고서 · worklog

§39에 「해결 + 남은 것(statistics·production-year)」을 기록하고, 메모리를 갱신한다.

## 5. 검증

- `npx tsc --noEmit` · `npx eslint .`(기준선 0/0 유지) · `npm test`(헬퍼 테스트는 TZ 두 가지로).
- 🔴 **grep 0 확인**: 끝나면 `toISOString().slice(0, 10)` · `toISOString().split('T')`가 헬퍼 안에서만 나와야 한다.
- **브라우저 확인(사용자)**:
  1. 제품재고 재고차감 이력에서 2026-09-08에 넣은 일괄차감이 `26-09-08`로 보이는지 (지금은 `26-09-07`)
  2. 발주서 목록과 매트릭스 머리글의 발주일·상차일이 **같은 날짜**인지
  3. 원물 수정 다이얼로그를 열었을 때 입고일이 목록과 같은지
  4. 포장일자 검색이 전과 같은 결과를 내는지
- ⚠️ C 부류는 **개발 서버에서 달라진 게 안 보이는 게 정상**이다(개발 PC가 KST라서). 대신 테스트의 `TZ=UTC` 실행으로 증명한다.

## 6. 리스크

| 리스크 | 대응 |
|---|---|
| 발주서 중복 판정 키가 바뀌어 기존 묶음과 중복 판정이 어긋남 | 실측상 발주일은 전부 UTC 자정이라 UTC로 잘라도 KST로 잘라도 같은 날짜 → 키 불변 |
| 포장일자 검색 결과가 달라짐 | `createdAt`은 전부 KST 09~24시라 UTC 하루와 KST 하루 둘 다 포함 → 결과 불변. 매입 1행만 새로 잡힌다(의도) |
| 파일이 많다(약 25개) | 단계별로 커밋한다. 각 커밋은 tsc·test 통과 상태로 |

## 7. 확인 요청

1. **D(파일명 7곳)도 같이 할지** — 추천: 같이
2. **C의 `statistics.ts`·`production-year.ts`는 이번에 빼는 것** — 괜찮은지
