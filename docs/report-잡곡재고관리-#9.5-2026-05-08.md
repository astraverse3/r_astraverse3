# 잡곡 재고관리 #9.5 — 권한 체계 정리 (그림 B) — 결과보고서

> **작업일**: 2026-05-08
> **계획서**: [plan-잡곡재고관리-#9.5.md](plan-잡곡재고관리-#9.5.md)
> **매트릭스**: [permission-matrix.md](permission-matrix.md) (단일 진실 원천)

## 변경 사항 요약

총 **15파일** 변경 (신규 2 + 수정 13).

### A. 단일 진실 원천 신설 (1파일)
- **`docs/permission-matrix.md`** — 권한 키 정의 + 페이지·버튼·행별 매핑 + server action 매핑 + 변경 이력. 향후 권한 변경 시 이 문서 먼저 갱신.

### B. `lib/permissions.ts` (1파일)
- 상단에 권한 정책 요약 주석 + 매트릭스 docs 링크
- `STOCK_MANAGE` label "재고 관리" → "원물 관리", description 갱신 (출고 분리)
- `MILLING_MANAGE` label "도정 관리" → "도정·포장 관리"
- **`SALES_MANAGE` 신규 추가** (BUSINESS_PERMISSIONS)

### C. Server actions — `requirePermission` 가드 일괄 주입 (5파일, 총 28개 함수)

| 파일 | 함수 | 권한 |
| --- | --- | --- |
| `app/actions/stock.ts` | createStock, updateStock, deleteStock, deleteStocks (4) | `STOCK_MANAGE` |
| `app/actions/misc-stock.ts` | createMiscStock, updateMiscStock, deleteMiscStock (3) | `STOCK_MANAGE` |
| `app/actions/packages.ts` | createMiscPackage, updateMiscPackage, deleteMiscPackage (3) | `MILLING_MANAGE` |
| `app/actions/packages.ts` | createMiscPurchase, updateMiscPurchase, deleteMiscPurchase (3) | `STOCK_MANAGE` |
| `app/actions/release.ts` | createStockRelease, cancelStockRelease, updateStockRelease, deleteStockReleases, removeStockFromRelease (5) | `SALES_MANAGE` |
| `app/actions/milling.ts` | startMillingBatch, removeStockFromMilling, addPackagingLog, updatePackagingLogs, deletePackagingLog, updateMillingBatchStatus, deleteMillingBatch, deleteMillingBatches, updateMillingBatchStocks, updateMillingBatchMetadata (10) | `MILLING_MANAGE` |

> 각 파일의 import에 `requirePermission` 추가, write 함수 본문 첫 줄을 `requireSession()` → `requirePermission('XXX_MANAGE')`로 교체.
> read 함수(`getStocks`, `getStockGroups`, `getStocksByGroup`, `getMillingLogs`, `getMiscStocks`/`getMillingVendors`/...)는 `requireSession()` 유지 (정책: 조회는 가드 X).
> `closeMillingBatch`/`reopenMillingBatch`는 `updateMillingBatchStatus` wrapper라 자동 가드.

### D. 클라이언트 가드 (5파일)

#### D-1. `/raw-stocks` 잡곡 탭 (이중 권한 분기)
- `misc-stock-list-client.tsx` — `canMill = hasPermission(session?.user, 'MILLING_MANAGE')` 신설, row 3곳에 `canMill` prop 전달
- `misc-stock-table-row.tsx` — `Props`/`MobileCardProps`에 `canMill?: boolean` 추가, **포장 버튼 가드를 `canManage` → `canMill`로 교체** (수정/삭제 메뉴는 `canManage` 그대로)

#### D-2. `/packages` 잡곡 탭 (이중 권한 신설)
- `misc-package-panel.tsx` — `useSession` + `canMill`(MILLING_MANAGE) + `canPurchase`(STOCK_MANAGE) + `canAnyRow` 변수 신설
  - `[+ 포장하기]` 버튼 → `canMill` 가드
  - `[+ 매입 등록]` 버튼 → `canPurchase` 가드
  - `handleEditRow`/`handleDeleteRow` 안에 source별 권한 체크 + toast 안내
  - `<PackageListClient onEditRow/onDeleteRow>`는 `canAnyRow`일 때만 전달 (둘 다 권한 0이면 메뉴 자체 비표시)

#### D-3. `/sales/release` (SALES_MANAGE 교체)
- `release-page-client.tsx` — `STOCK_MANAGE` → `SALES_MANAGE`
- `release-history-list.tsx` — 동일
- `mobile-release-card.tsx` — 동일

#### D-4. `/raw-stocks` 벼 페이지 (출고 버튼 SALES_MANAGE 분리)
- `stock-page-client.tsx` — `canSales = hasPermission(session?.user, 'SALES_MANAGE')` 신설, **출고/출고취소 버튼**은 `canSales`로 가드 (재고 삭제·도정·담기는 기존 키 유지)

## 변경하지 않은 것 (의도적)
- 코드명 `STOCK_MANAGE`/`MILLING_MANAGE` 자체 — DB의 `User.permissions` 배열 호환성, label만 UI 변경
- 사이드바·모바일 네비 메뉴 가시성 — 사용자 결정대로 현상 유지
- 조회(read) server actions — 정책상 가드 X
- 엑셀 export 함수 — 조회 성격
- 기존 가드 영역(`admin.ts`/`excel.ts`/`notice.ts`/`backup.ts`/`user.ts`/`settings.ts`/`stock-excel.ts`) — 매트릭스 매핑 정확
- 미들웨어 `/admin/*` 라우트 가드
- 벼 packages 탭(`rice-package-panel.tsx`) — 등록/수정/삭제 버튼 없음
- `notice.ts`의 인라인 체크 패턴 — 별도 PR로 통일 검토(매트릭스 명시)
- 기존 lint 경고(`any`, `@ts-ignore`) — 수술적 변경 원칙

## 주요 결정 사항

### 1. 그림 B 채택 (3-way: 들여오기 / 가공 / 내보내기)
업무 흐름과 권한 라벨 일치. 잡곡 포장이 시스템상 "원물→제품 변환"이라 도정과 같은 카테고리(`MILLING_MANAGE`)로 묶음.

### 2. 페이지 ≠ 단일 권한 (이중 권한 페이지)
- `/raw-stocks` 잡곡 탭: 입고는 STOCK_MANAGE, 포장 버튼은 MILLING_MANAGE
- `/packages` 잡곡 탭: 포장하기는 MILLING_MANAGE, 매입 등록은 STOCK_MANAGE
- `/raw-stocks` 벼 페이지: 입고/도정 버튼과 별개로 출고 버튼은 SALES_MANAGE

→ **단일 진실 원천 = `permission-matrix.md`**로 흩어진 매핑 문서화.

### 3. `/packages` 잡곡 탭 콜백 가드 패턴
- 메뉴 표시 자체는 `canAnyRow`(둘 중 하나라도 권한)로 분기 → 권한 0인 사용자는 메뉴 비표시
- 메뉴 클릭 후 `handleEditRow`/`handleDeleteRow`에서 row.source 기반 세부 권한 체크 + toast 안내
- prop drill을 `package-list-client`/`package-row`/`mobile-package-card`까지 가져가지 않고 panel 단에서 처리 (수술적 변경)

## 검증 결과

### ✅ 자동 검증
- `npx tsc --noEmit` — 에러 0건
- `npx eslint <변경파일들>` — 본 작업으로 새로 발생한 lint 에러/경고 0건. 보고된 47 errors / 8 warnings는 모두 기존 사항(`any`, `@ts-ignore`, 미사용 변수)

### 🟡 사용자 직접 검수 필요 (운영 마이그레이션)

> **중요**: `STOCK_MANAGE` 의미가 축소됨 (출고 분리). 기존 `STOCK_MANAGE`만 보유하던 사용자는 출고 작업 불가.

배포 전 권한 부여 점검:
- [ ] `/admin/users`에서 출고 담당자 목록 확인 → `SALES_MANAGE` 별도 부여
- [ ] 도정·포장 담당자에게 `MILLING_MANAGE` 보유 확인 (잡곡 포장이 새로 이 권한으로 묶임)
- [ ] ADMIN role 사용자는 모든 권한 자동 보유 — 영향 없음

### 🟡 dev 서버 수동 테스트 (권장)
- [ ] STOCK_MANAGE만 보유: 원물 입고/매입 OK, 포장하기/도정/출고 차단(메뉴 비표시 또는 toast)
- [ ] MILLING_MANAGE만 보유: 도정/포장 OK, 입고/매입/출고 차단
- [ ] SALES_MANAGE만 보유: 출고 OK, 입고/도정/포장/매입 차단
- [ ] ADMIN 사용자: 모든 작업 OK
- [ ] 권한 미보유 사용자가 server action 직접 호출 시 `ForbiddenError` 응답

## 위험 / 모니터링

### 낮음
- 권한 키 코드명 변경 0건 → DB 마이그레이션 불필요
- 클라이언트 가드는 추가/교체 방향 → 회귀 가능성 거의 없음
- Server 가드는 정상 사용자(클라이언트 가드 통과한)에게 영향 없음

### 모니터링
- **출고 담당자 SALES_MANAGE 누락**: 권한 부여 점검 누락 시 출고 작업 차단됨. 위 운영 마이그레이션 체크리스트 참조.
- **잡곡 탭 이중 권한 UX**: 한 권한만 가진 사용자는 일부 버튼만 보임. 정상 동작이지만 첫 노출 시 혼란 가능 → 매트릭스 문서로 안내.
- **`notice.ts` 인라인 체크 패턴**: 본 PR에서 통일하지 않음. 매트릭스에 명시했으니 향후 별도 PR.

## 후속 정리
- `project_misc_grain_feature.md` — `#9.5 권한 정리 완료(그림 B)` 기록, 다음 재개 지점 갱신 (벼·잡곡 판매 탭 본구현)
- `MEMORY.md` — 다음 재개 지점 갱신
- `리팩토링-백로그.md §12` — ✅ 처리 (다음 커밋에서 표시)

## 확인 필요한 사항
- [ ] 운영 사용자 권한 분포 점검 (특히 출고 담당자에게 SALES_MANAGE 부여)
- [ ] dev 서버 수동 테스트 (선택)
- [ ] 커밋 진행 여부
