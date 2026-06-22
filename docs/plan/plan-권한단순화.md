# 계획서: 비즈니스 권한 5개 → 2개 단순화 + 관리권한 ADMIN 흡수

> **상태: ✅ 완료·푸시 (2026-06-22, origin/main `2afc7cd`)** — 코드·타입·DB 전부 통과. 결과보고서 [report-권한단순화-2026-06-22.md](../report/report-권한단순화-2026-06-22.md). 다음=발주서 §8 본구현 복귀.
> 발주서 판매처리 설계 중 권한 #14 검토에서 파생. 실제 사용자 권한 데이터 진단 → 2분할 + 새 키 2개(2안) + USER/SYSTEM의 ADMIN 흡수 확정.

## 1. 목표 / 배경

현재 비즈니스 권한 5개(`STOCK_MANAGE`·`MILLING_MANAGE`·`SALES_MANAGE`·`VARIETY_MANAGE`·`FARMER_MANAGE`)가 현장 겸직 구조와 안 맞아 한 사람에게 여러 개를 묶어 부여하게 되고, 권한 구분의 의미가 약해진 상태. **비즈니스 2개로 통합**하고, 동시에 관리 권한 중 위임이 없는 `USER_MANAGE`·`SYSTEM_MANAGE`를 **ADMIN role로 흡수**해 권한 키를 전반적으로 정리한다.

### 1.1 진단 근거 (2026-06-22, 실 DB User.permissions 11명 조회)

| 실제 역할 | 가진 권한 | 인원 |
|---|---|---|
| 가공·판매 라인 | MILLING + SALES | 6명 |
| 원물·마스터 라인 | STOCK + VARIETY + FARMER | 4명 |
| 전권(둘 다) | 6개 전부 | 3명 |
| 입고 전담 | STOCK+마스터, 가공·판매 X | 1명 (땅끝황토친환경) |
| 가공·판매 전담 | MILLING+SALES, 입고 X | 3명 (임승원·민채·이영명) |
| 공지 전담 | NOTICE만 | 2명 |
| 권한 없음 | (없음) | 1명 |

**데이터가 보여주는 사실:**
1. **`MILLING`과 `SALES`는 100% 동행**(6명 동일) → 분리 무의미.
2. **`VARIETY`와 `FARMER`도 100% 동행**(4명 동일) → 분리 무의미.
3. **`STOCK`은 MILLING/SALES와 갈림**(입고전담·가공판매전담 실재) → **진짜 경계**.
4. **`USER_MANAGE`·`SYSTEM_MANAGE` 개별 보유자 = 0명**(ADMIN만 자동 보유) → 별도 키로 둘 이유 없음, ADMIN 흡수해도 영향 0.

→ 비즈니스는 **2분할**(판매는 가공과 안 떨어지므로 따로 통제 안 함), 관리는 **USER/SYSTEM을 ADMIN으로 흡수**.

## 2. 결정: 새 키 2개(2안) + ADMIN 흡수

### 2.1 비즈니스 권한 5개 → 2개 (새 키 신설 — 2안)

| 새 키 | 흡수(폐기) | label | description | 포함 작업 |
|---|---|---|---|---|
| **`SUPPLY_MANAGE`** | STOCK + VARIETY + FARMER | **원물·마스터 관리** | 원물 입고·잡곡 매입 + 품종·생산자 마스터 등록/수정/삭제 | 입고·매입·품종·생산자 |
| **`OPERATION_MANAGE`** | MILLING + SALES | **가공·판매 관리** | 도정·포장 + 출고·판매·발주서 차감·제품유형 등록/수정/삭제 | 도정·포장·출고·판매·발주서·제품유형 |

- 폐기 키: `STOCK_MANAGE`·`MILLING_MANAGE`·`SALES_MANAGE`·`VARIETY_MANAGE`·`FARMER_MANAGE` (전부 새 키로 치환).
- 이름이 의미와 정확히 일치(2안 채택). 대신 전 호출부 전수 치환.

### 2.2 관리 권한 정리 — USER/SYSTEM의 ADMIN 흡수

| 키 | 처리 | 사유 |
|---|---|---|
| `USER_MANAGE` | **폐기 → ADMIN 전용** | 개별 보유자 0명, 관련 액션(user.ts) 이미 `requireAdmin`. 라우트만 ADMIN 전용화 |
| `SYSTEM_MANAGE` | **폐기 → ADMIN 전용** | 동일. backup.ts·logs·stock-excel·settings 이미 `requireAdmin` |
| `NOTICE_MANAGE` | **유지** | 공지 전담 2명이 업무권한 없이 이것만 보유 → 위임 의미 살아있음 |

→ 최종 권한 키: **`SUPPLY_MANAGE` · `OPERATION_MANAGE` · `NOTICE_MANAGE`** + ADMIN role.

## 3. 변경 범위

