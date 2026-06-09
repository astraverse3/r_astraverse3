# 잡곡 재고관리 #9.5 — 권한 체계 정리 (그림 B: 들여오기·가공·내보내기 3-way)

> **작성일**: 2026-05-08
> **상위 계획서**: [plan-잡곡재고관리.md §390-395](plan-잡곡재고관리.md)
> **백로그**: [리팩토링-백로그.md §12](../리팩토링-백로그.md)
> **사용자 결정 (2026-05-08)**: 그림 B 채택, label 변경 + `SALES_MANAGE` 신설, server 가드 보강, 메뉴 가시성 현상 유지, **권한 매트릭스 문서 신설**

## 사용자 결정 사항 요약
| 결정 | 내용 |
| --- | --- |
| 권한 키 분리 정책 | **그림 B**: 3-way (들여오기 / 가공 / 내보내기). 기존 `STOCK_MANAGE` 코드명 유지(label만 변경), `MILLING_MANAGE` label 확장, **`SALES_MANAGE` 신설** |
| Server action 가드 누락 | 이번 PR에 같이 보강 |
| 사이드바·모바일 네비 메뉴 가시성 | 현상 유지 (가시성 가드 추가 X) |
| **권한 매핑 문서화** | **신설** `docs/permission-matrix.md` — 한눈에 보는 단일 진실 원천. 코드 가드는 docs 링크 주석으로 연결 |

## 권한 키 정의 (변경 후)
| 키 | 변경 | label | description |
| --- | --- | --- | --- |
| `STOCK_MANAGE` | label/desc | **원물 관리** | 벼·잡곡 원물 입고 등록/수정/삭제 + 잡곡 매입 등록/수정/삭제 |
| `MILLING_MANAGE` | label/desc | **도정·포장 관리** | 벼 도정 + 벼 포장 + 잡곡 포장 등록/수정/삭제 |
| `SALES_MANAGE` | **신규** | **판매 관리** | 출고 + 향후 벼/잡곡 판매 등록/수정/삭제 |
| `VARIETY_MANAGE` | 변경 없음 | 품종 관리 | (기존) |
| `FARMER_MANAGE` | 변경 없음 | 생산자 관리 | (기존) |
| `USER_MANAGE` / `SYSTEM_MANAGE` / `NOTICE_MANAGE` | 변경 없음 | (기존) | (기존) |

> 코드명 `STOCK_MANAGE`는 유지 — DB의 `User.permissions` 배열에 저장된 문자열 호환성. label만 UI 표시 변경.

## 권한 매핑 (단일 진실 원천 = `docs/permission-matrix.md`)

### 페이지·버튼·행별 클라이언트 가드
| 위치 | 액션 | 권한 |
| --- | --- | --- |
| `/raw-stocks` 벼 탭 | 입고 등록/수정/삭제 | STOCK_MANAGE |
| `/raw-stocks` 잡곡 탭 | 입고 등록/수정/삭제 | STOCK_MANAGE |
| `/raw-stocks` 잡곡 탭 행 | **"포장하기" 버튼** | **MILLING_MANAGE** ⚠️ 다른 권한 |
| `/milling` | 도정 배치 시작/종료, 벼 포장 | MILLING_MANAGE |
| `/packages` 잡곡 탭 | "+ 포장하기" 버튼 | **MILLING_MANAGE** |
| `/packages` 잡곡 탭 | "+ 매입 등록" 버튼 | **STOCK_MANAGE** |
| `/packages` 잡곡 탭 행 | 수정/삭제 (source=MILLED) | MILLING_MANAGE |
| `/packages` 잡곡 탭 행 | 수정/삭제 (source=PURCHASED) | STOCK_MANAGE |
| `/sales` 출고 탭 | 출고 등록/수정/삭제 | **SALES_MANAGE** (신규) |

