# 잡곡 재고관리 #5 — 잡곡 입고 등록 + 원물재고 잡곡 탭

> **상위 계획서**: [docs/plan-잡곡재고관리.md](plan-잡곡재고관리.md) §3 화면/플로우 1, 작업 단계 #5
> **선행 완료**: #1 스키마, #2 잡곡 품종 시드, #3 포장단위 정책, #4 라우팅 이동(`/stocks` → `/raw-stocks`)
> **상태**: 📝 **2026-04-30 사용자 1차 피드백 반영** — 재승인 대기

## 목표

`/raw-stocks` 페이지를 **벼/잡곡 2탭 구조**로 재편하고, 잡곡 탭에서 **위탁도정/농가도정** 두 가지 입고 유형을 등록할 수 있게 한다. 외부매입(PURCHASED)은 원물 경유 안 하므로 본 단계 범위 외 — `/packages` 잡곡 탭(작업 단계 #8)에서 처리.

## 범위

### 포함
- **Farmer 모델 확장**: `producesMiscGrain` Boolean 필드 추가 + 마이그레이션
- `/admin/farmers` 등록·수정 폼에 잡곡 생산 체크박스
- `/raw-stocks` 페이지 탭 인프라 (벼/잡곡, URL 쿼리 기반 상태)
- 잡곡 Server Actions 신규 (`app/actions/misc-stock.ts`)
- 잡곡 입고 등록 다이얼로그 (위탁/농가 토글)
- 잡곡 원물재고 목록·필터·그룹 (벼 패턴 차용)
- 위탁 도정업체 자동완성 (과거 입력 `millingVendor` distinct)
- **잡곡 입고 수정·삭제** (#5e — 등록/조회와 같은 다이얼로그 재활용)

### 제외 (후속 단계)
- 디자인 시스템 토큰/아이콘 이관 (#0~#0.7) — 본 작업은 기존 shadcn 패턴 그대로 사용. 디자인 이관은 별도 트랙
- 잡곡 포장 다이얼로그 (#7), 잡곡 매입 등록 (#8)
- 엑셀 Import/Export (#10)
- 잡곡 출고/도정 시작 — 잡곡은 도정 단계가 입고 시점에 이미 끝나 있고, 출고는 판매관리(#9 이후)에서 처리

## 핵심 설계 결정

### 1. 탭 상태 관리
- URL 쿼리 `?tab=rice` (기본) | `?tab=misc`
- shadcn `Tabs` 컴포넌트, `Link` + `useSearchParams`로 상태 동기화
- 탭 전환 시 다른 필터(`varietyId`, `productionYear` 등)는 **리셋** — 벼/잡곡 데이터 도메인이 달라 필터 의미가 다름

### 2. 잡곡 그룹화 키
- **잡곡 그룹 키**: `(생산년도, 품종, 인증유형)` — **벼와 동일** (사용자 결정: 2026-04-30)
- `sourceType`(위탁도정/농가도정)은 **그룹화에 쓰지 않고 행 내 뱃지로만** 표시
- 잡곡도 인증 개념을 그대로 따름 — 작목반 미소속 농가는 "일반"으로 묶여 그룹화됨 (벼 동일 규칙)

### 3. 로트번호 생성
- 잡곡 위탁도정·농가도정 모두 `generateLotNo()` 그대로 사용
- `millingType`은 잡곡에서 의미 없으므로 **'백미' 고정**으로 전달 (`getProductCode`는 잡곡일 때 millingType 무시하고 품종명으로 21~215 산출)
- 작목반 미소속 농가(group=null)는 로트번호 `null` (벼 동일 규칙)

### 4. 위탁도정 수율 계산
- `수율 = weightKg(입고중량) / rawWeightKg(원물중량) * 100`
- 다이얼로그에서 두 값 입력 시 실시간 표시 (서버 저장은 두 raw 값만, 수율은 표시 시 계산)
- 농가도정은 `rawWeightKg = null` → 수율 표시 "-"

### 5. 톤백번호(`bagNo`) 처리
- 스키마상 `bagNo` 필수. 잡곡은 톤백 단위가 아닐 수도 있지만 **로트별 일련번호** 의미로 재활용
- 다이얼로그에서 라벨을 "**일련번호**"로 표기, placeholder는 "1, 2, 3..."
- 중복 체크는 `(category=MISC_GRAIN, productionYear, farmerId, varietyId, bagNo)` 조합 — 벼와 풀 분리

### 6. 잡곡 생산자 풀 — `Farmer.producesMiscGrain` 플래그 도입
- 잡곡도 기존 `Farmer` 테이블 그대로 사용 (별도 테이블 X)
- **`Farmer.producesMiscGrain Boolean @default(false)` 필드 신규 추가** — 마이그레이션 `add_producesMiscGrain_to_farmer`
- 잡곡 입고 다이얼로그의 생산자 드롭다운은 **`producesMiscGrain=true` 농가만** 노출
- `/admin/farmers` 등록·수정 폼에 "잡곡 생산" 체크박스 추가 → 사용자가 해당 농가에 체크하면 잡곡 다이얼로그에 노출됨
- 벼 입고 다이얼로그(`AddStockDialog`)는 **이 플래그를 무시**하고 기존 동작 그대로 (인증유형/년도 필터)
- 신규 농가가 잡곡만 한다면 등록 시 체크박스 ON만 하면 됨 — 벼 인증/작목반 정보는 비워둘 수 있어야 함 (현재 `groupId`도 nullable이라 OK)

## 변경 파일

### 신규 파일 (9개)
1. `prisma/migrations/{timestamp}_add_producesMiscGrain_to_farmer/migration.sql` — Farmer 필드 추가
2. `app/actions/misc-stock.ts` — 잡곡 Server Actions
   - `createMiscStock(data)`, `updateMiscStock(id, data)`, `deleteMiscStock(id)` — 위탁/농가 분기 저장
   - `getMiscStocks(params)` — 평면 조회
   - `getMiscStockGroups(params)` — 그룹별 집계 (인증 그룹 키)
   - `getMiscStocksByGroup(groupKey, params)` — 그룹 펼침 시 호출
   - `getMillingVendors()` — 자동완성용 distinct 목록
   - `getMiscFarmers()` — `producesMiscGrain=true` 농가 조회 (잡곡 다이얼로그 전용)
3. `app/(dashboard)/raw-stocks/misc/add-misc-stock-dialog.tsx` — 위탁/농가 토글 등록·수정 통합 다이얼로그
4. `app/(dashboard)/raw-stocks/misc/misc-stock-page-wrapper.tsx` — 잡곡 탭 wrapper (벼 wrapper 단순화 버전, 도정/장바구니 없음)
5. `app/(dashboard)/raw-stocks/misc/misc-stock-list-client.tsx` — 그룹 + lazy load 목록
6. `app/(dashboard)/raw-stocks/misc/misc-stock-table-row.tsx` — 잡곡 행 표시 (sourceType 뱃지, 원물중량/입고중량/수율, 수정/삭제 버튼)
7. `app/(dashboard)/raw-stocks/misc/misc-stock-filters.tsx` — 잡곡 전용 필터 (sourceType, 품종 MISC_GRAIN만, 생산자, 상태, 인증)
8. `app/(dashboard)/raw-stocks/misc/active-misc-filters.tsx` — 활성 필터 칩
9. `app/(dashboard)/raw-stocks/raw-stocks-tabs.tsx` — 벼/잡곡 탭 셸 (Client)

### 수정 파일 (3~5개)
1. `prisma/schema.prisma` — `Farmer.producesMiscGrain` 추가
2. `app/actions/admin.ts` (또는 farmer 액션 파일) — `createFarmer`/`updateFarmer`에 `producesMiscGrain` 처리, `getFarmersWithGroups` 반환 타입에 필드 포함
3. `app/(dashboard)/admin/farmers/`의 등록/수정 폼 — "잡곡 생산" 체크박스 추가 (1~2개 파일 예상)
4. `app/(dashboard)/raw-stocks/page.tsx` — 탭에 따라 벼/잡곡 데이터 분기 fetch + 잡곡 슬롯 props 전달

### 영향 검토 (변경 불필요 확인)
- `components/breadcrumb-display.tsx` — 라벨은 `/raw-stocks` 그대로 (탭 상태는 브레드크럼 미표시)
- 기존 벼 탭 UI/액션 — 모두 그대로 (`AddStockDialog`도 `producesMiscGrain` 무시)
- `app/actions/stock.ts` — 이미 `category: 'RICE'` 필터 적용됨

## 단계별 커밋 (#5-pre → #5e)

각 단계가 독립적으로 빌드/타입체크 통과해야 함.

### #5-pre — Farmer 모델 확장 + admin UI 체크박스
- `prisma/schema.prisma`에 `Farmer.producesMiscGrain Boolean @default(false)` 추가
- `npx prisma migrate dev --name add_producesMiscGrain_to_farmer`
- `app/actions/admin.ts`(또는 해당 액션 파일):
  - `createFarmer`/`updateFarmer` 인풋 타입에 `producesMiscGrain` 추가 (기본 false)
  - `getFarmersWithGroups` 반환 타입에 필드 포함
- `/admin/farmers` 등록/수정 폼에 "**잡곡도 생산**" 체크박스 추가
- 검증: 벼 입고(`/raw-stocks` 벼 탭) 회귀 X, 농가 등록/수정 정상

### #5a — 잡곡 Server Actions + zod
- `app/actions/misc-stock.ts` 신규
- zod 스키마: `MiscStockFormSchema` — discriminated union (`sourceType`)
  - CONSIGNMENT: rawWeightKg 양수 필수, millingVendor 비어있지 않은 문자열 필수
  - FARMER_MILLED: rawWeightKg/millingVendor null 강제
- `createMiscStock` 내부:
  - 중복 체크 → 로트 생성 → Stock create (category=MISC_GRAIN, sourceType, rawWeightKg, millingVendor 세팅)
  - audit log 기록
  - `revalidatePath('/raw-stocks')`
- `getMiscStocks` / `getMiscStockGroups` / `getMiscStocksByGroup` — `getStocks`/`getStockGroups`/`getStocksByGroup` 패턴 차용. **그룹 키는 벼와 동일** `(productionYear, varietyName, certType)`
- `getMillingVendors`: `prisma.stock.findMany({ where: { category: 'MISC_GRAIN', millingVendor: { not: null } }, distinct: ['millingVendor'], select: { millingVendor: true } })` → 알파벳순
- `getMiscFarmers`: `producesMiscGrain=true` 농가만 조회 (group include)

### #5b — 탭 인프라
- `raw-stocks-tabs.tsx` 신규 (Client) — `Tabs` + URL 쿼리 동기화
- `page.tsx` 수정 — `searchParams.tab`에 따라 분기:
  - `tab !== 'misc'` → 기존 벼 데이터 fetch + `StockPageWrapper` 렌더 (현재 동작)
  - `tab === 'misc'` → 잡곡 데이터 fetch + `MiscStockPageWrapper` 렌더 (#5c에서 구현)
- `tab='misc'`인데 잡곡 컴포넌트가 아직 없는 경우, **이 단계에서는 placeholder** ("잡곡 탭은 #5c에서 구현됩니다")로 두고 다음 커밋에서 채움
- 빌드/타입체크 통과 확인

### #5c — 잡곡 입고 등록 다이얼로그
- `add-misc-stock-dialog.tsx` 신규 — **등록·수정 통합** (`mode: 'create' | 'edit'` prop)
- 헤더: "잡곡 입고 등록" / "잡곡 입고 수정"
- 상단 sourceType 세그먼트 토글 (가로 2개)
- 공통 필드: 생산년도, 인증유형, 생산자(`getMiscFarmers` 결과 + 인증/년도 필터), 품종(MISC_GRAIN만), 입고일, 일련번호(bagNo), 입고중량
- 위탁도정 전용: 원물중량, 위탁 도정업체명(`Combobox`로 자동완성)
- 농가도정: 위 두 필드 숨김
- 위탁 선택 시 수율 미리보기 (`weightKg / rawWeightKg * 100` 소수점 1자리)
- 등록: `createMiscStock` 호출 → `triggerDataUpdate()` + 닫기
- 수정 모드는 #5e에서 활성화. 본 커밋에서는 **등록 모드만** 동작 검증
- 목록/필터는 placeholder. 다이얼로그 자체 띄우기·저장만 검증

### #5d — 목록/필터/그룹화 + 통합
- `misc-stock-page-wrapper.tsx`, `misc-stock-list-client.tsx`, `misc-stock-table-row.tsx`, `misc-stock-filters.tsx`, `active-misc-filters.tsx` 신규
- `page.tsx`의 `tab='misc'` 분기에 실제 wrapper 결합
- 벼와 동일한 lazy load 패턴 (그룹 헤더 → 펼침 시 항목 fetch)
- 행 표시: 입고일·로트·품종·생산자·**sourceType 뱃지**·원물중량(위탁만)·입고중량·수율(위탁만)·상태
- 모바일 카드 스타일은 벼 패턴 단순 차용
- 필터: 생산년도, 품종(MISC_GRAIN), 생산자(잡곡 농가만), sourceType(위탁/농가), 인증유형, 상태

### #5e — 잡곡 입고 수정·삭제
- `updateMiscStock(id, data)` / `deleteMiscStock(id)` Server Action 추가 (#5a 액션 파일에 추가)
  - 수정: sourceType 변경 시 rawWeightKg/millingVendor 정합성 재검증
  - 삭제: `status === 'CONSUMED'`(이미 포장됨)이거나 outputPackages가 있으면 거절
  - audit log 기록
- 행에서 수정/삭제 트리거 — 벼 패턴 차용 (`edit-stock-dialog`/`delete-stock-button` 구조)
- `add-misc-stock-dialog.tsx`의 edit 모드 활성화: `defaultValues` prop으로 기존 값 prefill
- 검증: 등록 → 수정 → 삭제 라이프사이클 한 번 통과

## zod 스키마 초안

```ts
// app/actions/misc-stock.ts
const baseSchema = z.object({
  productionYear: z.number().int().min(2000).max(2100),
  bagNo: z.number().int().positive(),
  weightKg: z.number().positive(),
  incomingDate: z.date(),
  farmerId: z.number().int().positive(),
  varietyId: z.number().int().positive(),
  actualFarmer: z.string().optional(),
})

const consignmentSchema = baseSchema.extend({
  sourceType: z.literal('CONSIGNMENT'),
  rawWeightKg: z.number().positive(),
  millingVendor: z.string().min(1),
})

const farmerMilledSchema = baseSchema.extend({
  sourceType: z.literal('FARMER_MILLED'),
  rawWeightKg: z.null().optional(),
  millingVendor: z.null().optional(),
})

export const MiscStockFormSchema = z.discriminatedUnion('sourceType', [
  consignmentSchema,
  farmerMilledSchema,
])
```

## 테스트 시나리오 (수동)

1. `/admin/farmers` → 농가 1명 "잡곡 생산" 체크박스 ON 저장 → 다시 열어 체크 유지 확인
2. `/raw-stocks` 진입 → 벼 탭이 기본 활성, 기존 벼 목록 표시 (회귀 X)
3. 잡곡 탭 클릭 → URL `?tab=misc`, 빈 잡곡 목록 + "[+ 잡곡 입고]" 버튼
4. 잡곡 입고 다이얼로그 → 생산자 드롭다운에 **#1에서 체크한 농가만** 노출 확인
5. 위탁도정 토글:
   - 원물중량 800, 입고중량 540 입력 → 수율 67.5% 미리보기
   - 위탁 도정업체명 입력 → 저장 → Toast 성공, 목록에 그룹 추가
6. 같은 다이얼로그 재오픈 → 도정업체명 자동완성에 직전 입력값 노출
7. 농가도정 토글 → 원물중량/위탁업체 필드 사라짐 → 입고중량만 입력 → 저장 성공
8. 그룹 헤더 클릭 → 항목 lazy load → 행 표시 검증 (sourceType 뱃지, 원물·입고·수율)
9. 필터: sourceType=위탁만, 품종=보리만, 인증=유기농만 등 조합 동작 확인
10. URL `/raw-stocks?tab=misc&sourceType=CONSIGNMENT` 직접 접근 → 필터 적용된 상태로 진입
11. 벼 탭으로 돌아갔다가 잡곡 탭 다시 → 잡곡 필터 상태 유지/리셋 정책 확인
12. **수정**: 행 수정 버튼 → 다이얼로그 prefill → sourceType 변경(농가→위탁) → 저장 → 목록 갱신
13. **삭제**: 행 삭제 버튼 → 확인 모달 → 삭제 → 목록에서 사라짐
14. 도정관리(`/milling`)에서 벼 데이터 정상 동작 (회귀 X) — 잡곡 Stock이 도정 후보 목록에 섞이지 않는지 (이미 `getStocksByGroup`에 RICE 필터 있어 안전)
15. 벼 입고(`AddStockDialog`) 회귀 — `producesMiscGrain` 도입 후에도 벼 다이얼로그 생산자 드롭다운 동작 변화 X

## 위험 요소

- **탭 전환 시 필터 리셋 vs 유지** 정책 — 위 §3에서 "리셋"으로 결정. 만약 유지하려면 `farmerId`처럼 도메인 공유 가능한 필터만 살리는 패치가 필요. 1차는 단순 리셋
- **`bagNo` 라벨 변경**: 벼 다이얼로그는 "톤백번호"인데 잡곡은 "일련번호". 같은 `bagNo` 컬럼이지만 의미가 다르니 라벨만 분기. 엑셀 Import/Export(#10)에서도 헤더 라벨 분기 필요
- **농가 풀 단순화**: 잡곡 다이얼로그가 모든 농가를 보여주면 벼 농가가 잡곡으로 등록될 수 있음. 정책상 의도된 동작이지만 추후 농가 카테고리 정책이 생기면 재검토
- **로트번호 의미**: 잡곡도 벼와 동일한 14자리 로트(YYMMDD-제품코드-인증번호-개인번호). 인증번호는 작목반 인증인데 잡곡은 인증 약함 → 빈 작목반 농가가 많을 가능성 → 잡곡 로트 `null` 비율이 높을 수 있음. 사용자 측에서 OK인지 확인 필요
- **도정업체명 정합성**: `millingVendor`가 자유 텍스트 → "한국미곡" / "한국미곡 " / "(주)한국미곡" 같은 미세 차이로 distinct가 늘어날 수 있음. 1차는 그대로 두고, 표준화는 추후 별도 마스터 테이블화 검토

## 사용자 1차 결정사항 (2026-04-30)

| # | 항목 | 결정 |
| --- | --- | --- |
| 1 | 잡곡 그룹 키 | **벼와 동일** `(생산년도, 품종, 인증유형)`. sourceType은 행 뱃지로만 |
| 2 | `bagNo` 라벨 | 잡곡에서 "일련번호"로 재활용 (스키마 변경 X) |
| 3 | 잡곡 생산자 풀 | `Farmer.producesMiscGrain` 필드 신설, `/admin/farmers` 체크박스 |
| 4 | 단계 분할 | #5-pre, #5a~#5e 5+1단계 |
| 5 | 수정/삭제 | A안 — #5e로 본 작업에 포함 |

## 완료 정의 (DoD)

- 위 단계별 커밋 6개(#5-pre, #5a~#5e) 모두 통과
- 타입체크(`npx tsc --noEmit`) 통과
- 수동 테스트 시나리오 1~15 모두 정상
- `docs/worklog.md`에 #5 작업 기록 (커밋별 줄 추가)
- `docs/report-잡곡재고관리-#5-2026-04-30.md` 결과보고서 작성

## 백로그 메모

기능 추가에 따른 권한 키 재정리는 본 #5에서는 다루지 않음. 사이드바/메뉴 개편(#9) 직후 **#9.5 권한 체계 정리** 단계에서 일괄 처리 — 자세한 내용은 [docs/리팩토링-백로그.md §12](../리팩토링-백로그.md) 참조.
