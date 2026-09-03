# 계획서 — 목록 표준규격 통일 (데스크탑)

- 작성일: 2026-09-03
- 핸드오프: `docs/handoff/list-standard/` (README + 작업지시 + 시안)
- 상태: 승인 대기

## 1. 목표

목록 테이블 11곳의 헤더·행 스펙이 제각각이라 화면 이동 시 밀도가 튀는 문제를 없앤다.
`components/ui/table.tsx` 기본값을 표준으로 올리고, 각 목록에 흩어진 개별 클래스를 걷어낸다.

## 2. 사전 대조 결과 (구현 전 필수 절차)

시안이 낡은 스냅샷 기준인 사고가 과거 두 번 있었으므로 전수 대조를 먼저 했다.

| 항목 | 결과 |
| --- | --- |
| 대상 파일 11개 실존 | ✅ 전부 경로·이름 일치 |
| 시안이 적은 「지금 붙어 있는 클래스」 | ✅ 실물과 일치 (grep 확인) |
| 생 `<th>` 4개 파일 | ✅ `ui/table` import 0건 — 교체 필요 맞음 |
| 짝수행 음영 | ⚠️ **이미 0건** — 검수항목 자동 통과, 작업 불필요 |
| `log-list.tsx` 세로 구분선 | `border-l` 10건 — 제거 대상 맞음 |
| `ui/table` 사용처 | ⚠️ **11개** — 작업지시가 지목한 7개 외 4개 추가 발견 (아래 참조) |

### 시안과 실물의 불일치 1건

README는 「기준 페이지 = 생산자 관리」라 적어 해당 화면은 안 바뀌는 것처럼 읽히지만,
`farmer-list.tsx`의 헤더는 현재 shadcn 기본값(`text-sm` 14px / `font-medium` 500 / `text-foreground` slate-900 / `px-2`)이다.
**기준으로 삼은 것은 여백감뿐이고 타이포·패딩은 기준 페이지도 함께 바뀐다.** (13px / 700 / slate-500 / px-3)

### 시안의 누락 2건 — 본문 행 파일이 통째로 빠져 있다

`ui/table`을 import하는 파일은 11개인데, 작업지시 R3 표는 그중 **헤더가 있는 7개만** 지목했다.
목록 3곳은 본문 행이 별도 컴포넌트로 분리돼 있어 `TableHead`는 클라이언트 파일에, `TableCell`은 row 파일에 있다.

| 누락 파일 | TableCell | 현재 박혀 있는 것 |
| --- | --- | --- |
| `milling/milling-table-row.tsx` | 23 | `py-3 px-3 text-sm font-mono text-slate-500`, `text-slate-800` |
| `raw-stocks/misc/misc-stock-table-row.tsx` | 25 | `text-xs text-slate-400`, `text-xs tabular-nums` |
| `raw-stocks/stock-table-row.tsx` | 21 | `py-2 px-1 text-xs font-medium text-slate-500`, `text-slate-800` |

→ **헤더만 정리하면 「본문 행 44px / 13.5px」 스펙은 달성 불가**이고 검수 체크리스트 1번을 통과할 수 없다.
R3a 대상을 7개 → **10개**로 확장한다.

추가로 `components/admin/BackupManager.tsx`(TableCell 11)는 시안 범위 밖 화면이지만
프리미티브 변경의 영향을 그대로 받는다. 클래스는 손대지 않되 **회귀 확인 대상에 포함**한다.

## 3. 방향 결정 — 색상 표기는 토큰, 픽셀은 시안 그대로

시안은 `slate-500`/`slate-50`/`slate-700` 생색을 프리미티브에 박으라고 하지만,
현행 `ui/table.tsx`는 시맨틱 토큰(`text-foreground`, `hover:bg-muted/50`) 기반이고
백로그 §22(`bg-background`→`bg-card`)·벼탭 정렬(→`primary`)도 토큰 방향이었다.

`app/globals.css`를 확인한 결과 **이 프로젝트의 토큰 값이 애초에 slate 팔레트**라, 둘은 충돌이 아니다.

