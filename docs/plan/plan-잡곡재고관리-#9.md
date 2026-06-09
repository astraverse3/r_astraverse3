# #9 사이드바/모바일 네비 개편 + 판매관리 라우트 이관 — 작업 계획

> **상태**: ✅ 사용자 승인 완료 (2026-05-07)
> **단일 진실 원천**: 본 문서 + [docs/plan-잡곡재고관리.md](plan-잡곡재고관리.md) §382-389
> **선행 완료**: #0 토큰 / #0.5 브레드크럼 / #0.7 듀오톤 아이콘 — 본 단계에서 그대로 활용

## 사용자 결정 사항 (2026-05-07)
1. **`/releases` 디렉토리는 남겨둔다** — `next.config.ts` 308 리다이렉트 + 컴포넌트만 `/sales`에서 import 방식으로 재사용. 디렉토리 정리/삭제는 후속 PR.
2. **`/sales` 기본 탭은 "출고"** — 유일한 활성 기능. 벼/잡곡 탭은 "준비중" placeholder.
3. **모바일 5탭에서 홈 제거** — 상단 모바일 헤더 로고가 홈 링크 역할 (`mobile-header.tsx` 이미 적용됨).

## 목표
- **메뉴 구조 개편**: 작업흐름 순서(홈/원물재고/도정관리/제품재고/판매관리/통계)로 재배치
- **Set C 듀오톤 아이콘 주입**: PC 사이드바 + 모바일 5탭 모두 #0.7에서 만든 컴포넌트 사용
- **`/sales` 라우트 신설**: 3탭 쉘(벼/잡곡/출고). 출고 탭은 기존 `/releases` 컨텐츠 그대로 이관, 벼·잡곡은 "준비중"
- **`/releases` → `/sales` 영구 리다이렉트**: 북마크 호환
- **통계 라벨 변경**: "출고분석" → "판매분석" (URL `/statistics/output` 유지)
- **임시 진입점 카드 제거**: `app/(dashboard)/page.tsx`의 `/packages` 임시 링크

## 사전조사 결과 (2026-05-07)

### 현재 상태
| 영역 | 파일 | 현황 |
|---|---|---|
| PC 사이드바 | `components/desktop-sidebar.tsx` | 5메뉴(재고/도정/출고/통계 + Mgmt). lucide 아이콘. **개편 필요** |
| 모바일 네비 | `components/mobile-nav.tsx` | 5탭(홈/원물/도정/출고/통계). Goo blob + `#2563eb` blob 이미 적용. **메뉴/아이콘만 갱신** |
| 모바일 헤더 | `components/mobile-header.tsx` | 로고→홈 링크 ✅ 적용 완료. **변경 없음** |
| 브레드크럼 | `components/breadcrumb-display.tsx` | `/sales`, `/packages`, `/statistics/output → 판매분석` 매핑 ✅ 완료. **변경 없음** |
| 레이아웃 | `app/(dashboard)/layout.tsx` | 구조 그대로. **변경 없음** |
| 임시 카드 | `app/(dashboard)/page.tsx:37-48` | `/* TEMP ... #9 사이드바·네비 개편 시 제거 */`. **제거** |
| 듀오톤 아이콘 | `components/icons/duotone.tsx` | RawStock/Milling/Package/Sales/Stats 5종 ✅ 완료. **그대로 import** |
| `/sales` 라우트 | — | 디렉토리 없음. **신설** |
| `/releases` 컨텐츠 | `app/(dashboard)/releases/page.tsx` 외 8개 파일 | **`/sales/release/`로 이관 (또는 컴포넌트만 import)** |
| `/releases` 리다이렉트 | `next.config.ts` redirects | `/stocks→/raw-stocks`만 있음. **`/releases→/sales` 추가** |
| revalidatePath | `app/actions/release.ts` 3곳 | `'/releases'` 호출. **`'/sales'`로 갱신** |
| router.push | `app/(dashboard)/releases/release-filters.tsx` 2곳 | `'/releases?...'`. **이관 후 경로 갱신** |
| 출고분석 라벨 | `desktop-sidebar.tsx`, `mobile-nav.tsx`, `output-stats-client.tsx:324` 3곳 | "출고분석" → "판매분석" |

### 핸드오프 §3.1 PC 사이드바 스펙 요약
```
[로고]
MAIN MENU
  홈           (lucide Home)
  원물재고      (Set C RawStockIcon)
  도정관리      (Set C MillingIcon)
  제품재고      (Set C PackageIcon)
  판매관리      (Set C SalesIcon)
  통계 ▾       (Set C StatsIcon)
    └ 수율분석 / 재고분석 / 판매분석
MANAGEMENT (border-t로 분리)
  품종 관리      (lucide Leaf)
  생산자 관리    (lucide Users)
  관리자 메뉴 ▾  (lucide Server)
    └ 사용자 관리 / 공지사항 관리 / 활동 로그 / 시스템 백업 / 관리자 설정
```
- 메뉴 아이템: `flex gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50` / active=`bg-blue-50 text-primary`
- 섹션 헤더: `px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider`
- Set C 아이콘은 `active` prop으로 듀오톤 fill 토글

