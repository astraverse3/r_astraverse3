# 계획서: 어드민 메뉴 접근 권한 수정

## 1. 배경

- **사용자 보고**: 배포 환경에서 `VARIETY_MANAGE` / `FARMER_MANAGE` 권한만 가진 사용자가 품종관리(`/admin/varieties`) · 생산자관리(`/admin/farmers`) 메뉴에 진입할 수 없음
- **원인**: [proxy.ts:16-21](../proxy.ts#L16-L21)의 블랭킷 가드
  ```ts
  if (pathname.startsWith("/admin")) {
      if (!token || token.role !== "ADMIN") {
          return NextResponse.redirect(new URL("/", req.url))
      }
  }
  ```
  `/admin/*` 하위를 **role === 'ADMIN'** 만 통과시켜서, 업무 권한만 가진 사용자는 전부 차단됨
- **설계 의도와의 불일치**: [lib/permissions.ts:3](../lib/permissions.ts#L3) 주석에 "업무 권한: 페이지 조회는 누구나 가능, 등록/수정/삭제만 제어"로 명시되어 있으며, 실제 사이드바([desktop-sidebar.tsx:115](../components/desktop-sidebar.tsx#L115)) · 모바일 헤더([mobile-header.tsx:70](../components/mobile-header.tsx#L70)) · 클라이언트 컴포넌트(`variety-page-client.tsx`, `farmer-page-client.tsx`)는 모두 권한 기반 노출을 전제로 구현되어 있음
- **파일명 이슈**: 현재 `proxy.ts`는 Next.js 표준 이름(`middleware.ts`)이 아니라서 로컬 빌드 manifest에는 미들웨어가 등록되지 않음. 배포 환경에서 차단이 발생하는 건 확인된 사실이므로, 환경 간 동작 불일치를 제거하기 위해 표준 이름으로 통일 필요

## 2. 목표

1. 경로별 권한 매핑 테이블을 기반으로 `/admin/*` 진입을 제어 (ADMIN은 항상 통과, 해당 업무 권한자는 해당 경로만 통과)
2. 서버 액션의 `requireAdmin()`을 권한 기반 `requirePermission()`으로 재정렬하여, 권한자가 페이지 진입 후 등록/수정/삭제 버튼이 실제로 동작하도록
3. 미들웨어 파일명을 Next.js 표준 `middleware.ts`로 통일

## 3. 변경 파일 및 범위

### 3-1. 미들웨어 리네임 및 로직 재작성

**파일**: `proxy.ts` → `middleware.ts` (리네임)

**매핑 테이블** (ADMIN은 모든 경로 통과):

| 경로 | 필요 권한 |
|---|---|
| `/admin/varieties` | `VARIETY_MANAGE` |
| `/admin/farmers` | `FARMER_MANAGE` |
| `/admin/users` | `USER_MANAGE` |
| `/admin/notices` | `NOTICE_MANAGE` |
| `/admin/logs` | `SYSTEM_MANAGE` |
| `/admin/backup` | `SYSTEM_MANAGE` |
| `/admin/settings` | (ADMIN 전용) |
| `/admin` (루트) | 현재 진입 링크 없음 — 직접 주소창 입력 시만 도달, [page.tsx](../app/(dashboard)/admin/page.tsx)에서 `/admin/backup` 리다이렉트. 권한 없으면 다시 홈으로 튕기므로 별도 처리 불필요 |

**구현 방식**:
- 경로 prefix → 필요 권한 맵을 상수로 정의
- 요청 경로와 매칭되는 첫 엔트리를 찾아 `token.role === 'ADMIN' || token.permissions.includes(required)` 체크
- 매칭되는 엔트리가 있는데 조건 미충족 → `/`로 리다이렉트
- `/admin` 루트는 매핑 없으므로 세션만 있으면 통과 (그 다음 `page.tsx`에서 `/admin/backup`으로 리다이렉트 → 미들웨어가 권한 체크 → 없으면 홈)
- 토큰의 `permissions` 필드 접근 방식은 기존 `auth.ts`의 JWT callback 구조 확인 후 반영

### 3-2. 서버 액션 권한 조정

**파일 1**: [app/actions/admin.ts](../app/actions/admin.ts)

**Variety 계열** (`requireAdmin` → `requirePermission('VARIETY_MANAGE')`):
- `createVariety` (29줄)
- `updateVariety` (62줄)
- `deleteVariety` (95줄)
- `deleteVarieties` (118줄)

**Farmer / ProducerGroup 계열** (`requireAdmin` → `requirePermission('FARMER_MANAGE')`):
- `createFarmer` (289줄)
- `updateFarmer` (340줄)
- `deleteFarmer` (387줄)
- `deleteFarmers` (417줄)
- `createFarmerWithGroup` (482줄)
- `createProducerGroup` (567줄)
- `updateProducerGroup` (605줄)

**파일 2**: [app/actions/excel.ts](../app/actions/excel.ts)
- `importFarmers` (73줄): `requireAdmin` → `requirePermission('FARMER_MANAGE')`

> 기타 파일(`backup.ts`, `settings.ts`, `user.ts`, `audit.ts`, `stock-excel.ts`)의 `requireAdmin`은 관리자 전용 기능(SYSTEM_MANAGE/USER_MANAGE 범위 또는 진짜 ADMIN 전용)이므로 **이번 작업 범위 외**. 건드리지 않음.

### 3-3. `lib/auth-guard.ts`

이미 `requirePermission(permission: string)` 헬퍼가 존재하므로([auth-guard.ts:35](../lib/auth-guard.ts#L35)) 추가 변경 없음. 단, TypeScript 타입 안정성을 위해 파라미터 타입을 `PermissionCode`로 조이는 건 선택사항 — 필요 시 함께 조정.

## 4. 단계별 접근

1. **분석** (완료): 원인 파악, 매핑 테이블 확정
2. **구현**:
   - (a) `proxy.ts` 내용을 경로 매핑 기반으로 재작성 후 `middleware.ts`로 리네임
   - (b) `app/actions/admin.ts`의 11개 액션 가드 교체
   - (c) `app/actions/excel.ts`의 `importFarmers` 가드 교체
3. **로컬 검증** (dev 서버):
   - ADMIN 계정: 모든 관리 메뉴 진입 + 등록/수정/삭제 정상
   - VARIETY_MANAGE만 있는 계정: `/admin/varieties` 진입 OK, 품종 CRUD OK, `/admin/farmers`는 홈으로 리다이렉트
   - FARMER_MANAGE만 있는 계정: `/admin/farmers` 진입 OK, 생산자 CRUD OK, `/admin/varieties`는 홈으로 리다이렉트
   - 권한 없는 일반 계정: `/admin/varieties`, `/admin/farmers` 전부 홈으로 리다이렉트
   - `/admin/settings` 진입: ADMIN만 통과
4. **결과 보고서 작성**: `docs/report-admin-access-fix-2026-04-20.md`
5. **worklog 업데이트**: `docs/worklog.md`에 당일 항목 추가

## 5. 리스크 / 주의사항

- **배포 동작 변화**: 현재 배포 환경에서 `proxy.ts`가 어떤 경로로든 동작 중인 상태이므로, `middleware.ts` 리네임 후에도 가드 자체는 유지됨 (블랭킷 → 매핑 기반으로 로직 교체). 차이는 권한자에게 문이 열린다는 점.
- **JWT 클레임 구조 의존**: 미들웨어 레벨에서 `token.role`, `token.permissions`를 읽어야 하므로, `auth.ts`의 `jwt` 콜백에서 실제로 `permissions`가 토큰에 들어가는지 구현 직전에 재확인. 안 들어가 있으면 먼저 토큰에 포함시켜야 함.
- **세션 재발급**: 배포 후 기존 로그인 세션의 JWT에 `permissions`가 이미 박혀있다면 즉시 반영됨. 만약 토큰 구조를 수정하게 되면 기존 사용자는 재로그인 필요.
- **설정 변경 아님**: 권한 데이터(사용자별 permissions DB 레코드) 자체는 이번 작업에서 건드리지 않음. 사용자별로 VARIETY_MANAGE/FARMER_MANAGE를 부여하는 작업은 관리자 메뉴에서 별도로 이뤄져야 함.

## 6. 범위 외 (이번 작업에서 처리하지 않음)

- `/admin/backup`, `/admin/logs` 등 SYSTEM_MANAGE 관련 서버 액션 재정렬 (기능 자체는 SYSTEM_MANAGE 보유자가 쓸 수 있어야 하지만, 이번 버그 범위 밖)
- `/admin` 루트 리다이렉트 타겟 변경 (현재 주소창 직타 외 진입 경로 없어서 사용자 영향 없음)
- 사이드바/모바일 헤더에 관리자 메뉴 노출을 권한 기반으로 필터링 (현재는 무조건 노출 상태. 이건 UX 개선 항목이라 별도 이슈로 분리)
