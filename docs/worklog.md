# 작업일지

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

### 사이드바 메뉴 개편 및 관리자 설정 페이지 추가 `feat`
**커밋:** `1073aae`

### 도정내역 기본 조회기간 1주→1달, 수율 설정화면 2열 레이아웃 `fix`
**커밋:** `47cf836`
