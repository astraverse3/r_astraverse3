# Handoff: 원물(벼) 재고 모바일 카드 — 정보 배치 개선 + 상태칩 제거 (A안)

## Overview
`/raw-stocks`(원물·벼 재고) 화면의 **모바일 상세 카드**(`MobileStockDetailCard`) 레이아웃을 개선한다.
기존에는 한 줄에 생산자명 + LOT이 같이 들어가 둘 다 truncate 되어 **LOT 번호가 거의 항상 잘리는** 문제가 있었다.
이번 변경은 카드를 **테이블형 1행 레이아웃**으로 바꿔 톤백번호·무게를 고정폭 컬럼으로 정렬하고, **상태칩(Badge)을 제거**해 가변폭을 확보한다.

핵심 의도:
1. **톤백번호(`bagNo`)** 는 작업자가 목록에서 특정 톤백을 고를 때 시선이 가장 먼저 가는 "선택 핸들" → 고정폭 우측정렬 컬럼으로 빼 위→아래로 한 열씩 정렬.
2. **톤백번호 + 무게(`weightKg`)** 는 "이 톤백 = N kg" 라는 한 쌍의 의미 → 같은 행의 가까운 컬럼으로 배치.
3. **상태칩 제거** → 생산자/LOT 가변폭 ~50px 확보.

## About the Design Files
이 번들의 HTML 파일(`reference-시안.html`)은 **HTML로 만든 디자인 레퍼런스(프로토타입)** 다. 그대로 가져다 쓰는 프로덕션 코드가 아니라, 의도한 레이아웃·치수·동작을 보여주는 참고물이다.
실제 작업은 **기존 코드베이스(Next.js + React + Tailwind + shadcn/ui)의 패턴 그대로** 해당 컴포넌트를 수정하는 것이다. 함께 제공하는 `MobileStockDetailCard.tsx` 는 그 코드베이스 컨벤션에 맞춰 작성한 **드롭인 교체본**이다.

## Fidelity
**High-fidelity.** 색·타이포·간격·hit-area까지 최종값. 픽셀 그대로 재현하면 된다. (단, 이미 코드베이스에 있는 shadcn `Checkbox`/`Badge`/`DropdownMenu`/`Button` 과 lucide 아이콘을 그대로 사용한다.)

## 변경 대상 (정확한 위치)
- **파일**: `app/(dashboard)/raw-stocks/stock-list-client.tsx`
- **함수**: `function MobileStockDetailCard(...)` (대략 491~599행)
- **작업**: 이 함수 **전체**를 `MobileStockDetailCard.tsx` 내용으로 교체.
  - `import` / `useState` / 핸들러(`handleDelete`, `handleCardClick`) / `EditStockDialog` / 권한(`canManage`) 로직은 **그대로 유지** — 바뀌는 건 `return ( ... )` 의 레이아웃뿐이다.
  - 이 컴포넌트에서 `<Badge>` 사용이 사라지지만, **같은 파일 상단 그룹 헤더**(`group.certType` 표시)에서 `Badge` 를 계속 쓰므로 `import` 는 **삭제하지 말 것**.

## Screen / View

### 화면: 원물(벼) 재고 — 모바일, 품종 그룹 펼친 상태
- **목적**: 작업자가 품종 그룹을 펼쳐 그 안의 개별 톤백(재고)을 훑어보고 도정/출고 대상으로 선택한다.
- **맥락(상위 구조, 변경 없음)**:
  - 본문은 모바일에서 `px-0`(full-bleed). 펼친 서브목록 컨테이너: `flex flex-col gap-1.5 p-2 mx-1 mb-2 rounded-lg bg-slate-50/70`.
  - 그 안에 `MobileStockDetailCard` 들이 `gap-1.5` 로 쌓인다.
  - iPhone 14(390px) 기준 **카드 안쪽 가용폭 ≈ 346px**.

### 변경 컴포넌트: `MobileStockDetailCard` (1행 테이블형)
한 행의 컬럼 구성(좌→우), 모두 `flex items-center gap-2`(8px), 카드 패딩 `px-2.5 py-2`:

| 순서 | 요소 | 폭/정렬 | 타이포·색 |
|---|---|---|---|
| 1 | 체크박스 | `w-4 h-4` 시각, hit-area `absolute -inset-2.5`(44px) | shadcn `Checkbox`, `rounded-sm border-slate-300` |
| 2 | **톤백번호** `#{bagNo}` | `w-[34px]` 고정, `text-right`, `tabular-nums` | `font-mono font-black text-[14px] text-slate-900`; `#` 는 `text-[10px] font-bold text-slate-400` |
| 3 | 생산자 + LOT | `flex-1 min-w-0` (가변, 2줄, `truncate`) | 생산자 `font-bold text-[12.5px] text-slate-800`; LOT `font-mono text-[10px] text-slate-400 mt-0.5` |
| 4 | **무게** | `w-[52px]` 고정, `text-right`, `tabular-nums` | `font-mono font-bold text-[13px] text-slate-700`; `kg` 는 `text-[9px] font-bold text-slate-400 ml-px` |
| 5 | (상태칩 없음) | — | 상태는 카드 배경+흐림으로 표현 (아래) |
| 6 | 점세개 메뉴 | `h-6 w-6` 시각, hit-area `-inset-2.5`, `-mr-1.5` | `Button variant="ghost" size="icon"`, `MoreVertical h-4 w-4 text-slate-400` |

