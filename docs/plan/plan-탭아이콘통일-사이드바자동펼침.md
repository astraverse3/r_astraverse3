# 계획서 — 탭 아이콘 통일 + PC 사이드바 자동펼침

> 작성일: 2026-05-21
> 디자인 정본: `docs/handoff/` (최신)

## 작업 목표

1. **탭 아이콘 통일** — 원물재고·제품재고의 벼/잡곡 탭 아이콘을 **판매관리 탭과 동일하게** 교체
   - 벼: `RiceIcon`(세로줄기+잎) → `Wheat`(lucide-react, 밀 이삭)
   - 잡곡: `GrainIcon`(씨앗 5개) → `Sprout`(lucide-react, 새싹)
2. **PC 사이드바 자동펼침** — "통계"·"관리자 메뉴" 서브메뉴를 항상 펼침 → **현재 경로면 자동 펼침 + 화살표 클릭 토글** (디자인 시안 `SidebarV1` 방식)

## 현황 (조사 결과)

| 위치 | 현재 | 비고 |
|---|---|---|
| 판매관리 [sales-tabs.tsx](app/(dashboard)/sales/sales-tabs.tsx#L4) | `Wheat`/`Sprout`/`Truck` (lucide) | ← **이게 통일 기준** |
| 원물재고 [raw-stocks-tabs.tsx](app/(dashboard)/raw-stocks/raw-stocks-tabs.tsx) | `RiceIcon`/`GrainIcon` (category) | F안 스타일 |
| 제품재고 [packages-tabs.tsx](app/(dashboard)/packages/packages-tabs.tsx) | `RiceIcon`/`GrainIcon` (category) | F안 스타일 |
| [category.tsx](components/icons/category.tsx) | `RiceIcon`/`GrainIcon` 정의 | 위 두 탭에서만 사용 → 교체 시 미사용 |
| [desktop-sidebar.tsx](components/desktop-sidebar.tsx) | 통계·관리자 서브 **항상 펼침** | useState 토글 없음 |

## 변경 파일 / 범위

### 작업 A — 탭 아이콘 (3파일)
1. `app/(dashboard)/raw-stocks/raw-stocks-tabs.tsx`
   - import: `{ RiceIcon, GrainIcon } from '@/components/icons/category'` → `{ Wheat, Sprout } from 'lucide-react'`
   - 타입 `Icon: typeof RiceIcon` → `LucideIcon`
   - `TABS` Icon: `RiceIcon`→`Wheat`, `GrainIcon`→`Sprout`
   - `<Icon>`에 크기 클래스 `w-3.5 h-3.5` 추가 (lucide 기본 24px라 명시 필요)
   - **F안 스타일은 유지** (active 시 scale-110 / strokeWidth 2.4·1.8 / 텍스트 14px·13px / 2.5px 바)
2. `app/(dashboard)/packages/packages-tabs.tsx` — 위와 동일 패턴
3. `components/icons/category.tsx` — **삭제** (미사용 확인됨)

### 작업 B — 사이드바 자동펼침 (1파일)
4. `components/desktop-sidebar.tsx`
   - `useState` + lucide `ChevronDown`/`ChevronRight` import 추가 (이미 `'use client'`)
   - 통계 헤더: `<div>` → `<button onClick={토글}>` + Chevron, 서브 목록을 `{statsOpen && ...}` 조건부
   - 관리자 메뉴 헤더도 동일하게 토글 + Chevron + 조건부
   - 초기 펼침 상태: 현재 경로가 해당 섹션 하위면 열림
     - 통계: `pathname.startsWith('/statistics')`
     - 관리자: `/admin/users|notices|logs|backup|settings` 진입 시 (품종·생산자 제외)
   - **경로 진입 시 자동 펼침 동기화**: 사이드바는 layout에 상주(persistent)해서 SPA 이동 시 useState 초기값이 재평가 안 됨 → `useEffect`로 pathname 변화 감지해 해당 섹션 자동 open (수동으로 접은 건 같은 섹션 재진입 전까지 존중)

## 단계별 접근

1. 작업 A: raw-stocks-tabs.tsx 수정 → packages-tabs.tsx 수정 → category.tsx 삭제
2. 작업 B: desktop-sidebar.tsx 통계/관리자 토글화
3. `npx tsc --noEmit` 통과 확인
4. (가능하면) dev 서버 띄워 실제 렌더링 확인 — 탭 아이콘 교체 + 사이드바 토글 동작
5. 결과보고서 작성 + worklog 갱신

## 확인 필요 / 결정사항

- **디자인 문서 §6 불일치**: [design-system.html](docs/handoff/design-system.html) §6 탭 시안은 아직 `GrainIcon`을 그림. 코드를 `Wheat`/`Sprout`으로 바꾸면 문서와 어긋남.
  - (가) 코드만 바꾸고 문서는 그대로 (불일치 메모만 남김) ← 기본
  - (나) design-system.html §6도 Wheat/Sprout으로 같이 갱신
  - → **핸드오프 문서는 Claude Design 산출물이라 (가) 권장**, 추후 디자인 측에서 정합
- **category.tsx 삭제** vs 보존: 미사용이라 삭제 권장. 혹시 향후 재사용 계획 있으면 보존.
- 사이드바 자동펼침: 시안은 단순 useState 초기값이지만, persistent 사이드바라 **useEffect 동기화 포함**을 권장 (위 작업 B 참고).
