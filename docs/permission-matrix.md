# 권한 매트릭스 (Permission Matrix)

> **단일 진실 원천**: 권한 변경/추가/제거 시 **이 문서를 먼저** 갱신한 뒤 코드 수정.
> **마지막 갱신**: 2026-05-08 (잡곡 재고관리 #9.5 — 그림 B 채택)
> **관련 코드**: [lib/permissions.ts](../lib/permissions.ts), [lib/auth-guard.ts](../lib/auth-guard.ts), [middleware.ts](../middleware.ts)

## 설계 원칙

1. **3-way 비즈니스 권한**: 들여오기(원물 관리) / 가공(도정·포장 관리) / 내보내기(판매 관리)
2. **메뉴 ≠ 단일 권한**: 같은 페이지 안에서도 버튼·행별로 다른 권한이 필요할 수 있음 (예: `/raw-stocks` 잡곡 탭의 "포장하기" 버튼은 `MILLING_MANAGE`, 입고 등록은 `STOCK_MANAGE`)
3. **이중 가드**: 클라이언트(`hasPermission`)는 UI 노출 제어, 서버(`requirePermission`)는 실제 차단. **반드시 둘 다** 적용해야 우회 차단 가능
4. **ADMIN 자동 전권**: `role==='ADMIN'`은 모든 권한 자동 보유 (헬퍼 내부 처리)
5. **조회는 가드하지 않음**: 페이지 진입 가능한 사용자라면 데이터 조회는 자유. 등록/수정/삭제만 제어
6. **메뉴 가시성은 현상 유지**: 업무 메뉴(원물재고/도정/제품재고/판매/통계)는 모든 로그인 사용자에게 노출. 권한 없으면 등록/수정/삭제 버튼만 숨김. 관리(/admin/*) 메뉴만 권한별 가시성 적용

## 권한 키 정의

### Business Permissions (`BUSINESS_PERMISSIONS`)
| 코드 | label | description | 영역 |
| --- | --- | --- | --- |
| `STOCK_MANAGE` | 원물 관리 | 원물 입고 등록/수정/삭제 + 잡곡 매입 등록/수정/삭제 | 들여오기 |
| `MILLING_MANAGE` | 도정·포장 관리 | 벼 도정 + 벼 포장 + 잡곡 포장 등록/수정/삭제 | 가공 |
| `SALES_MANAGE` | 판매 관리 | 출고 + 향후 벼/잡곡 판매 등록/수정/삭제 | 내보내기 |
| `VARIETY_MANAGE` | 품종 관리 | 품종 등록/수정/삭제 | 마스터 |
| `FARMER_MANAGE` | 생산자 관리 | 생산자 등록/수정/삭제 | 마스터 |

### Admin Permissions (`ADMIN_PERMISSIONS`)
| 코드 | label | description |
| --- | --- | --- |
| `USER_MANAGE` | 사용자 관리 | 사용자 목록, 권한 변경 |
| `SYSTEM_MANAGE` | 시스템 관리 | 백업/복구 |
| `NOTICE_MANAGE` | 공지사항 관리 | 대시보드 전광판 공지 |

### 특별 권한
- **`ADMIN` role**: 모든 권한 자동 보유 (`hasPermission`/`requirePermission` 내부 처리)
- **`requireAdmin()`**: ADMIN 역할 전용 (백업, 사용자 관리, 일부 설정)

## 페이지·버튼·행별 클라이언트 가드

> 클라이언트 가드는 UI 노출 제어용 — 우회 가능하므로 **반드시 server action 가드와 짝**

### 원물재고 (`/raw-stocks`)
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 벼 탭 헤더 | 입고 등록 버튼 | `STOCK_MANAGE` |
| 벼 탭 행 | 수정/삭제 메뉴 | `STOCK_MANAGE` |
| 벼 탭 헤더 | 출고 처리 버튼 | `SALES_MANAGE` ⚠️ |
| 잡곡 탭 헤더 | 입고 등록 버튼 | `STOCK_MANAGE` |
| 잡곡 탭 행 | 수정/삭제 메뉴 | `STOCK_MANAGE` |
| **잡곡 탭 행** | **"포장" 버튼** (상태 셀) | **`MILLING_MANAGE`** ⚠️ |

### 도정관리 (`/milling`) — 벼 전용
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 헤더 | 도정 시작 버튼 | `MILLING_MANAGE` |
| 행 | 도정 마감/재개 | `MILLING_MANAGE` |
| 행 | 포장 등록/수정/삭제 | `MILLING_MANAGE` |
| 행 | 도정 배치 삭제 | `MILLING_MANAGE` |

### 제품재고 (`/packages`)
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 벼 탭 | (조회 + 엑셀만, 등록 X) | — |
| **잡곡 탭 헤더** | **"+ 포장하기" 버튼** | **`MILLING_MANAGE`** |
| **잡곡 탭 헤더** | **"+ 매입 등록" 버튼** | **`STOCK_MANAGE`** |
| **잡곡 탭 행 (MILLED)** | 수정/삭제 메뉴 | **`MILLING_MANAGE`** |
| **잡곡 탭 행 (PURCHASED)** | 수정/삭제 메뉴 | **`STOCK_MANAGE`** |

### 판매관리 (`/sales`)
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| 출고 탭 | 출고 등록 버튼 (벼 출고는 raw-stocks 측) | — |
| 출고 탭 | 출고 취소 (단일/일괄) | `SALES_MANAGE` |
| 출고 탭 행 | 수정 다이얼로그 | `SALES_MANAGE` |
| 출고 탭 행 | 항목(톤백) 제외 | `SALES_MANAGE` |
| 벼/잡곡 탭 | (준비중) | — |

### 관리 (`/admin/*`) — 미들웨어가 라우트 단위로 가드
| 라우트 | 권한 |
| --- | --- |
| `/admin/varieties` | `VARIETY_MANAGE` |
| `/admin/farmers` | `FARMER_MANAGE` |
| `/admin/users` | `USER_MANAGE` |
| `/admin/notices` | `NOTICE_MANAGE` |
| `/admin/logs` | `SYSTEM_MANAGE` |
| `/admin/backup` | `SYSTEM_MANAGE` |
| `/admin/settings` | ADMIN 전용 |

## Server Action 가드 (`requirePermission`)

> 모든 write(create/update/delete) 함수에 가드 필수. 조회는 `requireSession`만 (또는 가드 없음).

### 원물 (`STOCK_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/stock.ts` | `createStock`, `updateStock`, `deleteStock`, `deleteStocks` |
| `app/actions/misc-stock.ts` | `createMiscStock`, `updateMiscStock`, `deleteMiscStock` |
| `app/actions/packages.ts` | `createMiscPurchase`, `updateMiscPurchase`, `deleteMiscPurchase` |

### 도정·포장 (`MILLING_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/packages.ts` | `createMiscPackage`, `updateMiscPackage`, `deleteMiscPackage` |
| `app/actions/milling.ts` | `startMillingBatch`, `removeStockFromMilling`, `addPackagingLog`, `updatePackagingLogs`, `deletePackagingLog`, `closeMillingBatch`, `reopenMillingBatch`, `updateMillingBatchStatus`, `deleteMillingBatch`, `deleteMillingBatches`, `updateMillingBatchStocks`, `updateMillingBatchMetadata` |

### 판매 (`SALES_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/release.ts` | `createStockRelease`, `cancelStockRelease`, `updateStockRelease`, `deleteStockReleases`, `removeStockFromRelease` |

### 마스터 (`VARIETY_MANAGE` / `FARMER_MANAGE`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/admin.ts` | `createVariety`, `updateVariety`, `deleteVariety`, `deleteVarieties` (`VARIETY_MANAGE`) |
| `app/actions/admin.ts` | `createFarmer`, `updateFarmer`, `deleteFarmer`, `deleteFarmers`, `createFarmerWithGroup`, `createProducerGroup`, `updateProducerGroup` (`FARMER_MANAGE`) |
| `app/actions/excel.ts` | `importFarmers` (`FARMER_MANAGE`) |

### ADMIN 전용 (`requireAdmin`)
| 파일 | 함수 |
| --- | --- |
| `app/actions/backup.ts` | `getBackups`, `createBackup`, `restoreBackup` |
| `app/actions/user.ts` | 모든 함수 |
| `app/actions/settings.ts` | `saveYieldRates` |
| `app/actions/stock-excel.ts` | `importStocks` |

### 인라인 체크 (특이 케이스)
- `app/actions/notice.ts` — `createNotice`/`updateNotice`/`deleteNotice` 내부에서 `role !== 'ADMIN' && !permissions?.includes('NOTICE_MANAGE')` 직접 체크. 동작 동일하지만 패턴 비일관 — 별도 PR로 통일 검토.

## 운영 가이드

### 권한 부여 패턴
| 직원 유형 | 권장 권한 조합 |
| --- | --- |
| 원물 입고 담당 | `STOCK_MANAGE` |
| 도정·포장 담당 | `MILLING_MANAGE` |
| 매입·판매 담당 | `STOCK_MANAGE` (매입) + `SALES_MANAGE` (판매) |
| 통합 운영 담당 | `STOCK_MANAGE` + `MILLING_MANAGE` + `SALES_MANAGE` |
| 마스터 데이터 관리자 | `VARIETY_MANAGE` + `FARMER_MANAGE` |
| 시스템 관리자 | `ADMIN` role (모든 권한 자동) |

### 마이그레이션 (#9.5 배포 시)
- **변경 전**: `STOCK_MANAGE`만 갖고 있던 사용자가 출고 작업 가능했음
- **변경 후**: 같은 사용자는 출고 작업 못 함 → ADMIN이 `/admin/users`에서 **`SALES_MANAGE` 별도 부여 필요**
- 자동 백필 스크립트는 미제공 — 운영 사용자 수가 적으므로 수동 부여가 안전

## 변경 이력

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
- [docs/plan-잡곡재고관리-#9.5.md](plan/plan-잡곡재고관리-#9.5.md) — 본 변경의 계획서
- [docs/plan-잡곡재고관리.md](plan/plan-잡곡재고관리.md) — 상위 잡곡 기능 계획서 (§9.5 권한 단계)
- [docs/리팩토링-백로그.md](리팩토링-백로그.md) §12 — 권한 정비 백로그 (✅ #9.5에서 처리)