- **생산자 표기**: `{farmer.name}{actualFarmer ? ` (${actualFarmer})` : ''}`
- **LOT 표기**: `farmer.group?.certType === '일반' ? '관행' : (lotNo || '-')`
- **무게**: `weightKg.toLocaleString()` + `kg`

### 상태 표현 (칩 제거 → 행 스타일로 구분)
이 목록의 상태는 **보관중(`AVAILABLE`) / 소진됨(`CONSUMED`)** 2종뿐이다 (`stock-filters.tsx` 필터 옵션 기준). 상태칩 대신 **카드 컨테이너 스타일**로 구분한다(기존 코드에 이미 있는 동작):
- **선택됨**: `border-primary bg-blue-50 ring-1 ring-primary/20`
- **소진됨(consumed)**: `border-slate-200 bg-slate-50`
- **보관중(기본)**: `border-slate-200/80 bg-white`
- 또한 `!isAvailable || isCartBlocked` 일 때 **내부 래퍼에 `opacity-60`** → 소진/투입/장바구니 잠금 행이 흐려진다.
- `IN_PRODUCTION`(투입됨)은 이 화면에 노출되지 않지만, 들어와도 `!isAvailable` 분기로 자동 흐림 처리되어 안전.

## Interactions & Behavior
- **카드 탭**: `handleCardClick` — `!hideCheckbox && isAvailable && !isCartBlocked` 일 때만 선택 토글. (소진/잠금 행은 비반응)
- **체크박스**: `onSelect(checked)`; `disabled={!isAvailable || isCartBlocked}`. `onClick` 에 `stopPropagation` 으로 카드 탭과 분리.
- **점세개 메뉴**: `DropdownMenu` (정렬 `align="end"`, `w-[120px]`) → **수정**(`setEditOpen(true)`), **삭제**(`handleDelete`, `disabled` when `CONSUMED`). 트리거 `onClick` 에 `stopPropagation`.
- **수정 다이얼로그**: `EditStockDialog` (`open`/`onOpenChange` 로 제어, `trigger={null}`).
- **삭제**: `confirm()` 후 `deleteStock(stock.id)`, 결과에 따라 `toast.success/ error`.
- **반응형**: 컬럼 폭은 고정, 좁아지면 **생산자/LOT(3번)만 `truncate`** 로 줄어든다. iPhone SE(320px)에서도 컬럼은 깨지지 않음.

## State Management
- 로컬: `editOpen` (`useState<boolean>`) — 수정 다이얼로그 열림.
- 세션: `useSession()` → `canManage = hasPermission(session?.user, 'STOCK_MANAGE')`.
- 선택 상태(`selected`)·장바구니(`isInCart`)·체크박스 숨김(`hideCheckbox`)은 **부모(`GroupedStockMobileCards`)에서 props 로 주입** — 변경 없음.
- 데이터 패칭: 이 컴포넌트는 없음(부모가 그룹 펼침 시 `fetchGroupItems` 로 로드).

## Design Tokens
- **Primary**: `#2563eb` (Tailwind `primary` 설정값) / `primary/10`, `primary/20`, `primary/40`
- **Text**: slate-900 / slate-800 / slate-700 / slate-400; 보조 blue-50, slate-50
- **Font**: `Pretendard Variable` (본문), 숫자/LOT 은 `font-mono`(시스템 모노)
- **Type scale(px)**: 14(톤백번호) · 13(무게) · 12.5(생산자) · 10(LOT) · 10(# 기호) · 9(kg)
- **Spacing**: 행 간 `gap-1.5`(6px), 행 내 `gap-2`(8px), 카드 패딩 `px-2.5`(10) `py-2`(8)
- **Radius**: 카드 `rounded-lg`(8px)
- **Shadow**: `shadow-sm`
- **고정 컬럼폭**: 톤백 `w-[34px]`, 무게 `w-[52px]`, 체크박스/메뉴 `w-4`/`h-6 w-6`
- **Hit-area**: 체크박스·메뉴 트리거 `absolute -inset-2.5` 로 44px 확보

## Assets
별도 이미지 없음. 아이콘은 기존 `lucide-react`: `MoreVertical`, `Edit`, `Trash2` (그룹 헤더의 `ChevronDown/Right`, `Loader2` 는 기존 유지).

## Files
- `MobileStockDetailCard.tsx` — **A안 드롭인 교체본** (이 README의 핵심 산출물).
- `reference-시안.html` — 실제 사이즈(iPhone 14 390px) 시각 레퍼런스. 아트보드 **A · 뱃지 완전 제거**가 이번 채택안이다. (B · 점 아이콘은 미채택 비교군.)
- `design-canvas.jsx` — 레퍼런스 HTML 구동용 보조 스크립트(디자인 캔버스). 구현과 무관.

> 원본 수정 대상: `app/(dashboard)/raw-stocks/stock-list-client.tsx` 의 `MobileStockDetailCard`.
