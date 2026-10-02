# 통계 화면에 판매분석 디자인 규칙 넓히기 — 백로그 §97

작성 2026-10-02 · 출처: 작업지시 ⑪ 끝 절 「다른 통계 화면에도 적용할 것」 · 판매분석 구현(`f1e872e`·`c569518`)

## 대상

| 화면 | 파일 | 비고 |
|---|---|---|
| 재고분석 `/statistics/stock` | `stock-stats-client.tsx`(634줄) · `_parts/stock-summary-cards.tsx`·`stock-tables.tsx`·`stock-filter-sheet.tsx` · `components/statistics/StockChart.tsx` | |
| 수율분석 `/statistics/milling` | `milling-stats-client.tsx`(705줄) · `_parts/constants.ts`·`milling-filter-sheet.tsx` · `components/statistics/SummaryCards.tsx`·`MillingChart.tsx`·`MultiSeriesChart.tsx`·`MillingTable.tsx` | |
| ~~`/statistics/millingtype`~~ | | 메뉴·링크 없음(브레드크럼 표기만). 수율분석의 「도정구분별」 탭과 겹치는 고아 페이지라 손대지 않는다. 공용 `SummaryCards`만 같이 바뀐다 |

## 현재 코드 대조

| 규칙(판매분석) | 재고분석 | 수율분석 |
|---|---|---|
| 카드 색 띠·점 없음, 값은 본문색 | 띠 `h-[3px]` + 점 + 값 색. 차트 색(`#0080c8`·`#8dc540`·`#f89c1e`) | 같은 구조(`SummaryCards`). 투입 파랑·생산 초록·수율 주황 = 차트 계열 색 |
| 「없다」는 차트 자리 한 곳, 표 숨김, 카드 0(slate-300) | 차트 「데이터가 없습니다」 + 표 3곳 같은 말(전부 slate-400) | 차트 2종 「조회된 데이터가 없습니다」 + 표 같은 말(slate-400) |
| 모바일 탭 「별」 떼기 · `px-3 text-[13px]` | 생산자별·작목반별·품종별(`px-5 text-sm`) | 기간별·품종별·도정구분별(`px-5 text-sm`) |
| 모바일 순서: 요약 → 차트 → 목록 | 차트 → 요약 → 표 | 차트 → 요약 → 표 |
| 모바일 시간축 눈금: 11px · slate-500 · 일별 1·8·15·22·29 | 해당 없음(가로 막대, 이름 축) | 모바일 눈금 **10px**(T2 하한 11 미만) · `#94A3B8`(slate-400) · `preserveStartEnd` |
| 모바일 표 → 두 줄 목록 | 표 3개(6~8칸) 가로 스크롤 | 표 8칸 + 머리글 정렬 + 투입·생산 상세 팝업, 가로 스크롤 |

## 1단계 — 지금 한다 (디자인 불필요)

1. **카드**: 띠·점을 빼고 값을 `text-slate-800`으로 한다. 빈 조건이면 0을 slate-300으로 둔다.
   - 재고분석: `totalKg === 0`
   - 수율분석: `millingCount === 0`
   - 라벨 slate-400은 slate-500으로 올린다(판매분석과 같다)
2. **빈 상태**: 「없다」는 차트 자리 한 곳에서 slate-600으로 말하고, 표 카드는 숨긴다.
   - 재고분석: 「이 조건에 맞는 재고가 없어요」(지시서 문구)
   - 수율분석: 「이 조건에 맞는 도정 기록이 없어요」(제안 — 지시서에 수율분석 문구는 없다)
3. **탭**: 모바일에서 「별」을 떼고 `px-3 text-[13px]`로 한다.
   - 재고분석: 생산자 · 작목반 · 품종
   - 수율분석: 기간 · 품종 · 도정구분
   - 판매분석처럼 `short` 라벨을 상수에 둔다
4. **모바일 순서**: 요약을 차트 위로 올린다(`order-first md:order-none`)
5. **수율 차트 눈금**(`MillingChart`·`MultiSeriesChart`, 모바일):
   - 글자 10px → 11px, 색 `#94A3B8` → `#64748b`
   - 일별일 때만 `interval={6}`, 그 밖에는 지금처럼 둔다
