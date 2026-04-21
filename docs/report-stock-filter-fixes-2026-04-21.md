# 재고관리 필터·엑셀 수정 + 통계 엑셀다운 추가 결과보고서

**작업일**: 2026-04-21
**관련 계획서**: [plan-stock-filter-fixes.md](plan-stock-filter-fixes.md)
**타입체크**: `npx tsc --noEmit` **통과** (exit 0)

---

## 변경 사항 요약

사용자 리뷰에서 지적된 4건 전부 처리.

### 1. 재고관리 필터 드롭다운 휠 스크롤 수정
- **문제**: PC에서 필터 드롭다운 내부 스크롤 시 팝오버가 닫히거나 스크롤이 외부로 전파됨
- **수정**: 공용 드롭다운 2종에 `onWheel={e => e.stopPropagation()}` 추가
  - [components/ui/multi-select.tsx](../components/ui/multi-select.tsx) (재고관리 필터 전용)
  - [components/statistics/MultiSelectDropdown.tsx](../components/statistics/MultiSelectDropdown.tsx) (통계 페이지 전용)
  - `MultiSelectDropdown`에는 `overscroll-contain` + `onTouchMove` 전파 차단도 함께 적용 (모바일 관성 스크롤 대응)

### 2. 재고관리 품종 필터에 "전체 해제" 버튼 추가
- **변경**: `MultiSelect`에 선택된 항목이 1개 이상일 때만 하단에 "전체 해제" 버튼 표시
- 전체선택 버튼은 제외 (사용자 결정: 전체 해제 = 전체 표시이므로 불필요)
- 통계용 `MultiSelectDropdown`은 이미 `onClearAll` prop 존재 → 변경 없음

