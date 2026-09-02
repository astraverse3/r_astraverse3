# 계획서 — 원물재고(벼) 검색 필터에 중량 추가

작성일: 2026-09-02

## 배경 / 목표
- 올해 처음 적용하는 방식이라 **톤백번호가 안 적힌 톤백이 많음** → 톤백번호 대신 **무게로 재고를 찾아야** 함.
- 벼 탭 검색 다이얼로그에 「중량(kg)」 입력칸을 추가한다.
- 매칭 방식: **정확 일치** (목록에 보이는 중량값 그대로 입력, 소수점 지원).
- 임시 운영용 필터이므로 기존 필터 구조(URL 쿼리 파라미터)를 그대로 따라간다.

## 변경 범위 (4개 파일)

### 1. `app/actions/stock.ts`
- `GetStocksParams`에 `weightKg?: string` 추가.
- 아래 3개 조회 함수 모두에 동일 필터 적용 (그룹 목록 / 그룹 펼침 / 전체 목록·엑셀이 따로 조회하므로 셋 다 필요):
  - `getStocks` — 목록·엑셀
  - `getStockGroups` — 그룹 집계(건수·합계)
  - `getStocksByGroup` — 그룹 펼쳤을 때 항목
- 파싱: 콤마 제거 후 `parseFloat`, `NaN`이면 필터 무시. 조건은 `where.weightKg = 값` (정확 일치).

### 2. `app/(dashboard)/raw-stocks/stock-filters.tsx`
- 생산자 줄을 `grid-cols-2`로 나눠 오른쪽에 「중량(kg)」 입력칸 배치 (사용자 제안대로).
- 상태값 `weight` 추가 + URL 동기화(`useEffect`), `handleApply`(`params.set('weightKg', ...)`), `handleReset`, `activeFilterCount`에 반영.
- 입력 타입은 숫자 키패드가 뜨도록 `inputMode="decimal"`, Enter 시 적용.

### 3. `app/(dashboard)/raw-stocks/page.tsx`
- `RiceStockPanel`의 `filters` 및 `getStockGroups` 인자에 `weightKg` 전달. (잡곡 탭은 이번 범위 밖)

### 4. `app/(dashboard)/raw-stocks/active-filters.tsx`
- 적용된 중량을 배지로 표시(`1,004kg`), `activeFilterCount`에 포함.

## 검증
- `tsc`, `eslint`, 기존 테스트 실행 (dev 서버 상시 기동이라 `next build`는 하지 않음).
- 화면 확인은 사용자 브라우저에서: 중량 입력 → 그룹 건수/합계와 펼친 목록이 같이 걸러지는지, 초기화 동작.

## 확인 필요
- 정확 일치라서 소수점(예: 1004.5)이 있는 톤백은 **표시된 값 그대로** 입력해야 잡힘. 쓰다가 불편하면 ±오차 방식으로 바꾸는 건 나중에 한 줄 수정으로 가능.
