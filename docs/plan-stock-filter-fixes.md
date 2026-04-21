# 재고관리 필터/엑셀 수정 + 통계 엑셀다운 추가

## 작업 목표

사용자 리뷰에서 지적된 4건을 모두 처리한다. 모바일도 동일 적용.

1. 재고관리 검색필터 드롭다운에서 마우스 휠 스크롤 시 팝오버가 닫히는 문제 해결
2. 재고관리 품종 검색필터에 "전체 해제"(+전체 선택) 버튼 추가
3. 재고관리 엑셀 다운로드 시 다중 선택한 품종이 무시되고 첫 품종만 반환되는 버그 수정
4. 통계 페이지(수율분석·재고분석·도정구분별·출고분석)의 그래프 하단 테이블에 엑셀 다운로드 기능 신규 추가

---

## 사전 조사 결과

### 이슈 1 — 휠 스크롤 문제
- 재고 필터는 [components/ui/multi-select.tsx](../components/ui/multi-select.tsx) 사용 (`Popover` 기반)
- 컨테이너에 `onTouchMove stopPropagation`은 있지만 `onWheel` 처리 없음
- 통계용 [components/statistics/MultiSelectDropdown.tsx](../components/statistics/MultiSelectDropdown.tsx)는 별도 컴포넌트 — 얘도 onWheel 없음 (같은 증상 가능)

### 이슈 2 — 초기화 기능 부재
- `MultiSelect`(재고용): **전체 해제·전체 선택 버튼 없음**
- `MultiSelectDropdown`(통계용): `onClearAll` prop으로 "전체 해제"만 있음 (전체 선택은 없음)
- 재고 필터에서 일관된 UX 제공 필요. 사용자 표현 "전체선택, 해제?" → 둘 다 추가 검토

