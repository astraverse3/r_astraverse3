# 작업일지

## 2026-04-21

### 공지사항 마키 최신 공지 시각 구분 `feat` `ux`

**배경**: 마키 배너가 모든 공지를 동일한 폰트·색상으로 흘려서 최신 공지인지 과거 공지인지 구분이 안 됐음.

**수정 내용**:
- 각 공지 앞에 `[MM-DD]` 날짜 prefix 추가 (본문과 동일 크기, `font-mono`)
- 가장 최신 1건: 굵은 진한 주황(`#c2410c`) + 3일 이내면 빨간 `NEW` 뱃지
- 나머지 공지: 얇은 연한 주황(`#fb923c`)로 차등화 (회색이 아닌 같은 주황 계열로 배너 톤 유지)
- 구분자 `•` 색도 연한 주황(`#fdba74`)으로 맞춤
- `NoticeTicker` 로컬 컴포넌트로 분리 (원본/복제본 span 둘 다에서 재사용)
- 애니메이션 duration 계산용 글자 수는 날짜/구분자 추가분 반영해 재계산

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `app/(dashboard)/_components/notice-marquee.tsx`

### 공지사항 팝업에 전체 목록 뷰 추가 `feat`

**배경**: 일반 사용자가 마키 팝업에서 공지 한 건만 볼 수 있고 과거 공지나 다른 공지로 이동할 수 없었음. 별도 목록 페이지 대신 기존 팝업 안에서 목록/상세를 토글하는 방식으로 구현.

**수정 내용**:
- `NoticeViewDialog`에 `notices?` prop과 `mode: detail | list` 내부 상태 도입
- 상세 뷰 푸터에 "전체 목록" 버튼 추가 (notices 전달된 경우에만 노출)
- 목록 뷰: 카드형 버튼 목록 (제목/내용 미리보기/작성자/등록일), 현재 선택 공지 주황 하이라이트
- 목록에서 항목 클릭 → 해당 공지 상세로 전환, "상세로" 버튼으로 복귀
- 팝업 재오픈 시 상세 모드 + 마키에서 전달한 공지로 초기화
- `notice-marquee.tsx`에서 전체 활성 공지 배열을 팝업에 전달 (author.name → authorName 매핑)
- 관리자 `/admin/notices`의 NoticeTable은 notices를 전달하지 않아 버튼 미노출 (기존 동작 유지)

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `components/admin/NoticeViewDialog.tsx`
- `app/(dashboard)/_components/notice-marquee.tsx`
- `docs/plan-notice-list.md` (계획서)
- `docs/report-notice-list-2026-04-21.md` (결과보고서)

### 재고에 농가명(actualFarmer) 필드 추가 `feat`

**배경**: 인증은 공식 생산자 명의로 되어있지만 실제로는 배우자 등 다른 가족이 농사짓는 경우가 있음. 톤백에도 실제 농가명이 적히는 경우가 있어 검색까지 필요.

**수정 내용**:
- `Stock` 모델에 `actualFarmer String?` 컬럼 추가 + 마이그레이션 파일 생성
- `StockFormData` 타입 확장, `createStock`/`updateStock`에서 저장 (trim 후 빈 값 null 처리)
- `getStocks`/`getStockGroups`/`getStocksByGroup`/`exportStocks`의 `farmerName` 검색을 **생산자명 OR 농가명** OR 조건으로 확장 (콤마 멀티값 유지)
- 등록/수정 다이얼로그에 "농가명 (선택)" 입력란 추가 (생산자 셀렉트 오른쪽 2-column)
- PC 테이블/모바일 카드에 `생산자(농가명)` 형태로 병기 (값 없으면 생산자명만)
- PC 테이블 생산자 컬럼 너비 60px → 120px 확장
- 검색 필터 라벨 "생산자 / 농가명"으로 변경, placeholder 안내 수정
- 엑셀 Export에 "농가명(선택)" 컬럼 추가 (생산자명 옆), Import에서도 `농가명`/`농가명(선택)` 헤더 수용
- `package.json` build 스크립트에 `prisma migrate deploy` 선행 추가 → Vercel 배포 시 production DB 자동 마이그레이션

**검증**: Neon DB에 `actualFarmer` 컬럼 추가 확인 (`information_schema.columns` 조회). 브라우저 동작 확인은 사용자 환경에서 수행.

**변경 파일**:
- `prisma/schema.prisma`
- `prisma/migrations/20260421000000_add_stock_actual_farmer/migration.sql` (신규)
- `app/actions/stock.ts`
- `app/actions/stock-excel.ts`
- `app/(dashboard)/stocks/page.tsx`
- `app/(dashboard)/stocks/add-stock-dialog.tsx`
- `app/(dashboard)/stocks/edit-stock-dialog.tsx`
- `app/(dashboard)/stocks/stock-table-row.tsx`
- `app/(dashboard)/stocks/stock-list-client.tsx`
- `app/(dashboard)/stocks/stock-filters.tsx`
- `package.json`
- `docs/plan-stock-farmhouse.md` (계획서)
- `docs/report-stock-farmhouse-2026-04-21.md` (결과보고서)

### 재고 검색결과 품종 칩이 ID로 표시되던 버그 `fix` `ux`

재고목록 상단 "검색결과 N건" 영역의 품종 칩이 URL 쿼리의 `varietyId` 값(숫자 ID 콤마 문자열)을 그대로 출력하고 있었음. 여러 품종을 선택해도 한 Badge에 "1,4,5"처럼 묶여서 표시됨.

**수정 내용**:
- `ActiveStockFilters`에 `varieties: { id, name }[]` prop 추가
- `varietyId` 파라미터를 콤마 분리 → ID→이름 매핑 → 품종별 개별 Badge 렌더
- 매핑 실패 시 fallback으로 ID 자체를 표시 (방어)
- `stock-page-wrapper.tsx`에서 기존에 보유한 `varieties` 배열을 그대로 주입

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `app/(dashboard)/stocks/active-filters.tsx`
- `app/(dashboard)/stocks/stock-page-wrapper.tsx`