| 시안 표기 | 채택 토큰 | 실제 값 | 일치 |
| --- | --- | --- | --- |
| `text-slate-500` | `text-muted-foreground` | `#64748b` (slate-500) | 정확 |
| `bg-slate-50` (헤더) | `bg-secondary` | `#f8fafc` (slate-50) | 정확 |
| `text-slate-700` (본문) | `text-card-foreground` | `#334155` (slate-700) | 정확 |
| `border-slate-200` (헤더 하단) | `border-border` | `#e2e8f0` (slate-200) | 정확 |
| `text-slate-900` (대표값) | `text-foreground` | `#0f172a` (slate-900) | 정확 |
| `hover:bg-slate-50` | `hover:bg-secondary` | `#f8fafc` | 정확 |
| `border-slate-100` (행 구분) | `border-border/60` | 근사 | **근사** |
| `text-slate-400` (보조 숫자) | `text-muted-foreground/70` | 근사 | **근사** |

→ 시각 결과물은 시안과 동일. 표기만 토큰이라 §22 방향과도 어긋나지 않는다.

**전면 토큰화는 하지 않는다.** 앱 전체 slate 하드코딩 1,953건 / 토큰 328건으로,
그건 이번 작업과 무관한 별도 대형 과제다. 이번엔 프리미티브 1개 파일에서만 토큰을 쓴다.
호출부(R3)는 클래스를 **삭제**하는 작업이라 색 표기 논쟁이 발생하지 않는다.

## 4. 변경 범위

### R1 — 공통 프리미티브 (1파일)

`components/ui/table.tsx`

```
TableHead: h-10 px-3 text-[13px] font-bold text-muted-foreground whitespace-nowrap align-middle
TableCell: h-11 px-3 text-[13.5px] text-card-foreground align-middle whitespace-nowrap
TableRow:  border-b border-border/60 hover:bg-secondary transition-colors
```

- 정렬 기본값은 두지 않는다 — 호출부의 `text-left/center/right`가 결정 (현행 유지 원칙)
- `TableHead`의 기존 `text-left` 기본값 제거 여부는 R3 진행 중 회귀 확인 후 판단 (기본값을 빼면 명시 안 한 헤더가 틀어질 수 있음 → **일단 유지**)
- Tailwind 임의 값(`text-[13px]`)은 이 파일 안에서만 사용, 호출부로 퍼뜨리지 않는다

### R2 — 셀 클래스 규약

작업지시 R2 표를 그대로 따르되 색만 토큰으로 치환. 코드 변경 없음(적용 기준).

### R3a — 개별 클래스 삭제 (10파일)

| 파일 | 삭제 대상 |
| --- | --- |
| `admin/farmers/farmer-list.tsx` | td의 `text-sm` 축소 클래스 |
| `raw-stocks/stock-list-client.tsx` | `py-2 px-1 text-xs font-bold text-slate-500` |
| `raw-stocks/misc/misc-stock-list-client.tsx` | 동일 |
| `milling/milling-list-client.tsx` | `py-3 px-3 text-sm font-bold text-slate-500` |
| `milling/stock-list-dialog.tsx` | `px-1 text-xs font-bold text-slate-500` (sticky 유지) |
| `sales/release/release-history-list.tsx` | `py-2 text-xs font-bold text-slate-500`, 중첩표 `text-[11px]`·`h-9` |
| `admin/varieties/variety-list-client.tsx` | `font-bold text-slate-500` |
| `milling/milling-table-row.tsx` | **(시안 누락)** `py-3 px-3 text-sm text-slate-500`, `text-slate-800` |
| `raw-stocks/misc/misc-stock-table-row.tsx` | **(시안 누락)** `text-xs text-slate-400` 등 |
| `raw-stocks/stock-table-row.tsx` | **(시안 누락)** `py-2 px-1 text-xs text-slate-500`, `text-slate-800` |

