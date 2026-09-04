# 땅끝황토친환경 재고관리 시스템 — 디자인 기준서

> **대상**: Claude Code (자동 코드 생성용) + 사람 개발자
> **스택**: Next.js 16.1.3 (App Router) · React 19.2.3 · Tailwind CSS v4 · shadcn/ui · lucide-react · TypeScript

---

## 목차

1. [Foundations](#1-foundations)
2. [Iconography](#2-iconography)
3. [Layout](#3-layout)
4. [Components](#4-components)
5. [Patterns](#5-patterns)
6. [Motion](#6-motion)
7. [Voice & Tone](#7-voice--tone)

---

## 1. Foundations

### 1.1 Color

#### Brand
- `--brand`: **`#2563eb`** (Blue-600) — 주요 액션, active 상태, 브랜드 인디케이터
- 레거시 `#00a2e8`은 **사용 금지**. 기존 코드에서 발견 시 모두 `--brand`로 교체.
  - 단, **그룹 펼침 배경**의 `#00a2e8`은 `--brand`가 아니라 **slate 묶음톤으로 제거**한다 (§4.2.6 NOTE). 의미색으로 쓰인 나머지는 토큰 전환 과제로 남긴다.

#### Semantic (shadcn 기준)

```css
/* globals.css — light */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;        /* slate-900 */
  --muted: 210 40% 96.1%;              /* slate-100 */
  --muted-foreground: 215.4 16.3% 46.9%; /* slate-500 */
  --border: 214.3 31.8% 91.4%;         /* slate-200 */
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;           /* blue-600 */
  --primary: 221.2 83.2% 53.3%;        /* #2563eb */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... */
}
```

#### 상태 색상 (Tailwind direct)
| 용도 | 클래스 | 비고 |
|---|---|---|
| 성공/완료 | `emerald-500` / `emerald-50` | 출고·완료 배지 |
| 주의 | `amber-500` / `amber-50` | 2025년산, 유통기한 임박 |
| 경고 | `red-500` / `red-50` | 재고 부족, 에러 |
| 중성 태그 | `slate-100` / `slate-500` | LOT 칩, 필터 칩 |

### 1.2 Typography

**폰트**: Pretendard Variable (웹) — subset 버전 권장
```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');

html { font-family: 'Pretendard Variable', -apple-system, system-ui, sans-serif; }
```

#### 스케일
| Role | size / line-height | weight | 용도 |
|---|---|---|---|
| Display | `text-2xl` (24px) / 1.3 | 700 | 로그인·랜딩 히어로 |
| H1 (Page title) | `text-xl` (20px) / 1.4 | 700 | 페이지 헤더 타이틀 |
| H2 | `text-lg` (18px) / 1.4 | 700 | 카드/섹션 헤더 |
| H3 | `text-base` (16px) / 1.5 | 600 | 다이얼로그 타이틀 |
| Body | `text-sm` (14px) / 1.5 | 400/500 | 기본 본문·버튼 |
| Caption | `text-xs` (12px) / 1.4 | 500 | 필터 칩·메타·서브 |
| Micro | `text-[11px]` / 1.3 | 500 | LOT 번호·보조 라벨 |
| Micro bold | `text-[10px]` / 1.3 | 700 + uppercase + `tracking-wider` | 섹션 그룹 헤더 ("MAIN MENU") |

#### 숫자 표기
수량·날짜 등 숫자는 반드시 **`tabular-nums`** 유틸 적용. 정렬이 흔들리지 않게.
```tsx
<span className="tabular-nums">{qty}</span>
```

### 1.3 Spacing

Tailwind 기본 4px 스케일. 내부 일관성을 위해 사용하는 값만 열거:
- 내부 패딩: `2`(8) / `2.5`(10) / `3`(12) / `4`(16) / `5`(20) / `6`(24)
- 섹션 간격: `gap-2`, `gap-3`, `gap-4`, `space-y-1`, `space-y-4`, `space-y-6`

### 1.4 Radius

| 토큰 | 값 | 용도 |
|---|---|---|
| `rounded` | 4px | 기본 |
| `rounded-md` | 6px | 버튼, 작은 카드 |
| `rounded-lg` | 8px | 카드 (default, `--radius`) |
| `rounded-xl` | 12px | 큰 카드, 모달 |
| `rounded-2xl` | 16px | 모바일 네비 바 |
| `rounded-full` | — | 칩, 아바타, FAB |

### 1.5 Shadow

| 토큰 | 값 | 용도 |
|---|---|---|
| `shadow-sm` | 기본 카드 | 테이블 행, 정적 카드 |
| `shadow` | 팝오버 | Dropdown, Tooltip |
| `shadow-lg` | 모달 | Dialog, Sheet |
| 커스텀 모바일 네비 | `0 4px 24px rgba(0,0,0,0.10)` | 플로팅 Goo blob 바 |
| 커스텀 헤더 | `0 4px 16px rgba(99,102,241,0.06)` | 모바일 상단 헤더 |

---

## 2. Iconography

### 2.1 라이브러리 규칙

**lucide-react 고정**. 프로젝트 어디서도 다른 아이콘 팩 도입 금지. 예외는 단 하나 — **Set C 듀오톤** (아래).

```tsx
import { Package, ClipboardList, Boxes, ShoppingCart, BarChart3 } from 'lucide-react';
```

### 2.2 Set C — 핵심 5 메뉴 듀오톤 아이콘

**원물재고 / 도정관리 / 제품재고 / 판매관리 / 통계** 이 5개 메뉴에만 적용.
- 비활성: stroke-only (lucide와 동일 톤)
- 활성: 내부가 `currentColor`로 채워짐 → 사이드바/네비의 active 상태를 **아이콘 자체로도** 강조

이 5개 아이콘은 **커스텀 SVG 컴포넌트**로 작성합니다 (`components/icons/duotone/`). 원본 SVG 경로는 `design-system.html` 에서 시각 확인 후 추출. lucide-react와 같은 props 인터페이스 (`className`, `strokeWidth`)를 제공하되 `active?: boolean` prop을 추가:

```tsx
// components/icons/duotone/RawStock.tsx
type DuotoneIconProps = {
  className?: string;
  strokeWidth?: number;
  active?: boolean;
};

export function RawStockIcon({ className, strokeWidth = 1.8, active = false }: DuotoneIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M12 4a7 7 0 0 1 7 7c0 .5-.1 1-.2 1.4C17 13 14.6 11 12 11s-5 2-6.8 1.4C5.1 12 5 11.5 5 11a7 7 0 0 1 7-7Z"
        fill={active ? 'currentColor' : 'none'} />
      <path d="M5 14c1.5 3 3.5 6 7 6s5.5-3 7-6" />
    </svg>
  );
}
```

모든 5개 SVG 원본은 `design-system.html` 의 "Iconography" 섹션 참조.

### 2.3 시스템/유틸 메뉴

**홈·품종 관리·생산자 관리·관리자 메뉴·알림·설정** 등은 **lucide-react 원본** 그대로. 얇은 라인(stroke-width 1.8) 유지.

```tsx
<Home strokeWidth={1.8} className="w-4 h-4" />
```

### 2.4 아이콘 크기 규칙

| 자리 | 크기 |
|---|---|
| 사이드바 메뉴 | `w-4 h-4` (16px) |
| 헤더 액션 버튼 | `w-4 h-4` (16px) |
| 카드 내부 | `w-3.5 h-3.5` (14px) |
| 모바일 네비 비활성 | 20px |
| 모바일 네비 활성 | 18px (축소) + 라벨 페이드아웃 |

---

## 3. Layout

### 3.1 PC 사이드바

- **너비**: `w-64` (256px)
- **배경**: `bg-white` + `border-r border-slate-200`
- **내부 패딩**: `p-6`
- **로고**: 상단 `mb-10`, `h-10 w-auto`

**섹션 구조**:
```
[로고]

MAIN MENU
  홈 (lucide Home)
  원물재고 (Set C)
  도정관리 (Set C)
  제품재고 (Set C)
  판매관리 (Set C)
  통계 ▾ (Set C)
    └ 수율분석 / 재고분석 / 판매분석

  (밀어내기 / border-t)

MANAGEMENT
  품종 관리 (lucide Leaf)
  생산자 관리 (lucide Users)
  관리자 메뉴 ▾ (lucide Server)
    └ 사용자 관리 / 공지사항 관리 / 활동 로그 / 시스템 백업
```

**메뉴 아이템 스펙**:
```tsx
// 기본
"w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg
 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"

// active
"bg-blue-50 text-blue-600"   // (blue-50 = primary-50 상응)
```

**섹션 그룹 헤더**:
```tsx
"px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider"
```

### 3.2 모바일 하단 네비 (Goo blob)

- **포지션**: `fixed bottom-0` + `px-4 pb-4` (safe-area 고려 시 `pb-[max(1rem,env(safe-area-inset-bottom))]`)
- **바**: `h-[60px] rounded-full bg-white border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.10)]`
- **5탭 (홈 제거)**: 원물·도정·제품·판매·통계
- **Blob**: 42×42, `bg-primary`, SVG `filter: url(#nav-goo)` 로 ghosting 잔상 효과 (popmotion · cubic-bezier easing)
- **활성 상태**: 라벨 페이드 아웃 + 아이콘 18px 축소 + 흰색 렌더

**구현 포인트**:
- Blob의 `transform: translateX(px)` 를 `cubic-bezier(0.34,1.56,0.64,1)` (overshoot 있는 back.out) 로 이동
- 뒤따르는 "잔상" blob은 60ms delay + `cubic-bezier(0.25,0.46,0.45,0.94)` 로 부드럽게 쫒아옴
- 초기 마운트 시 `transition: none` 상태에서 위치를 맞춘 뒤 `ready=true`가 되면 transition 활성

### 3.3 헤더 — 1줄 브레드크럼 패턴

페이지 상단 헤더는 **한 줄**로 통일. 왼쪽에서 오른쪽으로 밀도가 점점 낮아짐:

```
[icon] 제품재고  /  잡곡  ·  제품으로 포장된 재고를 품목별로 조회하고, 매입·포장 내역을 관리합니다.
```

- **아이콘**: 현재 페이지의 Set C 아이콘 (사이드바 active와 시각 언어 일치)
- **타이틀**: `text-base font-bold text-slate-900`
- **구분자**: `/` (슬래시, `text-slate-300`)
- **서브컨텍스트**: `text-sm font-medium text-slate-600` (탭으로 선택된 값)
- **미들도트**: `·` (slate-300)
- **설명**: `text-xs text-slate-500 truncate` (좁은 화면에서 먼저 줄어듬)

**높이**: `h-12`, `border-b border-slate-200`, `bg-white`, `px-6`

### 3.4 헤더 액션 버튼 세트

목록 페이지 오른쪽 상단의 **업로드 · 다운로드 · 검색 · 추가** 세트. 기존 milling.log 앱의 스타일과 통일:

| 버튼 | 스타일 | 아이콘 | 용도 |
|---|---|---|---|
| 업로드 | `w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-md` | `Upload` | 엑셀 업로드 |
| 다운로드 | 동일 | `Download` | 엑셀 다운로드 |
| 검색 | `h-8 pl-3 pr-2 bg-blue-50 border border-blue-200 text-primary font-semibold rounded-md` + 카운트 배지 | `SlidersHorizontal` | 검색/필터 다이얼로그 열기 |
| 추가 | `h-8 px-3 bg-primary text-primary-foreground font-semibold rounded-md` | — | `+ 포장하기`, `+ 매입 등록` 등 페이지별 액션 |

**검색 버튼 활성 카운트 배지** — 적용된 필터 개수를 우측에 원형 배지로 표시:
```tsx
<Button variant="outline" className="h-8 pl-3 pr-2 bg-blue-50 border-blue-200 text-primary">
  <SlidersHorizontal className="w-3.5 h-3.5" />
  검색
  <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-white text-[10px] font-bold text-primary border border-blue-200">
    {filterCount}
  </span>
</Button>
```

---

## 4. Components

### 4.1 Tabs — F안 (애니메이션 하이라이트)

`벼 / 잡곡` 같은 최상위 구분 탭. 선택 시 텍스트·아이콘이 **커지는** 애니메이션 + 아래 2.5px 바.

```tsx
// 비활성
"inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold
 text-slate-400 hover:text-slate-600 transition-all duration-200"

// 활성
"text-slate-900"
// 아이콘: scale-110
// 텍스트: text-[14px]
// 바: absolute left-2 right-2 bottom-[-1px] h-[2.5px] bg-slate-900 rounded-full
```

shadcn `Tabs` 컴포넌트의 `TabsList`/`TabsTrigger` 위에 **커스텀 스타일로 override**해서 구현. `data-[state=active]` 변종을 활용.

### 4.2 테이블 — 품종 그룹 펼침 패턴 (그룹 + 낱개 혼합)

> **2026-09-03 「목록 표준규격」 적용본.** 앱 전체 목록 11곳의 헤더·행 스펙을 하나로 통일하면서
> 이 절도 그 표준값으로 개정했다. 아래 값의 **단일 정본은 `components/ui/table.tsx` 프리미티브**이고,
> 이 문서는 그것이 렌더되는 값을 기술한다. 개별 화면에서 헤더·셀 클래스를 덧붙이지 않는다.
>
> 🔴 **이 절의 CSS Grid 마크업 자체는 유지한다.**
> 다만 **타이포·밀도는 `<table>` 목록과 같은 값**으로 맞춘다. 구조와 밀도는 분리 가능한 문제이고,
> 화면을 옮길 때 글자 크기가 튀지 않는 것이 이 표준의 목적이다.
> **2026-09-04 제품재고 화면(`packages/package-row.tsx`, `PKG_GRID`)에 적용 완료** — 백로그 §30 닫힘.
>
> 참고: 제품재고만 grid인 것은 설계 판단이 아니라 **만든 시점 차이**다. 벼(04-29)·잡곡(04-30) 원물재고는
> 문서 없이 `<table>`로 먼저 만들어졌고, 제품재고(05-04 `ebd7886`)만 이 §4.2를 받아 그 마크업을 따랐다.
> 「`<table>`로 표현하기 어렵다」는 사실이 아니다(잡곡이 나흘 먼저 table로 같은 펼침 그룹을 구현했다).
> 다만 grid에는 **그룹 헤더를 `<button>`으로 감쌀 수 있다**는 이점이 실제로 있다 —
> `<table>`에서는 `<tr>`을 `<button>`으로 감쌀 수 없어 다른 세 화면은 `<TableRow onClick>`으로 처리했다.

**표준값 요약** (`<table>` 목록과 공통)

| 항목 | 값 |
| --- | --- |
| 헤더 | `h-10`(40px) · `px-3` · `text-sm`(14px) · `font-medium` · `text-foreground` · 좌측정렬 |
| 헤더 배경 | `bg-slate-50` + `border-b border-slate-200` — **호버에 반응하지 않는다** |
| 본문 셀 | `h-11`(44px) · `px-3 py-0` · `text-sm` · `text-slate-700` |
| 본문 행 | `border-b border-slate-100` + 호버 `bg-slate-50`. **짝수행 음영 없음** |
| 그룹 헤더 행 | 본문과 같은 **44px** (`h-12` 금지) |
| 컬럼 폭 | `<table>`은 `colgroup` % + `table-layout:fixed`, grid는 `fr` 비율 유지. 로트 컬럼 **≥24%** 비중 |
| 로트번호 | `font-mono text-[12.5px] text-slate-500` |

#### 4.2.1 데이터 구조

서버에서 **GROUP BY 결과 + 낱개 행이 섞인 형태**로 내려옴. 한 품종에 규격이 2개 이상이면 그룹으로 묶이고, 1개뿐이면 낱개 행으로 그대로 표시.

```ts
type InventoryItem =
  | {
      type: 'group';
      variety: string;
      total: number;       // 합계 kg
      rows: InventoryRow[]; // 2개 이상의 규격 행
    }
  | ({ type: 'single'; variety: string } & InventoryRow);

type InventoryRow = {
  spec: string;        // 5kg, 1kg, 500g …
  qty: number;         // 포 수
  producer: string;
  lot: string;         // '—' 가능
  date: string;
  sub: number;         // 행 합계 kg
};
```

#### 4.2.2 시각 원칙

- **단일 테이블**: 그룹 헤더·서브행·낱개 행을 모두 **하나의 그리드(같은 컬럼 배치)** 안에 흘림. 그룹과 낱개가 어색하게 분리되지 않도록.
- **공통 그리드**: `grid-cols-[1.1fr_0.7fr_0.7fr_1fr_1.2fr_0.9fr_0.9fr]` (품종 / 규격 / 개수 / 생산자 / 로트 / 날짜 / 합계)
- **행 높이 44px 고정**: 낱개 행 · 그룹 헤더 행 · 서브행이 **모두 같은 높이**. 그룹 헤더를 크게 만들지 않는다.
- **펼쳐진 그룹은 한 덩어리**: 그룹 헤더 + 서브행에 **같은 `bg-slate-100`** 을 주고, 묶음 위쪽에 `border-t border-slate-200/80`. 시안톤(primary) 강조 X.
- 🔴 **묶음 안에서도 행 구분선은 유지한다** — `border-b border-slate-200/70`.
  묶음톤 위에서 기본 `border-slate-100`은 보이지 않으므로 **색을 `/70`으로 올려서** 준다.
  > **2026-09-04 개정 — 초안을 뒤집었다.** 초안은 「내부 경계를 `border-b-0`으로 지운다」였으나,
  > 실화면에서 **행이 구분되지 않는 회색 덩어리**가 됐다(제품재고 9줄 그룹에서 먼저 드러났고,
  > 이어서 원물재고·생산자관리도 같은 판단으로 되돌렸다).
  > **묶음은 배경색이 표현하고, 행 구분은 선이 한다 — 둘은 서로 다른 일이다.**
  > 선을 지워서 얻는 「일체감」보다 행을 못 읽는 손해가 크다.
  > ⚠️ 초안의 `bg-slate-50/75`는 흰 배경과 **밝기 차이가 2%**라 실화면에서 묶음으로 읽히지 않았다.
  > `bg-slate-100`(약 5.5%)으로 확정 — 실화면 확인을 거친 값이다.
  > `ring-1 ring-inset ring-slate-200/70`은 쓰지 않는다 → `border-t`.
- **접힌 그룹은 흰 배경 금지**: `bg-slate-50` + `border-y border-slate-200/80`. 낱개 행과 구분돼야 한다.
- **단일 건 그룹은 그룹을 만들지 않는다**: 하위가 1건이면 헤더·토글 없이 낱개 흰 행(`bg-white hover:bg-slate-50`)으로 흘린다.
- **서브행에서 그룹 키와 중복되는 컬럼은 비운다**: 그룹이 이미 말해 준 값(년도·작목반·인증번호 등)을 서브행에서 반복하지 않는다.
  **묶음을 인지시키는 데는 배경색보다 이쪽이 훨씬 효과적이다.**
- **서브행의 첫 컬럼**은 들여쓰기로 그룹 소속임을 표시. 토글 자리는 첫 컬럼 안에서만 비움 → 그리드는 깨지지 않음.

#### 4.2.3 컬럼 헤더

```tsx
<div className="grid grid-cols-[1.1fr_0.7fr_0.7fr_1fr_1.2fr_0.9fr_0.9fr]
                h-10 items-center px-3 text-sm font-medium text-foreground
                bg-slate-50 border-b border-slate-200">
  <span>품종</span><span>규격</span><span>개수</span>
  <span>생산자</span><span>로트</span><span>날짜</span>
  <span className="text-right">합계</span>
</div>
```

> **옛 값** `text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2 bg-slate-50/60`은
> Typography의 **Micro Bold(섹션 그룹 헤더)** 토큰이었다 — 영문 라벨("MAIN MENU")용을 한글 헤더에 쓰고 있었다.
> `uppercase`·`tracking-wider`는 한글에 아무 효과가 없고 글자만 10.5px로 작아진다.
>
> **`text-slate-900`이 아니라 `text-foreground`인 이유**: 두 값은 같지만(#0f172a) 토큰 방향(§22)을 보존한다.
> 스펙에 slate-900으로 적힌 것은 **렌더 값 표기**이며, 새 하드코딩을 넣으라는 뜻이 아니다.

#### 4.2.4 낱개 행 (`type: 'single'`)

흰 배경, 좌측 토글 자리는 폭만 잡고 비워 두어 그룹 행과 정렬을 맞춤.

```tsx
<div className="grid grid-cols-[1.1fr_0.7fr_0.7fr_1fr_1.2fr_0.9fr_0.9fr]
                h-11 items-center px-3 text-sm text-slate-700
                bg-white hover:bg-slate-50 border-b border-slate-100">
  <span className="font-semibold text-slate-900 flex items-center gap-2">
    <span className="w-3.5 inline-block" /> {/* 토글 자리 비움 */}
    {it.variety}
  </span>
  <span>{it.spec}</span>
  <span className="tabular-nums">{it.qty}포</span>
  <span className="text-slate-600">{it.producer}</span>
  <span className="font-mono text-[12.5px] text-slate-500">{it.lot}</span>
  <span className="text-slate-500 tabular-nums">{it.date}</span>
  <span className="tabular-nums font-semibold text-right">{it.sub}kg</span>
</div>
```

#### 4.2.5 그룹 헤더 행 (`type: 'group'`)

같은 그리드·같은 높이(44px). 좌측에 `▶/▼` 토글, 합계만 굵게 강조. 규격·생산자·로트·날짜 컬럼은 `—` (그룹 단계에선 단일 값이 없음).

접힘/펼침의 배경이 다르다 — 접힘은 `bg-slate-50`, 펼침은 묶음톤 `bg-slate-100`.

```tsx
<button onClick={toggle}
  className={`w-full grid grid-cols-[1.1fr_0.7fr_0.7fr_1fr_1.2fr_0.9fr_0.9fr]
             h-11 items-center px-3 text-sm text-left transition-colors cursor-pointer
             ${isOpen
               ? 'bg-slate-100 hover:bg-slate-200/70 border-t border-slate-200/80 border-b-0'
               : 'bg-slate-50 hover:bg-slate-100 border-y border-slate-200/80'}`}>
  <span className="font-bold text-slate-900 flex items-center gap-2">
    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform
      ${isOpen ? 'rotate-90 text-slate-700' : 'text-slate-400'}`} />
    {it.variety}
  </span>
  <span className="text-slate-400 text-[11.5px]">{it.rows.length}종 규격</span>
  <span className="tabular-nums text-slate-400 text-[11.5px]">
    {it.rows.reduce((a, r) => a + r.qty, 0)}포
  </span>
  <span className="text-slate-300">—</span>
  <span className="text-slate-300">—</span>
  <span className="text-slate-300">—</span>
  <span className="tabular-nums font-bold text-slate-900 text-right">{it.total}kg</span>
</button>
```

> 하위가 **1건뿐이면 이 헤더를 렌더하지 않는다.** 토글할 것이 없는 그룹은 만들지 않고 §4.2.4 낱개 행으로 흘린다.

#### 4.2.6 펼쳐진 그룹의 일체감 처리

**그룹 헤더와 서브행에 같은 `bg-slate-100`** 을 주어 "한 묶음"임을 표현한다.
묶음 **위쪽에** `border-t border-slate-200/80`을 두어 앞 행과 끊는다.

🔴 **묶음 안의 행 구분선은 지우지 않는다** — 서브행에 `border-b border-slate-200/70`.
묶음톤 위에서 기본 `border-slate-100`은 보이지 않으므로 색을 한 단 올려서 준다.

> **2026-09-04 — 초안을 뒤집었다.** 초안은 「내부 경계를 `border-b-0`으로 지운다.
> 가로선이 남으면 묶음이 다시 잘려 보인다」였다. 실제로는 반대였다:
> 선을 지우자 **행을 셀 수 없는 회색 덩어리**가 됐다(제품재고 한 품종 9줄에서 먼저 드러났다).
> **묶음은 배경색이, 행 구분은 선이 한다.** 하나로 두 가지를 하려다 둘 다 잃었다.
> 적용: `package-row.tsx` · `stock-table-row.tsx` · `misc-stock-table-row.tsx` · `farmer-list.tsx`.

**서브행에도 호버를 준다** — `hover:bg-slate-200/70`(묶음톤보다 한 단 어둡게).
🔴 묶음톤 위에 **더 밝은** 호버·배경을 얹으면 얼룩으로 보인다. 그룹 헤더의 호버도 펼침 상태에서는
`hover:bg-slate-50`이 아니라 `hover:bg-slate-200/70`으로 분기해야 한다.

```tsx
{/* 그룹 헤더 행 (위 4.2.5, isOpen=true) */}
{isOpen && it.rows.map((r, i) => (
  <div className={`grid grid-cols-[1.1fr_0.7fr_0.7fr_1fr_1.2fr_0.9fr_0.9fr]
                  h-11 items-center px-3 text-sm text-slate-600
                  bg-slate-100 hover:bg-slate-200/70 border-b-0
                  ${i === it.rows.length - 1 ? 'border-b border-slate-200/80' : ''}`}>
    <span className="flex items-center gap-2 pl-5">
      <span className="w-2 h-px bg-slate-300" />
      <span className="text-[12.5px] text-slate-400">규격</span>
    </span>
    <span className="font-medium text-slate-700">{r.spec}</span>
    <span className="tabular-nums">{r.qty}포</span>
    {/* 생산자·로트가 그룹 키와 같으면 비운다 — 반복하지 않는다 */}
    <span className="text-slate-600">{r.producer}</span>
    <span className="font-mono text-[12.5px] text-slate-500">{r.lot}</span>
    <span className="text-slate-500 tabular-nums">{r.date}</span>
    <span className="tabular-nums font-semibold text-slate-700 text-right">{r.sub}kg</span>
  </div>
))}
```

> **NOTE — 시안톤(`#00a2e8`)의 경위**
> 초기 시안은 펼친 그룹을 시안톤(`#e6f6fd` / `border-primary/40`)으로 강조했으나, 같은 테이블 안에
> 낱개 행이 섞이면 톤이 어긋나 보여 slate로 톤다운했다. **primary 액센트는 사용하지 않는다.**
>
> 그럼에도 **생산자 관리 화면에는 `bg-[#00a2e8]/20` 그룹 헤더와 `/7` 서브행이 남아 있었고**,
> 2026-09-03 목록 표준규격 작업(R3)에서 위 slate 클래스로 교체하며 제거했다.
> 🔴 **같은 화면의 나머지 `#00a2e8` 29건은 의미색**(인증 칩·연락처 버튼·필터 배지·감사로그 총건수 등)이라
> **손대지 않았다.** 이 NOTE는 **그룹 표현의 색**에만 적용된다 — 부록 체크리스트도 같은 취지로 개정했다.

#### 4.2.7 모바일 (카드 리스트) 적용 규칙

모바일은 테이블이 아닌 카드 리스트지만 같은 원칙:
- 낱개 행과 그룹 헤더는 같은 흰 배경의 한 줄.
- 펼쳐진 그룹만 `bg-slate-50/70` 으로 묶음 표현 (시안톤 X).
- 서브 항목들은 묶음 영역 안에 `bg-white border border-slate-200/80 rounded-md` 카드로 들어감.
- 낱개 행은 한 줄에 `품종 · 규격 × 수량 / 생산자 / 합계kg` + 두 번째 줄에 `LOT 칩 / 날짜`.

> 🔴 **모바일 카드는 표를 따르지 않는다 — 「의도된 예외」다**(2026-09-04 확정).
> 카드와 표는 서로 **다른 밀도 문맥**이므로, 같은 화면에서 데스크탑과 모바일의 밀도가 갈리는 것은 정상이다.
> 데스크탑 목록을 표준으로 올려도 `mobile-package-card.tsx` 등 카드는 **함께 올리지 않는다.**
> 위 값은 개정되지 않은 원안이다.
> 카드의 **폰트를 키우지 않는다** — 줄 넘침이 더 큰 문제이며, 가독성은 정보 재배치로 해결한다.

### 4.3 모바일 품종 카드 — 2줄 구조

테이블 대신 모바일에서 쓰는 카드 컴포넌트. **헤더(품종) + 펼침 상세 카드**로 구성.

**품종 헤더 행**:
```
▶ 검정보리          2종    260kg
```

**펼침 상세 카드** (2줄):
```
┌─────────────────────────────────────┐
│ 5kg × 40포   김재훈           200kg │
│ ┌─LOT칩─┐                   25-08-12 │
│ │25-MG-21-001│                       │
│ └────────┘                           │
└─────────────────────────────────────┘
```

- **줄 1**: `규격 × 수량` (좌, 굵게) / `생산자` (중앙, truncate) / `합계kg` (우, 굵게)
- **줄 2**: `LOT 칩` (좌, mono) / `날짜` (우, tabular-nums)

**LOT 칩**:
```tsx
<span className="inline-flex items-center font-mono text-[10px] text-slate-500
  bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px]">
  {lot}
</span>
```

### 4.4 버튼 (shadcn 기준)

기본 shadcn `Button` variant 사용. 커스텀 variant 필요 시 `class-variance-authority`로 확장:

| variant | 용도 |
|---|---|
| `default` | 주요 액션 (저장, 등록) — `bg-primary` |
| `outline` | 보조 액션 (취소, 매입 등록) — `border bg-background` |
| `ghost` | 아이콘 버튼, 경량 액션 |
| `destructive` | 삭제 |
| `link` | 텍스트 링크 |

**커스텀**: 헤더 액션의 정사각 아이콘 버튼 (`w-8 h-8 bg-slate-100`) 은 별도 `IconButton` 컴포넌트로.

### 4.5 뱃지 / 칩

- **필터 칩** (적용된 필터 요약): `inline-flex items-center h-5 px-2 rounded-full text-[10.5px] text-slate-500 border border-slate-200 bg-transparent`
- **카운트 배지** (탭/버튼): `inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9.5px] font-bold tabular-nums`
  - 활성: `bg-slate-900 text-white`
  - 비활성: `bg-slate-100 text-slate-400`
- **LOT 칩**: 위 4.3 참조

### 4.6 검색 다이얼로그

헤더의 "검색" 버튼으로 열림. shadcn `Dialog` 사용. 내부 구조:
1. 년도 선택 (select or tab)
2. 품종 체크박스 리스트 (다중 선택)
3. 상태 필터 (보유 / 출고완료 / 전체)
4. 하단: `초기화` (ghost) / `적용` (default)

적용된 필터 수는 헤더 검색 버튼의 카운트 배지로 즉시 반영.

---

## 5. Patterns

### 5.1 목록 페이지 공통 구조

```
┌──────────────────────────────────────────────┐
│ [Set C Icon] 제품재고 / 잡곡 · 설명          │ ← 1줄 헤더 (h-12)
├──────────────────────────────────────────────┤
│                                              │
│ [Tab F: 벼 | 잡곡]                           │
│                                              │
│                     [↑][↓][🔍 검색 (1)][＋]  │ ← 헤더 액션
│                                              │
│ 검색결과 128건    [2025년][검정보리][귀리]… │ ← 적용 필터 요약
│                                              │
│ ┌─ 품종 그룹 테이블 / 모바일 카드 ─────┐   │
│ │ ▶ 검정보리          2종    260kg      │   │
│ │ ▼ 귀리              2종    108kg      │   │
│ │   500g × 120포  동일농산       60kg   │   │
│ │   1kg × 48포    동일농산       48kg   │   │
│ │ ▶ 백태              1종     80kg      │   │
│ └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### 5.2 반응형 브레이크포인트

- **모바일**: `< 768px` → 하단 Goo blob 네비 + 상단 헤더 (h-11) + 카드 리스트
- **태블릿**: `768px ~ 1024px` → 사이드바 축소 (아이콘만) + 테이블
- **데스크톱**: `>= 1024px` → 풀 사이드바 (w-64) + 테이블

### 5.3 빈/로딩/에러 상태

**빈 상태** — 아이콘 + 메시지 + (optional) 액션 버튼
```tsx
<div className="py-16 flex flex-col items-center gap-3 text-center">
  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
    <Inbox className="w-5 h-5 text-slate-400" />
  </div>
  <p className="text-sm text-slate-600">아직 등록된 재고가 없어요.</p>
  <Button variant="outline" size="sm">+ 매입 등록하기</Button>
</div>
```

**로딩** — shadcn `Skeleton` 으로 테이블 행 구조 모사
**에러** — `text-destructive` + `AlertCircle` 아이콘 + 재시도 버튼

---

## 6. Motion

전역 transition 표준:

| 용도 | duration | easing |
|---|---|---|
| hover 상태 변화 | `duration-150` | `ease-out` (기본) |
| active 토글 (탭, 메뉴) | `duration-200` | `ease-out` |
| 모바일 네비 blob 이동 (메인) | 320ms | `cubic-bezier(0.34,1.56,0.64,1)` |
| 모바일 네비 blob 이동 (잔상) | 400ms + 60ms delay | `cubic-bezier(0.25,0.46,0.45,0.94)` |
| 체크/펼침 (`rotate-90`) | `duration-200` | `ease-out` |
| 다이얼로그 열림/닫힘 | shadcn 기본 (150ms) | `tw-animate-css` 프리셋 |

`prefers-reduced-motion` 대응: Tailwind의 `motion-safe:` / `motion-reduce:` 유틸 적극 사용.

---

## 7. Voice & Tone

### 원칙
- **반말 금지, 친절한 존댓말**. "~하세요", "~입니다" 기본.
- **전문용어 유지**. 도정·LOT·원물·수율 등 도메인 용어는 그대로. 과하게 풀어쓰지 않음.
- **숫자 우선**. 설명보다 숫자(건수·kg·%)를 먼저 보여주는 게 사용자에게 더 빠르게 읽힘.

### 버튼 카피
| ✅ 좋음 | ❌ 나쁨 |
|---|---|
| `포장하기` | `새 포장 등록` (중복) |
| `매입 등록` | `매입 추가하기` |
| `검색` | `필터 설정` |
| `초기화` | `리셋` (영어 지양) |

### 빈 상태 메시지
| 상황 | 문구 |
|---|---|
| 재고 없음 | `아직 등록된 재고가 없어요.` |
| 검색 결과 0건 | `조건에 맞는 결과가 없어요. 필터를 바꿔보세요.` |
| 데이터 로딩 중 에러 | `불러오지 못했어요. 잠시 후 다시 시도해주세요.` |

### 섹션 그룹 라벨
대문자 영문 + `tracking-wider`:
- `MAIN MENU`
- `MANAGEMENT`
- `WORKFLOW` (선택적)
- `INSIGHTS` (선택적)

---

## 부록: 시안에서 실제 코드로의 변환 체크리스트

### ✅ 체크리스트
- [ ] `#00a2e8` → **그룹 표현(펼침 배경)에서만** slate로 제거. `bg-primary` 등 **다른 색으로 치환하지 않는다** — 인증 칩·연락처 버튼·필터 배지·감사로그 총건수 등 **의미색은 그대로 둔다** (2026-09-03 목록 표준규격 결정, §4.2.6 NOTE)
- [ ] `bg-[#e6f6fd]` → `bg-blue-50`
- [ ] `text-slate-500` → 가능하면 `text-muted-foreground`
- [ ] 인라인 `<button>` → shadcn `<Button variant="...">`
- [ ] 인라인 `<dialog>` / 자체 모달 → shadcn `<Dialog>`
- [ ] 커스텀 SVG 아이콘(시안) → lucide-react import 또는 `components/icons/duotone/*`로 분리
- [ ] Pretendard CDN → `next/font/local` 또는 `@fontsource/pretendard` 로 self-host
- [ ] 시안의 `className="text-[12.5px]"` 등 임의 값 → 가능하면 표준 스케일로 치환, 필요한 것만 유지
- [ ] 다크모드 토큰 정의 및 `dark:` variant 적용

### 참고 파일
- `handoff/design-system.html` — 모든 컴포넌트의 **라이브 렌더링 시각 참조**. 브라우저로 열어 px·색·간격을 직접 확인.
- `handoff/README.md` — 전달용 한 장 요약.
