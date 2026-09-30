# Handoff: 2026-09 전체 점검 — 보안 · 디자인 토큰 · 디자인 결정

## 개요
millinglog 전체 점검 결과를 Claude Code 작업 3건으로 나눴습니다. **반드시 ① → ② → ③ 순서**로 진행하세요(③은 ①의 승인제와 ②의 slate 통일에 의존).

| # | 문서 | 성격 | 시안 필요 |
|---|---|---|---|
| ① | `작업지시-1-보안.md` | P0 · 승인제, 백업 명령 주입, 세션 무효화, /admin 기본 거부, CSP, 민감 파일 | 승인대기 화면만(③ T4) |
| ② | `작업지시-2-디자인토큰-정리.md` | P1 · 화면 변화 거의 없는 기계적 정리 | 없음 |
| ③ | `작업지시-3-디자인결정.md` | P1 · 확정된 디자인 변경 | `시안/디자인점검-시안.html` |

각 문서에 **변경 · 완료 기준 · 체크리스트**가 있습니다. 항목별로 커밋을 나누고, 끝나면 `docs/worklog.md`와 `docs/permission-matrix.md`를 갱신하세요.

## 디자인 파일에 대해
`시안/`의 HTML은 **디자인 참고용 프로토타입**이지 그대로 옮길 코드가 아닙니다. 기존 `milling-log/`의 Next.js + Tailwind v4 + shadcn/ui 패턴으로 **재구현**하세요. 시안의 인라인 JSX, CDN Tailwind, `design-canvas.jsx`는 보기 위한 틀일 뿐입니다.

## 충실도
**Hi-fi.** 색, 크기, 높이, 문구는 최종안입니다. 시안에서 값이 문서와 다르면 **문서가 우선**입니다.

## 확정 결정 (③ 요약)
- **T1 보조색: B안.** purple/violet/indigo를 폐기합니다. 필터 칩은 blue, 분류 태그(다중그룹·발아위탁·내보내기)는 회색 외곽선 `border-slate-300 text-slate-700 bg-white`로 바꿉니다.
- **T2 타입 스케일 승인.** 11 caption / 12 meta / 13 body-sm / 14 body / 16 input의 5단계만 씁니다. 11px 미만은 금지하고, 텍스트 색은 slate-500 이상(4.5:1)이어야 합니다.
- **T3 포장 다이얼로그 모바일: B안.** 1행 구성은 `[규격+포장지 셀] [스테퍼] [중량] [삭제]`이고 높이는 40px입니다. 규격 버튼은 36px이며, 규격별 합계 밴드는 표시만 정리합니다. 하단 바는 3가지 상태(편집 / 마감됨 / 조회 전용)로 나뉘고, 읽기 전용 행은 3열 36px입니다. PC(`sm` 이상)는 바꾸지 않습니다.
- **T4 승인 대기.** `/pending` 화면, `/admin/users` 상단의 승인 대기 블록, 사이드바 대기 인원 뱃지를 만듭니다.

## 시안 보는 법
`시안/디자인점검-시안.html`을 브라우저로 여세요. 네트워크가 필요하고(React, Tailwind CDN), 캔버스는 팬과 줌으로 봅니다.

| 섹션 | 아트보드 | 채택 |
|---|---|---|
| ① 보조색 | 현재 / A안 / **B안** | B |
| ② 타입 스케일 | 스케일 표 + 현재·제안 비교 | 승인 |
| ③ 포장 다이얼로그 (390px) | 현재 / A안 / **B안 편집** / **B안 마감됨** / **B안 조회 전용** | B |
| ④ 승인 대기 | `/pending` 모바일 / `/admin/users` | 채택 |

A안과 "현재" 아트보드는 비교용입니다. 구현하지 마세요.

## 디자인 토큰 (이번 작업 범위)
- **Primary:** `#2563eb` (blue-600)
- **Neutral:** slate 계열만 씁니다. stone과 gray는 ② D3에서 치환합니다.
- **상태 색:** emerald(등록), blue(수정), rose(삭제·초기화), amber(작업 마감·승인 대기), yellow(잔량)
- **텍스트 색 하한:** 흰 배경 기준 slate-500 `#64748b` (4.8:1)
- **Type** (`@theme` 추가):
  - `--text-caption: 11px/16px`
  - `--text-meta: 12px/16px`
  - `--text-body-sm: 13px/20px`
  - 14px과 16px은 기존 `text-sm`·`text-base`를 씁니다.
- **숫자:** monospace + `tabular-nums`
- **터치 타깃 (모바일):**
  - 주 버튼: 44px
  - 행 안 컨트롤: 40px
  - 규격 버튼: 36px
  - 읽기 전용 행: 36px (누를 곳 없음)
- **Radius:** 버튼과 셀은 `rounded-lg`(8px), 카드는 `rounded-xl`(12px)
- **Font:** Pretendard를 `next/font/local`로 불러옵니다(② D5).

## 에셋
- `assets/logo-full.png`: `/pending` 카드 로고입니다. 레포에는 이미 `public/logo-full.png`가 있으니 그걸 쓰세요.
- 아이콘은 lucide-react를 씁니다(`Lock`, `Trash2`). 시안의 인라인 SVG는 자리 표시용입니다.

## 파일
```
점검-2026-09/
├─ README.md                       ← 이 문서
├─ 작업지시-1-보안.md
├─ 작업지시-2-디자인토큰-정리.md
├─ 작업지시-3-디자인결정.md
├─ 시안/
│  ├─ 디자인점검-시안.html          ← 진입점
│  ├─ design-audit-parts.jsx       ← 아트보드 컴포넌트 (PackB, PackRO, SpecBand, PendingCard, UsersAdmin …)
│  └─ design-canvas.jsx            ← 캔버스 틀 (구현 대상 아님)
└─ assets/logo-full.png
```

## 레포 대응표
| 작업 | 주요 파일 |
|---|---|
| ① S1–S4 | `auth.ts`, `lib/auth-guard.ts`, `middleware.ts`, `app/(dashboard)/layout.tsx`, `app/actions/backup.ts`, `prisma/schema.prisma` |
| ① S5 · ② D5 | `next.config.ts`, `app/globals.css`, `app/layout.tsx` |
| ② D1–D4 | `app/globals.css`, `app/layout.tsx`, `components/ui/input.tsx`·`textarea.tsx`·`select.tsx`, stone·gray 사용 파일 9개 |
| ③ T1 | 통계 4개 파일, `farmer-list.tsx`, `misc-stock-table-row.tsx`, `log-list.tsx` |
| ③ T2 | 임의 px 약 200곳 (문서에 우선순위 있음) |
| ③ T3 | `app/(dashboard)/milling/add-packaging-dialog.tsx`, `spec-summary.tsx` |
| ③ T4 | `app/pending/page.tsx`(신규), `app/(dashboard)/admin/users/*`, `components/desktop-sidebar.tsx` |