### Server actions 가드 (write 함수만 — 30개)
| 파일 | 함수 | 권한 |
| --- | --- | --- |
| `stock.ts` | createStock, updateStock, deleteStock, deleteStocks | STOCK_MANAGE |
| `misc-stock.ts` | createMiscStock, updateMiscStock, deleteMiscStock | STOCK_MANAGE |
| `packages.ts` | createMiscPackage, updateMiscPackage, deleteMiscPackage | **MILLING_MANAGE** |
| `packages.ts` | createMiscPurchase, updateMiscPurchase, deleteMiscPurchase | **STOCK_MANAGE** |
| `release.ts` | createStockRelease, cancelStockRelease, updateStockRelease, deleteStockReleases, removeStockFromRelease | **SALES_MANAGE** (신규) |
| `milling.ts` | 12함수 모두 | MILLING_MANAGE |

### 이미 가드 있는 영역 (변경 없음)
- `admin.ts` (VARIETY_MANAGE / FARMER_MANAGE)
- `excel.ts` (FARMER_MANAGE)
- `notice.ts` (NOTICE_MANAGE 인라인)
- `backup.ts` / `user.ts` / `settings.ts(saveYieldRates)` / `stock-excel.ts(importStocks)` (`requireAdmin`)
- 미들웨어 `/admin/*` 라우트 가드

## 변경 파일 / 범위

### A. `lib/permissions.ts` — 권한 키 마스터 갱신
- `STOCK_MANAGE` label "재고 관리" → "원물 관리", description 갱신
- `MILLING_MANAGE` label "도정 관리" → "도정·포장 관리", description 갱신
- **`SALES_MANAGE` 신규 추가** (BUSINESS_PERMISSIONS)
- 상단에 권한 정책 요약 주석 + `docs/permission-matrix.md` 링크

