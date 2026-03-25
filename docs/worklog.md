# 작업일지

## 2026-03-25

### 검색필터 멀티셀렉트 + 다중 생산자 검색 `feat`
**커밋:** (이번 커밋)

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