### 재고관리 필터·엑셀 수정 + 통계 엑셀 다운로드 추가 `fix` `feat`

**배경**: 사용자 리뷰에서 지적된 4건 일괄 처리. ①재고 필터 드롭다운 휠 스크롤 ②품종 필터 전체 해제 버튼 ③재고 엑셀 다중 품종 버그 ④통계 목록 엑셀 다운로드 기능.

**수정 내용**:
- 공용 드롭다운 2종에 `onWheel.stopPropagation` 추가 (PC 휠 동작), `MultiSelect`에 "전체 해제" 버튼 조건부 노출
- `exportStocks` 다중값 버그 수정: `parseInt(params.varietyId)` → `getStocks`와 동일한 콤마 분리 + `in/OR` 처리. `productionYear/varietyId/certType/farmerName` 모두 다중 선택 반영
- `daa` → `data` 오타 교정 (서버 액션 리턴값 + 클라이언트 호출부)
- 엑셀 다운로드 헤더에 업로드 기준 선택 필드 `(선택)` 접미사 부여 (`작목반명/인증구분/인증번호/상태`). `importStocks`에 `pick()` 헬퍼로 양쪽 헤더명 수용 → 재업로드 호환
- 통계 공통 `exportStatsRows` 서버 액션 + `StatsExcelButton` 공통 컴포넌트 신설
- 재고분석/수율분석/출고분석 3개 페이지 탭 바에 엑셀 버튼 배치. 클라이언트가 보유한 탭별 rows를 한글 헤더로 매핑해 서버로 전달, 서버는 xlsx 변환 + 감사 로그만 수행

**제외**: 도정구분별(`millingtype`) 페이지는 차트만 있고 테이블이 없어 사용자 요청 범위 밖으로 판단, 엑셀 버튼 추가하지 않음.

**검증**: `npx tsc --noEmit` 통과. UI 테스트는 배포 후 필요.

**문서**:
- `docs/plan-stock-filter-fixes.md`
- `docs/report-stock-filter-fixes-2026-04-21.md`

**변경 파일** (9개):
- `components/ui/multi-select.tsx`
- `components/statistics/MultiSelectDropdown.tsx`
- `components/statistics/StatsExcelButton.tsx` (신규)
- `app/actions/stock-excel.ts`
- `app/actions/stats-excel.ts` (신규)
- `app/(dashboard)/stocks/stock-excel-buttons.tsx`
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
- `app/(dashboard)/statistics/output/output-stats-client.tsx`

## 2026-04-20

### 어드민 메뉴 접근 권한 수정 `fix` `security`

**배경 & 버그**: 배포 환경에서 `VARIETY_MANAGE` / `FARMER_MANAGE` 권한 보유자가 품종관리(`/admin/varieties`) · 생산자관리(`/admin/farmers`) 메뉴에 진입 불가. 원인은 `proxy.ts`의 블랭킷 `/admin/*` ADMIN-only 가드가 업무 권한 구조("페이지 조회는 누구나, 수정만 권한자")를 깨뜨린 것. 추가로 파일명이 `proxy.ts`라 Next.js 표준 자동 로드 대상에서 벗어남.

**수정 내용**:
- `proxy.ts` 삭제 → `middleware.ts` 신규 생성 (표준 이름)
- 블랭킷 가드를 **경로별 권한 매핑 테이블**로 교체: `/admin/varieties` → `VARIETY_MANAGE`, `/admin/farmers` → `FARMER_MANAGE`, `/admin/users` → `USER_MANAGE`, `/admin/notices` → `NOTICE_MANAGE`, `/admin/logs` · `/admin/backup` → `SYSTEM_MANAGE`, `/admin/settings` → ADMIN 전용. ADMIN은 모든 경로 통과
- `app/actions/admin.ts`의 11개 액션(Variety/Farmer/ProducerGroup CRUD) `requireAdmin()` → `requirePermission('VARIETY_MANAGE' | 'FARMER_MANAGE')` 교체
- `app/actions/excel.ts`의 `importFarmers` 동일 교체
- 미사용 `requireAdmin` import 정리

**검증**: `npx tsc --noEmit` 통과 (에러 없음). 실제 동작 테스트는 배포 후 사용자 계정별 시나리오로 필요.

**후속 제안**: 사이드바 관리자 메뉴를 권한 기반으로 조건부 노출할지 별도 UX 이슈로 검토 필요 (권한 없는 사용자에게 메뉴가 보였다가 클릭하면 홈으로 튕기는 현상 존재).

**문서**:
- `docs/plan-admin-access-fix.md`
- `docs/report-admin-access-fix-2026-04-20.md`

**변경 파일**:
- `middleware.ts` (신규)
- `proxy.ts` (삭제)
- `app/actions/admin.ts`
- `app/actions/excel.ts`

### 사이드바 "관리자 메뉴" 조건부 노출 `ux` `fix`

관리 권한이 없는 사용자(업무 권한만 있거나 로그인만 한 사용자)에게 PC 사이드바·모바일 헤더의 "관리자 메뉴" 섹션이 그대로 보이던 문제 해소. 클릭 시 미들웨어에서 홈으로 튕기는 UX 불일치 제거.

**변경 내용**:
- PC 사이드바의 "관리자 메뉴" 드롭다운 전체를 `hasAnyPermission(user, ['USER_MANAGE', 'NOTICE_MANAGE', 'SYSTEM_MANAGE'])` 조건으로 감쌈 (ADMIN 자동 통과)
- 모바일 헤더의 `{isAdmin && ...}` 블록도 동일 조건으로 교체
- PC 사이드바의 "관리자 설정" 링크는 조건 없이 렌더되던 상태를 `user?.role === 'ADMIN'`으로 제한 (관리 권한자 중 non-ADMIN에게 죽은 메뉴로 보이던 문제)

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `components/desktop-sidebar.tsx`
- `components/mobile-header.tsx`

### 모바일 헤더에 활동 로그 메뉴 추가 `ux`