6. **(선택) 필터 시트 탭바 겹침 — 백로그 §36 중 2곳**: `stock-filter-sheet.tsx:57`·`milling-filter-sheet.tsx:69`의 바닥과 max-h를 판매분석 시트와 같은 값으로 바꾼다(`60px+1rem+safe+8px`). 같은 화면이고 두 줄씩이다. §36의 나머지 10곳은 그대로 둔다

## 2단계 — 디자인 요청: 모바일 두 줄 목록

판매분석 목록은 「이름 · kg / 비중 막대 · 개수 · 주문 · %」로 칸이 단순했다. 두 화면은 그렇지 않다.

- **재고분석 표 3개**
  - 한 줄에 입고 · 도정완료 · 직접출고 · 미처리 · 재고율 다섯 값이 있다(작목반은 인증·생산자수 포함 8칸)
  - 둘째 줄을 세 갈래 막대(도정/출고/미처리)로 할지, 숫자만 둘지 정해야 한다
- **수율분석 표**
  - 8칸(날짜 · 도정종류 · 품종 · 생산자 · 투입 · 생산 · 수율 · 비고)이다
  - 머리글 정렬이 있다. 목록으로 바꾸면 정렬 수단이 사라진다
  - 투입·생산 숫자를 누르면 상세 팝업이 뜬다
  - 수율 판정 색(기준값 대비)이 있다

→ 요청서 `docs/handoff/요청-통계-모바일목록.md`를 쓴다. 시안이 오면 2단계를 착수한다.

## 범위 밖 (발견만, 손대지 않음)

- **T1 보라 잔여(§87)**: 이번 화면들에 아직 남아 있다.
  - 재고분석: 생산자 칩 `purple-50/700`(:463·533·567) · 직접출고 차트 `#8b5cf6` · 표 글자 `#7c3aed`
  - 수율분석: 도정구분 칩 `purple`(:591·635, 시트 :187) · `MultiSeriesChart` 3번째 계열 `#8b5cf6`
  - 판매분석에서 한 것과 같은 판단(차트 색은 검증해서 교체, 칩은 다른 색)이 필요하다. §87에 덧붙인다
- **표 글자를 계열 색으로 칠하는 것**(재고 표 도정완료 초록 · 출고 보라 · 미처리 주황): dataviz 규칙 「글자는 본문색」에 어긋난다. 1단계 카드와 같은 문제지만 지시서 범위 밖이라 §97에 적어 둔다
- 차트 제목 `text-slate-400 uppercase`(재고분석): T3 · §33

## 변경 파일 (1단계)

| 파일 | 내용 |
|---|---|
| `stock/_parts/stock-summary-cards.tsx` | 띠·점·값 색 제거 · empty |
| `components/statistics/SummaryCards.tsx` | 같음 (수율분석·고아 페이지 공용) |
| `stock/_parts/stock-tables.tsx` · `components/statistics/StockChart.tsx` | 빈 문구 정리(표는 부모가 숨긴다) |
| `components/statistics/MillingChart.tsx` · `MultiSeriesChart.tsx` · `MillingTable.tsx` | 빈 문구 · 모바일 눈금 |
| `stock/stock-stats-client.tsx` · `stock/_parts/utils.ts` | 탭 짧은 라벨 · 순서 · 빈 상태 분기 |
| `milling/milling-stats-client.tsx` · `milling/_parts/constants.ts` | 같음 |
| (선택) `stock/_parts/stock-filter-sheet.tsx` · `milling/_parts/milling-filter-sheet.tsx` | §36 바닥·max-h |
| `docs/handoff/요청-통계-모바일목록.md` (신규) | 2단계 디자인 요청 |

검증: `npm test` · `tsc` · `npx eslint .`(0/0)를 돌린 뒤 커밋한다. 🖐 화면 확인은 재고분석·수율분석의 PC와 모바일, 그리고 빈 조건이다(재고분석은 다른 연산, 수율분석은 기간 1주).
