# 보안 이슈 수정 결과보고서

> 작업일: 2026-04-14
> 기반 계획서: [plan-security-fix.md](plan-security-fix.md)
> 기반 분석서: [report-security-audit-2026-04-13.md](report-security-audit-2026-04-13.md)

## 작업 요약

보안 분석 보고서의 긴급 4건 + 단기 4건을 단일 PR로 한 번에 수정 완료. 빌드 검증(`npm run build`) 성공.

---

## 이슈별 조치 결과

| # | 심각도 | 이슈 | 조치 | 상태 |
|---|--------|------|------|------|
| 1 | 긴급 | NEXTAUTH_SECRET 예측 가능 | 사용자 직접 교체 안내 (아래 "후속 조치" 참고) | 안내됨 |
| 2 | 긴급 | Server Action 인증 없음 | 16개 action 파일 전부 가드 적용 | ✅ 완료 |
| 3 | 긴급 | middleware 부재 → admin 라우트 무방비 | 기존 `proxy.ts`(Next 16의 middleware)에 ADMIN 체크 추가 | ✅ 완료 |
| 4 | 긴급 | backup.ts 세션만 체크, ADMIN 미확인 | `requireAdmin`으로 강화 | ✅ 완료 |
| 5 | 높음 | 엑셀 업로드 검증 부재 | `lib/file-validation.ts` 신설 + import 경로 적용 | ✅ 완료 |
| 6 | 중간 | 보안 HTTP 헤더 미설정 | `next.config.ts` 헤더 6종 추가 (CSP는 Report-Only) | ✅ 완료 |
| 7 | 중간 | NextAuth debug=true (프로덕션 노출) | `debug: NODE_ENV==='development'`로 변경 | ✅ 완료 |
| 8 | 낮음 | 에러 메시지 내부 정보 노출 | `lib/error-sanitize.ts`로 민감 정보 필터 | ✅ 완료 |

---

## 변경 내용 상세

### 신규 파일 (4)
- [lib/auth-guard.ts](../lib/auth-guard.ts)
  - `requireSession()`, `requireAdmin()`, `requirePermission()` 3종 헬퍼
  - `AuthError`, `ForbiddenError` 커스텀 에러 클래스
- [lib/file-validation.ts](../lib/file-validation.ts)
  - `validateExcelUpload(file)`: MIME / 확장자(.xlsx, .xls) / 최대 10MB / 빈 파일 검증
- [lib/error-sanitize.ts](../lib/error-sanitize.ts)
  - `sanitizeErrorMessage(error, fallback)`: Prisma/경로/스택 등 민감 패턴 감지 시 fallback 반환

### 수정 파일 (20)

**Server Actions (16)** — 인증 가드 적용
- [app/actions/user.ts](../app/actions/user.ts) — 기존 private `requireAdmin` 제거, 공용 헬퍼 import
- [app/actions/admin.ts](../app/actions/admin.ts) — 읽기(3)는 session, 쓰기(11)는 admin
- [app/actions/backup.ts](../app/actions/backup.ts) — ADMIN 전용 강화 + 에러 메시지 일반화
- [app/actions/audit.ts](../app/actions/audit.ts) — 로그 조회/내보내기는 admin, 경로별 최종 업데이트는 session
- [app/actions/dashboard.ts](../app/actions/dashboard.ts) — session
- [app/actions/settings.ts](../app/actions/settings.ts) — 읽기 session, 저장 admin
- [app/actions/stock.ts](../app/actions/stock.ts) — 전체 session + 에러 일반화
- [app/actions/milling.ts](../app/actions/milling.ts) — 전체 session + 에러 일반화
- [app/actions/release.ts](../app/actions/release.ts) — 전체 session + 에러 일반화
- [app/actions/statistics.ts](../app/actions/statistics.ts) — session
- [app/actions/stock-statistics.ts](../app/actions/stock-statistics.ts) — session
- [app/actions/output-statistics.ts](../app/actions/output-statistics.ts) — session
- [app/actions/excel.ts](../app/actions/excel.ts) — export는 session, import는 admin + 파일 검증
- [app/actions/stock-excel.ts](../app/actions/stock-excel.ts) — 동일 패턴
- [app/actions/milling-excel.ts](../app/actions/milling-excel.ts) — session
- [app/actions/release-excel.ts](../app/actions/release-excel.ts) — session

**인프라 (4)**
- [proxy.ts](../proxy.ts) — `/admin/*` ADMIN 권한 체크 추가 (Next 16의 middleware 파일)
- [auth.ts](../auth.ts) — `debug: true` → `debug: process.env.NODE_ENV === 'development'`
- [next.config.ts](../next.config.ts) — `headers()` 추가, CSP(Report-Only) + X-Frame-Options/X-Content-Type-Options/HSTS/Referrer-Policy/Permissions-Policy

---

## 주요 결정 사항

