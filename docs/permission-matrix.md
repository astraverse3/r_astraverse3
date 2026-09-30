# 권한 매트릭스 (Permission Matrix)

> **단일 진실 원천**: 권한 변경/추가/제거 시 **이 문서를 먼저** 갱신한 뒤 코드 수정.
> **마지막 갱신**: 2026-09-30 (가입 승인제 — 역할 PENDING·REVOKED · /admin 기본 거부 §83 · 제품판매 탭 읽기 전용 §60)
> **관련 코드**: [lib/permissions.ts](../lib/permissions.ts), [lib/auth-guard.ts](../lib/auth-guard.ts), [middleware.ts](../middleware.ts)
> **관련 계획서**: [docs/plan/plan-권한단순화.md](plan/plan-권한단순화.md)

## 설계 원칙

1. **2-way 비즈니스 권한**: 원물·마스터(들여오기+마스터) / 가공·판매(가공+내보내기). 실제 사용 패턴(MILLING↔SALES 100% 동행, STOCK↔마스터 동행)에 맞춰 통합.
2. **메뉴 ≠ 단일 권한**: 같은 페이지 안에서도 버튼·행별로 다른 권한이 필요할 수 있음 (예: `/raw-stocks` 잡곡 탭의 "포장하기" 버튼은 `OPERATION_MANAGE`, 입고 등록은 `SUPPLY_MANAGE`)
3. **이중 가드**: 클라이언트(`hasPermission`)는 UI 노출 제어, 서버(`requirePermission`)는 실제 차단. **반드시 둘 다** 적용해야 우회 차단 가능
4. **ADMIN 자동 전권**: `role==='ADMIN'`은 모든 권한 자동 보유 (헬퍼 내부 처리). 사용자 관리·시스템(백업/복구/로그)·설정은 **ADMIN 전용**(별도 권한 키 없음)
5. **조회는 가드하지 않음**: 페이지 진입 가능한 사용자라면 데이터 조회는 자유. 등록/수정/삭제만 제어
   - 예외: **쓰기 화면 안에서만 부르는 조회**는 그 쓰기와 같은 권한이다(차감 팝오버의 `getCellAllocation`·`getBulkCellOptions`·`getUnmatchedCellOptions`, 게이트의 `previewBatch`, 재포장 다이얼로그의 `getRepackSources`, 삭제 전 `getProductTypeUsage`). 입구 버튼이 권한으로 숨으니 쌍이 맞는다