### 핸드오프 §3.2 모바일 네비 스펙 요약
- **5탭 (홈 제거)**: 원물·도정·제품·판매·통계
- 이미 적용된 항목: `h-[60px] rounded-full`, Goo blob filter, `#2563eb` blob, cubic-bezier 애니메이션, safe-area
- 변경되는 것: 메뉴 4개 라벨/아이콘/href + statsSubItems "출고분석"→"판매분석"

## 작업 단계 (3 커밋 분할)

### #9a — `/sales` 라우트 신설 + `/releases` 이관 + 리다이렉트
**범위**: 라우트만 살리고 기존 출고 기능을 무손실로 옮기는 단계. 메뉴는 아직 안 건드림.

#### 신규 파일
- `app/(dashboard)/sales/page.tsx` — 3탭 쉘. `?tab=rice|misc|release` (기본 `release`). 탭 전환은 URL 쿼리.
- `app/(dashboard)/sales/sales-tabs.tsx` (client) — F안 애니메이션 탭 (handoff §4.1). 벼/잡곡은 "준비중" 뱃지 표시
- `app/(dashboard)/sales/coming-soon-panel.tsx` — 벼·잡곡 탭 placeholder

#### 컨텐츠 이관 방식 — **컴포넌트 그대로 import (이동 X)**
- `/releases` 디렉토리는 **그대로 두고**, `/sales` page에서 `ReleasePageWrapper`/`ReleaseFilters`/`ReleaseExcelButton`를 직접 import
- 이유: 9개 파일을 옮기면 import 경로/grep 누락 위험 큼. 컴포넌트 위치는 후속 PR에서 정리
- `/releases/page.tsx`는 더 이상 진입점 아니지만 **삭제하지 않음** — `next.config.ts` 308 리다이렉트가 우선 처리. 빌드시 dead route지만 문제없음. (이후 정리는 별도 PR)
- 단, **`release-filters.tsx`의 `router.push('/releases?...')` 2곳**은 `'/sales?tab=release&...'`로 갱신 필수 (출고 탭 안에서 검색해도 정상 동작해야 함)

#### 라우트 리다이렉트
- `next.config.ts` redirects에 추가:
  - `/releases` → `/sales?tab=release` (308)
  - `/releases/:path*` → `/sales?tab=release` (308) — 현재 `/releases` 하위는 없지만 안전망

#### Server Actions 갱신
- `app/actions/release.ts`의 `revalidatePath('/releases')` 3곳 → `revalidatePath('/sales')`

#### 검증
- `/sales` 진입 → 출고 탭 기본 활성, 출고 내역 정상 로딩
- 출고 검색·필터·엑셀 다운로드 기능 동작
- `/releases` 진입 → `/sales?tab=release` 308 리다이렉트
- 벼/잡곡 탭 → "준비중" placeholder

---

### #9b — 사이드바 + 모바일 네비 개편
**범위**: 메뉴 구조 + Set C 듀오톤 아이콘 주입.

#### `components/desktop-sidebar.tsx` 전면 개편
- 새 메뉴 6개 (홈 추가, "재고관리"→"원물재고", "출고관리"→"판매관리"+`/sales`, "제품재고" 신규)
- Set C 듀오톤 5개 컴포넌트 사용 — `active` prop은 `isActive(href)` 결과 전달
- 통계 하위 라벨 "출고분석" → "판매분석"
- 기존 MANAGEMENT 섹션은 **변경 없음** (스펙은 그대로 유지, 권한 가드 그대로)
- `isActive('/sales')`는 `pathname.startsWith('/sales')` — 기본 동작 그대로

#### `components/mobile-nav.tsx` 메뉴 갱신
- `navItems` 배열 갱신:
  - `[홈]` 제거
  - `{ /raw-stocks, RawStockIcon, '원물' }` (이미 있음, 아이콘만 교체)
  - `{ /milling, MillingIcon, '도정' }`
  - `{ /packages, PackageIcon, '제품' }` (신규)
  - `{ /sales, SalesIcon, '판매' }` (출고 → 판매로 교체)
  - `{ /statistics, StatsIcon, '통계' }`
- statsSubItems의 "출고분석" → "판매분석"
- `getActiveIndex`/`buttonRefs` index 그대로 (4 = 통계 하위)
- Set C 듀오톤 아이콘은 active 상태에서 `text-white` + `active=true` 전달 (현재 lucide의 stroke 분기 패턴은 듀오톤에서도 똑같이 동작)

