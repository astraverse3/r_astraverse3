# 통계 표 — 모바일 목록 · 재고 PC 표 · 보라 칩 · 세 표 겉모양 (작업지시 ⑫)

작성 2026-10-02 · 백로그 §97 2단계 · 지시서 `docs/handoff/작업지시-12-통계-모바일목록/`(15:45) · 요청서 `docs/handoff/요청-통계-모바일목록.md`

## 전수 대조

### 그대로 반영

| 지시 | 현재 코드 | 할 일 |
|---|---|---|
| A-1 재고 모바일 두 줄 목록 | 표만 있다(`stock-tables.tsx`, 가로 스크롤) | `_parts/stock-list-mobile.tsx` 신규 · 1줄 순위·이름(생산자=작목반 11px / 작목반=인증 배지)·총 입고 · 2줄 세 갈래 막대(길이 = 그 줄 총 입고 100%) + `[N명 · ]재고 N%` · 누르면 3칸 카드(한 번에 한 줄) · 머리 범례 + 「입고순/미처리순」 |
| A-1 ⑤ 재고 PC 표 = 판매분석 틀 | 순위·막대 없음 · 작목반 따로 칸 · 119줄 한 번에 | 칸: 순위·이름·총 입고·도정완료·직접출고·미처리·재고율·구성(22%). 생산자는 이름 뒤 작목반 12px, 작목반은 이름 뒤 인증 + 생산자수 칸. 도구 줄 「총 입고 많은 순 · N명」 + 정렬 토글. 세 표 모두 상위 20 + 더 보기 |
| 정렬 「미처리순」 | 서버가 총 입고 순으로만 준다 | `availableKg` 내림차순을 화면에서. PC·모바일 같은 상태. 차트는 그대로 |
| 더 보기 「나머지 N명/곳/종」 | 판매분석 `ShowAllRow`는 「곳」 고정 | 단위 인자를 받게 한다(기본 「곳」) |
| A-2 수율 모바일 목록 | 8칸 표 가로 스크롤 | `components/statistics/MillingListMobile.tsx` 신규 · 1줄 `mm-dd`·도정종류·품종 \| 수율 배지 · 2줄 생산자 \| 투입 → **생산** kg · 줄 전체 터치 → 펼침(비고 상자 + 버튼 2칸 h-11 → 기존 `MillingStockListDialog`·`PackagingPopup`) · 정렬 칩 3개(TanStack `sorting` 공유, 다시 누르면 방향) · 20건씩 더 보기 · 머리 「도정 상세 N건」 |
| B-1 보라 칩 | 칩 색이 조건마다 다르다(재고: 인증 teal · 작목반 blue · 품종 green · 생산자 purple / 수율: 품종 blue · 도정 purple · 생산자 emerald / 판매: 곡종 amber · 채널 blue · 품종 green) | 적용 칩은 전부 `bg-blue-50 text-blue-700` + 조건 이름 `text-blue-700/70`. 드롭다운 활성색(지시서 범위 `stock 430~` 포함)·생산자 입력칸·수율 시트·드롭다운 선택(`bg-blue-500`)도 같이 바꾼다. 고아 `millingtype`도 지시서 대상이라 포함 |
| B-2 표 숫자 계열 색 | `#7db037`·`#7c3aed`·`#cc7b0c` 글자 | `text-slate-600`(주 값 외). 머리글 앞에 차트 색 네모 `w-2 h-2 rounded-sm` |
| B-3 재고율 판정 색 | `#7db037`·`#cc7b0c`·`#ef4444` | `text-emerald-700`·`amber-700`·`red-600` 한 함수(`stockRateTone`)로 PC·모바일 같이 |
| C 세 표 겉모양 | 판매 12px · 재고 12px + 줄무늬 · 수율 14px + 흰 머리줄 + 테두리 없음 | 공용 상수(`components/statistics/table-styles.ts`): 카드 `border-slate-100` · 머리줄 `h-10 bg-slate-50 border-slate-200` 12px medium slate-600 · 행 `h-11 border-slate-100` 13px · 호버 `bg-slate-50` · 줄무늬 없음 · 주 값 semibold slate-800 · 나머지 slate-600 · 숫자 오른쪽 정렬 · 눌리는 숫자 점선 밑줄 한 종류 · 정렬 아이콘 slate-400/800 · 수율 바닥줄 h-11 · 화살표 32px · 도정종류 배지 11px |
| C-2 카드 머리 | 수율만 「도정 상세 내역」 14px + 「총 N건」 slate-400 두 줄 | 한 줄 `px-4 py-2.5` 13px semibold slate-800 + 「N건」 12px slate-500 |