`*-table-row.tsx` 3개는 본문 셀 담당이므로 헤더 파일과 **반드시 짝으로** 처리한다.
`misc-stock-table-row.tsx`는 카드 모드도 함께 들어 있다 — **카드 모드 부분은 범위 밖이므로 건드리지 않는다.**

**보존 필수**: `text-left/center/right`, `w-[..]`, `hidden sm:table-cell` 등 반응형 표시 제어.

### R3b — 생 `<th>` → `ui/table` 교체 (4파일)

| 파일 | `<th>` | 비고 |
| --- | --- | --- |
| `admin/logs/log-list.tsx` | 7 | `border-l` 10건 제거, `px-5`→`px-3` |
| `admin/product-types/product-type-page-client.tsx` | 14 | `py-1.5 px-3` / `py-2 px-2 font-medium` |
| `statistics/stock/_parts/stock-tables.tsx` | 24 | `py-2.5 px-3 font-semibold text-slate-500 text-xs` |
| `components/statistics/MillingTable.tsx` | 2 | 그룹 헤더 `<tr className="bg-slate-50">` 포함 |

### 부수 정리 1건

`milling/stock-list-dialog.tsx:311` — sticky `TableHeader`의 `bg-white` → `bg-card` (§22 준수, 다이얼로그 배경 토큰 규칙)

## 5. 진행 순서

1. **R1** 프리미티브 수정 → dev 화면에서 farmer-list 1곳만 눈으로 확인 (기준선 검증)
2. **R3a** 7파일 클래스 삭제 → 화면별 회귀 확인
3. **R3b** 4파일 컴포넌트 교체 → 화면별 회귀 확인
4. 검수 체크리스트 → 커밋

R1 직후 한 번 끊고 사용자 확인을 받는다. 프리미티브라 전 목록에 파급되므로 여기서 틀리면 전부 틀린다.

## 6. 범위 밖

- **컬럼 정렬** — 성격별 기준선(텍스트 좌·숫자 우·상태 중앙)은 시안 2절에 기록만, 이번엔 손대지 않음
- **모바일 카드** — `mobile-package-card.tsx`, `misc-stock-table-row.tsx` 카드 모드, `farmer-list.tsx` 모바일 그룹, `stock-list-client.tsx` 모바일 카드
- **앱 전체 slate → 토큰 전환** (1,953건, 별도 과제)

## 7. 검수 체크리스트

- [ ] 헤더 40px / 본문 44px (2줄 셀 예외 제외)
- [ ] 헤더 텍스트 13px / 700 / muted-foreground
- [ ] 로트번호가 어느 목록에서도 잘리지 않음 (폭 ≥210px)
- [x] 짝수행 음영 없음 — 사전 확인 완료 (0건)
- [ ] **정렬이 기존과 동일** (바뀌면 회귀)
- [ ] 감사 로그 세로 구분선 제거
- [ ] `bg-white` 잔존 없음 (stock-list-dialog)
- [ ] `BackupManager.tsx`(시안 범위 밖) 목록이 깨지지 않았는가
- [ ] `misc-stock-table-row.tsx` 카드 모드가 그대로인가
- [ ] `tsc` · `eslint` 통과 (dev 검증에 `next build` 금지)

## 8. 리스크

| 리스크 | 대응 |
| --- | --- |
| 프리미티브 변경이 시안 범위 밖 화면에 파급 | 전수 grep 완료 — `components/admin/BackupManager.tsx` 1건. 클래스는 미변경, 회귀 확인만 |
| 헤더/본문이 다른 파일에 있어 반쪽 적용 | R3a를 10파일로 확장, 헤더-row 짝 단위로 커밋 |
| `misc-stock-table-row.tsx`의 카드 모드까지 건드림 | 카드 모드는 범위 밖 — 테이블 분기만 수정 |
| 클래스 삭제 중 정렬·폭 동반 삭제 → 회귀 | 삭제는 색·크기·패딩 토큰만, `text-*`/`w-[..]`는 손대지 않음 |
| `TableHead` 기본 `text-left` 제거 시 헤더 틀어짐 | 기본값 유지로 회피 |