#### 검증
- 데스크톱: 새 6 메뉴 클릭 → 정상 활성/이동. /sales 클릭 시 active 강조
- 모바일: 5탭 클릭 → blob 이동, 활성 색상 토글, 통계 펼침 메뉴
- /raw-stocks·/milling·/packages·/sales·/statistics 다 진입해서 active 매치 확인

---

### #9c — 통계 라벨 변경 + 임시 카드 제거
**범위**: 잔여 텍스트/링크 정리.

#### 변경 파일
- `app/(dashboard)/statistics/output/output-stats-client.tsx:324` — `fileNamePrefix={` `출고분석_${activeTab}` `}` → `` `판매분석_${activeTab}` ``
  - 페이지 헤더 텍스트(만약 있으면)도 같이 점검 — `Read`로 확인
- `app/(dashboard)/page.tsx:37-48` — TEMP 진입점 카드 제거 (`Package` import 사용처가 이것뿐이면 import도 정리)

#### 검증
- 통계 → 판매분석 진입, 엑셀 다운로드 시 파일명 `판매분석_*.xlsx`
- 홈에서 임시 카드 사라짐. 다른 카드/통계 정상 렌더

---

## 변경 파일 종합 (14개 + 신규 3개)

### 신규
1. `app/(dashboard)/sales/page.tsx`
2. `app/(dashboard)/sales/sales-tabs.tsx`
3. `app/(dashboard)/sales/coming-soon-panel.tsx`

### 수정
1. `next.config.ts` — redirects 2개 추가
2. `app/actions/release.ts` — revalidatePath 3곳
3. `app/(dashboard)/releases/release-filters.tsx` — router.push 2곳
4. `components/desktop-sidebar.tsx` — 메뉴 전면 개편
5. `components/mobile-nav.tsx` — navItems + statsSubItems
6. `app/(dashboard)/statistics/output/output-stats-client.tsx` — fileNamePrefix
7. `app/(dashboard)/page.tsx` — TEMP 카드 제거
8. `docs/worklog.md` — 작업일지

> 11개 수정 + 3개 신규 = 14개. CLAUDE.md HARD-GATE("3개 이상 파일 변경 시 plan 후 승인") 적용 — 본 plan으로 사전 승인 후 진행.

## 위험 요소
- **`/releases` 컨텐츠를 import 방식으로 재사용**: 컴포넌트 내부 `'use client'` + `router.push('/releases?...')` 같은 self-reference 발견 시 누락 가능 — `release-filters.tsx` 2곳 외 추가 발견 시 즉시 갱신
- **3탭 URL 상태**: `/sales?tab=rice|misc|release` 쿼리 기반. 브레드크럼 `BreadcrumbDisplay`는 이미 `?tab=` 파싱 로직 있음 (`TAB_LABEL_MAP: rice|misc|release`) ✅ — 추가 작업 불필요
- **모바일 사이드바 active 인덱스**: `getActiveIndex`에서 `/sales` 경로 분기 자동 매치 (배열 순서로 처리)
- **PWA sw.js 캐시**: `precacheAndRoute`에 `/releases` 매니페스트 항목 있음 — 다음 빌드 시 자동 갱신, 코드 수정 X
- **권한 가드 (#9.5 후속)**: `/sales`는 권한 키 신설 안 하고 `/releases`와 동일 정책 (현재는 모든 로그인 사용자 접근). #9.5에서 `SALES_MANAGE` 분리 검토
- **F안 탭 스타일 충돌**: `sales-tabs.tsx`는 신규 컴포넌트이므로 기존 패턴 영향 없음. handoff §4.1 그대로 따름

## 비범위 (후속 PR로 분리)
- `/releases` 디렉토리 정리/삭제 — 308 리다이렉트로 충분, 코드 정리는 별도
- 권한 키 분리 (`SALES_MANAGE` 등) — #9.5
- 벼/잡곡 판매 탭 본 구현 — `plan-판매관리.md`로 별도 계획 (현재 "준비중" placeholder)
- 사이드바 admin 섹션 권한 키 재정리 — #9.5

## 체크리스트
- [ ] **사용자 승인**
- [ ] #9a 구현 + 동작 확인 + 커밋
- [ ] #9b 구현 + 동작 확인 + 커밋
- [ ] #9c 구현 + 동작 확인 + 커밋
- [ ] 결과보고서 `docs/report-잡곡재고관리-#9-2026-05-07.md`
- [ ] worklog 업데이트
- [ ] memory `project_misc_grain_feature.md` 갱신 (#9 완료 + #11 폐기 확정 + 다음 재개 지점)
