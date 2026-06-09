# 잡곡 재고관리 기능 추가 계획

> **상태**: ✅ **계획 확정** (2026-04-24)
> **다음 액션**: Claude Design에서 시안 제작 → Claude Code로 번들 핸드오프 → 구현 시작
> **단일 진실 원천**: 본 문서. 구현 중 스펙 변경이 발생하면 여기부터 업데이트.

## 목표
벼(쌀)와 별도로 **잡곡 입고 → 포장 → 제품재고 등록**까지의 플로우를 관리한다. 판매관리 기능 구현 전 재고 인프라를 먼저 확정해, 판매관리에서 벼·잡곡 제품을 **단일 인터페이스(`MillingOutputPackage`)**로 차감할 수 있도록 한다.

## 디자인 시스템 이관 정책 (B안 — 점진적 이관)

핸드오프 번들 [docs/handoff/잡곡재고관리/](../handoff/잡곡재고관리/)을 "접촉하는 경로만" 새 시스템으로 이관한다. 기존 벼 UI(`/milling`, `/admin` 등)의 일괄 교체는 본 계획 범위 밖.

### 이번 범위에 포함
- **전역 토큰**: `app/globals.css` — 번들 HSL 토큰·커스텀 shadow 추가
- **헤더 1줄 브레드크럼**: `components/breadcrumb-display.tsx` 교체 → **모든 페이지 자동 적용** (영향 범위가 한 컴포넌트로 국한되어 이번에 전역 이관)
  - path 기반 `ICON_MAP` / `DESCRIPTION_MAP` / 서브컨텍스트 주입 방식 추가
