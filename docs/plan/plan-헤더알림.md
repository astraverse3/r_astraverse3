# 계획서 — 헤더 알림(종) 1단계 (작업지시 ⑥ · 백로그 §83 2단계)

작성 2026-09-30 · 근거 `docs/handoff/점검-2026-09/작업지시-6-헤더알림.md`(**17:26 간단안**) · 시안 `시안/헤더-알림-시안.html` + `header-bell-parts.jsx`(17:27)

## 목표

승인 대기를 **헤더 종 아이콘 하나**로 알린다. 지금의 임시 뱃지(사이드바 「사용자 관리」 옆 숫자 · 접힌 「관리자 메뉴」 점 · 모바일 톱니 점)는 걷어낸다.
알림은 **저장하지 않고 요청 때마다 계산**한다. 해결되면 저절로 사라진다(읽음 개념 없음). 개인 알림·쪽지는 §90.

## 간단안에서 빠진 것 (17:18판 대비)

- 행의 보조 줄(「카카오 가입 · 가장 오래된 요청 N일 전」) → 없음. 행은 **한 줄**, 높이 모바일 48 · PC 40
- 목록 머리의 「지금 상태 기준」 → 없음
- 빈 상태의 두 번째 줄 → 없음
- 2단계 방향 시안 → 없음
- → **개수만 있으면 된다.** 기존 `countPendingUsers()`를 그대로 쓴다(쿼리 추가 없음)

## 현재 코드와 대조한 결과

| 지시서·시안 | 코드 | 판단 |
|---|---|---|
| `duotone.tsx`의 `Base`·`active` 규칙 | `components/icons/duotone.tsx` — 같다 | `BellIcon` 추가 |
| 타일 아이콘 = 채움형 userPlus(시안 `HB_P.userPlus`, `a` 켬) · 빈 상태 = 채움형 check | lucide엔 채움형이 없다 | 시안 경로로 `UserPlusIcon`·`CheckCircleIcon`도 `duotone.tsx`에 추가(지시서가 허용) |
| `countPendingUsers()` | 있다(§83, ADMIN 전용·실패하면 0) | 그대로 |
| 모바일 오른쪽 묶음 | 지금 `gap-1.5 pr-1.5` · 아바타 28 · 톱니 `p-1` | 40×40 버튼 세 개 · `gap-0 pr-1` |
| PC 상단 바 | `layout.tsx` `<header … justify-between gap-4 px-6>` 안에 브레드크럼 · `HeaderUserProfile` | 오른쪽을 `종 · 구분선 · 프로필` 묶음(`gap-2`)으로 |

## 변경 파일

| # | 파일 | 내용 |
|---|---|---|
| 1 | `lib/notifications.ts` (신규, 서버 전용) | `getHeaderNotifications(role)` → `{ eligible, items }`. `eligible = ADMIN`. ADMIN이면 `countPendingUsers()`, 0이면 항목 없음. 레이아웃에서만 부른다(`'use server'` 아님 — 클라이언트가 직접 부를 입구를 만들지 않는다) |
| 2 | `app/(dashboard)/layout.tsx` | `pendingUsers` 계산을 이 함수로(`getYieldRates`와 병렬 유지) · 모바일 헤더에 넘김 · PC 상단 바 오른쪽 `종 · 구분선 · 프로필` |
| 3 | `components/icons/duotone.tsx` | `BellIcon`(지시서 경로) · `UserPlusIcon` · `CheckCircleIcon`(시안 경로) |
| 4 | `components/header/header-bell.tsx` (신규, 클라이언트) | 트리거(모바일 40/아이콘 20 · PC 32/18 · 색 3상태 · 열리면 `active`) · 아이콘 기준 빨강 뱃지(합계 · `99+` · 0이면 없음 · aria-label) · 목록(PC `Popover` w-340 end / 모바일 `DropdownMenu` `calc(100vw-16px)`) · 머리 「알림」 · 행(타일 32 amber · 「승인 대기 **N**명」 13 semibold · 화살표) · 빈 상태 · 최대 높이(PC 420 · 모바일 탭바 위까지). 행을 누르면 닫고 이동 |
| 5 | `components/mobile-header.tsx` | 종 · 아바타 · 톱니 40×40 · 톱니 점과 「사용자 관리」 숫자 삭제 · prop을 `pendingUsers` → `notifications`로 |
| 6 | `components/desktop-sidebar.tsx` | 접힌 「관리자 메뉴」 점 · 「사용자 관리」 숫자 · `pendingUsers` prop 삭제(링크 클래스 원래 `block`으로) |
| 7 | 문서 | `plan-가입승인제.md` 「2단계」 완료 · 백로그 §83 · 작업일지 |

코드 6곳(신규 2) → HARD-GATE, 승인 후 착수.

## 하지 않는 것

- 새 알림 종류, 저장형 알림 · 읽음(§90)

## 확인 방법

- `npx tsc --noEmit` · `npx eslint .` 0/0 · `npm test` · `grep pendingUsers` → layout·actions 외 0건
- 브라우저(사용자): ADMIN 모바일·PC에 회색 종(대기 0) → 빈 상태 · 390폭 한 줄 · 목록 아래 끝이 탭바 위. 대기자가 생기면 빨강 숫자 → 「승인 대기 N명」 → 사용자 관리로 이동하며 닫힘 · 승인하면 숫자가 줄어든다. 일반 사용자는 종이 없다
