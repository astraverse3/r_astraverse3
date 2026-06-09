# 재고 농가명(actualFarmer) 필드 추가 계획

## 목표
재고(Stock) 데이터에 공식 생산자와 별개의 **실제 농사짓는 농가명**을 자유 텍스트로 저장할 수 있는 필드를 추가한다.
- 인증은 공식 생산자 명의로 되어있지만 실제로는 배우자 등이 농사짓는 경우를 위한 참고용
- 실제 톤백에 농가명이 적혀있는 경우가 있어 **검색으로도 찾을 수 있어야 함**
- Farmer 테이블과 **관계없는** 단순 문자열 필드

## 필드 설계
- DB 컬럼: `actualFarmer` (String?, nullable)
- 한글 라벨: "농가명"
- 최대 길이 제한 없음

## 표시 규칙
- **PC 테이블 생산자 컬럼**: `홍길동(김영희)` 한 줄 표시, 농가명 없으면 `홍길동`만
- **모바일 카드**: 동일하게 `홍길동 (김영희)` 형식
- 빈 값이면 괄호 전체 생략

## 입력 UI 배치
- 등록/수정 다이얼로그에서 **생산자 셀렉트 오른쪽 빈 공간에 배치** (2-column 그리드)
- placeholder: "실제 농사짓는 분 (선택)"

## 검색 필터
- 기존 "생산자" 검색 입력란이 `farmerName`으로 Farmer.name만 검색 중
- `farmerName` 검색 시 **생산자 명과 농가명 둘 다** OR 조건으로 검색하도록 확장
  - 이유: UI 복잡도 줄이고, 사용자는 톤백에 적힌 이름만 알면 검색 가능
  - 라벨도 "생산자 / 농가명"으로 변경 고려

## 변경 파일 (총 9개)

### 1. DB 스키마 & 마이그레이션
- [prisma/schema.prisma](prisma/schema.prisma) — `Stock` 모델에 `actualFarmer String?` 추가
- `npx prisma migrate dev --name add_stock_actual_farmer` 실행

### 2. Server Action (재고 CRUD + 검색)
- [app/actions/stock.ts](app/actions/stock.ts)
  - `StockFormData`에 `actualFarmer?: string` 추가
  - `createStock`, `updateStock`에서 저장 (공백 trim, 빈 문자열은 null)
  - `getStocks`, `getStockGroups`, `getStocksByGroup`의 `farmerName` 파라미터를 **생산자명 OR 농가명** 검색으로 확장
    - 단일: `OR: [{ farmer: { name: { contains } } }, { actualFarmer: { contains } }]`
    - 멀티: 각 이름마다 위 OR 블록을 만들어 상위 OR로 결합

### 3. 타입
- [app/(dashboard)/stocks/page.tsx](app/(dashboard)/stocks/page.tsx)
  - `Stock` 인터페이스에 `actualFarmer: string | null` 추가

### 4. 등록 다이얼로그
- [app/(dashboard)/stocks/add-stock-dialog.tsx](app/(dashboard)/stocks/add-stock-dialog.tsx)
  - 생산자 섹션을 2-column 그리드로 리팩터 (좌: 기존 생산자 셀렉트, 우: 농가명 Input)
  - 인증 배지 설명 박스(`selectedFarmer && ...`)는 2-column 하단에 full-width로 유지

### 5. 수정 다이얼로그
- [app/(dashboard)/stocks/edit-stock-dialog.tsx](app/(dashboard)/stocks/edit-stock-dialog.tsx)
  - 등록과 동일 레이아웃, `defaultValue={stock.actualFarmer ?? ''}`

### 6. PC 테이블 행
- [app/(dashboard)/stocks/stock-table-row.tsx](app/(dashboard)/stocks/stock-table-row.tsx)
  - 생산자 셀 표시: `{farmerName}{actualFarmer && `(${actualFarmer})`}`
  - 너비 `max-w-[60px]` → `max-w-[120px]`로 확대, `title`에 전체값 포함
  - 헤더 컬럼 너비(`w-[60px]`)도 `w-[120px]`로 맞춰 조정 ([stock-list-client.tsx](app/(dashboard)/stocks/stock-list-client.tsx))

### 7. 모바일 카드
- [app/(dashboard)/stocks/stock-list-client.tsx](app/(dashboard)/stocks/stock-list-client.tsx) — `MobileStockDetailCard`
  - 굵은 이름 부분: `{stock.farmer.name}{stock.actualFarmer && ` (${stock.actualFarmer})`}`

### 8. 검색 다이얼로그
- [app/(dashboard)/stocks/stock-filters.tsx](app/(dashboard)/stocks/stock-filters.tsx)
  - "생산자" 라벨 → "생산자 / 농가명"
  - placeholder → "예: 홍길동, 김영희(농가명)"

### 9. 엑셀 Export / Import
- [app/actions/stock-excel.ts](app/actions/stock-excel.ts)
  - Export rows에 `'농가명(선택)': stock.actualFarmer || ''` 컬럼 추가 (생산자명 다음 위치)
  - 빈 시트 헤더 배열에도 동일 컬럼 추가
  - Import `pick('농가명', '농가명(선택)')`로 읽어 `stock.create.data.actualFarmer`에 저장

## 제외 항목
- 통계 페이지 변경 없음 (참고용 메모이므로 집계 대상 아님)
- `active-filters.tsx`는 기존 `farmerName` 뱃지가 농가명 검색도 커버하므로 변경 없음
- 기존 데이터 백필: 모두 null로 시작

## 작업 순서
1. Prisma 스키마 수정 + 마이그레이션
2. Server Action 타입/로직 수정
3. Page 타입 수정
4. 등록/수정 다이얼로그
5. 목록 표시 (PC/모바일)
6. 검색 필터 라벨/placeholder
7. 엑셀 Export/Import
8. 개발 서버 띄우고 브라우저에서 등록/수정/검색/엑셀 동작 확인

## 위험 요소
- `getStocks`의 `OR` 조건을 기존 `AND` 배열에 추가할 때 Prisma where 구조 주의 (이미 `andConditions`로 관리 중이라 단순 push로 해결 가능)
- 마이그레이션이 production DB에 적용되어야 함 — Vercel 배포 시 `prisma migrate deploy`가 자동 실행되는지 확인 필요
