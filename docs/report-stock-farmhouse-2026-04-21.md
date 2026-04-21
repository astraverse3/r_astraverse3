# 재고 농가명(actualFarmer) 필드 추가 결과보고서

날짜: 2026-04-21

## 변경 사항 요약
Stock 테이블에 공식 생산자와 별개로 **실제 농사짓는 농가명**을 자유 텍스트로 저장하는 `actualFarmer` 필드를 추가했다.
- 등록/수정 다이얼로그에서 입력 가능 (생산자 셀렉트 오른쪽 2-column 배치)
- 목록에서 `생산자(농가명)` 형태로 병기 표시 (PC/모바일 동일)
- 검색: 기존 "생산자" 검색이 **생산자명 OR 농가명** 둘 다 찾도록 확장
- 엑셀 Export/Import에 "농가명(선택)" 컬럼 추가

## 변경 파일 (총 10개)

### DB
- [prisma/schema.prisma](prisma/schema.prisma) — Stock 모델에 `actualFarmer String?` 추가
- [prisma/migrations/20260421000000_add_stock_actual_farmer/migration.sql](prisma/migrations/20260421000000_add_stock_actual_farmer/migration.sql) — 신규 (ADD COLUMN)

### 서버 액션
- [app/actions/stock.ts](app/actions/stock.ts)
  - `StockFormData`에 `actualFarmer?: string` 추가
  - `createStock`, `updateStock`에서 `trim()` 후 빈 값은 null 저장
  - `getStocks`, `getStockGroups`, `getStocksByGroup`의 `farmerName` 검색을 **생산자명 OR 농가명** OR 조건으로 확장 (콤마 멀티 검색 유지)
- [app/actions/stock-excel.ts](app/actions/stock-excel.ts)
  - Export에 "농가명(선택)" 컬럼 포함 (생산자명 바로 옆)
  - Import에 `'농가명'` / `'농가명(선택)'` 헤더 수용
  - farmerName 검색 확장 적용

### 클라이언트
- [app/(dashboard)/stocks/page.tsx](app/(dashboard)/stocks/page.tsx) — `Stock` 인터페이스에 `actualFarmer: string | null` 추가
- [app/(dashboard)/stocks/add-stock-dialog.tsx](app/(dashboard)/stocks/add-stock-dialog.tsx) — 생산자 셀렉트 옆에 농가명 Input 추가 (2-column)
- [app/(dashboard)/stocks/edit-stock-dialog.tsx](app/(dashboard)/stocks/edit-stock-dialog.tsx) — 동일 구조, `defaultValue={stock.actualFarmer ?? ''}`
- [app/(dashboard)/stocks/stock-table-row.tsx](app/(dashboard)/stocks/stock-table-row.tsx) — `farmerDisplay` 변수로 `홍길동(김영희)` 형태 표시, 생산자 셀 너비 60px → 120px
- [app/(dashboard)/stocks/stock-list-client.tsx](app/(dashboard)/stocks/stock-list-client.tsx) — 헤더 너비 동기화, 모바일 카드 이름 부분도 동일 병기
- [app/(dashboard)/stocks/stock-filters.tsx](app/(dashboard)/stocks/stock-filters.tsx) — 검색 라벨 "생산자 / 농가명", placeholder "예: 홍길동, 김영희(농가명)"

## 주요 결정 사항

### 필드명 `actualFarmer`
- 사용자 요청에 따라 `actualFarmer` 채택 (실제 농사짓는 사람)
- Farmer 테이블과 **관계 없는** 순수 문자열 필드 (정합성 검증 X)

### 검색 통합
- 별도 검색 입력란을 만들지 않고 기존 "생산자" 검색이 농가명까지 커버하도록 확장
- 이유: UX 단순성 + 톤백에 적힌 이름만 알면 찾을 수 있음
- Prisma `OR` 조건: `[{ farmer: { name: { contains: n } } }, { actualFarmer: { contains: n } }]`
- 멀티값(콤마 구분) 지원도 각 이름별로 동일한 OR 블록 반복

### 통계 미포함
- 참고용 메모 성격이므로 [app/(dashboard)/statistics/stock/](app/(dashboard)/statistics/stock/) 변경 없음
- [app/(dashboard)/stocks/active-filters.tsx](app/(dashboard)/stocks/active-filters.tsx)의 뱃지는 기존 `farmerName` 뱃지가 농가명 검색도 커버하므로 변경 없음

### 표시 포맷
- `홍길동(김영희)` 한 줄 형식 (PC/모바일 공통)
- 농가명이 비어있으면 괄호 생략하고 생산자명만 표시

## 확인이 필요한 사항 (사용자 처리)

### 1. Prisma 마이그레이션 적용 **(필수)**
개발 서버가 켜져 있어 자동 실행이 안 됐음. 터미널에서 직접 실행 필요:
```bash
# 개발 서버 중단 후
npx prisma migrate deploy   # 또는 npx prisma migrate dev (이미 파일 생성됨)
npx prisma generate
```
- 마이그레이션 파일은 [prisma/migrations/20260421000000_add_stock_actual_farmer](prisma/migrations/20260421000000_add_stock_actual_farmer)에 이미 생성됨
- Neon DB에 `ALTER TABLE "Stock" ADD COLUMN "actualFarmer" TEXT` 적용됨

### 2. Vercel 배포 시 마이그레이션
- `package.json`의 postinstall에는 `prisma generate`만 있음
- Vercel 빌드 단계에서 `prisma migrate deploy`가 돌아야 production DB에 적용됨
- 현재 어떻게 처리하는지 확인 필요 (build 명령 수정 또는 수동 적용)

### 3. 브라우저 수동 확인 포인트
개발 서버 재시작 후 확인:
- [ ] 재고 등록 시 농가명 입력 → 저장 → 목록에서 `생산자(농가명)` 표시 확인
- [ ] 기존 재고 수정 → 농가명 입력/수정 → 반영 확인
- [ ] 농가명 비우고 저장 → `생산자`만 표시 확인
- [ ] 검색에서 농가명 입력 → 해당 재고만 검색되는지
- [ ] 엑셀 다운로드 → "농가명(선택)" 컬럼 존재 확인
- [ ] 엑셀 업로드 → "농가명(선택)" 컬럼 포함 파일 업로드 테스트
- [ ] 모바일 뷰에서도 동일 표시 확인

## 위험 요소 / 한계
- Prisma 마이그레이션 수동 적용 전까지 런타임 에러 발생 가능 (컬럼 없음)
- TS 타입 체크는 Prisma Client 재생성 전까지 `actualFarmer` 참조 부분에서 에러 보일 수 있음 (서버 재시작 시 해결)
- 브라우저 실제 동작 검증은 사용자의 로컬 환경에서 직접 수행 필요
