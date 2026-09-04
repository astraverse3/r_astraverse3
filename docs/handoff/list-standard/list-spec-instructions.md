# 작업지시 — 목록 표준규격 통일 (데스크탑)

시안: `handoff/list-standard/list-spec.html`

## 배경

목록 테이블 11곳의 헤더/행 스펙과 펼침 그룹 표현이 전부 다르다. 헤더 폰트가 `text-sm`/`text-xs`/`text-[11px]`, 웨이트가 `bold`/`semibold`/`medium`, 좌우 패딩이 `px-1`/`px-2`/`px-3`/`px-5`로 섞여 있고, 펼침 그룹은 화면마다 색(시안톤 vs slate)과 서브행 처리가 다르다.

- **헤더·본문 정본**: 생산자 관리 (`app/(dashboard)/admin/farmers/farmer-list.tsx`) — `TableHead` 기본값 `h-10 px-2 text-sm font-medium text-foreground`
- **펼침 그룹 정본**: 원물재고 잡곡 (`raw-stocks/misc/misc-stock-list-client.tsx`) — slate 묶음톤 + 단일건 낱개

> **정본의 범위**: 잡곡이 정본인 것은 **묶음톤과 단일건 낱개 패턴**이다. 행 높이는 아니다 — 잡곡도 `h-12`를 갖고 있으므로 "모든 행 44px" 기준에 맞춰 같이 고친다 (R3 참조).

## 결정 사항

| 항목 | 값 |
| --- | --- |
| 헤더 | 40px 높이 / 14px / `font-medium`(500) / `text-slate-900` / 좌측정렬 |
| 헤더 배경 | `bg-slate-50` + 하단 `border-slate-200`, 호버 없음 |
| 본문 | 14px / `text-slate-700` |
| 행 높이 | **44px 고정** — 그룹 헤더 행도 44px |
| 좌우 패딩 | 12px (`px-3`) |
| 행 구분 | 구분선만 (`border-b border-slate-100`) + 호버 `bg-slate-50`. 짝수행 음영 없음 |
| 컬럼 폭 | `colgroup`에 **% 비율** + `table-layout:fixed`. 가로 스크롤 없음 |
| 펼침 그룹 | 헤더+서브행 같은 `bg-slate-100` 묶음톤 (흰색 대비 5.5%) |
| 접힌 그룹 | `bg-slate-50` + 상하 `border-slate-200/80`. **흰 배경 금지** |
| 단일 건 그룹 | 그룹 헤더를 만들지 않고 낱개 흰 행으로 표시 |
| `#00a2e8` | 펼침 그룹 2건만 삭제 — 의미색 29건은 범위 밖 |
| 정렬 | **페이지별 현행 유지** — 이번 작업에서 손대지 않는다 |
| sticky 헤더 | 다이얼로그·긴 목록에만 (현행 유지) |
| 모바일 카드 | **범위 밖** — 별도 검토 |

## R1. 공통 프리미티브 정비

`components/ui/table.tsx`를 표준으로 올린다. 각 목록에서 개별 클래스로 덧붙이던 것을 걷어내는 것이 목적.

```
TableHead: h-10 px-3 text-left align-middle font-medium text-foreground whitespace-nowrap
TableCell: h-11 px-3 py-0 align-middle whitespace-nowrap text-slate-700
TableRow:  border-b border-slate-100 hover:bg-slate-50 transition-colors
```

- `Table`의 `text-sm`은 유지 → 헤더·본문 모두 14px 상속
- **`TableCell`의 `p-2` → `px-3 py-0` + `h-11`** 로 교체. `p-2`가 남으면 높이 고정이 안 된다
- 헤더 행: `<TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-transparent">`
- 정렬은 기본 `text-left`, 우측정렬 필요한 셀만 호출부에서 `text-right`
- 체크박스·아이콘 전용 컬럼만 `px-1` 예외 허용
- 2줄 셀이 필요한 행은 `h-11` 대신 `min-h-11 py-2`