### 🔴 시안이 실제와 다른 곳 → 지시서 쪽으로 고쳐서 한다

1. **「투입 원물 N포대」**(시안 버튼). 이 앱에서 원물 단위는 **톤백**이다. 투입 팝업도 「총 N개 톤백」이라고 쓰고, 「포대」는 코드에 한 번도 안 나온다 → **「투입 톤백 N개」**로 한다
2. **수율 표 머리 오른쪽의 「위 탭과 상관없이 기간 조건 전체」**(시안에만 있고 지시서에는 없다). 사실이 아니다: 표는 고른 품종·도정구분·생산자로 걸러진다(`getMillingStatistics`). 넣지 않는다
3. 시안 수율 머리글 「투입 (kg)·생산 (kg)·수율」은 지금 「투입량 (kg)·생산량 (kg)·수율 (%)」을 줄인 것이다. 지시서에 없어서 지금 이름을 그대로 둔다
4. 시안 인증 배지(`green-100/800` 11px)는 지금(`green-100/700` 12px)과 다르다. 지시서에 없어서 지금 배지를 모바일에 그대로 쓴다
5. 시안의 모바일 필터 줄(「2025년산 벼 원물 [조건]」)은 판매분석 모양이다. 지시서에 없어서 재고·수율의 지금 모바일 필터는 그대로 둔다

### 범위를 조금 넓히는 것 (확인 부탁)

- **재고분석 조건 시트**(`stock-filter-sheet.tsx`): 인증 teal-500 · 품종 green 체크가 남는다. 지시서 대상 목록에는 없지만 「칩은 파랑 하나」 규칙이라 같이 파랑으로 맞춘다(권장)
- **판매분석 원물출고 표**(`raw-release-panel.tsx` `DestinationTable`): 판매분석 표를 본뜬 것이라 C 값도 같이 넣는다

## 단계 (커밋 4개)

1. **C + B-2·B-3 + A-1 ⑤** — 공용 표 스타일. 재고 PC 표를 판매분석 틀로, 판매·원물·수율 PC 표 겉모양
2. **A-1** — 재고 모바일 목록 · 정렬 토글 · 펼침
3. **A-2** — 수율 모바일 목록 · 정렬 칩 · 20건 더 보기 · 펼침
4. **B-1** — 칩·드롭다운·시트 파랑

단계마다 `npm test` · `tsc` · `npx eslint .`을 돌리고 바꾼 파일은 `touch`한다(개발 서버가 변경을 놓친 적 있음). 🖐 화면 확인은 끝에 한 번이다. 지시서 「체크」 3개(360 폭 작목반 13자 + 배지 + kg · 26년산 15행이면 더 보기 없음 · 펼친 버튼이 탭바에 안 가림)를 본다.

## 변경 파일 (예상)

| 파일 | 단계 |
|---|---|
| `components/statistics/table-styles.ts` (신규) | 1 |
| `stock/_parts/stock-tables.tsx` · `stock/_parts/utils.ts` · `stock/stock-stats-client.tsx` | 1 · 2 · 4 |
| `stock/_parts/stock-list-mobile.tsx` (신규) | 2 |
| `output/_parts/sales-breakdown-table.tsx`(ShowAllRow 단위 · C) · `raw-release-panel.tsx`(C) · `sales-filter-bar.tsx`(B-1) | 1 · 4 |
| `components/statistics/MillingTable.tsx` · `MillingListMobile.tsx` (신규) | 1 · 3 |
| `milling/milling-stats-client.tsx` · `milling/_parts/milling-filter-sheet.tsx` · `stock/_parts/stock-filter-sheet.tsx` · `millingtype/millingtype-stats-client.tsx` | 4 |
| 문서: 백로그 §97 · §87(T1 잔여 해소분) · worklog · 결과보고서 | 끝 |