### B. `docs/permission-matrix.md` — 신설 (단일 진실 원천)
권한 키 정의 + 페이지/버튼/행별 매핑 + server action 매핑 + 정책 결정 컨텍스트(#9.5 결정 이력) 포함. 마크다운 표 위주로 한눈에 보이게.

### C. Server actions — `requirePermission` 가드 추가 (5파일, 30함수)
- `stock.ts` (4) → STOCK_MANAGE
- `misc-stock.ts` (3) → STOCK_MANAGE
- `packages.ts` (6) → MILLED 3개 = MILLING_MANAGE / PURCHASED 3개 = STOCK_MANAGE
- `release.ts` (5) → SALES_MANAGE
- `milling.ts` (12) → MILLING_MANAGE

각 파일 상단 import 추가 + 함수 본문 첫 줄에 `await requirePermission('XXX_MANAGE')`. `requireSession` 중복은 `requirePermission`이 내부 호출하므로 정리.

### D. 클라이언트 가드 보강 — `/raw-stocks` 잡곡 탭
- `app/(dashboard)/raw-stocks/misc/misc-stock-list-client.tsx` — `canPackage = hasPermission(user, 'MILLING_MANAGE')` 추가, 행 "포장" 버튼에 적용 (현재 `canManage`(STOCK_MANAGE)로 가려져 있음 — MILLING_MANAGE로 분기 변경)
- `app/(dashboard)/raw-stocks/misc/misc-stock-panel.tsx` — 필요 시 동일 분기

### E. 클라이언트 가드 신설 — `/packages` 잡곡 탭
- `app/(dashboard)/packages/misc-package-panel.tsx` — `useSession` + `canPackage`(MILLING_MANAGE) / `canPurchase`(STOCK_MANAGE) 두 변수
  - `[+ 포장하기]` 버튼 → `canPackage`
  - `[+ 매입 등록]` 버튼 → `canPurchase`
  - `handleEditRow`/`handleDeleteRow` → row.source 분기 후 각 권한 체크
- `package-list-client.tsx` → `package-row.tsx` / `mobile-package-card.tsx`로 source별 권한 prop 전달 (또는 콜백 자체를 권한별로 undefined 처리)

### F. 클라이언트 가드 변경 — `/sales` 출고 탭
- `app/(dashboard)/sales/release/release-page-client.tsx` — `STOCK_MANAGE` → `SALES_MANAGE`
- `app/(dashboard)/sales/release/release-history-list.tsx` — `STOCK_MANAGE` → `SALES_MANAGE`
- `app/(dashboard)/sales/release/mobile-release-card.tsx` — 동일

### G. 변경하지 않는 것
- 코드명 `STOCK_MANAGE` 자체 (DB 호환성)
- 기존 `MILLING_MANAGE` 코드명
- `notice.ts`의 인라인 체크 패턴
- 사이드바·모바일 네비 메뉴 가시성
- 조회(read) 함수 / 엑셀 export 함수 (현재 정책 유지)
- 벼 packages 탭 (등록 버튼 없음)

## 단계별 접근

1. **권한 매트릭스 문서 작성** (`docs/permission-matrix.md`) — 결정사항 동결, 후속 작업의 단일 진실 원천
2. **`lib/permissions.ts` 갱신** — label 변경 + `SALES_MANAGE` 신설 + 상단 docs 링크 주석
3. **Server action 가드 일괄 주입** (5파일, 30함수)
4. **클라이언트 가드 조정** — `/raw-stocks` 잡곡 탭, `/packages` 잡곡 탭, `/sales` 출고 탭
5. **검증** — tsc / lint / dev 서버 수동 테스트
6. **결과보고서** — `docs/report-잡곡재고관리-#9.5-2026-05-08.md`
7. **커밋** — `feat: 잡곡 재고관리 #9.5 — 권한 체계 정리 (그림 B + 매트릭스 문서)`. worklog 갱신

## 운영 영향 — 기존 사용자 권한 데이터

> **중요**: `STOCK_MANAGE` 의미가 축소됨 (출고 분리). 기존에 `STOCK_MANAGE`만 갖고 있던 사용자는 출고 작업을 못 하게 됨. 운영 사용자에게 `SALES_MANAGE`를 별도로 부여해야 함.

- 마이그레이션 전략: ADMIN이 `/admin/users`에서 기존 출고 담당자에게 `SALES_MANAGE` 수동 부여.
- 자동 백필 옵션도 가능하지만(예: `STOCK_MANAGE` 보유자에게 자동 `SALES_MANAGE` 부여) 본 PR 범위 외. 사용자가 운영 사용자 분포 보고 결정.

## 위험 요소

### 낮음 — 통제됨
- **권한 키 코드명 변경 0건** — DB의 `User.permissions` 배열 그대로.
- **신규 키 1개(`SALES_MANAGE`)만 추가** — 추가 방향이라 회귀 가능성 거의 없음.
- **단일 진실 원천 문서로 일관성 확보** — 향후 가드 추가 시 매트릭스 참조.

### 모니터링 항목
- **출고 담당자에게 `SALES_MANAGE` 누락 시 차단** — 위 운영 영향 섹션 참조. 배포 전 운영 사용자 권한 점검 필수.
- **잡곡 탭 이중 권한** — `/raw-stocks` 잡곡, `/packages` 잡곡은 한 페이지에서 두 권한이 동시에 작동. 사용자가 한 권한만 가지면 일부 버튼만 보임. 의도된 동작이지만 첫 노출 시 혼란 가능 → permission-matrix.md에 명시.

## 검증 체크리스트
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 본 작업 파일 새 에러 0건
- [ ] `docs/permission-matrix.md` 작성 완료
- [ ] STOCK_MANAGE만 보유한 사용자: 원물 입고/매입 OK, 포장하기/도정/출고 차단
- [ ] MILLING_MANAGE만 보유한 사용자: 도정/포장 OK, 입고/매입/출고 차단
- [ ] SALES_MANAGE만 보유한 사용자: 출고 OK, 입고/도정/포장/매입 차단
- [ ] ADMIN 사용자: 모든 작업 OK
- [ ] Server action 직접 호출 시 권한 체크 작동 (ForbiddenError)

## 작업 후 메모리 갱신
- `project_misc_grain_feature.md` — `#9.5 권한 정리 완료` + 매트릭스 문서 위치 명시
- `리팩토링-백로그.md §12` — ✅ 처리 표시
- `MEMORY.md` — 다음 재개 지점 갱신 (벼·잡곡 판매 탭 본구현)