> **헤더는 사실상 `px-2` → `px-3` 하나만 바뀐다.** 스펙의 `text-slate-900`은 현행 기본값 `text-foreground`(#0f172a)와 같은 값이다 — 토큰 방향(§22)을 보존하기 위해 **`text-foreground`를 유지**한다. 시안에 slate-900으로 적은 것은 렌더 값 표기이며, 새 하드코딩을 넣으라는 뜻이 아니다. `TableCell`·`TableRow`는 실변경이 있다.

### 컬럼 폭

각 목록의 `<TableHead className="w-[..px]">`를 걷어내고 `<colgroup>`에 % 로 옮긴다. 합이 100%가 되게 하고 로트번호 컬럼에는 **24% 이상** 배정한다.

```tsx
<colgroup>
  <col className="w-[7%]" /><col className="w-[11%]" /><col className="w-[19%]" />
  <col className="w-[10%]" /><col className="w-[24%]" />{/* Lot No */}
  <col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[10%]" />
</colgroup>
```

`Table`의 컨테이너는 `overflow-x-auto`를 유지해도 되지만, % 폭에서는 스크롤이 발생하지 않는다.

> `w-[..px]` 제거는 R4의 "정렬·폭 보존" 원칙과 충돌한다. **이 단계에서만 의도적으로 걷어낸다** — R4 이후엔 보존한다.

## R2. 셀 클래스 규약

| 성격 | 클래스 |
| --- | --- |
| 텍스트 | 기본값 그대로. 대표값(생산자명·품종명)만 `font-semibold text-slate-900` |
| 숫자·수량 | `text-right font-mono tabular-nums`. 합계·중량은 `font-semibold text-slate-900` |
| 보조 숫자 | 년도·번호 등 참고값 `text-slate-400` |
| 로트번호 | `text-[12.5px] font-mono text-slate-500`, 컬럼 폭 ≥24% |
| 인증 칩 | `text-[11.5px] font-semibold px-1.5 rounded-md border` · 유기=lime, 무농약=sky |
| 상태 배지 | `text-[11.5px] font-semibold px-2 rounded-full` · 테두리 없이 배경 톤만 |
| 액션 | 아이콘 버튼 `h-8 w-8 text-slate-400`, 호버 `text-primary bg-primary/10` |
| 빈 목록 | `h-32 text-center text-sm text-slate-400`, 문구 "OOO이 없습니다." |

## R3. 펼침 그룹 통일

세 화면(생산자관리 / 원물재고 벼 / 원물재고 잡곡)의 펼침 표현을 **잡곡 방식**으로 맞춘다.

```tsx
// 펼친 그룹 헤더
<TableRow className="bg-slate-100 hover:bg-slate-200/70 border-t border-slate-200/80 border-b-0 cursor-pointer">

// 펼친 그룹 서브행 — 헤더와 같은 톤
<TableRow className={`bg-slate-100 hover:bg-slate-200/70 border-b-0 ${isLast ? 'border-b border-slate-200/80' : ''}`}>

// 접힌 그룹 헤더 — 흰 배경 금지
<TableRow className="bg-slate-50 hover:bg-slate-100 border-y border-slate-200/80 cursor-pointer">

// 단일 건 그룹 → 그룹 헤더 없이 낱개 행
<TableRow className="bg-white hover:bg-slate-50">
```

화면별 변경:

| 파일 | 현행 | 조치 |
| --- | --- | --- |
| `admin/farmers/farmer-list.tsx` L371 | `bg-[#00a2e8]/20` 그룹 헤더, hover `/16`, 접힘 시 `bg-white` | **시안톤 삭제.** 위 slate 클래스로 교체. 접힘 상태를 `bg-slate-50`으로 |
| `admin/farmers/farmer-list.tsx` L405 | 서브행 `bg-[#00a2e8]/7` | `bg-slate-100` |
| `raw-stocks/stock-list-client.tsx` L234 | 그룹 헤더 `h-12` + `shadow-sm`, 서브행 톤 없음 | `h-12`·`shadow-sm` 제거(44px), 서브행에 묶음톤 추가 |
| `raw-stocks/misc/misc-stock-list-client.tsx` L210 | `h-12 border-y border-slate-200/70` + `bg-slate-50/60` | `h-12` → `h-11`, `/70` → `/80`, `bg-slate-50/60` → `bg-slate-100`. **벼와 동일 조치** |

> **정본이라는 잡곡도 `h-12`를 갖고 있다.** 잡곡을 정본으로 삼은 것은 묶음톤·단일건 낱개 패턴이고, 행 높이는 별도로 "모든 행 44px"로 정했다. 세 화면 모두 그룹 헤더를 `h-11`로 맞춘다.

- 단일 건 그룹 처리는 잡곡의 `isMulti` 패턴을 따른다 (`misc-stock-list-client.tsx` L201, `misc-stock-table-row.tsx`의 `inExpandedGroup` prop)
- 생산자관리의 `isMultiFarmer` 분기도 같은 방식으로 정리 — 하위 1명이면 그룹 헤더를 렌더하지 않는다
- **생산자관리 L411의 "클릭해서 펼치기/접기" 안내 칩은 제거한다** (`text-[#00a2e8] bg-[#00a2e8]/10` span 전체 삭제). 세 화면 중 이 화면에만 있던 예외이고, 셰브론 + `cursor-pointer` + `총 N명` 밑줄로 어포던스가 이미 확보된다. 다른 두 화면에 새로 넣지 않는다 → 이로써 그룹 헤더에서 청록은 밑줄 `decoration-[#00a2e8]/40` 하나만 남는다
- **"총 N명" 셀은 `font-semibold text-slate-900` 유지** (기존 `text-[#008cc9] font-bold`에서 변경 확정). R2의 「대표값 = font-semibold text-slate-900」 규약과 일치하고, slate 배경 위에 청록 글자만 남는 상태를 만들지 않는다

## R4. 화면별 헤더·셀 클래스 제거 (10파일)

개별 헤더/셀 클래스를 삭제하고 정렬 클래스만 남긴다. **헤더와 본문 행이 다른 파일에 있는 경우가 있으므로 짝으로 묶어 커밋한다.**

### 헤더가 있는 파일 (7)

| 파일 | 삭제할 것 |
| --- | --- |
| `admin/farmers/farmer-list.tsx` | 헤더는 정본. `text-xs`로 축소한 td 클래스만 제거 |
| `raw-stocks/stock-list-client.tsx` | `py-2 px-1 text-xs font-bold text-slate-500` |
| `raw-stocks/misc/misc-stock-list-client.tsx` | `py-2 px-1 text-xs font-bold text-slate-500` |
| `milling/milling-list-client.tsx` | `py-3 px-3 text-sm font-bold text-slate-500` |
| `milling/stock-list-dialog.tsx` | `px-1 text-xs font-bold text-slate-500` (sticky는 유지) |
| `sales/release/release-history-list.tsx` | `py-2 text-xs font-bold text-slate-500` / 중첩표 `text-[11px]`, `h-9` |
| `admin/varieties/variety-list-client.tsx` | `font-bold text-slate-500` |

### 본문 행 파일 (3) — 반드시 함께

이 파일들이 `TableCell`에 개별 클래스를 덧붙이고 있어, R1에서 프리미티브를 `h-11 px-3 py-0`로 바꿔도 **그대로 덮어쓴다.** 이걸 놓치면 "본문 행 44px"가 달성되지 않는다.

| 파일 | TableCell | 삭제할 것 |
| --- | --- | --- |
| `milling/milling-table-row.tsx` | 23 | `py-3 px-3 text-sm text-slate-500` |
| `raw-stocks/stock-table-row.tsx` | 21 | `py-2 px-1 text-xs text-slate-500` |
| `raw-stocks/misc/misc-stock-table-row.tsx` | 25 | `text-xs text-slate-400` (카드 모드 분기는 건드리지 말 것) |

**보존 필수**: `text-left/center/right`, `hidden sm:table-cell` 등 반응형 표시 제어. (`w-[..]`만 R1 컬럼 폭 단계에서 colgroup으로 이전)

`components/admin/BackupManager.tsx`(TableCell 11)는 범위 밖이지만 프리미티브 파급을 받는다. 클래스는 손대지 말고 **회귀 확인만** 한다.

### 생 `<th>`를 쓰는 곳 — `ui/table` 컴포넌트로 교체 (4)

| 파일 | 현행 |
| --- | --- |
| `admin/logs/log-list.tsx` | `px-5 py-3` + `border-l border-slate-100` 세로 구분선 → **세로선 제거**, px-3 |
| `admin/product-types/product-type-page-client.tsx` | `py-1.5 px-3` / `py-2 px-2 font-medium` |
| `statistics/stock/_parts/stock-tables.tsx` | `py-2.5 px-3 font-semibold text-slate-500 text-xs` |
| `components/statistics/MillingTable.tsx` | 확인 후 동일 적용 |

## R5. handoff.md §4.2 개정 — **실작업 (이전 「완료」 표기는 오류)**

이전 지시서가 "이미 개정 완료"로 적었지만, 그건 **디자이너 워크스페이스 사본**에만 적용된 것이고 이 저장소엔 들어오지 않았다. 저장소 `handoff.md:346`은 여전히 옛 값이다.

### 대상 — 1벌만 개정

저장소에 `handoff.md`와 `design-system.html`이 **2벌** 있다:

| 경로 | 처리 |
| --- | --- |
| `docs/handoff/디자인시스템/handoff.md` · `design-system.html` | **정본. 이것만 개정한다** |
| `docs/handoff/잡곡재고관리/handoff.md` · `design-system.html` | 개정하지 않는다. 첫 줄에 `> 정본은 docs/handoff/디자인시스템/ 입니다.` 한 줄만 추가 |

2벌을 계속 동기화하는 것이 이 불일치의 원인이다. 한 벌로 수렴한다.

### 개정 내용

이 패키지의 `handoff/handoff.md`·`handoff/design-system.html`에 **이미 적용된 상태**로 들어 있다 — 그대로 예시로 삼으면 된다.

**§4.2.3 컬럼 헤더** (저장소 현행 L346):
```
text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2 bg-slate-50/60
→ text-sm font-medium text-foreground px-3 h-10 flex items-center bg-slate-50
```
이 값은 Typography의 **Micro Bold(섹션 그룹 헤더)** 토큰 — 영문 라벨("MAIN MENU")용을 한글 헤더에 쓰고 있었다. `uppercase`·`tracking-wider`는 한글에 효과가 없고 글자만 10.5px로 작아진다.

함께 개정할 것:
- §4.2 도입부 — 목록 표준규격 적용 사실과 상위 정본 경로 안내
- §4.2.2 시각 원칙 — 행 44px, 묶음톤 `bg-slate-100` + `border-t`, 접힌 그룹 흰 배경 금지, 단일건 낱개 그룹
- §4.2.4/§4.2.5/§4.2.6 — `text-[12.5px]` → `text-sm`, `px-4 py-2.5` → `px-3 h-11`, 로트 `text-[11px]` → `text-[12.5px]`
- §4.2.6 묶음 — `ring-1 ring-inset ring-slate-200/70` → `border-t border-slate-200/80`
- §4.2.6 NOTE — 생산자관리에 `#00a2e8`이 잔존했고 R3에서 제거된 경위 기록. 그룹 헤더에 남기는 청록은 밑줄 하나뿐임을 명시
- `design-system.html` §Group Table 라이브 렌더링 — 위 값으로 갱신
- 부록 체크리스트 — `#00a2e8`은 다른 색으로 치환하지 말고 그룹 표현에서만 slate로 제거

§4.2의 **CSS grid 마크업 자체는 유지**한다 (펼침 포장재고는 `<table>`로 표현하기 어렵다). 컬럼 폭은 `fr` 비율을 유지하되 로트 컬럼에 24%에 해당하는 비중을 배정한다.

## 검수 체크리스트

- [ ] 모든 목록의 헤더 높이가 40px, 본문·그룹 헤더 행이 모두 44px로 실측되는가 (세 화면 모두 `h-12` 사라짐)
- [ ] 헤더 텍스트가 전부 14px / `font-medium` / `text-foreground` 톤인가 (연한 회색 bold가 남은 곳 없는가)
- [ ] 헤더 배경이 `bg-slate-50` 이고 호버에 반응하지 않는가
- [ ] `farmer-list.tsx` L371·L405에서 `#00a2e8`이 사라졌는가 — **나머지 29건 의미색은 건드리지 않았는가**
- [ ] 펼친 그룹의 헤더와 서브행이 같은 톤인가
- [ ] 접힌 그룹 헤더가 흰 배경이 아닌가 (낱개 행과 구분되는가)
- [ ] 하위 1건인 그룹에 토글이 없는가
- [ ] 로트번호가 어느 목록에서도 잘리지 않는가 (컬럼 ≥24%)
- [ ] `*-table-row.tsx` 3개의 개별 `TableCell` 클래스가 제거됐는가 — 이게 남으면 본문 44px가 무효
- [ ] `misc-stock-table-row.tsx`의 카드 모드 분기가 그대로인가
- [ ] `BackupManager.tsx` 목록이 프리미티브 변경으로 깨지지 않았는가
- [ ] 짝수행 음영이 남아 있는 목록이 없는가
- [ ] 정렬이 기존과 동일한가 (이번 작업에서 바뀌면 안 됨)
- [ ] 감사 로그의 세로 구분선이 제거됐는가
- [ ] `docs/handoff/디자인시스템/` 1벌만 개정됐고, 잡곡 폴더엔 정본 안내 한 줄이 들어갔는가
- [ ] `tsc` · `eslint` 통과

## 범위 밖

- 모바일 카드 통일 (`mobile-package-card.tsx`, `misc-stock-table-row.tsx` 카드 모드, `farmer-list.tsx` 모바일 그룹, `stock-list-client.tsx` 모바일 카드) — 별도 검토
- 컬럼 정렬 규칙 정리 — 성격별 기준선은 시안 2절에 기록
- **`#00a2e8` 의미색 29건** — 인증 칩(`farmer-list.tsx:196`), 연락처 버튼, 필터 배지, 감사로그 총건수, 실시간 그래디언트 등. 그룹 표현과 무관한 색이므로 토큰 전환 과제로 넘긴다
- 앱 전체 slate → 토큰 전환 — 별도 과제


---

## R6 — 제품재고(CSS Grid) 목록 표준 적용 · 확정 2026-09-04

표 10곳을 표준화한 결과 `<table>`이 아닌 제품재고 목록(`packages/package-row.tsx`, `PKG_GRID`)만 밖에 남아 격차가 벌어졌다. **grid 마크업은 유지하고 타이포·밀도만 표준으로 올린다** (= 구현 측 A안).

### 왜 밀도 손실 우려를 기각했는가
현행 `text-[13px] px-4 py-3`의 실제 행 높이는 13×1.5 + 24 ≈ **43.5px**. `h-11`(44px) 고정 시 +0.5px, `py-2.5` 행만 40→44px(+4px). **한 화면 행 수는 사실상 그대로**이므로 이 화면을 예외로 둘 근거가 없다.

### 적용 값
| 위치 | 현행 | 확정 |
| --- | --- | --- |
| `:95` 컬럼 헤더 | `text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2.5 bg-slate-50/60` | `h-10 px-3 text-sm font-medium text-foreground bg-slate-50 border-b border-slate-200` |
| `:219`/`:276`/`:336` 행 | `text-[13px] px-4 py-3` (또는 `py-2.5`) | `text-sm px-3 h-11` |
| `:332` 펼친 묶음 | `bg-slate-50/60 ring-1 ring-inset ring-slate-200/70` | `bg-slate-100 border-t border-slate-200/80` (ring 제거 — 표 10곳에 없는 패턴) |

헤더 변경은 선택이 아니라 **버그 수정**이다: `uppercase tracking-wider`는 한글에 아무 효과가 없고 글자만 10.5px로 줄인다. Typography의 Micro Bold(영문 섹션 라벨) 토큰을 한글 컬럼 헤더에 오용한 것.

### 보조값 폰트 — 두 단으로만 접는다
- `text-[12.5px]` — **수치 보조값** (로트, "N종 규격", 합계 등). 기존 `[12px]`·`[11px]` 흡수
- `text-[11.5px]` — **칩/배지 전용**. 기존 `[10px]` 흡수 (`:169`, `:187`)
- 세 번째 단은 만들지 않는다. 현재 4단인 것은 기준이 아니라 눈대중의 결과다

### 범위 밖 — 기준서에 예외로 명시할 것
- **모바일 카드(`mobile-package-card.tsx`)는 건드리지 않는다.** 카드 폰트 확대는 이미 「하지 않는다」로 확정(줄 넘침). 카드와 표는 다른 밀도 문맥이므로 같은 화면에서 데스크탑/모바일 밀도가 갈리는 것은 **의도된 예외**다
- **`PKG_GRID` 컬럼 비율은 유지.** 로트 `1.4fr` ≈ 23%는 24% 기준에 사실상 부합하고, 비율 조정은 이번 범위 밖
- `PKG_GRID_SELECT`(재포장 선택 모드)는 같은 상수를 공유하므로 자동 반영 — 선택 컬럼 폭만 회귀 확인
