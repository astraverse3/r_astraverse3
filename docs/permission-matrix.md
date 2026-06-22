# 권한 매트릭스 (Permission Matrix)

> **단일 진실 원천**: 권한 변경/추가/제거 시 **이 문서를 먼저** 갱신한 뒤 코드 수정.
> **마지막 갱신**: 2026-06-22 (권한 단순화 — 비즈니스 5→2개 통합 + USER/SYSTEM의 ADMIN 흡수)
> **관련 코드**: [lib/permissions.ts](../lib/permissions.ts), [lib/auth-guard.ts](../lib/auth-guard.ts), [middleware.ts](../middleware.ts)
> **관련 계획서**: [docs/plan/plan-권한단순화.md](plan/plan-권한단순화.md)

## 설계 원칙

1. **2-way 비즈니스 권한**: 원물·마스터(들여오기+마스터) / 가공·판매(가공+내보내기). 실제 사용 패턴(MILLING↔SALES 100% 동행, STOCK↔마스터 동행)에 맞춰 통합.
2. **메뉴 ≠ 단일 권한**: 같은 페이지 안에서도 버튼·행별로 다른 권한이 필요할 수 있음 (예: `/raw-stocks` 잡곡 탭의 "포장하기" 버튼은 `OPERATION_MANAGE`, 입고 등록은 `SUPPLY_MANAGE`)
3. **이중 가드**: 클라이언트(`hasPermission`)는 UI 노출 제어, 서버(`requirePermission`)는 실제 차단. **반드시 둘 다** 적용해야 우회 차단 가능
4. **ADMIN 자동 전권**: `role==='ADMIN'`은 모든 권한 자동 보유 (헬퍼 내부 처리). 사용자 관리·시스템(백업/복구/로그)·설정은 **ADMIN 전용**(별도 권한 키 없음)
5. **조회는 가드하지 않음**: 페이지 진입 가능한 사용자라면 데이터 조회는 자유. 등록/수정/삭제만 제어
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
| 제품판매 탭(발주서) | 업로드·매칭·차감·판매(향후) | `OPERATION_MANAGE` |

### 관리 (`/admin/*`) — 미들웨어가 라우트 단위로 가드
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

### 가공·판매 (`OPERATION_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/packages.ts` | `createMiscPackage`, `updateMiscPackage`, `deleteMiscPackage` |
| `app/actions/milling.ts` | `startMillingBatch`, `removeStockFromMilling`, `addPackagingLog`, `updatePackagingLogs`, `deletePackagingLog`, `closeMillingBatch`, `reopenMillingBatch`, `updateMillingBatchStatus`, `deleteMillingBatch`, `deleteMillingBatches`, `updateMillingBatchStocks`, `updateMillingBatchMetadata` |
| `app/actions/release.ts` | `createStockRelease`, `cancelStockRelease`, `updateStockRelease`, `deleteStockReleases`, `removeStockFromRelease` |
| `app/actions/product-type.ts` | `createPackaging`, `togglePackagingActive`, `upsertProductType`, `deleteProductType`, `toggleProductTypeActive` · `findOrCreateProductType`은 내부 헬퍼(무가드, 상위 액션이 가드) |
| `app/actions/purchase-order.ts` (향후) | 발주서 업로드·매칭·차감·취소·export |
| `app/actions/package-movement.ts` (향후) | `createSale`, `createNonSaleMovement`, `cancelMovement` |

### ADMIN 전용 (`requireAdmin`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/backup.ts` | `getBackups`, `createBackup`, `restoreBackup` |
| `app/actions/user.ts` | 모든 함수 (`updateUserPermissions` 등) |
| `app/actions/settings.ts` | `saveYieldRates` |
| `app/actions/stock-excel.ts` | `importStocks` |

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
