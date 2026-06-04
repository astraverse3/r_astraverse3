# 계획서 — 모바일 디자인 점검 후속 작업

**작성일**: 2026-06-04
**출처**: `docs/모바일-디자인점검.html` (Claude Design 핸드오프 번들)
**기준 디바이스**: iPhone 14 (390×844)

---

## 1. 작업 목표

Claude Design 모바일 점검에서 발견된 **20건**(P0 4 / P1 11 / P2 5)을 우선순위·연관성에 따라 **6개 PR 묶음**으로 나누어 순차 해결한다. 작업 단위는 점검 보고서 §"권장 PR 묶음"을 그대로 따른다.

---

## 2. P0 사전 검증 결과 (2026-06-04)

작업 착수 전 P0 4건을 실제 코드에서 모두 검증 완료. **4건 전부 진짜 버그**로 확정.

| # | 항목 | 파일:라인 | 검증 결과 |
|---|---|---|---|
| P0-1 | 템플릿 리터럴 escape 버그 | [stock-list-client.tsx:67,113](app/(dashboard)/raw-stocks/stock-list-client.tsx#L67) | `\${...}` backslash 박혀 있음 — Tailwind 클래스 문자열로만 들어가 무시됨. 확정 |
| P0-2 | 레이아웃 pb 4px 부족 | [layout.tsx:24](app/(dashboard)/layout.tsx#L24) | layout=`56+safe+16`=72+safe, nav=`60+safe+16`=76+safe → **4px 차이** 확정 |
| P0-3 | Floating Cart × BulkActionBar Y충돌 | [stock-page-wrapper.tsx:204](app/(dashboard)/raw-stocks/stock-page-wrapper.tsx#L204) · [stock-page-client.tsx:83](app/(dashboard)/raw-stocks/stock-page-client.tsx#L83) | 둘 다 `bottom-[calc(7.5rem+env(safe-area-inset-bottom))]` 동일 — 카트 우측·액션바 가운데이지만 액션바 폭 늘면 시각 겹침 발생 |
| P0-4 | 이모지 (📝) 사용 | [mobile-milling-card.tsx:178](app/(dashboard)/milling/mobile-milling-card.tsx#L178) | 비고 영역에 `📝` 그대로 — handoff §7 Voice & Tone 위반 |

---

## 3. PR 묶음 순서 및 범위

### PR-1: P0 일괄 처리 (escape + pb + 이모지)
**규모**: 4파일, ~10줄 미만 변경 / **위험**: 매우 낮음

| 항목 | 파일 | 접근 |
|---|---|---|
| P0-1 escape | `app/(dashboard)/raw-stocks/stock-list-client.tsx:67,113` | `\${` → `${` 2곳 |
| P0-2 pb | `app/(dashboard)/layout.tsx:24` | `pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)]` → `pb-[calc(60px+env(safe-area-inset-bottom)+1.5rem)]` |
| P0-4 이모지 | `app/(dashboard)/milling/mobile-milling-card.tsx:178` | `📝` → `lucide-react`의 `StickyNote` 또는 `MessageSquareText` (`w-3 h-3 text-slate-400`) |

> **P0-3은 별도 PR로 분리** (PR-2로 이동 — Floating UI 재배치는 카트 카운트 배지·우선순위 로직까지 같이 손대야 해서 묶음 부적합).

### PR-2: Floating UI 정리
**범위**: P0-3, P1(BulkActionBar 6개 → 아이콘만), P1(Cart 카운트 배지 색)

| 항목 | 파일 | 접근 |
|---|---|---|
| Cart Y 위로 이동 | `stock-page-wrapper.tsx:204` | BulkActionBar 활성 시(`selectedIds.size>0`) `bottom-[calc(12rem+safe)]` 사용 — 조건 prop으로 받기 |
| BulkActionBar 아이콘화 | `stock-page-client.tsx:80~120` | 모바일(sm 미만): 아이콘만(`w-9 h-9`) 표시, 라벨은 sm↑부터. 모바일 한해 `h-9` 보장 |
| Cart 카운트 배지 | `stock-page-wrapper.tsx:210` | `bg-red-500` → `bg-white text-primary border-2 border-primary` 또는 단순 primary. `-top-1 -right-1` → `top-0 right-0` |
| 잡곡 탭에서 Cart 숨김 (P2) | `stock-page-wrapper.tsx` | `pathname` 또는 탭 상태로 misc일 때 FAB 미렌더 |

### PR-3: Touch Target Sweep (P1 hit-area 4건)
**원칙**: 시각 변화 없이 `w-11 h-11 -m-3` 패턴으로 부모만 확장.

| 대상 | 파일:라인 |
|---|---|
| 체크박스 hit-area | `stock-list-client.tsx:558` · `mobile-milling-card.tsx:132` |
| DropdownMenu trigger | `stock-list-client.tsx:567` · `mobile-milling-card.tsx` · `packages/mobile-package-card.tsx:54` |
| MillingStatusBadge 버튼 | `mobile-milling-card.tsx:142` (`p-1.5 -m-1.5`) |
| Dialog X 버튼 (P2) | `components/ui/dialog.tsx:69` (`size-9 -m-1.5`) |

### PR-4: Tab Redesign — 벼/잡곡 Segmented (P1 2건)
> ⚠️ **사전 디자인 확인 후 진행** (사용자 결정, 2026-06-04)

**범위**: 모바일에서 segmented control 패턴, 데스크탑은 underline 유지.

- `raw-stocks/raw-stocks-tabs.tsx` — `grid grid-cols-2 p-0.5 bg-slate-100 rounded-lg` + `h-11 bg-white shadow-sm` 활성 (모바일 전용 분기)
- 활성/비활성 폰트 크기 14px 고정 → layout shift 제거
- (`packages-tabs.tsx`, `sales-tabs.tsx`는 후속 — 이번 PR은 raw-stocks만)

### PR-5: Typography Sweep (축소 — 2026-06-04 사용자 지시)
> ⚠️ **방향 변경**: 모바일 카드 본문 폰트 sweep은 **전면 제외**. 사용자 지시 —
> "도정 카드·MobileStockDetailCard는 현재 폰트 크기 유지. 폰트 키우면 한 줄에 안 들어가 **줄 넘어가는(깨지는) 게 더 큰 문제**."
> 두 카드 모두 `shrink-0`/`truncate`/`whitespace-nowrap`으로 한 줄에 욱여넣은 구조라, 폰트 상향 시 레이아웃 붕괴. → 카드는 손대지 않음.

**실제 진행 범위**: 하단 네비 라벨 + 원물 카드 레이아웃 재배치(A안).

| 파일 | 범위 | 상태 |
|---|---|---|
| `components/mobile-nav.tsx:147,211` | 비활성 라벨 `text-[9px]` → `text-[10.5px]` (`leading-none`+`max-h-3`로 wrap 위험 없음) | ✅ 완료 |
| ~~`milling/mobile-milling-card.tsx`~~ | ~~카드 본문 폰트 sweep~~ | ❌ 제외(폰트 유지) |
| `raw-stocks/stock-list-client.tsx` (MobileStockDetailCard) | **A안 적용**: 1행 테이블형 재배치 + 상태칩 제거. 폰트는 키우지 않음(컬럼화로 정리) | ✅ 완료 |
| `tsconfig.json` | `exclude`에 `docs` 추가 (핸드오프 번들 .tsx가 컴파일 대상에 잡히던 문제) | ✅ 완료 |

> **LOT 잘림 해결 — A안 채택 경위 (2026-06-04)**: 생산자명 잘림(흔치 않은 엣지케이스)을 모바일에서 어떻게 다룰지 논의 → PC tooltip의 모바일 이식은 부적합(hover 없음·탭=선택 충돌). 사용자가 Claude Design 핸드오프 번들(`docs/원물카드_상태간소화_A안/`)로 **테이블형 1행 + 상태칩 제거** 시안을 제시·채택. 상태칩(보관중/소진됨)은 카드 배경+흐림으로 대체 표현하여 가변폭 ~50px 확보 → 긴 생산자명도 안 잘림. 폰트는 상향하지 않음(사용자 "줄 넘침" 우려 존중). 드롭인 교체본 그대로 적용.

### PR-6: Dialog Shell 통일 (P1 3건 + P2 1건)
| 항목 | 파일 |
|---|---|
| sticky DialogFooter | `add-stock-dialog.tsx:138` — `<form id="...">`로 빼고 Footer 분리, `pb-[max(0.75rem,env(safe-area-inset-bottom))]` |
| `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` | add/edit-stock-dialog, start-milling-dialog 등 전반 |
| MillingCartSheet 색상 DS 정합 | `milling-cart-sheet.tsx:79` — `text-blue-600`/`bg-blue-600` → `text-primary`/`bg-primary`, 수정모드 `bg-orange-500` → `bg-amber-600` 또는 outline+칩 |
| SheetFooter safe-area | `milling-cart-sheet.tsx:128` — `pb-[max(1rem,env(safe-area-inset-bottom))]` |
| `Summary` → "요약" 텍스트 | `milling-cart-sheet.tsx:71` |
| (선택) native `confirm` → `AlertDialog` | 여러 곳 — 별도 PR로 분리 가능 |

---

## 4. 위험 요소 및 확인 사항

### 검증 방법
- PR마다 `next build` 통과 확인
- 모바일 변경은 **390×844 viewport**로 시각 확인 (사용자 실기기 확인 권장)
- PR-4(segmented)는 raw-stocks만 우선 적용 후 사용자 피드백 받고 packages/sales 확장 여부 결정

### 메모리 주의사항
- **벼 탭 디자인 점검은 이미 완료**(`5c1eed3`, `95f08f9`까지) — 본 작업은 그 후속이 아닌 **모바일 전반** 점검. 다이얼로그 색상 토큰화는 어제 이미 완료된 부분이 있으므로 PR-6 작업 전 실측 필요
- `replace-colors.js` 역방향 재사용 금지 (메모리 경고)

### 결정 사항 (2026-06-04 사용자 승인)
- ✅ PR 6단계 순서 동의
- ⚠️ **PR-4 Tab Redesign**: 사전 디자인 확인 후 진행
- 🅿️ **MillingCard 클릭 영역 단일화 (P1)**: **보류 처리 확정** — 벼탭 FN-1처럼 "추후 재검토"
- ✅ PR-1 즉시 착수

---

## 5. 산출물

- 본 계획서: `docs/plan-모바일디자인점검.md`
- 점검 원본: `docs/모바일-디자인점검.html` (사용자 업로드 예정)
- 각 PR 완료 후 `docs/worklog.md` 갱신
- 전체 완료 시 `docs/report-모바일디자인점검-{날짜}.md`

---

## 6. 승인 요청 사항

1. PR 6단계 순서 동의?
2. PR-4(Tab Segmented)는 디자인 영향이 커서 **별도 사전 확인** 후 진행할까, 아니면 일단 시안 적용 후 사용자가 보고 결정?
3. "MillingCard 클릭 영역 단일화"는 **보류 (FN처럼 추후 재검토)** 처리할까?
4. PR-1부터 즉시 착수 OK?