1. **Next.js 16의 middleware → proxy 이름 변경 반영**
   - 분석 보고서는 "middleware.ts 부재"로 판단했지만 실제로는 Next 16에서 `middleware.ts`가 `proxy.ts`로 리네이밍됨. 기존 `proxy.ts`가 이미 세션 체크를 하고 있어서, 여기에 ADMIN 라우트 분기만 추가함.
   - 혼동 방지를 위해 처음에 추가했던 `middleware.ts`는 빌드 에러 후 제거.

2. **admin.ts 읽기 함수는 `requireSession`**
   - `getVarieties`, `getFarmersWithGroups`, `getProducerGroups`는 재고/도정 폼의 드롭다운에서도 사용하므로 ADMIN으로 잠그면 일반 USER가 폼을 못 채움. 읽기 = session, 쓰기 = admin으로 분리.

3. **settings.ts의 `getYieldRates`/`getYieldRate`도 session**
   - 통계 페이지에서 목표 수율 표시에 사용되므로 일반 사용자 접근 필요. 저장(`saveYieldRates`)만 admin.

4. **CSP는 Report-Only로 시작**
   - Next.js inline script와 충돌 가능성 → Report-Only로 먼저 배포 후 브라우저 콘솔에서 위반 확인, 문제 없으면 enforcing으로 전환 예정.
   - `unsafe-inline`, `unsafe-eval` 포함한 이유: Next.js App Router의 hydration 및 PWA 서비스 워커 호환.

5. **에러 메시지 일반화는 sanitize 헬퍼로**
   - 모든 `error.message`를 무작정 가리면 비즈니스 메시지("해당 작목반에 이미 생산자번호 X가 존재")도 사라져 UX가 나빠짐.
   - 대신 Prisma/경로/스택 키워드가 포함된 메시지만 fallback으로 치환하는 `sanitizeErrorMessage` 헬퍼 도입.

6. **`AuthError`/`ForbiddenError` 클래스 예약**
   - 현재는 단순 throw로 사용. 추후 middleware/래퍼에서 HTTP 상태코드 매핑할 때 활용 가능하도록 클래스만 만들어 둠.

---

## 빌드 검증

```
✓ Compiled successfully in 55s
  Running TypeScript ...
✓ Generating static pages using 7 workers (19/19)
```

- 모든 라우트 정상 빌드됨
- Proxy (Middleware) 항목 확인
- 타입 에러 없음

---

## 확인이 필요한 사항 (후속 조치)

### 1. NEXTAUTH_SECRET 교체 (사용자 직접 수행 필요)
```bash
openssl rand -base64 32
```
- 위 명령으로 새 값 생성 후:
  - 로컬 `.env` 파일의 `NEXTAUTH_SECRET` 교체
  - Vercel 대시보드 → Environment Variables 에서 교체
- **주의**: 교체 후 배포하면 현재 로그인한 모든 사용자가 자동 로그아웃됨 (JWT 서명 키 변경)

### 2. CSP 위반 모니터링 (1~2주 권장)
- 배포 후 브라우저 DevTools → Console 탭에서 `[Report Only]` 경고 확인
- 위반이 없거나, 허용해야 할 정상 케이스만 남으면 `Content-Security-Policy-Report-Only` → `Content-Security-Policy`로 전환
- 일반 사용자도 콘솔을 열 일은 거의 없으니 개발자가 주요 페이지(대시보드/통계/엑셀 업로드 등)를 직접 돌려보며 검증 권장

### 3. 기존 USER 중 backup.ts 사용자 있는지 확인
- 이제 ADMIN만 DB 백업/복원 가능. 혹시 일반 USER가 백업 작업을 하던 케이스가 있으면 해당 사용자를 ADMIN으로 승격하거나, 별도 permission 추가 검토.

### 4. 이번에 제외된 항목 (별도 작업)
- Rate Limiting (중장기)
- 의존성 정리 (`bcryptjs`, `next-pwa` 등)
- Zod 검증 확대
- OneDrive 외부 경로 이동

---

## 위험 요소 및 대응

| 위험 | 상태 | 대응 |
|------|------|------|
| proxy.ts 매처 누락으로 정적 자원까지 차단 | 해소 | 기존 proxy.ts가 이미 `api/auth`, `_next/static`, `_next/image`, `favicon`, `manifest`, `icon-*`, `sw.js`, `workbox-*` 제외 |
| Action 가드 throw → 클라이언트 에러 노출 | 주의 | 대부분 try/catch 안쪽에 위치해 기존 에러 포맷 유지. 리트라이 또는 세션 갱신 플로우는 별도 개선 필요 시 검토 |
| CSP가 inline script 차단 | 완화 | Report-Only로 시작. 위반 확인 후 enforcing 전환 |
| ADMIN 승격 없는 USER가 백업 접근 시도 | 의도된 동작 | 위 "확인이 필요한 사항 #3" 참고 |

---

## 다음 단계

1. 사용자가 `NEXTAUTH_SECRET` 교체 (직접)
2. 개발 서버 `npm run dev`로 주요 화면 동작 확인
3. 로컬에서 비로그인 상태로 `/admin/users` 접근 → 로그인 페이지 리다이렉트 검증
4. 일반 USER 계정으로 `/admin/backup` 접근 → 루트로 리다이렉트 검증
5. 이상 없으면 커밋/배포