### 3. 재고관리 엑셀 다운로드 다중 품종 버그 수정
- **원인**: [app/actions/stock-excel.ts:22](../app/actions/stock-excel.ts#L22)의 `parseInt(params.varietyId)`
  - `varietyId="4,5,6"` 같은 다중 선택을 parseInt하면 `4`만 추출 → 첫 품종 ID만 쿼리됨
  - 리스트 조회 `getStocks`는 콤마 분리 + `in` 연산자로 이미 처리 중이었음 (그래서 화면은 정상)
- **수정**: `exportStocks`의 where 절을 `getStocks`와 동일하게 재구성
  - `productionYear`, `varietyId`, `certType`, `farmerName` 모두 콤마 분리 → `in` 또는 `OR` 처리
  - `farmerId`, `status`는 기존 단일값 유지 (UI에서 단일값만 사용)

### 추가: 오타 수정 + `(선택)` 헤더 표기 + import 호환성
- **`daa` → `data` 오타 수정**: 서버 액션 리턴값 + 클라이언트 호출부 모두 수정
  - [app/actions/stock-excel.ts:85](../app/actions/stock-excel.ts)
  - [app/(dashboard)/stocks/stock-excel-buttons.tsx:40](../app/\(dashboard\)/stocks/stock-excel-buttons.tsx)
- **엑셀 헤더에 `(선택)` 표기**:
  - 업로드 템플릿 기준 선택 필드: 작목반명 / 인증구분 / 인증번호 / 상태
  - 다운로드 엑셀의 해당 헤더를 `작목반명(선택)`, `인증구분(선택)`, `인증번호(선택)`, `상태(선택)`로 변경
- **import 호환성 유지**: `importStocks`에서 `pick()` 헬퍼로 기존 헤더명과 `(선택)` 접미사 헤더명 둘 다 수용
  - 다운로드한 엑셀을 그대로 재업로드해도 동작

### 4. 통계 페이지 엑셀 다운로드 기능 신규
- **공통 인프라 신규**:
  - [app/actions/stats-excel.ts](../app/actions/stats-excel.ts) - `exportStatsRows(rows, sheetName, fileNamePrefix)` 서버 액션. rows를 xlsx base64로 변환 + 감사 로그
  - [components/statistics/StatsExcelButton.tsx](../components/statistics/StatsExcelButton.tsx) - 재고 페이지와 동일한 초록색 Download 아이콘 버튼 (`h-8 w-8`), PC/모바일 공통

- **연결된 페이지**:
  - **재고분석** [app/(dashboard)/statistics/stock/stock-stats-client.tsx](../app/\(dashboard\)/statistics/stock/stock-stats-client.tsx) - 현재 탭(생산자별/작목반별/품종별)의 테이블 rows를 한글 헤더로 변환
  - **수율분석** [app/(dashboard)/statistics/milling/milling-stats-client.tsx](../app/\(dashboard\)/statistics/milling/milling-stats-client.tsx) - `data.tableData` 전체 다운로드 (도정 상세 내역 - 날짜/도정종류/품종/생산자/투입/생산/수율/비고)
  - **출고분석** [app/(dashboard)/statistics/output/output-stats-client.tsx](../app/\(dashboard\)/statistics/output/output-stats-client.tsx) - 현재 탭(규격별/월별/출고처별)에 맞춰 다운로드

- **버튼 배치**: 각 페이지의 탭 바 우측, 기존 isPending 로더와 모바일 필터 버튼 옆 (PC/모바일 동일 위치)

---

## 주요 결정 사항

1. **`MultiSelect` 전체 선택 버튼 제외**: 사용자가 "전체해제하면 전체니까 해제만"이라고 확인 → UX 단순화
2. **엑셀 다운로드 범위 = 현재 탭의 전체 rows**: 페이지네이션과 무관하게 필터 적용된 전체 데이터 제공
3. **도정구분별(`millingtype`) 통계 페이지 엑셀 제외**: 해당 페이지는 차트+요약카드만 있고 테이블이 없음 → 사용자 요청("그래프 하단 목록 있는 페이지") 범위 밖
4. **통계 엑셀: 클라이언트 → 서버 rows 전달 방식**: 서버에서 재조회하지 않고 이미 fetch된 data를 그대로 활용. 서버 액션은 xlsx 변환 + 감사 로그만 담당. 중복 쿼리 없음
5. **import 하위호환**: 다운로드 헤더에 `(선택)`을 붙여도 재업로드 시 양쪽 헤더명 모두 수용 (pick 헬퍼)

---

## 변경 파일 목록 (9개)

**공용 UI 수정**
- `components/ui/multi-select.tsx`
- `components/statistics/MultiSelectDropdown.tsx`

**재고 엑셀 버그 수정**
- `app/actions/stock-excel.ts`
- `app/(dashboard)/stocks/stock-excel-buttons.tsx`

**통계 엑셀 신규**
- `app/actions/stats-excel.ts` (신규)
- `components/statistics/StatsExcelButton.tsx` (신규)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
- `app/(dashboard)/statistics/output/output-stats-client.tsx`

---

## 검증

- **타입체크**: `npx tsc --noEmit` → exit 0, 에러 없음
- **UI/브라우저 테스트**: 미실시 (CLI 환경). 배포 후 사용자 시나리오 검증 필요
  - 재고관리 필터: 여러 품종 선택 → 엑셀 다운로드 → 모든 품종 포함 확인
  - 각 통계 페이지: 탭별로 아이콘 눌러 다운로드 정상 동작 확인
  - 필터 드롭다운 내 마우스 휠 스크롤 정상 동작 확인 (PC)
  - 다운로드한 엑셀을 그대로 업로드 시 정상 인식 확인

---

## 확인이 필요한 사항

1. **도정구분별 페이지 엑셀 제외 처리가 의도한 바인지**: 현재 해당 페이지는 차트만 있어 "목록 다운로드"의 의미가 모호함. 차트 데이터(기간별 x 품종/도정구분 매트릭스)를 엑셀로 펼쳐 제공하는 것도 가능 — 별도 요청 시 추가 가능
2. **출고분석 월별·출고처별 탭은 현재 `disabled` 상태**: 탭 자체는 비활성이지만 엑셀 로직은 세 탭 모두 준비해둠 (나중에 탭 활성화 시 자동 적용). 현재 사용자는 '규격별' 탭만 접근 가능
3. **엑셀 다운로드 시 audit log 항목 "Statistics"**: 감사 로그 엔티티 타입으로 'Statistics' 신설 사용. 기존 엔티티 enum 제약이 있다면 재검토 필요 (타입체크는 통과)