### 이슈 3 — 엑셀 다운로드 다중값 버그 ✅ **원인 확정**
- [app/actions/stock.ts:326](../app/actions/stock.ts#L326) `getStocks`는 `varietyId`를 `split(',')` → `in: [...]`로 올바르게 처리 → **리스트 정상 출력**
- [app/actions/stock-excel.ts:22](../app/actions/stock-excel.ts#L22) `exportStocks`는 `parseInt(params.varietyId)` — 문자열 `"4,5,6"`을 parseInt하면 `4`만 추출됨 → **첫 품종만 다운로드**
- 같은 파일 line 21의 `productionYear`, line 24의 `certType`, line 23의 `farmerId`도 모두 단일값 처리 → 다른 다중 선택 필터도 동일 버그 가능성
- line 35~39 `farmerName`은 `contains` 단일값만 지원 (리스트 쪽은 콤마 분리 지원)
- 추가 버그: line 85 `daa: buf` 오타 (`data` 아님) — 클라이언트 [stock-excel-buttons.tsx:40](../app/\(dashboard\)/stocks/stock-excel-buttons.tsx#L40)에서 `result.daa`로 읽기 때문에 현재는 동작. 함께 수정할지 판단 필요 (별도 리스크)

### 이슈 4 — 통계 엑셀 다운로드 신규
통계 페이지 4종:
- [app/(dashboard)/statistics/milling/milling-stats-client.tsx](../app/\(dashboard\)/statistics/milling/milling-stats-client.tsx) — 수율분석 (기간별·품종별·도정구분별 탭, `_parts/` 테이블)
- [app/(dashboard)/statistics/stock/stock-stats-client.tsx](../app/\(dashboard\)/statistics/stock/stock-stats-client.tsx) — 재고분석 (농가별·작목반별·품종별 테이블 in `_parts/stock-tables.tsx`)
- [app/(dashboard)/statistics/millingtype/millingtype-stats-client.tsx](../app/\(dashboard\)/statistics/millingtype/millingtype-stats-client.tsx) — 도정구분별
- [app/(dashboard)/statistics/output/output-stats-client.tsx](../app/\(dashboard\)/statistics/output/output-stats-client.tsx) — 출고분석

재고 페이지 엑셀 버튼 UI([stock-excel-buttons.tsx:162](../app/\(dashboard\)/stocks/stock-excel-buttons.tsx#L162)):
- `<Button variant="outline" size="sm" className="h-8 w-8 p-0 …green hover…" title="엑셀 다운로드">`
- 아이콘: `<Download className="w-4 h-4" />`
- 모바일도 동일 (아이콘만, 텍스트 없음)

---

## 변경 파일 및 범위

### A. 공통 UI 수정

| 파일 | 변경 |
|---|---|
| `components/ui/multi-select.tsx` | onWheel 이벤트 `stopPropagation` 추가 / "전체 선택"·"전체 해제" 버튼 추가 (옵션 0개일 땐 버튼도 숨김) |
| `components/statistics/MultiSelectDropdown.tsx` | onWheel 이벤트 `stopPropagation` 추가 (통계 필터도 같이) |

### B. 엑셀 다운로드 버그 수정

| 파일 | 변경 |
|---|---|
| `app/actions/stock-excel.ts` | `exportStocks`의 where 절 구성 로직을 `getStocks`와 동일하게 맞춤 (productionYear/varietyId/certType/farmerName 모두 콤마 분리 + `in` 처리). `farmerId`·`status` 단일값은 유지 |

→ 필터 타입은 기존 `GetStocksParams` (string 기반) 재사용. 클라이언트는 이미 콤마 구분 문자열을 넘김.

### C. 통계 엑셀 다운로드 기능 신규

| 파일 | 변경 |
|---|---|
| `app/actions/milling-statistics.ts` (신규 또는 기존) | 수율분석 테이블을 받아 xlsx 바이너리 리턴 서버 액션 추가. 현재 클라이언트에 있는 집계 데이터를 **클라이언트에서 서버로 전달**해서 변환만 하는 방식이 간단 (재조회 없이) |
| `app/actions/stock-statistics.ts` | 재고분석용 export 액션 추가 |
| `app/actions/millingtype-statistics.ts` | 도정구분별 export 액션 추가 |
| `app/actions/output-statistics.ts` | 출고분석 export 액션 추가 |
| `components/statistics/StatsExcelButton.tsx` (신규) | 공통 다운로드 버튼. props로 `onDownload: () => Promise<{success, data, fileName}>` 받음. 재고 페이지와 동일한 초록색 Download 아이콘 버튼 |
| 각 `*-stats-client.tsx` (4개) | 그래프 상단 필터 영역 또는 테이블 섹션 헤더에 StatsExcelButton 배치. 현재 탭/필터에 맞춰 다운로드 데이터 준비 |

#### 통계 엑셀 구조 방침
- 수율분석: 현재 탭(기간별/품종별/도정구분별)에 따라 시트명·컬럼 다름 → 탭별 다운로드
- 재고분석: 3개 테이블(농가별·작목반별·품종별) → 한 워크북 3시트 또는 현재 탭만
- 도정구분별/출고분석: 단일 테이블 → 단일 시트

구현 난이도 고려 **"현재 보이는 화면의 테이블 = 다운로드 범위"** 원칙으로 단순화.

### D. 모바일 검증
- 재고 필터 Dialog는 PC/모바일 공용 → 휠 수정은 자동으로 양쪽 적용
- 통계 엑셀 버튼: 모바일에서는 필터 바와 함께 상단 고정 영역에 위치. 재고와 동일하게 `h-8 w-8 p-0` 아이콘 버튼으로 공간 절약

---

## 단계별 접근

1. **이슈 1·2 (공용 컴포넌트 수정)** — `multi-select.tsx`, `MultiSelectDropdown.tsx`에 onWheel + 전체 선택/해제 추가
2. **이슈 3 (백엔드 버그 수정)** — `stock-excel.ts` where 절 재구성. `getStocks` 로직 그대로 복사
3. **이슈 4 (통계 다운로드)**
   - 4a. 공통 `StatsExcelButton` 컴포넌트 생성
   - 4b. 각 통계 서버 액션에 `exportXxxStats` 함수 추가 (재고분석부터 시작 — 가장 정적)
   - 4c. 각 클라이언트에 버튼 배치 + 필터/탭 상태 연동
4. **검증** — `npx tsc --noEmit`, 각 페이지에서 실제 다운로드 확인 (PC + 모바일 뷰포트)
5. **결과보고서** — `docs/report-stock-filter-fixes-2026-04-21.md`
6. **커밋 + worklog 업데이트**

---

## 사용자 결정 사항 (2026-04-21 승인)

1. **"전체 해제"만 추가** — 전체선택은 뺌 (전체 해제하면 결과상 "전체"가 되니까 해제만으로 충분)
2. **통계 엑셀 범위 = 현재 탭의 목록 전체** — 페이지네이션 있어도 필터 조건에 맞는 전체 데이터 다운로드. 탭 바꾸면 다른 데이터
3. **`daa` → `data` 오타 수정** — 서버 액션 리턴값 + 클라이언트 호출부 1곳 함께
4. **엑셀 다운로드 헤더에 `(선택)` 표기 (추가 요청)** — 업로드 템플릿 기준으로 필수 아닌 필드는 헤더 뒤에 `(선택)` 붙이기
   - 재고 기준 필수: 입고일자 / 생산년도 / 생산자명 / 품종 / 톤백번호 / 중량(kg)
   - 재고 기준 선택: 작목반명 / 인증구분 / 인증번호 / 상태
   - **주의**: 다운로드한 엑셀을 그대로 재업로드하는 케이스가 있으므로 `importStocks`에서 `row['작목반명']`과 `row['작목반명(선택)']` 둘 다 수용하도록 병행 수정 필요

---

## 예상 산출물

- 수정 파일 약 9~11개
- 신규 파일: `StatsExcelButton.tsx`, 결과보고서 1개
- 리스크: 통계 페이지 탭/필터 상태를 다운로드 데이터에 정확히 매핑하는 부분. 누락된 필터가 있으면 엑셀에도 반영 안 됨
