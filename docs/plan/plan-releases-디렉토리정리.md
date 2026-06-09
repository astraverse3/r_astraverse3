# `/releases` 디렉토리 정리 계획

> **작성일**: 2026-05-08
> **선행 컨텍스트**: 잡곡 재고관리 #9 (2026-05-07, 커밋 `c6c5292`)에서 `/sales` 신설 + `/releases → /sales` 308 리다이렉트 + 컴포넌트 import 재사용 방식으로 임시 처리. 본 작업은 그 후속 클린업.
> **백로그 출처**: `memory/project_misc_grain_feature.md` "다음 재개 지점 — `/releases` 디렉토리 정리"

## 목표
- `/releases` 디렉토리(`page.tsx` + 8개 release-* 컴포넌트)는 현재 308 리다이렉트로 인해 페이지 자체는 dead route.
- 컴포넌트 8개는 `/sales/release-section.tsx`가 `../releases/...` 상대 경로로 끌어 쓰고 있는 상태(코드 위치-실 사용처 미스매치).
- 본 작업으로 컴포넌트를 `app/(dashboard)/sales/release/`로 이동시키고, `/releases` 디렉토리를 완전히 삭제.
- 308 리다이렉트는 유지(북마크·외부 링크 호환).

## 사용자 결정사항 (2026-05-08)
1. **이전 위치**: `app/(dashboard)/sales/release/` 서브폴더 — 출고는 sales의 한 탭이라는 의미 구조 유지. 향후 벼·잡곡 본구현 시 `sales/rice/`, `sales/misc/` 같은 동일 패턴으로 확장 가능.
2. **`breadcrumb-display.tsx`의 `/releases` 매핑 삭제** — 308로 도달 불가하므로 dead 코드. 동시에 정리.
3. **308 리다이렉트는 유지** — `next.config.ts`의 `/releases` + `/releases/:path*` → `/sales` 그대로.

## 변경 파일 / 범위

### A. 파일 이동 (`git mv`, 8개)
`app/(dashboard)/releases/*.tsx` → `app/(dashboard)/sales/release/*.tsx`

| # | 파일명 |
| --- | --- |
| 1 | `release-page-wrapper.tsx` |
| 2 | `release-page-client.tsx` |
| 3 | `release-history-list.tsx` |
| 4 | `release-filters.tsx` |
| 5 | `release-excel-button.tsx` |
| 6 | `active-release-filters.tsx` |
| 7 | `mobile-release-card.tsx` |
| 8 | `edit-release-dialog.tsx` |

> 8개 파일끼리는 모두 `./...` 상대 경로 import — 디렉토리째 옮기면 그대로 유효, 내부 import 수정 불필요.

### B. 파일 삭제 (1개)
- `app/(dashboard)/releases/page.tsx` — 308 리다이렉트로 인해 도달 불가능, dead route.

### C. 디렉토리 삭제
- `app/(dashboard)/releases/` — 위 작업 후 빈 디렉토리 삭제.

### D. import 경로 수정 (1개 파일)
`app/(dashboard)/sales/release-section.tsx`:
```diff
- import { ReleasePageWrapper } from '../releases/release-page-wrapper'
- import { ReleaseFilters } from '../releases/release-filters'
- import { ReleaseExcelButton } from '../releases/release-excel-button'
+ import { ReleasePageWrapper } from './release/release-page-wrapper'
+ import { ReleaseFilters } from './release/release-filters'
+ import { ReleaseExcelButton } from './release/release-excel-button'
```

### E. dead 매핑 정리 (1개 파일)
`components/breadcrumb-display.tsx`의 `PAGE_CONFIG`에서 `/releases` 항목 삭제 (line 63-67):
```ts
'/releases': {
    icon: SalesIcon,
    title: '출고 관리',
    description: '출고 내역을 관리합니다.',
},
```

### F. 변경하지 않는 것
- `next.config.ts`의 308 리다이렉트 — 유지.
- `app/actions/release.ts` — server action, 디렉토리와 무관.
- `app/actions/output-statistics.ts` — release 데이터 조회 로직 (위치 무관).
- `public/sw.js` — 빌드 산출물 (자동 갱신).
- `MANUAL.md` / `README.md` / `prisma/ERD.md` / `prisma/erd.mmd` — 문서, URL 변동 없음.

## 단계별 접근

1. **파일 이동**
   - `app/(dashboard)/sales/release/` 디렉토리 신설.
   - `git mv` 8개 파일 (`page.tsx` 제외).
2. **불필요한 파일 삭제**
   - `app/(dashboard)/releases/page.tsx` `git rm`.
   - `app/(dashboard)/releases/` 빈 디렉토리 정리(자동 삭제).
3. **import 경로 수정** — `release-section.tsx` 3줄.
4. **breadcrumb 매핑 정리** — `/releases` 5줄 제거.
5. **검증**
   - `npx tsc --noEmit` (타입체크).
   - `npm run lint`.
   - dev 서버 띄워서 `/sales` 출고 탭 정상 렌더 확인.
   - `/releases` 직접 진입 → `/sales` 308 리다이렉트 확인.
6. **결과보고서 작성** — `docs/report-releases-디렉토리정리-2026-05-08.md`.
7. **커밋** — 메시지: `chore: /releases 디렉토리 정리 — sales/release/ 이전 + dead route 삭제`. worklog 업데이트.

## 위험 요소

### 낮음 — 통제됨
- **컴포넌트 자기완결성**: 8개 파일끼리만 `./` import — 디렉토리째 이동에 안전.
- **외부 import는 1곳뿐**: `sales/release-section.tsx`만 `../releases/`를 참조. 그 외에는 grep으로 확인 완료(`/releases` URL 문자열 포함은 next.config·breadcrumb에 한정).
- **dead route 삭제**: `/releases/page.tsx`는 308에 의해 도달 불가, 삭제로 인한 사용자 영향 없음.

### 모니터링 항목
- **`public/sw.js`**: 서비스 워커가 `/releases` 경로를 precache 했을 가능성. 빌드 후 자동 갱신되며, 이미 308이 작동하므로 캐시된 경로 진입도 정상 처리 예상. 첫 배포 후 PWA 캐시 새로고침 시점에 모니터링.

## 검증 체크리스트
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run lint` 통과
- [ ] dev 서버 `/sales` 진입 → 출고 탭 기본 활성, 목록·필터·엑셀 버튼 모두 동작
- [ ] dev 서버 `/sales?tab=release` 동일 확인
- [ ] dev 서버 `/releases` 진입 → `/sales` 308 리다이렉트 (브라우저 주소창)
- [ ] dev 서버 `/releases?keyword=test` 진입 → `/sales` (쿼리 보존 여부는 308 패턴상 destination 단순 매핑, 쿼리는 next.js 기본 동작에 따름. 출고 탭에서 검색 다이얼로그 사용 가능하므로 쿼리 손실 허용)
- [ ] `/releases` 디렉토리 완전 삭제 확인 (`git status`)
- [ ] `breadcrumb-display.tsx`에서 `/releases` 매핑 사라졌는지 확인

## 작업 후 후속 정리 (이번 범위 밖, 메모)
- 메모리(`project_misc_grain_feature.md`) "다음 재개 지점" 항목 갱신 — `/releases` 정리 → ✅ 처리.
- `docs/리팩토링-백로그.md` 해당 항목 있으면 ✅ 마크.
