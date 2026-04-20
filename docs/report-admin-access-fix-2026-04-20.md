# 결과보고서: 어드민 메뉴 접근 권한 수정 (2026-04-20)

## 1. 변경 사항 요약

### 1-1. 미들웨어 재작성 및 리네임
- **`proxy.ts` 삭제** → **`middleware.ts` 신규 생성**
  - 파일명을 Next.js 표준(`middleware.ts`)으로 통일. 기존 `proxy.ts`는 Next.js 자동 로드 대상이 아니라 환경 간 동작 불일치의 원인이었음
  - 블랭킷 `/admin/*` ADMIN-only 가드 제거 → **경로별 권한 매핑 테이블** 기반으로 교체
  - ADMIN은 모든 경로 무조건 통과. 그 외 사용자는 경로가 매핑에 걸려있으면 해당 권한 보유 여부로 진입 판단. 매핑 없는 `/admin` 루트는 세션만 있으면 통과

매핑 테이블 ([middleware.ts:6-14](../middleware.ts#L6-L14)):

| 경로 | 필요 권한 |
|---|---|
| `/admin/varieties` | `VARIETY_MANAGE` |
| `/admin/farmers` | `FARMER_MANAGE` |
| `/admin/users` | `USER_MANAGE` |
| `/admin/notices` | `NOTICE_MANAGE` |
| `/admin/logs` | `SYSTEM_MANAGE` |
| `/admin/backup` | `SYSTEM_MANAGE` |
| `/admin/settings` | ADMIN 전용 |

### 1-2. 서버 액션 권한 가드 재정렬

**[app/actions/admin.ts](../app/actions/admin.ts)** — 11개 액션에서 `requireAdmin()` → `requirePermission(...)`:

Variety 계열 (→ `'VARIETY_MANAGE'`):
- `createVariety`, `updateVariety`, `deleteVariety`, `deleteVarieties`

Farmer / ProducerGroup 계열 (→ `'FARMER_MANAGE'`):
- `createFarmer`, `updateFarmer`, `deleteFarmer`, `deleteFarmers`
- `createFarmerWithGroup`, `createProducerGroup`, `updateProducerGroup`

**[app/actions/excel.ts](../app/actions/excel.ts)** — 1개 액션:
- `importFarmers` → `requirePermission('FARMER_MANAGE')`

미사용 `requireAdmin` import는 두 파일에서 정리 완료.

## 2. 주요 결정 사항

- **매핑 기반 방식 채택**: 단순히 `/admin/varieties`, `/admin/farmers` 경로만 예외 처리하는 대신, 앞으로 추가될 관리 경로까지 유지보수하기 쉬운 테이블 구조로 작성
- **ADMIN은 항상 통과**: 기존 `hasPermission()` 헬퍼의 동작과 일관성 유지 ([lib/permissions.ts:33](../lib/permissions.ts#L33))
- **`/admin` 루트 별도 처리 안 함**: 현재 `/admin`으로 가는 직접 링크가 코드 전체에 없음 확인됨 (주소창 직타만 가능). `page.tsx`에서 `/admin/backup`으로 리다이렉트 → 미들웨어가 거기서 SYSTEM_MANAGE 체크 → 없으면 홈으로 튕김. 별도 처리 불필요
- **토큰 구조 손대지 않음**: [auth.ts:91](../auth.ts#L91)에서 이미 `token.permissions`를 DB에서 동기화하여 저장하고 있음. 미들웨어에서 그대로 읽어 사용 가능
- **범위 제한**: SYSTEM_MANAGE, USER_MANAGE 관련 서버 액션은 이번 버그와 무관하여 손대지 않음 (계획서에도 범위 외로 명시)

## 3. 검증

- **TypeScript 타입 체크** (`npx tsc --noEmit`): **통과** (에러 없음)
- **로컬 dev 동작 확인**: 사용자가 직접 아래 시나리오로 확인 필요
  - ADMIN 계정: 모든 관리 메뉴 진입 + CRUD 정상
  - `VARIETY_MANAGE`만 보유: `/admin/varieties` 진입 OK, 등록/수정/삭제 OK. `/admin/farmers` · `/admin/users` 등은 홈으로 리다이렉트
  - `FARMER_MANAGE`만 보유: `/admin/farmers` 진입 OK, 등록/수정/삭제 OK. `/admin/varieties` 등은 홈으로 리다이렉트
  - 권한 없는 일반 로그인: `/admin/*` 전부 홈으로 리다이렉트 (단, `/admin/varieties`, `/admin/farmers`도 차단됨에 유의 — 사이드바에는 여전히 노출됨. 다음 항목 참고)

## 4. 확인이 필요한 사항

### 4-1. 사이드바 "관리자 메뉴" 섹션 조건부 노출 (후속 작업 완료)
PC 사이드바와 모바일 헤더의 "관리자 메뉴" 전체를 **`USER_MANAGE` · `NOTICE_MANAGE` · `SYSTEM_MANAGE` 중 하나 보유 또는 ADMIN**일 때만 노출하도록 수정 완료. 품종/생산자 메뉴는 모든 로그인 사용자에게 계속 노출(기존 정책 유지).

**변경 내용**:
- [components/desktop-sidebar.tsx](../components/desktop-sidebar.tsx): "관리자 메뉴" 드롭다운 블록 전체를 `hasAnyPermission(user, ['USER_MANAGE', 'NOTICE_MANAGE', 'SYSTEM_MANAGE'])`로 감쌈. 추가로 내부의 "관리자 설정" 링크는 `user?.role === 'ADMIN'` 조건을 걸어, 관리 권한자(ADMIN 아님)에게도 보이던 죽은 메뉴를 숨김
- [components/mobile-header.tsx](../components/mobile-header.tsx): 기존 `{isAdmin && ...}` 블록을 동일한 `hasAnyPermission`으로 교체. 더 이상 쓰이지 않는 `isAdmin` 지역변수 제거
- 두 파일 모두 `hasAnyPermission`을 [lib/permissions.ts](../lib/permissions.ts)에서 import 추가

**결과 매트릭스**:

| 권한 | 관리자 메뉴 섹션 | 내부 항목 |
|---|---|---|
| ADMIN | 보임 | 전부 |
| USER_MANAGE만 | 보임 | 사용자 관리만 |
| NOTICE_MANAGE만 | 보임 | 공지사항 관리만 |
| SYSTEM_MANAGE만 | 보임 | PC: 활동 로그·시스템 백업 / 모바일: 활동 로그만 |
| 업무 권한만 (VARIETY_MANAGE/FARMER_MANAGE) | **숨김** | - |
| 로그인만 | **숨김** | - |

> 📱 **모바일 정책**: 활동 로그는 모바일 헤더에도 추가. 시스템 백업은 모바일 기기에 백업 파일을 저장하는 UX가 부적절하여 PC 전용으로 유지.

### 4-2. 배포 환경 재배포 필요
이번 수정은 파일 리네임을 포함하므로 배포 환경에 **재배포 필요**. 배포 후 동일 시나리오로 실환경 검증 필요.

### 4-3. 기존 배포 환경에서 `proxy.ts`가 어떻게 동작했는지 미확인
로컬 빌드에서는 `proxy.ts`가 로드되지 않았는데 배포 환경에서는 차단이 발생한 것으로 보아, 배포 플랫폼의 특정 동작으로 로드되었을 가능성이 있음. 이번 수정으로 표준 이름을 사용하므로 환경 의존적 이슈는 해소됨.

## 5. 변경 파일 목록

```
삭제:
  proxy.ts

추가:
  middleware.ts
  docs/plan-admin-access-fix.md
  docs/report-admin-access-fix-2026-04-20.md

수정:
  app/actions/admin.ts
  app/actions/excel.ts
  components/desktop-sidebar.tsx
  components/mobile-header.tsx
  docs/worklog.md
```