### 3.1 권한 정의 — `lib/permissions.ts`
- `BUSINESS_PERMISSIONS` = `SUPPLY_MANAGE`·`OPERATION_MANAGE` (2개)로 교체.
- `ADMIN_PERMISSIONS` = `NOTICE_MANAGE`만 남김(`USER_MANAGE`·`SYSTEM_MANAGE` 제거).
- 상단 주석(3-way 설명) 갱신.

### 3.2 미들웨어 — `middleware.ts`
| 라우트 | 변경 |
|---|---|
| `/admin/varieties` | VARIETY_MANAGE → **SUPPLY_MANAGE** |
| `/admin/farmers` | FARMER_MANAGE → **SUPPLY_MANAGE** |
| `/admin/product-types` | SALES_MANAGE → **OPERATION_MANAGE** |
| `/admin/users` | USER_MANAGE → **null(ADMIN 전용)** |
| `/admin/logs` | SYSTEM_MANAGE → **null(ADMIN 전용)** |
| `/admin/backup` | SYSTEM_MANAGE → **null(ADMIN 전용)** |
| `/admin/notices` | NOTICE_MANAGE (유지) |
| `/admin/settings` | null (유지) |

### 3.3 서버 액션 가드 치환 (~45곳, 전수)
| 파일 | 변경 | 건수 |
|---|---|---|
| `app/actions/stock.ts` | STOCK_MANAGE→SUPPLY_MANAGE | 4 |
| `app/actions/misc-stock.ts` | STOCK_MANAGE→SUPPLY_MANAGE | 3 |
| `app/actions/admin.ts` | VARIETY_MANAGE→SUPPLY_MANAGE | 4 |
| `app/actions/admin.ts` | FARMER_MANAGE→SUPPLY_MANAGE | 7 |
| `app/actions/excel.ts` | FARMER_MANAGE→SUPPLY_MANAGE | 1 |
| `app/actions/packages.ts` | STOCK_MANAGE→SUPPLY_MANAGE | 3 |
| `app/actions/packages.ts` | MILLING_MANAGE→OPERATION_MANAGE | 3 |
| `app/actions/milling.ts` | MILLING_MANAGE→OPERATION_MANAGE | 10 |
| `app/actions/release.ts` | SALES_MANAGE→OPERATION_MANAGE | 5 |
| `app/actions/product-type.ts` | SALES_MANAGE→OPERATION_MANAGE | 5 |
| `user.ts`·`backup.ts`·`stock-excel.ts`·`settings.ts` | **무변경**(이미 requireAdmin) | 0 |

### 3.4 클라이언트 UI 가드 치환 (~25곳, 전수)
- `STOCK_MANAGE`→`SUPPLY_MANAGE`: raw-stocks(stock-table-row·stock-page-client·stock-list-client·stock-excel-buttons·misc-stock-panel·misc-stock-list-client), packages(misc-package-panel).
- `MILLING_MANAGE`→`OPERATION_MANAGE`: milling(milling-page-client·milling-table-row·mobile-milling-card·close-batch-button·add-packaging-dialog), packages(misc-package-panel), raw-stocks(stock-page-client canMilling·misc-stock-list-client canMill), _components(recent-logs-list).
- `SALES_MANAGE`→`OPERATION_MANAGE`: sales/release(release-page-client·release-history-list·mobile-release-card), raw-stocks(stock-page-client canSales), product-types(product-type-page-client), components(desktop-sidebar·mobile-header).
- `VARIETY_MANAGE`→`SUPPLY_MANAGE`: admin/varieties(variety-page-client·variety-list-client).
- `FARMER_MANAGE`→`SUPPLY_MANAGE`: admin/farmers(farmer-page-client·farmer-list·excel-buttons).
- **관리자 메뉴 노출 조건**(desktop-sidebar:173 / mobile-header:83): `hasAnyPermission([... 'USER_MANAGE','NOTICE_MANAGE','SYSTEM_MANAGE'])`에서 USER/SYSTEM 제거 → **`role==='ADMIN' || hasPermission('NOTICE_MANAGE') || hasPermission('OPERATION_MANAGE')`** 형태로 재구성(제품유형 메뉴=OPERATION, 사용자/백업/로그=ADMIN, 공지=NOTICE). 각 항목별 가시성은 개별 가드 유지.
- ⚠️ `docs/handoff/.../MobileStockDetailCard.tsx`(핸드오프 산출물, 미사용)는 **제외**.