- **신규 페이지**: `/packages`, `/raw-stocks`(이동 시 재구성), 잡곡 다이얼로그 3종 — 번들 스펙 전면 적용
- **사이드바 + 모바일 네비**: 메뉴 개편과 함께 번들 스펙(Set C, Goo blob)으로 교체 (작업 단계 #9)
- **Set C 듀오톤 아이콘 5개**: `components/icons/duotone/` 신규 디렉터리

### 이번 범위 밖 (후속 PR)
- 기존 벼 페이지(`/milling`, `/admin/*`, `/statistics/*`, `/login`) 내부의 `#00a2e8` 전수 교체 및 shadcn 토큰 재매핑
- 기존 테이블/카드 컴포넌트의 품종 그룹 펼침 패턴 적용
- Pretendard self-host 전환 (현재 CDN 유지)

### 구현 원칙
1. **번들 JSX는 참조용**: `docs/handoff-잡곡재고관리/components/*.jsx`는 데모 (window React + lucide window binding). **실제 코드는 shadcn 패턴으로 재작성**.
2. **임의 값 최소화**: `bg-[#2563eb]` 대신 `bg-primary`, `text-slate-500` 대신 `text-muted-foreground` 우선.
3. **dark 모드 토큰도 동시 정의**: 번들이 `.dark` 스코프 변수 제공 — 빼먹지 말 것.
4. **충돌 시 계획서 > 번들**: 번들 `handoff.md`와 본 계획서가 부딪히면 본 계획서가 이김.

## 핵심 컨셉

### 잡곡 입고는 두 갈래로 처리
| 유형 | 원물재고(Stock) 경유? | sourceType | 입력 화면 |
| --- | --- | --- | --- |
| **도정위탁(CONSIGNMENT)** — 원물을 외부 도정업체에 위탁해 입고 | ✅ 경유 | `CONSIGNMENT` | 원물재고 > 잡곡 탭 > [+ 입고] |
| **농가도정(FARMER_MILLED)** — 농가가 직접 도정해 완제품 납품 | ✅ 경유 | `FARMER_MILLED` | 원물재고 > 잡곡 탭 > [+ 입고] |
| **외부매입(PURCHASED)** — 인증된 **소포장 완제품**을 외부 구매 | ❌ Stock 경유 안 함 | — | 제품재고 > 잡곡 탭 > [+ 매입 등록] |

**핵심 설계 결정**: 외부매입 잡곡은 **이미 소포장된 완제품 상태**로 들어오므로 원물재고(Stock)를 거치지 않고 **바로 제품재고(MillingOutputPackage)에 등록**한다.

### 잡곡의 도정/포장 특징
- 도정 과정은 **입고 시점에 이미 완료**되어 있음 (도정위탁이든 농가도정이든)
- 남는 작업은 "포장"뿐 → 벼처럼 "도정관리" 페이지에 통합하지 않음
- 잡곡 포장은 **제품재고 > 잡곡 탭**에서 시작 (원물재고 로트 선택 → 포장단위/개수 입력 → 제품재고 등록)

### 용어 통일
- **잡곡 입고 유형**: "도정위탁" / "농가도정" — UI, 다이얼로그 토글, 필터, 테이블 헤더 모두 동일 표기
- **제품재고 출처 구분**(`source`): "도정산" / "매입" (벼·잡곡 공통 — 잡곡 입고 유형과 개념이 다름)

## 확정 결정사항

### 데이터 모델
- **A안 채택**: 기존 `Stock` 모델 확장 + `category` 필드 (벼/잡곡 구분)
- **외부매입은 Stock 경유 안 함** → `MillingOutputPackage` 확장으로 통합 관리

### enum / 네이밍
- `StockCategory`: `RICE` | `MISC_GRAIN`
- `SourceType` (Stock용, 잡곡 입고 유형): `CONSIGNMENT`(도정위탁) | `FARMER_MILLED`(농가도정) | `GERMINATION`(발아위탁)
- `ProductSource` (MillingOutputPackage용): `MILLED` | `PURCHASED`

### 매입 관련
- **로트번호 생성 안 함** — 매입품은 Stock을 경유하지 않아 로트 개념 불필요. `MillingOutputPackage.lotNo`는 `null`로 저장
- 매입처명(`purchaseVendor`) 기록 필수, **자동완성 드롭다운 지원** (과거 입력한 매입처 distinct 조회)
- 인증번호·매입단가 이번 범위 외 (향후 필드 추가 가능하게 여지만 남김)
- 제품 식별은 `id` + `purchaseVendor` + `incomingDate` + `varietyId` + `packageType` 조합으로 충분

### 품종 시드 정책
- 🚨 **기존 품종(RICE 계열) 데이터는 절대 수정/삭제 금지**
- 마이그레이션에서 기존 `Variety` 레코드는 `category = 'RICE'` 백필만 수행
- 잡곡 품종은 `lib/lot-generation.ts` 매핑 기준 신규 레코드만 추가: 보리, 검정보리, 통밀, 수수, 기장, 차조, 백태/콩, 귀리, 참깨, 아마란스, 율무, 녹두, 팥/적두, 서목태/쥐눈이, 서리태
- 시드 스크립트: `findFirst({ where: { name } })` 후 없을 때만 `create`

### 엑셀 Seed
- `docs/잡곡대장 (25년산).xlsx` "도정,매입내역" 시트 **입고만** Import
- 출고내역(2,946행)은 판매관리 구현 시 처리

### 메뉴 구조 (확정)
**성격별 + 작업흐름 순서** — 원물 → 도정 → 제품 → 판매

#### PC 사이드바
| 순서 | 라벨 | URL | 비고 |
| --- | --- | --- | --- |
| 1 | 홈 | `/` | 대시보드 (공지·최근활동) |
| 2 | 원물재고 | `/raw-stocks` | 벼/잡곡 탭 |
| 3 | 도정관리 | `/milling` | **벼 전용 유지** |
| 4 | 제품재고 | `/packages` | 벼/잡곡 탭 (신규) — 잡곡 탭에서 포장/매입 트리거 |
| 5 | 판매관리 | `/sales` | 3탭(벼/잡곡/출고) — 기본 진입 시 "출고" 탭 활성. 벼·잡곡 탭은 "준비중" 뱃지 |
| 6 | 통계 | `/statistics` | 하위 메뉴: 수율분석 / 재고분석 / **판매분석**(기존 "출고분석" 리네이밍) |
| - | 품종/생산자/관리자 | `/admin/*` | 하단 섹션 유지 |

> **기존 `/releases` 출고관리 메뉴 제거** — 판매관리 > "출고" 탭으로 흡수. `/releases` → `/sales` 영구 리다이렉트.

#### 판매관리 탭 구조 (`/sales`)
| 탭 | 상태 | 데이터 소스 | 비고 |
| --- | --- | --- | --- |
| 벼 | **준비중 뱃지** | `MillingOutputPackage` (source=MILLED, category=RICE) + 매입품 일부 | 다음 계획서(`plan-판매관리.md`)에서 세부 확정 |
| 잡곡 | **준비중 뱃지** | `MillingOutputPackage` (category=MISC_GRAIN) | 다음 계획서에서 세부 확정 |
| 출고 | ✅ **바로 활성** | `ReleaseLog` (기존 `/releases` 그대로) | 대량판매/출고 내역 — UI·기능 **변경 없이 이관만** |

- **기본 진입 탭**: `/sales` 접근 시 "출고" 탭이 기본 활성 (유일한 기능 탭)
- 벼·잡곡 탭 클릭 시: "준비중" 안내 화면 표시

#### 모바일 하단 5탭
```
[📦 원물] [📋 도정] [🎁 제품] [💰 판매] [📊 통계]
```
- 홈 탭 제거, **상단 헤더 로고 탭 → 홈 이동** 패턴
- `💰 판매` 탭 **활성화** — 진입 시 "출고" 탭 기본 노출, 벼·잡곡 탭은 "준비중"
- 관리자 메뉴는 PC 전용 유지

## 데이터 모델

### `Stock` 확장 — 벼 + 잡곡 도정위탁/농가도정 원물재고
```prisma
model Stock {
  // 기존 필드 유지
  ...
  category       StockCategory @default(RICE)
  sourceType     SourceType?       // MISC_GRAIN일 때만 (벼는 null)
  rawWeightKg    Float?            // 원물중량 (sourceType=CONSIGNMENT일 때만)
  millingVendor  String?           // 위탁 도정업체명 (sourceType=CONSIGNMENT일 때만)
}

enum StockCategory { RICE MISC_GRAIN }
enum SourceType    { CONSIGNMENT FARMER_MILLED }
```

> `purchaseVendor`는 Stock에 두지 않음 (매입은 Stock 경유 안 함).

### `MillingOutputPackage` 확장 — 벼 포장 + 잡곡 포장 + 잡곡 매입 통합
> **테이블명 개명 계획**: 장기적으로는 `Package` 모델 + `@@map("packages")`로 리네이밍하는 것이 맞음. 다만 기존 호출부(`prisma.millingOutputPackage.*`) 전수 리팩터링이 수반되므로 **본 계획 범위 외로 분리**한다. 잡곡 기능 완성 후 별도 PR로 진행. (작업 단계 #13 참조)

```prisma
model MillingOutputPackage {
  id              Int           @id @default(autoincrement())

  // 출처 구분 ← 신규
  source          ProductSource @default(MILLED)
  category        StockCategory @default(RICE)

  // 도정·포장 기반(MILLED)일 때만 사용
  batchId         Int?          // nullable로 변경
  batch           MillingBatch?
  stockId         Int?          // 이미 nullable
  stock           Stock?

  // 매입(PURCHASED)일 때만 사용 ← 신규
  varietyId       Int?          // stock 없을 때 직접 참조
  variety         Variety?
  purchaseVendor  String?       // 매입처명
  incomingDate    DateTime?     // 매입일

  // 포장 정보 (공통)
  packageType     String        // 벼: '20kg'~'1kg', '톤백', '잔량' / 잡곡: '10kg', '5kg', '1kg', '800g', '500g', '420g' (+ '기타' 직접입력 공용)
  weightPerUnit   Float
  count           Int
  totalWeight     Float
  productCode     String?
  lotNo           String?       // 매입(PURCHASED) 건은 항상 null

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum ProductSource { MILLED PURCHASED }
```

#### null 허용 필드 일관성 — CHECK 제약조건
null 필드가 많아지는 만큼, 출처별 필수/금지 필드를 **DB 레벨 CHECK 제약**으로 강제한다. 마이그레이션에 raw SQL로 추가:

```sql
-- source=MILLED: batch 또는 stock 둘 중 하나는 반드시 있어야 함
ALTER TABLE "MillingOutputPackage"
  ADD CONSTRAINT pkg_milled_has_source
  CHECK (source <> 'MILLED' OR ("batchId" IS NOT NULL OR "stockId" IS NOT NULL));

-- source=PURCHASED: 매입처·품종·매입일 필수, batch/stock는 null
ALTER TABLE "MillingOutputPackage"
  ADD CONSTRAINT pkg_purchased_required_fields
  CHECK (
    source <> 'PURCHASED' OR (
      "purchaseVendor" IS NOT NULL
      AND "varietyId"    IS NOT NULL
      AND "incomingDate" IS NOT NULL
      AND "batchId"      IS NULL
      AND "stockId"      IS NULL
    )
  );
```

### `Variety` 확장
```prisma
model Variety {
  ...
  category StockCategory @default(RICE)
}
```
- 기존 품종은 모두 `RICE`로 백필
- 잡곡 품종은 `MISC_GRAIN`으로 신규 시드

## 로트번호 규칙
- 기존 `generateLotNo()` / `getProductCode()` 그대로 사용 (잡곡 제품코드 `21`~`215` 이미 존재)
- **도정위탁·농가도정**: 실제 생산자 작목반/농가번호로 생성 (벼와 동일 방식)
- **매입(PURCHASED)**: 로트번호 생성 **안 함** — `MillingOutputPackage.lotNo`는 `null`로 저장
  - 이유: 매입품은 Stock을 경유하지 않아 "원물 로트" 개념이 없음. 제품 식별은 `id` + `purchaseVendor` + `incomingDate` + `varietyId`로 충분
  - 가상 작목반/Farmer 시드 **불필요** (초기 계획에서 제거됨)

## 화면/플로우

### 1. 원물재고 페이지 (`/raw-stocks`)
```
┌─ 원물재고 ─────────────────────────────┐
│  [ 벼 ]  [ 잡곡 ]                       │
├────────────────────────────────────────┤
│  (잡곡 탭 선택 시)                      │
│  [+ 잡곡 입고] 버튼                     │
│  필터: 생산년도, 품종, 생산자, 로트,    │
│       sourceType(도정위탁/농가도정), 상태│
│  목록: 입고일·로트·품종·생산자·유형뱃지· │
│       원물중량·입고중량·수율·상태       │
└────────────────────────────────────────┘
```

#### 잡곡 입고 등록 다이얼로그
- 상단에 **sourceType 세그먼트 토글** (도정위탁 / 농가도정) — **매입은 여기 없음**
- 유형별 필드 가시성
  - **도정위탁**: 생산자, 품종(MISC_GRAIN만), 원물중량, 위탁 도정업체명, 입고중량(=도정 후 생산량), 자동 로트번호, 수율 자동계산
  - **농가도정**: 생산자, 품종, 입고중량, 자동 로트번호 (원물중량·위탁 도정업체 숨김)

### 2. 제품재고 페이지 (`/packages`) — 신규
```
┌─ 제품재고 ─────────────────────────────┐
│  [ 벼 ]  [ 잡곡 ]                       │
├────────────────────────────────────────┤
│  (잡곡 탭 선택 시)                      │
│  [+ 포장하기]   [+ 매입 등록]           │
│  필터: 품종, 포장단위, 로트, source뱃지  │
│  목록: 생성일·로트·품종·포장단위·개수·  │
│       총중량·source뱃지(도정산/매입)·   │
│       매입처(매입일 때만)               │
└────────────────────────────────────────┘
```

#### 잡곡 포장 다이얼로그 (`[+ 포장하기]`)
- 원물재고(AVAILABLE 상태 MISC_GRAIN Stock) 로트 선택
- 포장단위(잡곡 전용 셋, 7칸 그리드): 10kg, 5kg, 1kg, 800g, 500g, 420g + 기타 직접입력. **톤백·잔량 없음**(잡곡은 해당 케이스 미사용 — 필요 시 "기타"로 처리)
- 개수·총중량 입력
- 저장 시:
  - `MillingOutputPackage` 신규 레코드 (source=MILLED, stockId, varietyId, category=MISC_GRAIN, lotNo=원물 로트)
  - 원물 Stock.status: AVAILABLE → CONSUMED (또는 부분포장이면 유지)

#### 잡곡 매입 등록 다이얼로그 (`[+ 매입 등록]`)
- 매입처명 (필수, **자동완성 드롭다운** — 과거 매입처 distinct 목록)
- 품종 선택 (MISC_GRAIN만)
- 매입일 (기본 오늘)
- 포장단위, 개수, 총중량
- 저장 시:
  - `MillingOutputPackage` 신규 레코드 (source=PURCHASED, batchId=null, stockId=null, varietyId, purchaseVendor, incomingDate, category=MISC_GRAIN, **lotNo=null**)
  - 로트번호 **생성 안 함** (매입품은 Stock 경유 X → 로트 개념 없음)

### 3. 벼 제품재고 탭 — 동일 페이지(`/packages`)
- `source=MILLED`인 `MillingOutputPackage` 조회 (기존 도정관리에서 생성된 데이터)
- 도정관리에서 이미 생성된 포장품을 **독립 페이지로 조회·검색·엑셀 내보내기** 가능
- [+ 포장하기] 버튼은 기존 도정관리 페이지로 링크 (벼는 배치 기반이라 새로 만들지 않음)

### 4. 도정관리 (`/milling`) — 벼 전용 유지
- 현재 구조 그대로. 변경 없음.

## 변경 파일 예상

### 0. 디자인 시스템 이관 (B안 — 접촉 경로)
- `app/globals.css` — 번들 토큰 동기화 (HSL, 커스텀 shadow, dark 모드)
- `components/icons/duotone/` (신규) — RawStock / Milling / Package / Sales / Stats 5종
- `components/breadcrumb-display.tsx` — 1줄 브레드크럼 패턴으로 전면 교체 (ICON_MAP / DESCRIPTION_MAP / 서브컨텍스트 주입)
- `app/(dashboard)/layout.tsx` — 데스크톱 헤더 높이 `h-14` → `h-12`, 필요 시 모바일 헤더 정렬
- `components/desktop-sidebar.tsx` — 번들 스펙 전면 교체 (작업 단계 #9에서)
- `components/mobile-nav.tsx` — Goo blob + safe-area 대응 (작업 단계 #9에서)

### 1. 스키마/마이그레이션
- `prisma/schema.prisma` — Stock/Variety/MillingOutputPackage 확장, enum 3개 추가 (SourceType, StockCategory, ProductSource)
- 마이그레이션: `add_misc_grain_support`
- 기존 `getStocks`/`getStockGroups` 호출부에 `category: 'RICE'` 기본 필터 주입
- 기존 `MillingOutputPackage` 조회부에 `source: 'MILLED'`, `category: 'RICE'` 기본 필터 주입

### 2. Seed
- `prisma/seed.ts` 또는 별도 — 잡곡 품종 등록만 (중복 체크 필수). **외부매입용 가상 ProducerGroup/Farmer 시드는 생성하지 않음** (로트번호 생성 안 하므로 불필요)

### 3. Server Actions
- `app/actions/stock.ts` — `category` 파라미터 및 필터 확장
- `app/actions/stock-excel.ts` — category별 컬럼 스펙 분기
- `app/actions/misc-stock.ts` (신규) — 잡곡 입고 등록 (sourceType 분기, 수율 계산)
- `app/actions/packages.ts` (신규) — 제품재고 목록 조회/검색, 잡곡 포장 저장, 잡곡 매입 등록, 매입처 자동완성 목록

### 4. UI (신규)
- `app/(dashboard)/raw-stocks/` — 원물재고 페이지 (벼/잡곡 탭)
  - `misc/` 서브 — 잡곡 전용 컴포넌트(입고 다이얼로그 포함)
- `app/(dashboard)/packages/` — 제품재고 페이지 (벼/잡곡 탭)
  - 잡곡 탭 내부: 포장 다이얼로그, 매입 등록 다이얼로그

### 5. UI (수정)
- `components/desktop-sidebar.tsx` — 메뉴 개편
- `components/mobile-nav.tsx` — 하단 탭 개편, 상단 헤더 로고 홈 링크
- `app/(dashboard)/admin/varieties/` — 품종 등록 시 category 선택
- `app/(dashboard)/milling/add-packaging-dialog.tsx` — **변경 없음** (벼 다이얼로그 현행 유지). 잡곡 포장 다이얼로그(#7)에서 잡곡 전용 `PACKAGE_TEMPLATES_MISC` 인라인 정의
- `app/(dashboard)/stocks/*` → `app/(dashboard)/raw-stocks/` 로 이동 (벼 기존 코드)

### 6. 기존 엑셀 Seed (일회성)
- `scripts/import-misc-stock-legacy.ts` — `docs/잡곡대장 (25년산).xlsx` "도정,매입내역" 시트 파싱
- 파싱 규칙: 구분값(도정/농가/매입) 분기
  - 도정/농가: `Stock` 레코드 생성
  - 매입: `MillingOutputPackage` 레코드 직접 생성 (단, 엑셀에 매입 포장단위 정보 없으면 해당 건은 스킵하고 수동 재등록 안내)
- 실행: `npx tsx scripts/import-misc-stock-legacy.ts`

## Claude Design 활용 계획
워크플로우 문서: [docs/claude-design-workflow.md](../claude-design-workflow.md)

### 시안 제작이 필요한 신규 화면
1. **제품재고 페이지** (`/packages`)
   - 벼/잡곡 탭, 필터 영역, 테이블/모바일 카드
   - 잡곡 탭 상단의 [+ 포장하기] [+ 매입 등록] 버튼 배치
   - `source` 뱃지 (**도정산/매입**), 매입처 표시 패턴
2. **잡곡 입고 등록 다이얼로그** (원물재고에서)
   - sourceType 2단 토글 (**도정위탁/농가도정**)
   - 유형별 필드 show/hide, 수율 자동계산 표시
3. **잡곡 포장 다이얼로그** (제품재고에서)
   - 원물재고 로트 선택 UI, 포장단위 셀렉트 (g 포함)
4. **잡곡 매입 등록 다이얼로그** (제품재고에서)
   - 매입처 자동완성 콤보박스, 품종·포장·중량 입력
   - 로트번호 필드 **없음** (매입건은 로트 생성 X)
5. **판매관리 페이지 쉘** (`/sales`)
   - 벼/잡곡/출고 3탭 (벼·잡곡은 "준비중" 뱃지)
   - "출고" 탭 내용은 기존 `/releases` 컴포넌트 이식 — 시안 불필요
   - 벼·잡곡 탭용 **"준비중" 안내 컴포넌트** 디자인 포함
6. **사이드바/모바일 네비게이션 개편**
   - 아이콘 톤·순서 시각화, 판매관리 메뉴 뱃지 처리

### 기존 패턴 재사용 (Claude Design 불필요)
- 잡곡 원물재고 목록 테이블/카드 → 벼 `stock-list-client` 복제 + 탭
- 품종 관리 화면 → category 드롭다운만 추가
- 엑셀 Import/Export 버튼 → 기존 UI 재사용

### 단계 순서 (사용자 기준)
1. [claude.ai Claude Design](https://claude.ai)에서 위 화면 시안 제작
2. Export → "Send to Claude Code" → 붙여넣기용 프롬프트 받음
3. Claude Code 세션에 프롬프트 붙여넣기
4. 번들 URL을 `WebFetch`로 읽어 CLAUDE.md 규칙 + 본 계획서와 조율하며 구현
5. 번들과 충돌 시 **계획서·CLAUDE.md 우선 적용**

## 작업 단계 (커밋 단위)

0. **전역 디자인 토큰 동기화** — `app/globals.css`
   - 번들 `handoff.md §1.1` HSL 토큰과 대조, 누락분 병합 (`--ring`·`--primary` 값 검증)
   - 번들 커스텀 shadow 추가 (모바일 네비 Goo blob, 모바일 헤더용)
   - `.dark` 스코프 토큰 번들 기준 정렬
0.5. **헤더 1줄 브레드크럼 전역 교체** — `components/breadcrumb-display.tsx`
   - path 기반 `ICON_MAP` (Set C 아이콘 + lucide 폴백) / `DESCRIPTION_MAP` 추가
   - 서브컨텍스트(현재 탭) 주입 API — optional prop 또는 context
   - 높이 `h-14` → `h-12` 적용 (layout.tsx 동반 수정)
   - 모든 페이지 자동 반영 확인 (홈·도정·통계·관리자까지 스모크 테스트)
0.7. **Set C 듀오톤 아이콘 5종 컴포넌트화** — `components/icons/duotone/`
   - `design-system.html`에서 SVG path 추출 → `RawStockIcon`, `MillingIcon`, `PackageIcon`, `SalesIcon`, `StatsIcon`
   - `active?: boolean` prop으로 내부 fill 토글
1. **스키마 확장 + 마이그레이션** — Stock/Variety/MillingOutputPackage 확장, enum 3종, **CHECK 제약조건 2개**(pkg_milled_has_source, pkg_purchased_required_fields)
2. **Seed 데이터** — 잡곡 품종만 등록 (중복 체크, 기존 데이터 보호)
3. **포장단위 정책 확정** — 벼 현행 유지(`톤백/20/10/8/5/4/3/1kg/잔량 + 기타`), 잡곡은 `10/5/1kg + 800g/500g/420g + 기타` (톤백·잔량 없음). 옵션 셋이 다르므로 공용 상수 도입 폐기 — 잡곡 PACKAGE_TEMPLATES는 #7 잡곡 포장 다이얼로그에서 인라인 정의. **코드 변경 0건, 정책 문서화로 종결**. 사전조사: [docs/research-잡곡재고관리-#3.md](../research/research-잡곡재고관리-#3.md)
4. **기존 `/stocks` → `/raw-stocks` 라우팅 이동** + 벼 탭 유지 (벼 탭 내부 디자인은 범위 밖, 이동만)
5. **잡곡 입고 등록** — 2가지 sourceType 토글 다이얼로그(도정위탁/농가도정) + 잡곡 원물재고 탭
   - 번들 스펙: F안 탭, shadcn `Dialog`, 폼 패턴 (`handoff.md §4.1`, `§4.6`)
6. **제품재고 페이지 신설** — `/packages` 라우트, 벼/잡곡 탭, 벼 탭은 기존 MillingOutputPackage 조회
   - 번들 스펙: 헤더 액션 4버튼(업로드·다운로드·검색·추가), 테이블 품종 그룹 펼침, 모바일 카드 2줄, 검색 다이얼로그 (`handoff.md §3.4`, `§4.2`, `§4.3`)
7. **잡곡 포장 다이얼로그** — 제품재고 잡곡 탭에서 트리거 (세부 계획: [plan-잡곡재고관리-#7.md](plan-잡곡재고관리-#7.md))
   - ✅ #7a (2026-05-06, `3390363`) — 컬럼 정리 + 재고 노출 + 상태 셀 포장 트리거
   - ✅ 제품재고 컬럼 정리 (2026-05-06, `c12dcae`) — 순서·라벨·정렬 사용자 결정
   - ✅ #7b (2026-05-06, `56db3aa`) — 다이얼로그 본구현 + 양쪽 진입점 마운트
   - ✅ #7c (2026-05-06, `afd39da`) — 수정/삭제 + 행 액션 메뉴 (PURCHASED는 #8과 함께)
   - 🟡 #7d (잔여) — 모바일 다이얼로그 fit 검수, 권한 정책 확정 (`STOCK_MANAGE` vs 분리 — #9.5에서 일괄)
8. **잡곡 매입 등록 다이얼로그** — 매입처 자동완성 포함 (로트번호 생성 X)
9. **사이드바/모바일 메뉴 개편 + 판매관리 라우트 이관** —
   - 신규 메뉴 구조 적용, 상단 로고 홈 링크
   - **번들 스펙 전면 적용**: PC 사이드바 MAIN MENU/MANAGEMENT 섹션 구조 (`handoff.md §3.1`), 모바일 Goo blob 네비 (`§3.2`) — SVG `<filter id="nav-goo">` 주입 포함
   - Set C 듀오톤 아이콘은 단계 0.7에서 만든 컴포넌트 주입
   - `/sales` 라우트 신설 (3탭 쉘: 벼/잡곡/출고)
   - 기존 `/releases` 페이지 구성 요소(`release-page-wrapper`, `release-filters`, `release-excel-button` 등)를 **그대로** `/sales` "출고" 탭 컨텐츠로 이관 (기능·UI 변경 없음)
   - `/releases` → `/sales` 영구 리다이렉트 추가
   - 벼·잡곡 탭은 "준비중" 안내 컴포넌트로 Placeholder
   - 통계 하위 라벨 `"출고분석"` → `"판매분석"`으로 변경 (URL `/statistics/output`은 유지, 내부 페이지 제목도 같이 변경)
9.5. **권한 체계 정리** — 신규 기능에 맞춘 권한 키 재정의
   - 잡곡 원물(`MISC_STOCK_MANAGE`?) / 제품재고(`PACKAGE_MANAGE`) / 매입(`PURCHASE_MANAGE`?) / 판매(`SALES_MANAGE`) 권한 분리·통합 정책 결정
   - `lib/permissions.ts` 권한 키 마스터 업데이트
   - `/admin/users` 권한 편집 UI에 신규 키 노출
   - 사이드바/모바일 네비/페이지 가드(`hasPermission`) 일괄 점검
   - 자세한 내용: [docs/리팩토링-백로그.md §12](../리팩토링-백로그.md)
10. **엑셀 Import/Export** — category별 컬럼 스펙
11. **기존 엑셀 Seed 스크립트 실행** — 25년산 대장 데이터 입력
12. **브라우저 수동 테스트** — 도정위탁/농가도정 입고 → 포장 → 제품재고 확인, 매입 등록 → 제품재고 확인
13. **(후속 PR)** `MillingOutputPackage` → `Package` 모델 리네이밍 + `@@map("packages")` — 기능 안정화 후 별도 진행

## 판매관리 연동 포인트 (다음 단계 선반영)
- **3탭 구조 확정** — 벼 / 잡곡 / 출고
  - **벼·잡곡 탭**: 소포장 판매 주문 — 전적으로 `MillingOutputPackage`를 바라봄 → 도정산·매입품 모두 단일 쿼리로 해결. `source`, `category`, `varietyId`, `lotNo`, `packageType` 필드로 주문서 자동 매칭
  - **출고 탭**: 기존 `ReleaseLog` 기반 대량판매/출고 — 이번 개편에서 `/releases` 기능 **그대로** 이관. 다음 계획서에서 `MillingOutputPackage`와의 연동 방안 재검토
- 재고 차감: `MillingOutputPackage.count` 감소 or `status` 관리 (다음 계획서에서 결정)
- 통계 **"판매분석"**(기존 "출고분석")은 3탭 모두 포괄하는 상위 지표로 확장 (다음 계획서에서 차트 재정의)

## 위험 요소
- **신/구 디자인 혼재 기간**: 기존 벼 내부 페이지(`/milling`, `/admin`, `/statistics`)는 여전히 레거시 `#00a2e8`·구 버튼 스타일을 쓰므로, 신규 페이지와 내부 톤 차이가 존재한다. 단 헤더 브레드크럼·사이드바·모바일 네비는 이번 범위에서 통일 교체되므로 네비게이션 단위의 통일감은 확보된다.
- **헤더 높이 변경 (h-14 → h-12)**: `layout.tsx` `pt-[44px]`(모바일) 및 콘텐츠 상단 여백과 맞물림 — 스모크 테스트 필수
- **Set C 아이콘 원본 SVG 추출**: `design-system.html`에서 직접 경로 추출 필요. `components/icons.jsx` 데모는 일부 lucide 원본이라 "듀오톤 fill" 대상 path 식별 필요 → 작업 시 HTML을 브라우저로 열어 비교
- **Goo blob SVG filter**: `<filter id="nav-goo">` 전역 주입 필요 (layout.tsx 또는 네비 루트) — SSR hydration 주의
- **기존 `MillingOutputPackage` 호출부 전수조사 필요**: `batchId` nullable 변경 + `source`/`category` 기본 필터 누락 시 잡곡 매입품이 벼 목록에 섞일 수 있음
- **`category` 필터 누락**: 모든 `getStocks`/`getPackages` 호출부에 카테고리 기본값 주입 확인
- **CHECK 제약조건 위반**: 기존 `MillingOutputPackage` 데이터는 모두 `source=MILLED`(default)이고 `batchId` 값이 있으므로 통과. 신규 매입 저장 시 필수 필드 검증을 **Server Action 레벨에서도 zod 검증** 병행 필요 (DB 제약 위반 시 유저 피드백 어려움)
- ~~**포장단위 g 추가**: 통계·엑셀 내 하드코딩된 포장단위 라벨 전수조사~~ (해소 완료 — #3 정책 변경으로 벼 다이얼로그는 변경 없음. 통계·표시 라인은 자유 텍스트 fallback으로 잡곡 g 옵션도 자동 수용 — 사전조사 §3 검증)
- **기존 `/stocks` URL 이동**: 북마크·외부 링크 깨짐 → `/stocks` → `/raw-stocks` 리다이렉트 필요
- **기존 `/releases` URL 이동**: 북마크·외부 링크 깨짐 → `/releases` → `/sales` 리다이렉트 필요. 모바일 홈 최근활동/공지 내 `/releases` 하드코딩 링크 전수 검색
- **마이그레이션 자동화**: Vercel `prisma migrate deploy` 경로 동작 사전 확인 (CHECK 제약 raw SQL 포함)
- **사이드바/네비 변경**: 기존 사용자 학습비용 → 배포 시 공지사항 등록
- **테이블명 리네이밍 후속 PR**: `MillingOutputPackage` → `Package` 변경은 Prisma Client 호출부가 많아 (`prisma.millingOutputPackage.*` 전수) 본 범위에서 제외. 별도 PR로 원자적 진행

## 다음 액션 — 구현 착수

### 체크리스트
- [x] Claude Design 시안 제작 완료 (2026-04-24)
- [x] 핸드오프 번들 프로젝트 배치 (`docs/handoff-잡곡재고관리/`)
- [x] `.gitignore` 업데이트 (번들 폴더 제외)
- [x] 디자인 시스템 이관 정책(B안) 계획서 반영 (2026-04-24)
- [ ] **작업 단계 #0 착수**: 전역 토큰 동기화 (`app/globals.css`)
- [ ] 작업 단계 #0.5: 헤더 1줄 브레드크럼 전역 교체
- [ ] 작업 단계 #0.7: Set C 듀오톤 아이콘 5종 컴포넌트화
- [ ] 이후 #1~#12 순차 진행, 각 단계 커밋 후 `docs/worklog.md` 업데이트

### 구현 시 원칙 재확인
1. **계획서·CLAUDE.md > 번들** — 충돌 시 본 문서 우선
2. **용어 통일** — 잡곡 입고는 "도정위탁/농가도정", 제품 출처는 "도정산/매입"
3. **작업 단계 #1부터 순차 커밋** — 스키마 → Seed → UI 순서 준수
4. **3개 이상 파일 변경 시** 각 단계마다 증거 기반 완료 확인 (타입체크 / 수동 테스트)

### 참고 문서
- 디자인 워크플로우: [docs/claude-design-workflow.md](../claude-design-workflow.md)
- 마이그레이션 리포트(진행 시 기록): `docs/report-잡곡재고관리-YYYY-MM-DD.md`