SYSTEM_MANAGE 권한자가 모바일에서도 활동 로그 페이지에 접근할 수 있도록 모바일 헤더 설정 드롭다운에 "활동 로그" 항목 추가(`History` 아이콘). 시스템 백업은 모바일 기기에 백업 파일을 저장하는 UX가 부적절하여 PC 전용 유지로 의도적 제외.

**변경 파일**:
- `components/mobile-header.tsx`

## 2026-04-16

### Claude Forge 정리 문서 커밋 `docs`

2026-04-09에 이미 수행된 `~/.claude/` 정리 작업의 계획서와 결과보고서 2개 파일이 untracked 상태로 남아 있던 걸 커밋에 포함. 실제 정리 작업은 완료 상태 유지.

**파일 추가:**
- `docs/plan-forge-cleanup.md`
- `docs/report-forge-cleanup-2026-04-09.md`

## 2026-04-15

### 통계 페이지 필터 기본값 정비 & 재고분석 '(전체)' 라벨 `fix` `ux`

**후속 조치 — 리팩토링 이후 검증 과정에서 발견된 UX 이슈**

**수율분석 (milling):**
- `DEFAULT_PERIOD_VARIETIES` 4개 → 5개 (천지향5세 추가)
- `DEFAULT_VARIETIES` 3개 → 5개 (백옥찰/서농22호/천지향1세/새청무/하이아미, 천지향5세만 제외)
- `handleTabChange` 변경: 탭 전환 시 이전 필터 이월 금지, 각 탭 기본값으로 품종·도정구분·생산자 **강제 리셋** (기간 필터는 유지)
  - 기간별: 품종 5개 + 도정구분 `['백미']`
  - 품종별: 품종 5개 + 도정구분 `['백미']`
  - 도정구분별: 품종 6개 + 도정구분 전체
- 기존 이슈: 도정구분별(6개) → 품종별로 전환 시 `selectedVarieties`가 유지되어 5개 max 제한과 충돌 → 이제 해소

**재고분석 (stock):**
- 공유 `MultiSelectDropdown`에 `emptyLabel` prop 신설
  - 선택 없을 때 `"품종"` → `"품종 (전체)"` 처럼 placeholder 뒤에 옵션 라벨 표시
- stock의 인증/작목반/품종 드롭다운 3개에 `emptyLabel="(전체)"` 적용
- 이유: 빈 필터 = 전체 조회의 동작을 UI에 명시해 혼동 해소
- milling은 기존 동작 유지 (빈 상태의 의미가 다름)
- `handleTabChange` 신설: 탭(생산자/작목반/품종) 전환 시 인증/작목반/품종/생산자 필터 리셋 + 재조회 (연산은 유지). 필터가 이미 비어있으면 fetch 스킵

**변경 파일:**
- `app/(dashboard)/statistics/milling/_parts/constants.ts`
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
- `components/statistics/MultiSelectDropdown.tsx`
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`

**검증:** `tsc --noEmit` 통과

---

### 통계 페이지 정리 & 리팩토링 (800줄 제한 해소) `refactor`

**계획/보고서:**
- `docs/plan-stats-cleanup.md` (신규)
- `docs/report-stats-cleanup-2026-04-15.md` (신규)

**신규 파일:**
- `components/statistics/MultiSelectDropdown.tsx` (121줄) — 제네릭 공유 멀티셀렉트, `maxSelect`/`onClearAll`/`activeClass` prop 지원
- `app/(dashboard)/statistics/stock/_parts/utils.ts` — formatKg, toChartItems, CERT_TYPE_OPTIONS, StockTab
- `app/(dashboard)/statistics/stock/_parts/stock-tables.tsx` (182줄) — FarmerTable, GroupTable, VarietyTable, ChartLegend, 뱃지
- `app/(dashboard)/statistics/stock/_parts/stock-summary-cards.tsx` (73줄)
- `app/(dashboard)/statistics/stock/_parts/stock-filter-sheet.tsx` (199줄) — 모바일 바텀시트
- `app/(dashboard)/statistics/milling/_parts/constants.ts` — 상수 + MainTab 타입
- `app/(dashboard)/statistics/milling/_parts/milling-filter-sheet.tsx` (230줄) — 모바일 바텀시트

**수정 파일:**
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` — **999 → 560줄** (-439)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — **945 → 694줄** (-251)
- `README.md` — Next.js 보일러플레이트 → 프로젝트 소개/스택/셋업/원칙
- `docs/plan-statistics.md` (이전 작업 참고용, 변경 없음)

**주요 결정:**
- 출고 페이지 month/destination 탭은 사용자 의도적 disabled — 건드리지 않음 (메모리 저장)
- MultiSelectDropdown 통일 디자인: 네이티브 체크박스 + activeClass prop 주입 + 컴포넌트 내장 외부 클릭 닫기
- `_parts/` 서브폴더 컨벤션 (`_` 프리픽스로 라우트 제외)
- 상태/핸들러/메인 렌더는 메인에 유지, 재사용성 없는 부속만 분리

**검증:** `tsc --noEmit` 통과, `npm run build` 통과 (38.3s, 19페이지)

---

## 2026-04-14

### 보안 이슈 일괄 수정 (긴급 4건 + 단기 4건) `security`

**계획/보고서:**
- `docs/plan-security-fix.md` (신규)
- `docs/report-security-fix-2026-04-14.md` (신규)

**신규 파일:**
- `lib/auth-guard.ts` — `requireSession`/`requireAdmin`/`requirePermission` 공용 헬퍼
- `lib/file-validation.ts` — 엑셀 업로드 MIME/확장자/크기(10MB) 검증
- `lib/error-sanitize.ts` — Prisma/경로/스택 등 민감 정보 필터