### 3.4b 사용자 관리 화면(`/admin/users`) — 코드 수정 불필요(동적 순회)
권한 부여/표시 화면은 `permissions.ts` 정의를 **동적으로 순회**하므로 정의 교체만으로 자동 반영된다. **하드코딩된 권한 키 없음 → 별도 수정 불필요**, 단 결과 확인 대상.
- [UserPermissionDialog.tsx](../../components/admin/UserPermissionDialog.tsx): 체크박스를 `Object.values(BUSINESS_PERMISSIONS)`·`Object.values(ADMIN_PERMISSIONS)`로 렌더 → 정의 교체 시 **업무권한=SUPPLY·OPERATION 2개**, **관리권한=NOTICE 1개**만 자동 노출(USER/SYSTEM은 ADMIN 흡수로 체크박스에서 사라짐 = 의도대로).
- [UserTable.tsx](../../components/admin/UserTable.tsx:129): 권한 배지를 `ALL_PERMISSIONS[p]?.label || p`로 표시 → 마이그레이션 후 새 키만 남아 정상. 폐기 키 잔존 시에도 `|| p` 폴백으로 미파손.
- ⚠️ `updateUserPermissions`(user.ts) = 이미 `requireAdmin` → 무변경.

### 3.5 DB 사용자 권한 마이그레이션 (1회성, idempotent)
```
각 User에 대해:
  if (STOCK_MANAGE | VARIETY_MANAGE | FARMER_MANAGE 보유) → SUPPLY_MANAGE 추가
  if (MILLING_MANAGE | SALES_MANAGE 보유)                → OPERATION_MANAGE 추가
  제거: STOCK_MANAGE, MILLING_MANAGE, SALES_MANAGE, VARIETY_MANAGE, FARMER_MANAGE, USER_MANAGE, SYSTEM_MANAGE
  유지: NOTICE_MANAGE
  (중복 제거)
```
**적용 예측(11명)**: 땅끝=SUPPLY+NOTICE / 임승원·민채·이영명=OPERATION / 이민화·윤상훈·정윤미=SUPPLY+OPERATION+NOTICE / 윤영식·최지니=NOTICE / 이창익=없음 / 문희준=ADMIN(무변경). USER/SYSTEM 보유자 0이라 제거 영향 없음. **권한 상실자 0**(전권자는 둘 다 유지).

### 3.6 문서
- `docs/permission-matrix.md`: 전면 갱신(키 정의·페이지별 가드·서버 가드·운영 가이드·변경 이력). 단일 진실 원천 → **코드보다 먼저 갱신**.
- `docs/plan/plan-발주서판매처리.md` §8.3: 권한 칸 "잠정" 해제 → 발주서 업로드·매칭·차감·판매·비판매 전부 **`OPERATION_MANAGE`** 로 확정. #14의 "업로드=영업/매칭=포장" 분리는 통합으로 **소멸**.

## 4. 작업 순서

1. **`permission-matrix.md` 먼저 갱신**(문서 선행 원칙).
2. `lib/permissions.ts` 정의 교체(비즈니스 2 + NOTICE).
3. `middleware.ts` 라우트 권한 치환.
4. 서버 액션 가드 전수 치환(§3.3).
5. 클라이언트 UI 가드 전수 치환(§3.4) + 관리자 메뉴 노출 조건 재구성.
6. **DB 마이그레이션 스크립트** 작성 → 사용자 확인 후 실행 → 11명 예측표와 대조 검증.
7. **빌드/타입체크** + 전역 grep(`STOCK_MANAGE|MILLING_MANAGE|SALES_MANAGE|VARIETY_MANAGE|FARMER_MANAGE|USER_MANAGE|SYSTEM_MANAGE`)이 코드(.ts/.tsx)에서 **0건**(NOTICE 제외) 게이트.
8. 결과보고서 + worklog 갱신.

## 5. 리스크 / 검증

- **권한 상실 사고**: 마이그레이션이 합집합("하나라도 있으면 추가")이라 상실 0. 실행 후 11명 전수 대조(증거 기반 완료).
- **폐기 키 잔존 참조**: 치환 누락 시 런타임 항상 거부(없는 권한). → 빌드 후 전역 grep 0건 게이트(작업 7).
- **세션 JWT 캐싱**: 기존 로그인 사용자 토큰에 옛 permissions 잔존 → **재로그인 시 갱신**. 배포 노트에 "권한 반영하려면 재로그인" 안내.
- **배포/DB**: 단일 Neon 클라우드 DB(로컬 .env 실서버 직결 추정). 마이그레이션은 데이터 변경 → **실행 전 사용자 확인 필수**.
- **테스트**: ①빌드 통과 ②grep 0건 ③DB 11명 변환 결과 대조 ④입고전담(땅끝)·가공판매전담(임승원) 계정 화면 버튼 노출 스폿 체크 ⑤**`/admin/users` 권한 부여 화면에 업무권한 SUPPLY·OPERATION 2개 + 관리권한 NOTICE 1개만 뜨는지** + 사용자 배지 라벨 정상 표시 확인.

## 6. 원칙
- 수술적 변경(권한 통합만). 시스템 경계 검증 유지. 문서 선행. 승인 후 착수, 완료 후 발주서 §8로 복귀.
