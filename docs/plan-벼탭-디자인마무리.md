# 계획서 — 벼 탭 디자인 점검 마무리

> 단일 진실 원천: `docs/벼탭-디자인점검.html` · 정렬 기준(정답지): 잡곡 탭
> 작성일: 2026-05-22

## 1. 목표

벼탭 디자인 점검에서 남은 항목(메모리 `rice-tab-design-alignment`의 "남은 것" 1~3번)을 마무리한다.
점검 결과, **2·3번 대부분은 이미 어제 PR1 색상 토큰화 때 처리 완료**되어 있어 실제 작업은 2건으로 축소됐다.

## 2. 점검 결과 (착수 전 실측)

| 원래 항목 | 실제 상태 | 결론 |
|---|---|---|
| 1. statistics UI 강조색 → primary | `#00a2e8`/`#008cc9` 잔존 확인 | **작업 필요 (A)** |
| 2. 다이얼로그(start-milling/release-stock/add-packaging) | 저장버튼·뱃지 모두 이미 `bg-primary`, 폼 shell 정렬됨 | **불필요 (완료)** |
| 3-a. §3.4 헤더 액션 버튼 | stock-excel-buttons 정사각+hover primary, stock-filters 활성칩·카운트뱃지 primary | **불필요 (완료)** |
| 3-b. 그룹체크 lazy-load 두번클릭 | `stock-list-client.tsx`에 실제 존재 (주석 "User has to click again") | **작업 필요 (B)** |

## 3. 작업 A — statistics UI 강조색 → primary (색상)

UI 액션색만 `primary`로 교체. **데이터 시각화색(`#0080c8` 코발트, `#006097`)은 유지** (디자인 §1.5).

### 결정 사항 (사용자 위임)
- MillingTable **생산량/수율 숫자 강조 = 데이터색 `#0080c8` 유지** (차트와 통일, 의미 구분: 데이터=코발트 / UI액션=primary)

### 변경 파일·위치

**1) `app/(dashboard)/statistics/stock/stock-stats-client.tsx`**
- L390 필터 활성칩 `bg-[#00a2e8]/10 text-[#00a2e8] border-[#00a2e8]/30` → `bg-primary/10 text-primary border-primary/30`
- L396 카운트 뱃지 `bg-[#00a2e8]/20 text-[#008cc9]` → `bg-primary/20 text-primary`

**2) `app/(dashboard)/statistics/output/output-stats-client.tsx`**
- L331 필터 활성칩 → primary (위와 동일)
- L337 카운트 뱃지 → primary
- ⚠️ L122-123 `accent:'#0080c8'`/`valueColor:'#006097'` = 데이터색 → **유지**

**3) `app/(dashboard)/statistics/milling/milling-stats-client.tsx`**
- L432 필터 활성칩 → primary
- L438 카운트 뱃지 → primary

**4) `components/statistics/MillingTable.tsx`**
- L60 도정종류 뱃지 `bg-[#00a2e8]/20 text-[#007ab3]` → `bg-primary/20 text-primary` (UI)
- L173 도정종류 컬럼 뱃지 `border-[#00a2e8]/30 text-[#00a2e8] bg-[#00a2e8]/5` → primary (UI)
- L203 투입량 링크 hover `hover:text-[#00a2e8]` → `hover:text-primary` (UI)
- L303 행 hover `hover:bg-[#00a2e8]/5` → `hover:bg-primary/5` (UI)
- L218 생산량 링크 `text-[#00a2e8] decoration-[#00a2e8]/40 hover:decoration-[#00a2e8] hover:text-[#008cc9]` → **데이터색 `#0080c8` 계열로 통일** (데이터)
- L235 수율 뱃지 `bg-[#00a2e8]/10 text-[#00a2e8]` → `bg-[#0080c8]/10 text-[#0080c8]` (데이터)

> ⚠️ 루트 `replace-colors.js` 재사용 금지 (역방향 도구). 위 치환은 Edit으로 수기 진행.

## 4. 작업 B — 그룹체크 lazy-load 두번클릭 (기능/UX)

> 디자인 문서가 "기능 변경이라 별도 PR" 권고 → **작업 A와 커밋 분리**.

### 현재 동작 (`stock-list-client.tsx`)
- 그룹 행은 펼칠 때만 `fetchGroupItems(group)` 비동기 호출 (lazy-load)
- `onCheckboxClick`: `items.length === 0`이면 `toggleGroup(group)`만 하고 `return` → 로드 후 **사용자가 다시 클릭**해야 선택됨
- 동일 로직이 **데스크탑(L197~) / 모바일(L352~) 두 곳 중복**

### 수정 방향
- "선택 대기" 상태(`pendingSelect: Set<string>`) 추가
- `onCheckboxClick`에서 미로드 시 `toggleGroup` + `pendingSelect`에 그룹 등록
- items 로드 완료(리렌더) 시 `useEffect`로 `pendingSelect` 그룹을 자동 전체선택 후 대기열에서 제거
- 데스크탑·모바일 두 곳 동일 적용

### 회귀 위험
- 부모(`fetchGroupItems` 정의처)의 상태 흐름 확인 필요 → 구현 시 부모 컴포넌트까지 읽고 진행
- 자동 선택이 "펼침"과 충돌하지 않도록 (펼침은 그대로 두되 선택만 자동화)

## 5. 커밋 분리

1. `refactor: statistics UI 강조색 → primary (디자인 §3.4 / 데이터색 #0080c8 유지)` — 작업 A
2. `fix: 원물재고 그룹체크 lazy-load 두번클릭 해소 (디자인 점검 FN)` — 작업 B

## 6. 검증

- `npm run build` (또는 `tsc`) 타입/빌드 통과 확인
- 작업 A: statistics 3개 탭 + 도정 상세 테이블에서 `#00a2e8`/`#008cc9`/`#007ab3` 잔존 0건 (grep), 데이터색 `#0080c8`/`#006097`은 유지
- 작업 B: 그룹 미펼침 상태에서 체크박스 1회 클릭 → 펼침 + 자동 선택되는지 (가능하면 실제 실행 확인)

## 7. 확인 필요 사항

- 작업 B는 기능 변경이라 회귀 위험이 있음. 빌드 통과 후 실제 동작 확인을 권장 (`/verify` 또는 수동).
