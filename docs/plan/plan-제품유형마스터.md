# 구현 계획서: 제품유형(ProductType/SKU) 마스터 — 발주서 판매처리 선행 1순위

> **상위 계획서**: [plan-발주서판매처리.md](plan-발주서판매처리.md) §8.1 (결정 #1·#2·#6·#7·#22·#23)
> **작성**: 2026-06-15 · **개정**: 2026-06-16 · **상태**: 확정 (착수 가능)
>
> **2026-06-16 확정 사항**: ① 포장지=Packaging 테이블 정규화(20여 종) ② `millingType` sentinel=`'기타'`(빈문자열 폐기) ③ 매입 전용 포장지 행=`'매입포장'`(active=false) ④ 관리 라우트=**`/admin/product-types`**(기존 `/admin/*` 체계 편입, `/settings/*` 가드 신설 폐기) ⑤ 관리 화면·CRUD 액션 권한=**`SALES_MANAGE`**(권한 종류 정리는 추후 백로그) ⑥ `findOrCreateProductType`은 내부 헬퍼=무가드(상위 포장/매입 액션이 MILLING/STOCK으로 이미 가드).
> **전신**: `plan-포장지마스터.md`(폐기) — 2026-06-15 설계 점검 결과 **포장지 마스터 → 제품유형(SKU) 카탈로그로 격상**.
> **SKU = Stock Keeping Unit**(재고 관리 최소 단위). (품종+도정+규격+포장지)가 하나라도 다르면 다른 SKU.

---

## 1. 왜 ProductType인가 (설계 근거)

발주서 매칭 4키(품종+도정구분+규격+포장지)가 현재 **4개 테이블에 흩어짐**:
- 품종 = `stock.variety`(도정산) / `varietyId`(매입) — 경로마다 다름
- 도정구분 = `batch.millingType` (join) — **잡곡 포장은 `batchId=null` → 없음**
- 규격 = `MillingOutputPackage.packageType`
- 포장지 = (없음, 신규 필요)

→ 매칭 시 재고마다 4키를 조립·join·null특례 처리해야 함 = 산만함의 정체.

**ProductType = 이 4키를 하나의 엔티티(SKU 카탈로그)로 정규화.** 매칭이 `WHERE productTypeId = X` 단일 비교로 단순화되고, 기본 포장지(`isDefault`)·발주서 빈칸 처리(결정 #21)·통계가 한 곳에 모임. (대안 "필드만 추가"는 매핑 테이블 부활·카탈로그 부재로 열위 → 기각.)

---

## 2. 핵심 모델 결정 (2026-06-15 확정)

1. **ProductType 신설** — `(varietyId, millingType, packageType, packagingId)` 4키 `@@unique`
2. **`millingType` NOT NULL + sentinel**: 벼=`'백미'`/`'현미'`/`'오분도미'`…, 잡곡(위탁도정·발아·매입)=`'기타'`(2026-06-16 확정, 빈문자열 폐기). nullable 금지 — NULL은 Postgres 유니크에서 distinct 취급되어 중복 SKU 구멍 발생. `'기타'`는 UI에 그대로 노출 가능.
3. **`packagingId` NOT NULL + "매입포장" sentinel 행**: 매입잡곡은 `name='매입포장'`(`active=false`) Packaging 행을 가리킴. 이유 #2와 동일(NULL 유니크 구멍 방지). 사용자 결정 "매입잡곡 포장지 관리 불필요 = 있긴 하나 종류 무관".
4. **3경로 전부 ProductType 연동 + `find-or-create`**:
   - ①도정산(벼/잡곡 위탁도정·발아, `source=MILLED`): 포장지 **강제+기본추천**, `millingType=batch.millingType`(잡곡 포장 `createMiscPackage`는 `'기타'`)
   - ②잡곡 매입(`source=PURCHASED`): 포장지 **'매입포장' 자동**, `millingType='기타'`
   - 등록 시 (품종+도정+규격+포장지)로 SKU 조회 → 없으면 자동 생성
5. **`source`는 SKU에 없음**: 위탁분(MILLED)·매입분(PURCHASED)이 동일 SKU 공유 → 발주서 매칭 시 통합 FIFO 후보. source는 `MillingOutputPackage` 속성으로 유지.
6. **`PackagingMapping` 제거**: 기본 포장지는 `ProductType.isDefault`((품종+도정+규격)당 기본 1개)로 표현.
7. **`productCode`는 ProductType에 두지 않음**: 현행 `getProductCode(품종type, 품종명, 도정)` 파생 유지 — 코드는 규격·포장지 무관(품종+도정 레벨)이라 SKU 1:1이 아님.
8. **정합성 규칙**: `ProductType.varietyId == stock.varietyId`(도정산), 등록 흐름이 (품종+도정) 자동 결정 → 불일치 발생 불가.
9. **`Variety.aliases`** 유지(결정 #22) — 발주서 품목명↔품종 별칭.

---

## 3. Prisma 모델

```prisma
// (1) 신규 — 포장지명 마스터 (정규화·재사용)
model Packaging {
  id Int @id @default(autoincrement())
  name String @unique          // 자연주의 | 아이담쌀 | PET | 매입포장(sentinel) … (약 20종)
  active Boolean @default(true) // 매입포장=false → 도정산 드롭다운 숨김
  productTypes ProductType[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// (2) 신규 — 제품유형 (SKU 카탈로그) ★핵심
model ProductType {
  id Int @id @default(autoincrement())
  varietyId Int
  variety Variety @relation(fields: [varietyId], references: [id])
  millingType String @default("기타") // 벼=백미 등, 잡곡='기타' sentinel. NOT NULL
  packageType String                // 규격 '10kg' 등
  packagingId Int                   // NOT NULL ('매입포장' sentinel 허용)
  packaging Packaging @relation(fields: [packagingId], references: [id])
  isDefault Boolean @default(false) // (품종+도정+규격)당 기본 포장지 추천
  active Boolean @default(true)
  packages MillingOutputPackage[]
  // ⚠️ orderItems PurchaseOrderItem[] 는 본 단계에서 추가 금지 —
  //    PurchaseOrderItem 모델이 아직 없어 migrate/generate가 관계검증 실패함.
  //    발주서 단계에서 PurchaseOrderItem 모델 신설과 함께 양방향 관계로 추가.
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([varietyId, millingType, packageType, packagingId])
  @@index([varietyId, millingType, packageType])  // 기본추천 조회
}

// (3) 변경
model MillingOutputPackage {
  // … 기존 …
  productTypeId Int?               // nullable=백필용. 신규는 항상 채움. 매입도 채움
  productType   ProductType? @relation(fields: [productTypeId], references: [id])
}
model Variety {
  // … 기존 …
  aliases     String[]      @default([])
  productTypes ProductType[]
}
```
- `isDefault` 단일성은 DB 제약 아닌 **Server Action 트랜잭션**으로 보장(기본 지정 시 동일 조합 기존 기본 해제).

---

## 4. 변경 범위 (파일 단위)

### 신규
| 파일 | 내용 |
|---|---|
| `app/actions/product-type.ts` | ProductType/Packaging Server Actions + `findOrCreateProductType` 헬퍼 |
| `app/(dashboard)/admin/product-types/page.tsx` (+ 클라이언트 컴포넌트) | 제품유형 카탈로그 관리 화면 (기존 `/admin/*` 체계 편입, 비주얼=Claude Design) |
| `prisma/migrations/*` | 스키마 마이그레이션 |
| `scripts/seed-product-type.ts` | Packaging(미지정 포함)·기본 ProductType·`Variety.aliases` 시드 |
| `scripts/check-product-type-backfill.ts` | 백필 누락 조합 사전 점검 |
| `scripts/backfill-product-type.ts` | 기존 재고 `productTypeId` 백필 |

### 변경
| 파일 | 변경 |
|---|---|
| `prisma/schema.prisma` | Packaging·ProductType 추가, MillingOutputPackage.productTypeId, Variety.aliases |
| `middleware.ts` | `ADMIN_ROUTE_PERMISSIONS`에 `{ prefix: "/admin/product-types", permission: "SALES_MANAGE" }` 한 줄 추가 (기존 `/admin/*` 가드 재사용, 신규 인프라 없음) |
| `components/desktop-sidebar.tsx`, `components/mobile-nav.tsx` | Management 섹션에 "제품유형 관리"(/admin/product-types) 진입 |
| `docs/permission-matrix.md` | 제품유형 마스터 권한(`SALES_MANAGE`) 등록 |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 라인별 포장지 입력(find-or-create) ⚠️ 난도 최상 |
| `app/(dashboard)/packages/misc-package-dialog.tsx` | 포장지 드롭다운(강제+추천) |
| `app/(dashboard)/packages/misc-purchase-dialog.tsx` | 포장지=미지정 자동(입력 없음 또는 선택형) |
| `app/actions/milling.ts` | `MillingOutputInput`+`updatePackagingLogs`/`addPackagingLog` productTypeId 수용 |
| `app/actions/packages.ts` | `createMiscPackage`(강제)·`createMiscPurchase`(미지정) productTypeId 연동 |

> **3파일 이상 = HARD-GATE.** 본 계획서 승인 후 착수.

---

## 5. 단계별 작업 (의존순서)

**단계 1 — 스키마 + 마이그레이션**: §3 반영 → `prisma migrate dev` → `generate` → 타입 깨짐 없음 확인.

**단계 2 — Server Actions** (`app/actions/product-type.ts`, 기존 `admin.ts` 패턴):
| Action | 권한 | 역할 |
|---|---|---|
| `listPackagings()` / `listProductTypes(filter?)` | requireSession | 목록(active 우선) |
| `createPackaging(name)` / `togglePackagingActive(id)` | `SALES_MANAGE` | 포장지명 마스터 |
| `upsertProductType({...})` | `SALES_MANAGE` | SKU 추가/수정. isDefault=true면 동일(품종+도정+규격) 기본 해제(트랜잭션) |
| `deleteProductType(id)` / `toggleProductTypeActive(id)` | `SALES_MANAGE` | SKU 제거/비활성 |
| `suggestProductType(varietyId, millingType, packageType)` | requireSession | 기본 SKU + 허용 포장지 목록(등록용) |
| `findOrCreateProductType({varietyId, millingType, packageType, packagingId})` | 내부 헬퍼(무가드) | 등록 시 SKU 조회·자동생성. 상위 포장/매입 액션이 MILLING/STOCK으로 이미 가드 |
- 모든 write: `recordAuditLog` + `revalidatePath('/admin/product-types')`.

**단계 3 — 관리 메뉴 + 화면** (기존 `/admin/*` 패턴 재사용):
- `middleware.ts` `ADMIN_ROUTE_PERMISSIONS`에 `{ prefix: "/admin/product-types", permission: "SALES_MANAGE" }` 한 줄 추가. (신규 가드 인프라 없음 — 기존 `/admin` 매처가 그대로 적용)
- `/admin/product-types` 화면: 포장지 목록(추가·활성토글) + 제품유형 카탈로그 테이블(품종×도정×규격별 포장지·기본 지정·누락 강조). 비주얼=Claude Design.
- 사이드바/모바일내비 Management 섹션에 진입 링크(기존 품종·생산자 관리 옆).

**단계 4 — 시드 → 누락점검 → 백필** (순서 엄수):

> **2026-06-16 실측·결정 반영**(점검 스크립트 [scripts/check-product-type-backfill.ts](../../scripts/check-product-type-backfill.ts)):
> - 운영 DB MillingOutputPackage 428건 전부 productTypeId=null, 전부 벼 도정산(MILLED). 잡곡 매입/위탁 제품재고는 0건.
> - 찰벼 정규화([plan-찰벼도정유형정리.md](plan-찰벼도정유형정리.md)) 후 백필 대상 **58조합**(백옥찰 찹쌀→백미 흡수).
> - **발주서 명시 포장지는 3종**(자연주의·아이담쌀·PET) + 대부분 빈칸(기본). "약 20종"은 과대 추정 → **포장지 목록은 사용자 제공**.
> - **포장지 매칭키 결정(2026-06-16)**: `톤백`=일반 제품처럼 SKU 부여(발주/판매 매칭 O), 포장지=**`'톤백'`**(규격과 동명이나 packageType≠packaging.name 별개 필드라 무관). `잔량`=자체 판매 안 함(재포장 소진) → **SKU 백필 제외(productTypeId=null 유지)**. 잔량의 품종·생산자별 제품목록 처리는 **백로그**(재포장 흐름 + 잔량 전용 UX 별도 설계).
> - 시드 sentinel 포장지: `'톤백'`(톤백 규격용, active=true)·`'매입포장'`(매입 sentinel, active=false).

1. `seed`: Packaging(**사용자 제공 목록** + `'톤백'` + `'매입포장'`(active=false)) / 기본 ProductType(정규 규격별 기본 포장지 = 사용자 확정 / 톤백 규격은 포장지 `'톤백'`) / `Variety.aliases`(상위 §6.1.1·시드값: 서농22호=['가바']·흑미=['가바흑미']·발아현미=['가바발아현미']·천지향1세=['천지향']·백옥찰=['찹쌀'], name 조회·id 하드코딩 금지).
2. `check`: `productTypeId=null` 재고의 (품종+도정+규격) 중 기본 ProductType 없는 조합 전수 리포트(**'잔량' 규격 제외**). **0건 확인 후 백필.**
3. `backfill`: 각 `MillingOutputPackage`에 productTypeId 주입(idempotent). **'잔량' packageType은 스킵(null 유지)**. ⚠️ **품종·도정 2경로 분기**:
   - MILLED 벼: `stock.varietyId` + `batch.millingType`
   - MILLED 잡곡(`batchId=null`): `stock.varietyId` + `millingType='기타'`
   - PURCHASED 매입: `varietyId` + `'기타'` + `packagingId='매입포장'`

**단계 5 — 포장/매입 등록 3곳 연동**:
- **misc-purchase-dialog**(매입): 포장지 '매입포장' 자동, `createMiscPurchase`가 `findOrCreateProductType(품종,'기타',규격,매입포장)`.
- **misc-package-dialog**(잡곡포장): 포장지 강제+추천(`suggestProductType`), `createMiscPackage` 연동.
- **add-packaging-dialog**(도정산) ⚠️ **난도 최상**: 라인별 포장지 → `MillingOutputInput`에 `packagingId` 추가, 규격 추가 시 `suggestProductType` 호출, `updatePackagingLogs`가 라인마다 `findOrCreateProductType` 후 productTypeId 저장. 라인별 포장지 UI는 Claude Design.

---

## 6. 검증 (증거 기반 완료)
- 단계 1·2: `prisma generate` + 타입체크 통과
- 단계 4: 점검 0건 + 백필 후 `productTypeId=null` 잔존 수 리포트(0 기대)
- 단계 5: 3개 다이얼로그 각각 등록 → DB에 올바른 productTypeId(SKU 공유·find-or-create) 확인
- 전체: build(lint+typecheck) 통과 후 완료 선언

## 7. 리스크
| 리스크 | 대응 |
|---|---|
| add-packaging-dialog 라인별 SKU = 복잡 | 단계 5 마지막, MillingOutputInput 확장이 핵심 |
| millingType/packagingId NULL 유니크 구멍 | sentinel(`'기타'`/`'매입포장'`)로 NOT NULL 강제(§2) |
| 백필 누락 조합서 강제입력 막힘 | 단계 4 점검 0건이 단계 5 선행 |
| ProductType.varietyId ↔ stock.varietyId 이중화 | 등록 흐름이 품종 자동결정(§2-8) |
| `/admin/product-types` 가드 누락 무단접근 | 단계 3 middleware 한 줄 + 이중가드(서버 액션 `SALES_MANAGE`) |

## 8. 원칙
- 파일 800줄/함수 50줄, 수술적 변경, 시스템 경계 Zod, 불변성
- 각 단계 완료 시 커밋 + `docs/worklog.md` 갱신
