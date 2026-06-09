# 보안 분석 보고서 - milling-log

> 분석일: 2026-04-13

## 기술 스택 요약

- Next.js (App Router, Server Actions) + TypeScript
- NextAuth v4 (카카오 OAuth)
- PostgreSQL (Neon) + Prisma ORM
- Vercel 배포

---

## 발견된 보안 이슈

### [긴급] 1. NEXTAUTH_SECRET이 예측 가능한 값

`NEXTAUTH_SECRET`이 `simsimi_milling_log_secret_key_123456`처럼 추측 가능한 문자열로 설정되어 있음.
JWT 토큰 위조가 가능해질 수 있으므로 `openssl rand -base64 32`로 생성한 랜덤 값으로 즉시 교체 필요.

### [긴급] 2. Server Actions 대부분에 인증 검사 없음

`'use server'`로 선언된 17개 Action 파일 중 **3개만** 인증 검사를 수행함.
Next.js Server Actions는 자동으로 HTTP POST 엔드포인트로 노출되므로, 비인증 사용자가 직접 호출 가능.

| 파일 | 인증 검사 | 위험 |
|------|-----------|------|
| `actions/user.ts` | O (ADMIN) | - |
| `actions/notice.ts` | O (권한 체크) | - |
| `actions/backup.ts` | △ (세션만, ADMIN 미체크) | 일반 USER도 DB 백업/복원 가능 |
| `actions/stock.ts` | **X** | 비인증 재고 CRUD |
| `actions/milling.ts` | **X** | 비인증 도정 CRUD |
| `actions/release.ts` | **X** | 비인증 출고 처리 |
| `actions/admin.ts` | **X** | 비인증 품종/생산자 CRUD |
| `actions/excel.ts` | **X** | 비인증 엑셀 import/export |
| `actions/stock-excel.ts` | **X** | 비인증 재고 엑셀 import |
| `actions/audit.ts` | **X** | 비인증 감사 로그 열람 |
| `actions/dashboard.ts` | **X** | 비인증 통계 열람 |
| `actions/settings.ts` | **X** | 비인증 시스템 설정 변경 |

### [긴급] 3. middleware.ts 부재

프로젝트 루트에 `middleware.ts`가 없음. 라우트 레벨에서 비인증 사용자를 차단하는 방어선이 전혀 없음.
관리자 페이지(`/admin/*`) 중 `users`, `notices`만 서버 컴포넌트에서 세션 체크를 수행하고, 나머지(`backup`, `varieties`, `settings`, `logs`)는 UI 접근 제어 없음.

### [높음] 4. 파일 업로드 검증 부재

`actions/excel.ts`, `actions/stock-excel.ts`에서:
- 파일 MIME 타입 검사 없음
- 파일 크기 제한 없음
- 확장자 검증 없음
- 업로드 엔드포인트에 인증 없음

XLSX는 내부적으로 ZIP 형식이므로 zip bomb 공격 가능성도 있음.

### [중간] 5. 보안 HTTP 헤더 미설정

`next.config.ts`에 다음 헤더가 설정되어 있지 않음:
- `Content-Security-Policy` (CSP)
- `X-Frame-Options` (클릭재킹 방지)
- `X-Content-Type-Options`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`
- `Permissions-Policy`

### [중간] 6. NextAuth debug 모드 프로덕션 활성화

`auth.ts:100`에 `debug: true` 설정. 인증 과정의 상세 로그(토큰 내용 포함)가 서버 로그에 출력됨.

### [낮음] 7. 에러 메시지 내부 정보 노출

다수의 Server Action에서 `error.message`를 클라이언트에 그대로 반환. DB 제약 조건, 연결 정보 등이 노출될 수 있음.

해당 파일: `backup.ts`, `admin.ts`, `milling.ts`, `release.ts`, `stock.ts`

### [낮음] 8. Rate Limiting 없음

Server Action 호출 횟수 제한이 없어 반복 호출 공격에 취약.

### [참고] 9. 의존성 이슈

- `xlsx` ^0.18.5: 더 이상 유지보수되지 않는 버전
- `@auth/prisma-adapter` (v2)와 `@next-auth/prisma-adapter` (v1) 중복 설치
- `bcryptjs`: 코드에서 미사용 (불필요 의존성)
- `next-pwa`: 유지보수 활발하지 않음

### [참고] 10. OneDrive 동기화 환경 주의

프로젝트가 `OneDrive/문서` 경로에 있어 `.env` 파일이 클라우드에 자동 동기화됨. `.gitignore`로 git에서는 제외되지만 OneDrive에는 시크릿이 업로드됨.

---

## 양호한 항목

- **SQL 인젝션**: Prisma ORM 사용으로 직접 SQL 인젝션 불가
- **XSS**: `dangerouslySetInnerHTML` 미사용, React 기본 이스케이프 활용
- **CSRF**: NextAuth v4 내장 CSRF 보호
- **.gitignore**: `.env*` 패턴 포함, 민감 파일 git 추적 제외

---

## 우선순위별 권장 조치

### 즉시 조치 (긴급)
1. `NEXTAUTH_SECRET` 강력한 랜덤 값으로 교체
2. `middleware.ts` 추가 - 비인증 사용자 라우트 차단
3. 모든 Server Action에 인증/권한 검사 추가
4. `backup.ts`에 ADMIN 권한 검사 추가

### 단기 조치 (1-2주)
5. 파일 업로드 검증 (타입, 크기, 확장자)
6. 보안 HTTP 헤더 설정
7. `auth.ts`에서 `debug: false` 설정
8. 에러 메시지 일반화 (내부 정보 제거)

### 중장기 조치
9. Rate Limiting 도입
10. 불필요 의존성 정리
11. Server Action 입력값 Zod 검증 확대
12. OneDrive 외부 경로로 프로젝트 이동 검토