**수정 파일:**
- `app/actions/*.ts` × 16 — 모든 Server Action에 인증 가드 적용 (읽기=session, 쓰기/관리=admin)
- `proxy.ts` — `/admin/*` ADMIN 권한 체크 추가 (Next 16의 middleware.ts)
- `auth.ts` — `debug: true` → `NODE_ENV==='development'` 조건부
- `next.config.ts` — CSP(Report-Only) + X-Frame-Options/HSTS/Referrer-Policy/Permissions-Policy 등 보안 헤더 6종
- `app/actions/excel.ts`, `stock-excel.ts` — import에 파일 검증 + ADMIN 강화
- `app/actions/backup.ts` — 세션만 체크 → ADMIN 강화, 에러 메시지 일반화

**주요 결정:**
- Next.js 16부터 `middleware.ts` → `proxy.ts`로 이름 변경된 것 확인 (분석 보고서 오해 정정)
- admin.ts 읽기 함수(varieties/farmers/groups)는 드롭다운용이라 session만, 쓰기는 admin
- CSP는 Report-Only로 시작 (Next.js inline script 호환 검증 후 enforcing 전환 예정)
- 에러 일반화는 무조건 덮어쓰기가 아니라 `sanitizeErrorMessage`로 민감 패턴만 필터

**빌드 검증:** `npm run build` 통과

**후속 조치 필요:**
- `NEXTAUTH_SECRET` 교체 (사용자 직접, `openssl rand -base64 32`)
- CSP 위반 모니터링 후 enforcing 전환

---

## 2026-04-09

### Claude Forge 자산 정리 (글로벌 ~/.claude) `chore`

**변경 파일 (글로벌, milling-log 코드 영향 없음):**
- `~/.claude/claude-forge/` — 폴더 통째 삭제
- `~/.claude/agents/` — 11개 → 3개 (planner·code-reviewer·security-reviewer만 유지)
- `~/.claude/commands/` — 40개 → 1개 (`/plan`만 유지)
- `~/.claude/skills/` — 폴더 통째 삭제 (16개)
- `~/.claude/hooks/` — 폴더 통째 삭제 (16개 + hooks.json)
- `~/.claude/settings.json` — `hooks` 섹션 비움 (`{}`)
- `~/.claude/CLAUDE.md` — "Claude Forge Rules" → "코딩 원칙", 에이전트 목록 11개 → 3개 정리

**프로젝트 파일 추가:**
- `docs/plan-forge-cleanup.md` (신규)
- `docs/report-forge-cleanup-2026-04-09.md` (신규)

**백업 위치:** `~/.claude/backups/forge-cleanup-2026-04-09/`

**MCP:** stitch 1개만 등록돼 있고 사용 중이라 손 안 댐.

---

## 2026-04-08

### 재고분석 모바일 UI 개선 (바텀시트 팝업·차트·테이블) `feat`

**변경 파일:**
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 탭 바 우측: 모바일 전용 필터 버튼 추가 (`md:hidden`, 활성 필터 수 배지 포함)
  - PC 인라인 필터 바 `hidden md:block` 래퍼로 감싸기
  - 모바일 칩 영역 `md:hidden` 추가 (연산년산 + 활성 필터 칩 항상 표시)
  - 바텀시트 팝업 구현: 연산/인증구분/작목반/품종(체크박스 리스트)/생산자 섹션
  - 작목반·품종 팝업 필터: 버튼 그룹 → 스크롤 체크박스 리스트 (`max-h-[90px]`)
  - 차트: `barSize=14` 고정, 최대 10개 스크롤 영역(`maxHeight: 10×34px`)
  - 작목반별 차트: `truncateLabels` prop으로 4자 후 `…` 처리, 클릭 시 전체 표시
  - 테이블 3개: `text-sm` → `text-xs`, 모든 셀 `whitespace-nowrap`, `minWidth` 지정
  - 테이블 컨테이너 `mb-2` 추가 (하단 메뉴바 여백)
  - 모바일 칩 삭제: `removeChipCertType` / `removeChipGroup` / `removeChipVariety` / `removeChipFarmer` 핸들러 추가 → 즉시 fetch
- `components/statistics/StockChart.tsx`
  - `barSize=14` 고정 추가 (barCategoryGap 변경 시 막대 두께 불변)
  - `truncateLabels` prop 추가: true면 커스텀 TruncatedTick, false면 기본 recharts tick
  - `yAxisWidth`: truncate 시 68px 고정 / 일반 시 이름 길이 기준
  - `margin right` 60 → 48px
- `components/statistics/SummaryCards.tsx`
  - 카드 레이아웃: 라벨 + 값+단위 한 줄 배치 (컴팩트, `text-2xl` → `text-sm`)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` `StockSummaryCards`
  - 동일한 컴팩트 레이아웃 적용

---

## 2026-04-07

### 재고분석 차트·서머리카드·레이아웃 개편 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts`
  - `processRate` → `stockRate` 필드명 변경
  - 계산식 변경: 처리율(consumed+released/total) → 재고율(available/total)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 서머리카드 4번째: "생산자 수" → "재고율"
  - 카드 레이아웃: 모바일 2×2 / PC 우측 수직(md:w-48, h-[416px])
  - 테이블 "처리율" → "재고율" (전체 탭), 재고율 색상 반전(낮을수록 초록)
  - 인증 뱃지 색상 구분: 유기농(초록), 무농약(파랑), 일반(회색)
  - 차트 데이터 포인트 10 → 20개, "기타" 집계 제거
  - 레이아웃: 차트(좌, flex-1) + 서머리카드(우) flex row
  - 차트 컨테이너 고정 높이 416px + 내부 스크롤
- `components/statistics/StockChart.tsx`
  - Y축 너비 계산: ×13 max 200 → ×10 max 150 (한글 기준 최적화)
- `components/statistics/SummaryCards.tsx`
  - 수율분석 서머리카드 디자인 재고분석 스타일로 통일 (그라디언트→흰 배경+컬러 탑바)

---

### 재고분석 페이지 필터·UI 개선 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts`
  - `StockFilters`에 `varietyIds`, `farmerNames` 추가
  - `getStockVarietyOptions` Server Action 추가
  - `GroupStockRow`, `VarietyStockRow`에 `releasedKg` 필드 추가 및 집계 반영
  - 생산자 수 카드: 미처리 생산자 수 → 검색 조건 내 전체 생산자 수(`farmerMap.size`)