6. **메뉴 가시성은 현상 유지**: 업무 메뉴(원물재고/도정/제품재고/판매/통계)는 모든 로그인 사용자에게 노출. 권한 없으면 등록/수정/삭제 버튼만 숨김. 관리(/admin/*) 메뉴만 권한별 가시성 적용

## 권한 키 정의

### Business Permissions (`BUSINESS_PERMISSIONS`)
| 코드 | label | description | 흡수(구 키) |
| --- | --- | --- | --- |
| `SUPPLY_MANAGE` | 원물·마스터 관리 | 원물 입고·잡곡 매입 + 품종·생산자 마스터 등록/수정/삭제 | STOCK_MANAGE + VARIETY_MANAGE + FARMER_MANAGE |
| `OPERATION_MANAGE` | 가공·판매 관리 | 도정·포장 + 출고·판매·발주서 차감·제품유형 등록/수정/삭제 | MILLING_MANAGE + SALES_MANAGE |

### Admin Permissions (`ADMIN_PERMISSIONS`)
| 코드 | label | description |
| --- | --- | --- |
| `NOTICE_MANAGE` | 공지사항 관리 | 대시보드 전광판 공지 |

### 역할 (`User.role` · `lib/user-role.ts`) — 2026-09-30 가입 승인제(백로그 §83)
| 역할 | 뜻 | 들어가는 곳 |
| --- | --- | --- |
| `ADMIN` | 전권 | 전부 |
| `USER` | 승인됨. 업무 권한은 `permissions` | 대시보드 |
| `PENDING` | 첫 카카오 로그인 · 관리자 승인 대기 (`auth.ts` `profile()`이 넣는다) | `/pending`만 |
| `REVOKED` | DB에서 지워진 사용자의 남은 세션 — **토큰 전용 값, DB엔 없다** (`jwt` 콜백) | `/pending`만 |

- 판정은 `isApprovedRole()` 하나 — **허용 목록**(`ADMIN`·`USER`만 통과, 모르는 값·빈 값도 막힘)
- 서버: `requireSession()`이 승인 안 된 역할이면 `AuthError` → `requirePermission`·`requireAdmin`도 거치므로 **모든 서버 액션 자동 차단**
- 화면: `(dashboard)/layout.tsx`가 `redirect('/pending')` (미들웨어 쿠키 토큰은 낡을 수 있어 레이아웃에서 본다)
- 승인: `/admin/users` 위 「승인 대기」 블록 → `approveUser`(ADMIN, PENDING → USER · 권한 빈 채로). 거절 = `deleteUser`(다시 로그인하면 또 대기)
- 🔴 스키마 기본값은 여전히 `"USER"` — 사용자를 만드는 경로가 `profile()` 하나라 마이그레이션 없이 갔다. **사용자를 만드는 경로를 새로 만들면 PENDING을 직접 넣을 것**

### 특별 권한
- **`ADMIN` role**: 모든 권한 자동 보유 (`hasPermission`/`requirePermission` 내부 처리)
- **`requireAdmin()`**: ADMIN 역할 전용 — **사용자 관리(`/admin/users`), 시스템(백업·복구·활동로그), 설정**. (구 `USER_MANAGE`·`SYSTEM_MANAGE` 권한 키는 2026-06-22 폐기 → ADMIN 흡수)

## 페이지·버튼·행별 클라이언트 가드

> 클라이언트 가드는 UI 노출 제어용 — 우회 가능하므로 **반드시 server action 가드와 짝**

### 원물재고 (`/raw-stocks`)
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 벼 탭 헤더 | 입고 등록 버튼 | `SUPPLY_MANAGE` |
| 벼 탭 행 | 수정/삭제 메뉴 | `SUPPLY_MANAGE` |
| 벼 탭 헤더 | 출고 처리 버튼 | `OPERATION_MANAGE` ⚠️ |
| 잡곡 탭 헤더 | 입고 등록 버튼 | `SUPPLY_MANAGE` |
| 잡곡 탭 행 | 수정/삭제 메뉴 | `SUPPLY_MANAGE` |
| **잡곡 탭 행** | **"포장" 버튼** (상태 셀) | **`OPERATION_MANAGE`** ⚠️ |

### 도정관리 (`/milling`) — 벼 전용
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 헤더 | 도정 시작 버튼 | `OPERATION_MANAGE` |
| 행 | 도정 마감/재개 | `OPERATION_MANAGE` |
| 행 | 포장 등록/수정/삭제 | `OPERATION_MANAGE` |
| 행 | 도정 배치 삭제 | `OPERATION_MANAGE` |

### 제품재고 (`/packages`)
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 벼 탭 | (조회 + 엑셀만, 등록 X) | — |
| **잡곡 탭 헤더** | **"+ 포장하기" 버튼** | **`OPERATION_MANAGE`** |
| **잡곡 탭 헤더** | **"+ 매입 등록" 버튼** | **`SUPPLY_MANAGE`** |
| **잡곡 탭 행 (MILLED)** | 수정/삭제 메뉴 | **`OPERATION_MANAGE`** |
| **잡곡 탭 행 (PURCHASED)** | 수정/삭제 메뉴 | **`SUPPLY_MANAGE`** |

### 판매관리 (`/sales`)
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 출고 탭 | 출고 등록 버튼 (벼 출고는 raw-stocks 측) | — |
| 출고 탭 | 출고 취소 (단일/일괄) | `OPERATION_MANAGE` |
| 출고 탭 행 | 수정 다이얼로그 | `OPERATION_MANAGE` |
| 출고 탭 행 | 항목(톤백) 제외 | `OPERATION_MANAGE` |
| 제품판매 탭 | 목록 · 시트 매트릭스 · 주문 상세 · 엑셀 다운로드 (**읽기 전용**, 2026-09-30 §60) | — |
| 제품판매 탭 헤더 | 발주서 등록 (PC 버튼 · 모바일 아이콘) | `OPERATION_MANAGE` |
| 제품판매 탭 행 | 상차 편집 · ⋮ 비고 수정 · 시트 삭제 | `OPERATION_MANAGE` |
| 시트 매트릭스 | 행 체크박스 · 선택 바 · 셀 클릭(차감 팝오버) · 재매칭 | `OPERATION_MANAGE` |
| 시트 모바일 목록 · 주문 상세 | 품목 카드 탭(차감 시트) · 「N품목 일괄차감」 · 「작업필요 N건 검토」 · 재매칭 | `OPERATION_MANAGE` |
| 제품재고 행 | 재고차감(`createBulkMovements`) · 차감 취소 · 재포장 | `OPERATION_MANAGE` |

> 제품판매·매트릭스는 **서버 컴포넌트가 `getServerSession`으로 `canManage`를 한 번 계산해 prop으로 내린다**(`sales/page.tsx`, `sales/purchase/[uploadId]/page.tsx`). 자식은 콜백이 안 오면 그 버튼을 안 그린다.

### 관리 (`/admin/*`) — 미들웨어가 라우트 단위로 가드 · **표에 없는 경로는 ADMIN 외 거부**(2026-09-30 §83 S4 — 새 관리 화면은 `middleware.ts` 표에 먼저 등록)
| 라우트 | 권한 |
| --- | --- |
| `/admin/varieties` | `SUPPLY_MANAGE` |
| `/admin/product-types` | `OPERATION_MANAGE` |
| `/admin/farmers` | `SUPPLY_MANAGE` |
| `/admin/users` | ADMIN 전용 |
| `/admin/notices` | `NOTICE_MANAGE` |
| `/admin/logs` | ADMIN 전용 |
| `/admin/backup` | ADMIN 전용 |
| `/admin/settings` | ADMIN 전용 |

## Server Action 가드 (`requirePermission`)

> 모든 write(create/update/delete) 함수에 가드 필수. 조회는 `requireSession`만 (또는 가드 없음).

### 원물·마스터 (`SUPPLY_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/stock.ts` | `createStock`, `updateStock`, `deleteStock`, `deleteStocks` |
| `app/actions/misc-stock.ts` | `createMiscStock`, `updateMiscStock`, `deleteMiscStock` |
| `app/actions/packages.ts` | `createMiscPurchase`, `updateMiscPurchase`, `deleteMiscPurchase` |
| `app/actions/admin.ts` | `createVariety`, `updateVariety`, `deleteVariety`, `deleteVarieties` (구 VARIETY_MANAGE) |
| `app/actions/admin.ts` | `createFarmer`, `updateFarmer`, `deleteFarmer`, `deleteFarmers`, `createFarmerWithGroup`, `createProducerGroup`, `updateProducerGroup` (구 FARMER_MANAGE) |
| `app/actions/excel.ts` | `importFarmers` (구 FARMER_MANAGE) |
| `app/actions/stock-excel.ts` | `importStocks` (2026-09-21 ADMIN→SUPPLY_MANAGE) · `exportStocks`는 `requireSession` |

### 가공·판매 (`OPERATION_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/packages.ts` | `createMiscPackage`, `updateMiscPackage`, `deleteMiscPackage` |
| `app/actions/milling.ts` | `startMillingBatch`, `removeStockFromMilling`, `updatePackagingLogs`, `closeMillingBatch`, `reopenMillingBatch`, `updateMillingBatchStatus`, `deleteMillingBatch`, `deleteMillingBatches`, `updateMillingBatchStocks`, `updateMillingBatchMetadata` |
| `app/actions/release.ts` | `createStockRelease`, `cancelStockRelease`, `updateStockRelease`, `deleteStockReleases`, `removeStockFromRelease` |
| `app/actions/product-type.ts` | `createPackaging`, `togglePackagingActive`, `upsertProductType`, `getProductTypeUsage`(삭제 전 확인), `deleteProductType`, `toggleProductTypeActive` · 조회(`listPackagings`/`listProductTypes`/`listSkuSpecs`/`suggestProductType`)는 `requireSession` · `findOrCreateProductType`(`lib/product-type.ts`)은 내부 헬퍼(무가드, 상위 액션이 가드) |
| `app/actions/repack.ts` | `getRepackSources`(재포장 다이얼로그 전용 조회), `createRepack`, `cancelRepack` |
| `app/actions/purchase-order.ts` | `deletePurchaseUpload`, `deletePurchaseOrder`(호출 0 — 백로그 §56) · 조회 `listPurchaseUploads`는 `requireSession` |
| `app/actions/purchase-order-upload.ts` | `previewPurchaseOrder`, `uploadPurchaseOrder`, `updateUploadNote`, `updateUploadLoading` |
| `app/actions/purchase-order-matrix.ts` | `confirmCell`, `cancelCell` · 팝오버 조회 `getCellAllocation`, `getBulkCellOptions` · **`getUploadMatrix`는 `requireSession`**(2026-09-30 §60 — 매트릭스 읽기 전용) |
| `app/actions/purchase-order-assign.ts` | `rematchUpload` · 팝오버 조회 `getUnmatchedCellOptions` |
| `app/actions/purchase-order-batch.ts` | `confirmBatch` · 게이트 dry-run `previewBatch` |
| `app/actions/purchase-order-export.ts` | `exportPurchaseSheet` (D5 시트 엑셀 — 생산자·로트가 채워지는 내부 증빙)는 `requireSession` |
| `app/actions/package-movement.ts` | `createBulkMovements`(재고차감 화면), `cancelMovement`, `createSale`·`createNonSaleMovement`(호출 0 — 백로그 §56) · 조회(`listMovements`)는 `requireSession` |

### ADMIN 전용 (`requireAdmin`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/backup.ts` | `getBackups`, `createBackup` (복원은 화면에서 뺐다 — `scripts/restore-backup.ts`로만, 2026-09-30) |
| `app/actions/user.ts` | 모든 함수 (`getUsers`, `updateUserPermissions` 등) |
| `app/actions/settings.ts` | `saveYieldRates` · 조회(`getYieldRates`/`getYieldRate`)는 `requireSession` |
| `app/actions/shipping-vendor.ts` | `createShippingVendor`, `renameShippingVendor`, `moveShippingVendor`, `toggleShippingVendorActive` · 조회 `listShippingVendors`는 `requireSession` |
| `app/actions/audit.ts` | `getAuditLogs`, `exportAuditLogs` · `getLatestUpdateForPath`(레이아웃 「마지막 갱신」)는 `requireSession` |

### 인라인 체크 (특이 케이스)
- `app/actions/notice.ts` — `createNotice`/`updateNotice`/`deleteNotice` 내부에서 `role !== 'ADMIN' && !permissions?.includes('NOTICE_MANAGE')` 직접 체크. 동작 동일하지만 패턴 비일관 — 별도 PR로 통일 검토.

## 운영 가이드

### 권한 부여 패턴
| 직원 유형 | 권장 권한 조합 |
| --- | --- |
| 원물 입고·매입·마스터 담당 | `SUPPLY_MANAGE` |
| 도정·포장·판매 담당 | `OPERATION_MANAGE` |
| 통합 운영 담당 | `SUPPLY_MANAGE` + `OPERATION_MANAGE` |
| 공지 담당 | `NOTICE_MANAGE` |
| 시스템 관리자 | `ADMIN` role (모든 권한 + 사용자·백업·로그·설정 자동) |

### 마이그레이션 (권한 단순화 배포 시, 2026-06-22)
- 기존 `User.permissions` 자동 변환(합집합): STOCK/VARIETY/FARMER 보유 → `SUPPLY_MANAGE`, MILLING/SALES 보유 → `OPERATION_MANAGE`. 구 키 7종(USER/SYSTEM 포함) 제거, NOTICE 유지. **권한 상실자 0**(합집합).
- **세션 JWT 캐싱**: 기존 로그인 사용자는 토큰에 옛 permissions가 남음 → **재로그인 시 갱신**.

## 변경 이력

### 2026-09-30 — 가입 승인제 · 삭제 사용자 세션 차단 · /admin 기본 거부 (백로그 §83)
- 전: 카카오 계정만 있으면 누구나 로그인해 조회·엑셀 다운로드까지 됐다(`signIn` 무조건 통과 + 「조회는 가드 안 함」). 삭제한 사용자도 옛 토큰으로 계속 썼다. `/admin` 아래 매핑 안 된 경로는 세션만 있으면 통과
- 후: 위 「역할」 절. 기존 11명(ADMIN 1 · USER 10)은 행을 안 바꿨다. `getActiveNotices`(가드 없음)에 `requireSession` 추가
- 관리자 알림: **헤더 종 아이콘**(작업지시 ⑥, `lib/notifications.ts` → `components/header/header-bell.tsx`). ADMIN에게만 보인다. 처음 넣었던 사이드바·모바일 메뉴 뱃지(임시)는 걷어냈다
- 계획서: [plan-가입승인제.md](plan/plan-가입승인제.md)

### 2026-09-30 — 제품판매 탭 읽기 전용 · 문서 전수 대조 (백로그 §60)
- 증상: 가공·판매 권한이 없는 계정(11명 중 4명)이 시트를 누르면 매트릭스 대신 「이 작업을 할 권한이 없어요」 카드. 발주서 등록·⋮ 메뉴·상차 편집은 보이는데 누르면 실패
- 결정(사용자): **읽기 전용** — 원물출고 탭과 같은 방식. `getUploadMatrix`만 `requireSession`으로 풀고, 차감 입구(셀·체크박스·게이트·재매칭·품목 카드)는 `canManage`로 숨김. 쓰기·팝오버 조회 가드는 그대로
- 문서: 9/21 이후 빠진 가드(`repack`·`purchase-order-upload/matrix/assign/batch`·`shipping-vendor`·`audit`) 추가, 지워진 액션(`autoMatchOrderItem`·`setOrderItemProductType`·`confirmOrderItem`·`confirmOrder`·`cancelOrderItemMovements`·`listPurchaseOrders`·`getPurchaseOrderDetail`) 삭제. 대조는 `app/actions/*.ts`의 export 함수별 첫 가드를 스크립트로 뽑아서
- 계획서: [plan-제품판매-읽기전용.md](plan/plan-제품판매-읽기전용.md)

### 2026-09-21 — 원물 엑셀 업로드 `importStocks` ADMIN → `SUPPLY_MANAGE`
- 증상: 원물 엑셀 등록 버튼을 눌러도 "파일 분석 중 오류가 발생했습니다"만 뜨고 미리보기 요약조차 안 나옴. 특정 PC 문제로 보였으나 **계정 권한 문제**였다
- 원인: 버튼 노출 조건은 `SUPPLY_MANAGE`(`stock-excel-buttons.tsx`)인데 서버 가드만 `requireAdmin()`. 실 DB에 ADMIN은 1명뿐이라 **나머지 전원이 "버튼은 보이는데 항상 실패"**
- 같은 데이터를 다루는 `createStock`·`importFarmers`가 이미 `SUPPLY_MANAGE`였다 — **엑셀 import 한 곳만 빠져 있던 것**
- 에러가 뭉개진 이유: `requireAdmin()`이 `try` 블록 **밖**이라 `ForbiddenError`가 `ExcelImportResult`에 안 담기고 그대로 reject → 클라이언트가 generic 메시지만 표시. 실패 지점이 dry-run이라 요약도 안 뜬다
- 📌 교훈: **UI 노출 조건과 서버 가드는 한 쌍이다.** 어긋나면 "보이는데 안 되는" 기능이 되고, 사용자에겐 PC 고장처럼 보인다
- 재로그인 불필요(세션에 이미 `SUPPLY_MANAGE` 보유 — 버튼이 보였다는 게 그 증거)
- 계획서: [plan-26년산전환.md](plan/plan-26년산전환.md)

### 2026-06-22 — 권한 단순화 (비즈니스 5→2 + USER/SYSTEM ADMIN 흡수)
- 실 사용자 권한 데이터 진단(MILLING↔SALES 100% 동행, STOCK↔마스터 동행, USER/SYSTEM 개별 보유자 0) → 2분할 확정
- `BUSINESS_PERMISSIONS` = `SUPPLY_MANAGE`(STOCK+VARIETY+FARMER) · `OPERATION_MANAGE`(MILLING+SALES)
- `USER_MANAGE`·`SYSTEM_MANAGE` 폐기 → ADMIN 전용(`/admin/users`·`/admin/logs`·`/admin/backup` middleware `null`화)
- `NOTICE_MANAGE` 유지
- 서버 가드 ~45곳 + UI 가드 ~25곳 전수 치환, DB 사용자 권한 합집합 변환 1회
- 계획서: [plan-권한단순화.md](plan/plan-권한단순화.md)

### 2026-05-08 — 잡곡 재고관리 #9.5
- `STOCK_MANAGE` label "재고 관리" → "원물 관리", description 갱신 (출고 분리)
- `MILLING_MANAGE` label "도정 관리" → "도정·포장 관리" (잡곡 포장 포함)
- **`SALES_MANAGE` 신규 추가** (출고/판매 분리)
- `/packages` 디렉토리에 클라이언트 가드 신설 (포장=MILLING_MANAGE, 매입=STOCK_MANAGE 분기)
- `/raw-stocks` 잡곡 탭 "포장" 버튼 가드를 `STOCK_MANAGE`→`MILLING_MANAGE`로 교체
- `/sales/release` 가드를 `STOCK_MANAGE`→`SALES_MANAGE`로 교체
- 모든 핵심 server action(`stock.ts`, `misc-stock.ts`, `packages.ts`, `release.ts`, `milling.ts`)에 `requirePermission` 가드 일괄 주입 (총 30함수)

### (이전) — 초기 설계
- `STOCK_MANAGE`/`MILLING_MANAGE`/`VARIETY_MANAGE`/`FARMER_MANAGE` + Admin 3개 권한 키 정의
- 미들웨어가 `/admin/*` 라우트 권한 체크
- `admin.ts`/`excel.ts`/`notice.ts`만 server action 가드 적용

## 관련 문서
- [docs/plan/plan-권한단순화.md](plan/plan-권한단순화.md) — 본 변경(2026-06-22)의 계획서
- [docs/plan-잡곡재고관리-#9.5.md](plan/plan-잡곡재고관리-#9.5.md) — 권한 분리(#9.5) 계획서
- [docs/리팩토링-백로그.md](리팩토링-백로그.md) §12 — 권한 정비 백로그
