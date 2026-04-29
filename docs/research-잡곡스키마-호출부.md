# 잡곡 재고관리 #1 단계 사전조사 — 호출부 전수조사

조사일: 2026-04-28
조사자: Claude (사용자 요청)
대상: `prisma.stock.*`, `prisma.millingOutputPackage.*`, `prisma.variety.*` 호출부
목적: [작업 단계 #1 (Prisma 스키마 확장)](plan-잡곡재고관리.md) 착수 전, `category`/`source` 기본 필터 누락 시 잡곡 데이터가 벼 목록에 섞일 수 있는 위치 식별.

---

## 1. 요약 — 위험 등급별

### 🔴 HIGH — `category` 기본 필터 반드시 주입 (벼만 보여야 함)

| 파일 | 라인 | 함수 | 현재 where | 필요 조치 |
|------|------|------|-----------|-----------|
| `app/actions/stock.ts` | 406 | `getStocks` | productionYear/varietyId/status/farmerId/farmerName/certType | `category: 'RICE'` AND 추가 |
| `app/actions/stock.ts` | 490 | `getStockGroups` | 동일 | 동일 |
| `app/actions/stock.ts` | 607 | `getStocksByGroup` | groupKey + 상태/생산자명 | 동일 |
| `app/actions/stock-excel.ts` | 67 | `exportStocks` | 동일 패턴 | 동일 |
| `app/actions/stock-statistics.ts` | 79 | `getStockProductionYears` | 없음 (전체 distinct) | 동일 (벼 통계만) |
| `app/actions/stock-statistics.ts` | 92 | `getStockGroupOptions` | productionYear | 동일 |
| `app/actions/stock-statistics.ts` | 124 | `getStockVarietyOptions` | productionYear + farmer | 동일 |
| `app/actions/stock-statistics.ts` | 153 | `getStockStatistics` | productionYear + farmer + variety | 동일 |
| `app/actions/dashboard.ts` | 19 | `prisma.stock.aggregate` (AVAILABLE 재고) | status + productionYear | 동일 (현재는 벼 대시보드) |
| `app/actions/dashboard.ts` | 88 | `prisma.stock.groupBy` (varietyId/status) | productionYear | 동일 |

**핵심**: 위 10곳에 `category: 'RICE'` 기본 필터를 명시적으로 주입하지 않으면, #5(잡곡 입고)부터 잡곡이 벼 목록·통계·엑셀에 섞여 들어감.

### 🟡 MEDIUM — 모델 변경 영향 받음, 호출 시그니처 보강 필요

| 파일 | 라인 | 함수 | 영향 | 필요 조치 |
|------|------|------|------|-----------|
| `app/actions/stock.ts` | 51 | `findFirst` 중복 체크 | 잡곡 입고 시 동일 키(year+farmer+variety+bagNo) 충돌 가능 | `category` 포함해 중복 체크 (벼/잡곡 분리) |
| `app/actions/stock.ts` | 65 | `prisma.stock.create` | category/sourceType 신규 필드 | StockFormData 확장, 벼는 default 'RICE'·sourceType null |
| `app/actions/dashboard.ts` | 29 | `prisma.millingOutputPackage.aggregate` | 잡곡 매입품 포함 여부 | 대시보드는 벼만 → `source: 'MILLED'` AND `batch.stocks.some.category: 'RICE'` |
| `app/actions/output-statistics.ts` | 95 | `getOutputStatistics` | `where: { batch: { ... } }` 형식 → batch=null인 매입품 자동 제외 | 계획서 #9 "판매분석" 확장 시 재설계 (이번 #1 범위 밖, 다음 단계에서 OR 조건으로 매입 포함) |
| `app/actions/milling.ts` | 365, 412, 435 | 도정 포장 create/deleteMany | 도정관리는 벼 전용 → batchId 필수 유지 | 변경 불필요 (기존 동작 유지). 잡곡 포장은 #7 별도 다이얼로그 |

### 🟢 LOW — 영향 없음 또는 무시 가능

| 파일 | 라인 | 비고 |
|------|------|------|
| `app/actions/stock.ts` | 222, 261 | `findUnique` by id — id 단일 조회는 category 무관 |
| `app/actions/stock.ts` | 231, 283 | `delete` by id — 동일 |
| `app/actions/dashboard.ts` | 10, 96 | `findFirst` for latestYear/updatedAt — 메타 정보, 카테고리 무관 OK (단, 대시보드가 "벼 기준"이면 category=RICE로 제한하는 게 안전) |
| `app/actions/admin.ts` | 127 | variety 삭제 전 stock count — variety의 카테고리에 따라 자동으로 분리됨 (RICE variety는 RICE stock만 가짐) |
| `app/actions/admin.ts` | 389, 426 | farmer 삭제 전 stock 존재 체크 — farmer는 양쪽 카테고리에 stock 가질 수 있으므로 카테고리 무관 OK |
| `app/actions/admin.ts` | 18 등 | `prisma.variety.*` — Variety에 category 추가하면 별도 필터링 가능. 품종관리 화면은 신규 잡곡 품종도 같이 보일 텐데, **계획서: 벼 페이지 내부 변경은 범위 밖** → 일단 그대로 유지, 필요 시 추후 카테고리 탭 분리 |
| `check_db.js`, `find_stock*.ts`, `verify-release.js`, `scripts/*.ts` | — | 디버그·일회성 마이그레이션 스크립트, 운영 무영향 |

---

## 2. 모델별 변경 사항 (계획서 §10 + 본 조사 반영)

### Stock
```prisma
category    StockCategory   @default(RICE)   // 신규 (enum)
sourceType  SourceType?                       // 신규, 잡곡만 사용 (CONSIGNMENT/FARMER_MILLED), 벼는 null
```
- 마이그레이션 시 기존 row 전체 `category=RICE` 자동 backfill (default 활용)
- `bagNo` 중복 유니크 제약은 현재 없음 (`findFirst` 체크만) → category 분리 시 자연스럽게 충돌 회피

### Variety
```prisma
category    StockCategory   @default(RICE)   // 신규
```
- 기존 품종은 모두 RICE로 backfill
- #2 단계 Seed에서 잡곡 품종만 `category=MISC_GRAIN`으로 추가
- **호출부 영향 없음** (admin.ts의 variety CRUD는 category 인지 안 함, 추후 #6 제품재고 페이지에서 탭별 분리 시 사용)

### MillingOutputPackage
```prisma
batchId       Int?                                  // 변경: not null → nullable (매입품)
batch         MillingBatch?  @relation(...)         // 변경
source        ProductSource  @default(MILLED)        // 신규 (MILLED/PURCHASED)
category      StockCategory  @default(RICE)          // 신규
purchaseFrom  String?                                // 매입처 (PURCHASED 필수)
purchaseDate  DateTime?                              // 매입일 (PURCHASED 필수)
```
- CHECK 제약 2개 (raw SQL):
  - `pkg_milled_has_source`: source=MILLED → batchId NOT NULL AND stockId NOT NULL
  - `pkg_purchased_required_fields`: source=PURCHASED → purchaseFrom NOT NULL AND purchaseDate NOT NULL AND batchId IS NULL
- **기존 데이터 안전성**: 모두 `source=MILLED` (default), `batchId` 값 있음, `stockId` 있음 → 통과
- **milling.ts 영향**: 도정 포장 create는 batchId 필수 + stockId 필수, source=MILLED default 그대로 유효

---

## 3. #1 단계 작업 체크리스트 (다음 세션 재개용)

### 3.1 스키마 변경 (`prisma/schema.prisma`)
- [ ] enum `StockCategory { RICE, MISC_GRAIN }` 추가
- [ ] enum `SourceType { CONSIGNMENT, FARMER_MILLED }` 추가
- [ ] enum `ProductSource { MILLED, PURCHASED }` 추가
- [ ] `Stock`에 `category`, `sourceType` 추가
- [ ] `Variety`에 `category` 추가
- [ ] `MillingOutputPackage` 변경: `batchId` nullable, `source`/`category`/`purchaseFrom`/`purchaseDate` 추가

### 3.2 마이그레이션
- [ ] `npx prisma migrate dev --name add_misc_grain_support --create-only` 로 생성
- [ ] 마이그레이션 파일 끝에 raw SQL CHECK 제약 2개 수동 추가
  ```sql
  ALTER TABLE "MillingOutputPackage"
    ADD CONSTRAINT pkg_milled_has_source
    CHECK (source <> 'MILLED' OR ("batchId" IS NOT NULL AND "stockId" IS NOT NULL));

  ALTER TABLE "MillingOutputPackage"
    ADD CONSTRAINT pkg_purchased_required_fields
    CHECK (source <> 'PURCHASED' OR (
      "purchaseFrom" IS NOT NULL AND "purchaseDate" IS NOT NULL AND "batchId" IS NULL
    ));
  ```
- [ ] 로컬 적용: `npx prisma migrate deploy`
- [ ] `npx prisma generate`

### 3.3 호출부 수정 (1.HIGH 10곳)
- [ ] `stock.ts`: `getStocks`, `getStockGroups`, `getStocksByGroup` 3곳에 `where.category = 'RICE'` 기본값 (params로 override 가능하게 설계할지 결정 — 일단 #1에서는 하드코딩, #4 라우팅 분리 시 재구성)
- [ ] `stock-excel.ts`: `exportStocks` 동일
- [ ] `stock-statistics.ts`: 4개 함수 동일
- [ ] `dashboard.ts`: `aggregate`(19), `groupBy`(88) 동일
- [ ] `dashboard.ts` (29): `millingOutputPackage.aggregate`에 `source: 'MILLED'` AND `batch.stocks.some.category: 'RICE'` 추가

### 3.4 createStock 보강 (`stock.ts` 51, 65)
- [ ] 중복 체크에 `category` 포함
- [ ] `prisma.stock.create`에 `category` 명시 (벼 입고 화면이므로 'RICE' 하드코딩 — 잡곡 입고는 #5에서 별도 액션 작성)

### 3.5 검증
- [ ] `npx tsc --noEmit` 통과
- [ ] DB 무결성: 기존 row가 default값으로 backfill됐는지 `SELECT COUNT(*) WHERE category IS NULL` (0이어야 함)
- [ ] CHECK 제약 동작: `INSERT INTO "MillingOutputPackage" (source) VALUES ('PURCHASED')` 만으로 시도 → 위반 에러 확인
- [ ] 벼 재고 목록·통계 화면이 변경 전과 동일하게 동작 (브라우저 스모크)

---

## 4. 주의 사항

- **#1 범위는 "스키마 + 호출부 안전화"까지**. 잡곡 입고/포장 화면은 #5/#7 단계.
- **벼 페이지 UI 변경 금지** — 디자인 시스템 B안 정책에 따라 벼 내부 페이지는 그대로 유지.
- **`source: 'MILLED'`/`category: 'RICE'`는 이번 단계에서 "기본값"으로 박는다**. 잡곡 매입(#8)·잡곡 포장(#7) 화면이 추가될 때 explicit하게 'PURCHASED'/'MISC_GRAIN' 지정.
- **테이블명 리네이밍**(`MillingOutputPackage` → `Package`)은 본 범위 외, 후속 PR (#13).
- **Variety.category 추가의 부수효과**: `app/actions/admin.ts`의 `getVarieties()` (`variety.findMany`)는 모든 카테고리 품종을 같이 반환. 품종관리 화면(`/admin/varieties`)이 잡곡 품종도 함께 보이게 되는데, 운영자 관점에서는 자연스러움. 시각적 분리가 필요하면 별도 이슈로 처리.

---

## 5. 참고

- 단일 진실 원천: [docs/plan-잡곡재고관리.md](plan-잡곡재고관리.md)
- 호출부 전체 grep 결과는 본 문서 작성 시점(2026-04-28) 기준. 코드가 변경되면 재조사 필요.