- `app/(dashboard)/statistics/stock/page.tsx`
  - `getStockVarietyOptions` 초기 fetch 추가
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 탭 순서 변경: 품종별 → 작목반별 → 생산자별 (기본 탭: 품종별)
  - 품종 멀티셀렉트 드롭다운 필터 추가
  - 생산자 텍스트 검색 필터 추가 (쉼표 구분, trim 처리)
  - 초기화/검색 버튼 추가 (검색 버튼 클릭 시에만 조회)
  - 테이블 헤더 행 `bg-slate-50` 배경으로 데이터 행과 구분
  - 작목반·품종 테이블에 직접출고(kg) 열 추가
  - 차트 x축 가이드라인 추가 (`CartesianGrid`)
  - 최대 차트 표시 개수 15 → 10개
- `components/statistics/StockChart.tsx`
  - `CartesianGrid horizontal={false}` 추가 (x축 수직 가이드라인)
- `app/(dashboard)/milling/stock-list-dialog.tsx`
  - 컬럼 헤더 "농가명" → "생산자명"
- `app/actions/admin.ts`, `app/actions/excel.ts`, `app/actions/milling.ts`
  - UI 표시 용어 "농가" → "생산자" 전면 통일

---

## 2026-04-05

### 재고분석 통계 페이지 PC UI 구축 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts` (NEW)
  - `getStockStatistics`, `getStockProductionYears`, `getStockGroupOptions` Server Action
  - 농가별/작목반별/품종별 집계, 요약 카드 데이터 (Prisma include + JS Map 패턴)
- `app/(dashboard)/statistics/stock/page.tsx` (NEW)
  - 서버 컴포넌트, Promise.all로 초기 데이터 + 필터 옵션 동시 fetch
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` (NEW)
  - 필터(연산·작목반), 요약 카드 4개, 탭 3개(농가별/작목반별/품종별)
  - useTransition + Server Action으로 리필터링
- `components/statistics/StockChart.tsx` (NEW)
  - Recharts `BarChart layout="vertical"` 가로 스택 막대 차트
  - 도정완료(초록) / 직접출고(보라) / 미처리(주황) 스택
- `components/desktop-sidebar.tsx`
  - 통계 서브메뉴에 재고분석(`/statistics/stock`) 항목 추가

---

## 2026-04-03

### 수율분석 포장내역 팝업 소계 위치 수정 + 스크롤 잘림 수정 `fix`

**변경 파일:**
- `components/statistics/MillingTable.tsx`
  - 포장내역 팝업 그룹 헤더에 있던 소계를 아이템 목록 하단으로 이동
  - 그룹이 여러 개일 때만 각 그룹 하단에 소계 행 표시
- `app/(dashboard)/layout.tsx`
  - 모바일 하단 padding `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` → `+1rem` 추가
  - 마지막 스크롤 시 nav바에 가리는 문제 해결

---

## 2026-03-31

### 수율분석 페이지 모바일 팝업 필터 UI 완성 `fix`

**커밋:** `60a0b2e` (팝업 레이아웃 최종), `e8449de`, `f9334c0`, `a3128ac` 외 다수

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
  - 모바일 필터를 바텀시트 팝업으로 전환 (PC 인라인 필터는 유지)
  - 팝업 위치: `fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)]` — 네비바 위
  - 팝업 높이: `max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)]` — 헤더·네비 침범 방지
  - 스크롤 영역: `flex-1 min-h-0 overflow-y-auto` — 콘텐츠 크기에 맞게
  - 팝업 기간 섹션: 달력 아이콘 제거, '25년산' 표기, 날짜 2열 grid 입력
  - 팝업 내 필터 변경 시 fetch 지연 (`showFilter` 체크)
  - 하단 버튼: 초기화 + 검색 우측 정렬
  - 선택 칩: 종류별 이어붙이기 (품종: A* B*, 기간: ...) 한 줄 나열
- `components/statistics/SummaryCards.tsx` — 모바일 2×2 그리드, 레이블·값 한 줄 컴팩트
- `components/statistics/MillingChart.tsx` — 모바일 isMobile 반응형 (YAxis 숨김, 폰트/dot 축소, h-[260px] 명시)
- `components/statistics/MultiSeriesChart.tsx` — 동일한 isMobile 패턴 적용

**주요 수정 사항:**
- `top` + `bottom` 동시 고정 → 패널 강제 확장 버그: `top` 제거 + `max-h` calc로 해결
- 차트 안 보임: `min-h`로는 ResponsiveContainer 동작 안 함 → 부모에 `h-[260px]` 명시로 해결

---

### 수율분석 페이지 모바일 UI 반응형 적용 `feat`

**커밋:** `e88fa05`

**변경 파일:**
- `components/statistics/SummaryCards.tsx` — 모바일 2×2 그리드 (`grid-cols-2 md:flex md:flex-col`)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
  - 빠른기간 버튼 행을 `overflow-x-auto` 가로 스크롤로 전환
  - 필터 바를 3행 구조로 재설계 (기간 / 드롭다운 / 생산자+버튼)
  - 차트+카드 레이아웃: 모바일 `flex-col-reverse`(카드 위→차트 아래), PC `md:flex-row`

---

## 2026-03-30

### 모바일 네비게이션 바 전면 재설계 `feat`

**변경 파일:**
- `components/mobile-header.tsx` — `relative` 클래스 제거로 헤더 여백 버그 수정, 그라데이션 라인 색상 slate 계열로 변경
- `components/mobile-nav.tsx` — 전면 재설계
  - 통계 메뉴 서브메뉴 추가 (hover 시 팝업, 수율분석/도정구분별)
  - SVG Goo Filter 적용 (feGaussianBlur + feColorMatrix) — 물방울 liquid 이동 효과
  - Leading/Trailing 두 원으로 액체처럼 늘어나는 blob 애니메이션
  - 낙관적 active 상태 (클릭 즉시 애니메이션, 페이지 로딩과 분리)
  - 비활성: 아이콘 + 텍스트(두 글자) 표시 / 활성: 파란 원 + 흰 아이콘, 텍스트 숨김
  - 최종 디자인: 흰 배경, slate-300 테두리, rounded-full, 파란 blob
- `app/(dashboard)/layout.tsx` — MobileNav variant prop 임시 비교 후 단일 컴포넌트로 복원

**주요 동작:**
- 메뉴 이동 시 파란 원이 liquid 물방울처럼 자연스럽게 이동
- 통계 탭 hover/클릭 시 서브메뉴 팝업 (수율분석, 도정구분별)
- 메뉴 레이블 두 글자 통일 (홈·재고·도정·출고·통계)

---

### 모바일 헤더·네비 그라데이션 라인 적용 + 통계 모바일 UI 계획서 작성 `feat/docs`

**변경 파일:**
- `components/mobile-header.tsx` — border-b 제거, 하단 2px 그라데이션 라인 추가 (`#6366f1→#3b82f6→#06b6d4` 반복), 헤더 하단 인디고 glow shadow
- `components/mobile-nav.tsx` — nav에 `relative` 추가, 상단 2px 그라데이션 라인 추가 (투명→인디고→시안→인디고→투명)
- `docs/plan-stats-mobile.md` — 수율분석 모바일 UI 구현 7단계 계획서 신규 작성
- `docs/plan-statistics.md` — 개발 상태 체크리스트 추가 (완료 5단계 표시)
- `docs/plan-packaging-redesign.md` — 모든 체크리스트 완료 표시
- `public/preview/option-a.html` — 다크 크롬 시안 (헤더 #1e293b)
- `public/preview/option-b.html` — 블루 헤더 시안 (헤더 gradient blue)
- `public/preview/option-c.html` — 레이어드 그레이 시안
- `public/preview/option-stitch.html` — Google Stitch 시안2 HTML
- `public/preview/option-gradient.html` — G1/G2/G3 그라데이션 방식 비교 시안

**주요 동작:**
- 모바일 헤더 하단, 하단 네비 상단에 인디고-블루-시안 그라데이션 라인으로 컨텐츠 영역과 시각적 구분
- G2 방식 채택: 흰 헤더 유지 + 2px 그라데이션 라인 (로고 흰 배경 PNG와 어울림)
- 통계 모바일 UI 계획서 작성 (SummaryCards 그리드, 차트 레이아웃, 필터 반응형, 테이블 스크롤)

---

## 2026-03-26

### 수율분석 통계 개선 (도정구분별 탭 완성 + 생산자 필터 버그 수정) `feat/fix` — `170b7d1`

**커밋 목록:**
- `1da03fb` — fix: fetchCurrent overrides 타입에 groupBy 추가 (빌드 에러)
- `b24de31` — feat: 도정구분별 통계 페이지 신규 추가 (이후 탭으로 통합)
- `ee04a3d` — fix: 사이드바 통계 서브메뉴 → 수율분석 단일 링크로 정리
- `bccceee` — feat: 수율분석 도정구분별 탭 기본값 업데이트
- `d27f765` — fix: 품종별/도정구분별 탭 생산자 필터 미전달 버그 수정
- `4650ad1` — fix: 탭 전환 시 생산자 검색 필터 초기화
- `170b7d1` — fix: 탭 필터 변경 시 테이블·요약카드 미동기 버그 수정

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 도정구분별 탭 기본값(품종 6개·도정구분 전체), 탭 전환 시 생산자 초기화, fetchVariety/fetchMillingType에 farmers 연결 + 테이블 동기화
- `app/actions/statistics.ts` — getMillingStatsByVariety·getMillingStatsByMillingType에 farmers 파라미터 추가
- `components/desktop-sidebar.tsx` — 통계 서브메뉴 → 수율분석 단일 항목
- `components/breadcrumb-display.tsx` — 수율분석 경로명 반영

**주요 동작:**
- 도정구분별 탭: 품종 기본 6개(백옥찰·서농22호·천지향1세·천지향5세·새청무·하이아미), 도정구분 DB 전체 선택
- 생산자 검색 필터가 3개 탭 모두 정상 동작
- 탭 전환 시 생산자 검색어·칩 자동 초기화
- 품종별/도정구분별 탭에서 필터 변경 시 차트 + 테이블 + 요약카드 동시 업데이트

---

### 도정구분별 통계 페이지 신규 추가 `feat` — `b24de31`
**변경 파일:**
- `app/(dashboard)/statistics/millingtype/page.tsx` — 신규 서버 컴포넌트 (6개월 기본, 전체 도정구분 조회)
- `app/(dashboard)/statistics/millingtype/millingtype-stats-client.tsx` — 신규 클라이언트 컴포넌트 (필터 + MultiSeriesChart + SummaryCards)
- `components/desktop-sidebar.tsx` — 통계 메뉴를 서브링크 2개로 분리 (도정실적 분석 / 도정구분별 분석)
- `components/breadcrumb-display.tsx` — millingtype 경로 브레드크럼 추가

**주요 동작:**
- `/statistics/millingtype` 신규 페이지 생성
- 기간 기본: 6개월 / 품종 기본: 백옥찰·서농22호·천지향1세·천지향5세·새청무·하이아미
- 도정구분 전체 선택 (DB distinct 조회 기반, 동적)
- 품종/도정구분 토글 → 즉시 fetch, 드롭다운에 전체선택·전체해제 버튼

---

### 통계 UX 개선 (기간버튼 즉시fetch · 기본기간 6개월 · 품종별 차트 개선) `feat`
**커밋:** (이번)

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 기간 버튼 클릭 시 즉시 fetch, 기본 기간 6개월, 기본 품종 서농22→서농22호 수정, 초기화 기준 6개월
- `app/(dashboard)/statistics/milling/page.tsx` — 서버 초기 fetch 6개월 기준으로 변경
- `components/statistics/MultiSeriesChart.tsx` — X축 월별 레이블 단축(2511), Y축 allowDataOverflow 추가(55~75 정상 표시), 빈값 유령막대(점선 outline), 빈값 있는 시리즈에 ghost bar 추가

**주요 동작:**
- 빠른기간 버튼(연산/1년/6개월 등) 클릭 → 검색 버튼 없이 즉시 fetch
- 기본 기간 6개월로 변경 (연산 기준 → 실데이터 구간 중심)
- 품종별 차트 Y축 수율 55%~75% 정상 범위 표시
- 빈값 구간에 점선 outline ghost bar → 시리즈 구분 가능

---

### 통계 차트 개선 + 도정 투입내역 삭제 버그 수정 `feat/fix`
**커밋:** `7de3dda`

**변경 파일:**
- `components/statistics/MillingChart.tsx` — 막대폭 동적 조절(포인트 수 기반), X축 월별 레이블 단축(`2025-04` → `2504`)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 기간별 탭 품종 기본값 하이아미·서농22·천지향1세·새청무 적용
- `app/(dashboard)/statistics/milling/page.tsx` — 서버 초기 fetch에 동일 품종 기본값 추가
- `app/actions/milling.ts` — `removeStockFromMilling` 수정: stock 삭제 후 남은 stocks 합산해 `totalInputKg` 업데이트 (목록 투입량 미반영 버그 수정)

**주요 동작:**
- 막대폭: `480 / 포인트수` 기준, 최소 12px ~ 최대 56px 동적 계산
- 월별 X축: `yyyy-MM` → `YYMM` (day/week는 기존 유지)
- 기간별 품종 기본값: 페이지 로드 시 + 초기화 시 동일하게 적용
- 투입내역 삭제 시 `millingBatch.totalInputKg` 자동 재계산 → 목록 정합성 확보

---

## 2026-03-25 (세션2)

### 통계 품종별/도정구분별 차트 구현 + 수율 보간 `feat`
**커밋:** `7de3dda` (2026-03-26 커밋에 포함)

**변경 파일:**
- `app/actions/statistics.ts` — `MultiSeriesChartData` 타입, `getMillingStatsByVariety`, `getMillingStatsByMillingType` 추가. `generateAllBucketKeys()`로 빈 버킷 포함 전체 기간 생성, `hasData` 플래그 반환
- `components/statistics/MultiSeriesChart.tsx` — 신규. 5색 팔레트, 시리즈별 겹침막대+수율 라인, 막대폭 자동조절
- `components/statistics/MillingChart.tsx` — 보간 처리(좌우 평균), 실선/점선 이중 라인, Y축 수율 55-75로 변경
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 검색 바 공통화, 품종별/도정구분별 탭 연결, 기본값(서농22호·천지향1세·하이아미 / 백미·찹쌀·현미), 품종 최대 5개 제한

**주요 동작:**
- 품종별/도정구분별 탭 전환 시 기본값 자동 적용 후 fetch
- 데이터 없는 기간 포인트: 좌우 값 평균으로 보간, 점선(4-4 dash)으로 표시
- 수율 Y축: 55/60/65/70/75 (진폭 확대)
- 품종별 생산량: 동일 배치 내 투입 비율로 안분

---

## 2026-03-25

### 통계 기본 기간 연산(cropYear) 기준으로 변경 `feat`
**커밋:** `2e2270f`

- 통계 페이지 기본 기간을 1개월에서 현재 연산 기준으로 변경
- `page.tsx` 초기 fetch + `milling-stats-client.tsx` quickPeriod 기본값 `cropYear`로

**변경 파일:** `statistics/milling/page.tsx`, `statistics/milling/milling-stats-client.tsx`

---

### 활동로그 도정작업 상태변경 상세내역 추가 `feat`
**커밋:** `8d51266`

- `updateMillingBatchStatus` 호출 시 변경 전 배치 정보 조회 후 `details`에 포함
- 활동로그 UI에서 상세내역 버튼(FileText) 표시 가능해짐
- 기록 항목: 변경전/후 상태, 도정일, 도정구분, 투입량, 비고

**변경 파일:** `app/actions/milling.ts`

---

### 모바일 멀티셀렉트 터치 스크롤 수정 `fix`
**커밋:** `43425b1`

- Popover 내부 스크롤 컨테이너에 `touch-pan-y`, `overscroll-contain`, `onTouchMove stopPropagation` 추가
- iOS 모바일에서 터치 이벤트가 부모로 전파되어 스크롤 안 되던 문제 해결

**변경 파일:** `components/ui/multi-select.tsx`

---

### 통계 도정실적 페이지 기능·UI 개선 `feat`
**커밋:** `94c5f72`

**변경 파일:** `statistics/milling/milling-stats-client.tsx`, `actions/statistics.ts`, `components/statistics/MillingChart.tsx`, `components/statistics/MillingTable.tsx`, `components/statistics/SummaryCards.tsx`

**필터 기능:**
- 기간검색 탭에 생산자 텍스트 검색 추가 (쉼표로 다중 검색, Enter 지원)
- 검색 버튼 클릭 시에만 그래프 반영 (기존 자동 fetch → 수동 검색 방식)
- 검색 조건 칩 표기 — 기간(항상)/품종/도정구분/생산자 전부 칩으로 표시
- 초기화 버튼 추가 (기간 1개월·백미 기본값으로 리셋)

**그래프:**
- 범례 투입량·생산량 아이콘 두께 통일
- 좌측 Y축 단위 kg → t(톤) 변경, 툴팁도 t 단위 표시

**요약 카드:** 각 카드에 색상별 그라데이션 배경 추가

**상세 테이블:**
- 생산자 컬럼 "XXX 외 N명" 요약 표시 (title로 전체 이름 확인 가능)
- 투입목록 팝업 → `MillingStockListDialog` 재사용 (도정관리와 동일 화면)
- 포장내역 팝업 → `AddPackagingDialog` 스타일 동일 적용 (로트 그룹 헤더 구조)
- 로트번호 hover 시 생산자명 tooltip 표시
- 수율 표시 → 도정관리 목록 동일 스타일 (70%↑ 파란 배지, 미만 회색)

---

### 검색필터 멀티셀렉트 + 다중 생산자 검색 `feat`
**커밋:** `226b90a`

**신규:** `components/ui/multi-select.tsx` (Popover + 체크박스 멀티셀렉트 공통 컴포넌트)

**재고:** 년도·인증·품종 멀티셀렉트 전환
**도정:** 품종·도정구분 멀티셀렉트 전환
**생산자관리:** 인증·년도 멀티셀렉트 전환
**공통:** 생산자 텍스트 필드에서 쉼표(,)로 여러 생산자 동시 검색, 모든 텍스트 입력 앞뒤 공백 trim

**버그 수정:**
- `getStocksByGroup` 라인 608 `isNaN` 함수를 Prisma 필터값으로 전달하던 버그 → 그룹 클릭 시 하위목록 미표시 원인
- `getStockGroups` 멀티값 `parseInt('2025,2026')` 파싱 오류 → 검색결과 0건 원인

**변경 파일:** `components/ui/multi-select.tsx`, `stocks/stock-filters.tsx`, `stocks/active-filters.tsx`, `milling/milling-filters.tsx`, `milling/active-milling-filters.tsx`, `admin/farmers/farmer-filters.tsx`, `admin/farmers/page.tsx`, `actions/stock.ts`, `actions/milling.ts`, `actions/admin.ts`

---

### 포장 다이얼로그 단일 생산자 헤더 표시 `feat`
**커밋:** `bdd4c74`

- 단일 생산자 도정 시에도 포장 다이얼로그 상단에 생산자명 + 로트번호(또는 "관행") 표시
- 예상 생산량 계산은 다중 생산자일 때만 유지

---

### 관행 농가 로트번호 처리 개선 `fix`
**커밋:** `fed7f90`

**배경:** 관행(certType=일반) 농가는 인증이 없어 로트번호가 의미 없음.
관행 그룹의 certNo가 `-`(대시)로 저장되어 포장 저장 시 `251118-18---9915` 같은
잘못된 로트번호가 생성되는 버그 발견.

**변경 내용:**
| 파일 | 내용 |
|------|------|
| `app/actions/milling.ts` | 포장 저장 시 관행이면 lotNo = null |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 관행 농가를 farmerNo 기준 개별 그룹핑, "관행" 표시 |
| `app/actions/milling-excel.ts` | 로트번호 컬럼 추가, 관행이면 "관행" |
| `app/actions/statistics.ts` | OutputDetail에 isConventional 추가, group 쿼리 포함 |
| `components/statistics/MillingTable.tsx` | 관행이면 "관행" 표시 |
| `app/(dashboard)/stocks/stock-table-row.tsx` | 관행이면 "관행" 표시 |
| `app/(dashboard)/stocks/stock-list-client.tsx` | 관행이면 "관행" 표시 |

**DB 정리:** 잘못 생성된 MillingOutputPackage.lotNo 7건 → null (id: 277, 278, 279, 370, 375, 376, 377)

---

## 2026-03-24

### 도정실적 통계 페이지 신규 + 대시보드/포장 버그 수정 `feat`
**커밋:** `e2a3e09`

**변경 내용:**
- 도정실적 통계 페이지 신규 (`/statistics/milling`)
  - 요약 카드 4개 (총 투입량/생산량/수율/도정횟수)
  - 기간별 콤보 차트 (투입/생산 OverlappingBar + 수율 라인)
  - 상세 테이블 (생산자 열, 투입량/생산량 클릭 팝업)
- 포장 입력 예상생산량 수율 DB 연동
- 대시보드 최근도정내역: 생산량 클릭 포장내역 팝업, 수율 색상 개선
- 대시보드/포장 버그 수정 (stockId, lotNo, group 필드 누락)

---

## 2026-03-23

### 포장 입력 재설계 — lotNo 기반 생산자별 섹션 분리 `refactor`
**커밋:** `9defc62`

**변경 파일:**
- `app/(dashboard)/milling/add-packaging-dialog.tsx` — `computeLotGroups`로 lotNo 기준 섹션 분리, 자동배분 제거, 섹션별 독립 버튼
- `lib/lot-generation.ts` — `getYieldRate()` 추가 (백미 68% / 현미 70% / 인디카 65% / 분도미 69%)
- `app/actions/milling.ts` — `updatePackagingLogs` fallback 로직 명시적 정리
- 도정유형 명칭 통일: `7분도미` → `칠분도미`, `5분도미` → `오분도미` (소스코드 전체 6개 파일)
- `scripts/migrate-milling-type.ts` — DB 도정유형 명칭 통일 마이그레이션 스크립트

**주요 동작:**
- 다중 생산자 배치 시 lotNo별 섹션으로 분리 표시
- 각 섹션에 독립 규격 버튼 → 버튼 클릭 시 해당 생산자 섹션에만 추가
- 예상 생산량 = 투입량 × 수율(도정유형별)

---

### 모바일 포장내역 팝업 버그 수정 `fix`
**커밋:** `6a96ef0`, `d9908dc`

- `stocks prop` 누락으로 포장내역 팝업이 열리지 않던 버그 수정
- 모바일에서 포장 다이얼로그 저장 버튼이 잘리던 레이아웃 버그 수정

---

### 사이드바 메뉴 개편 및 관리자 설정 페이지 추가 `feat`
**커밋:** `1073aae`

- 품종/생산자 관리를 사이드바 상단 독립 메뉴로 승격
- 관리자 설정(`admin/settings`) 페이지 신규 — 도정유형별 수율 기준값 DB 관리
- `SystemConfig` Prisma 모델 추가, `getYieldRates` / `setYieldRate` Server Action

---

### 도정내역 기본 조회기간 1주→1달, 수율 설정화면 2열 레이아웃 `fix`
**커밋:** `47cf836`
