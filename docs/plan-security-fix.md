# 보안 이슈 수정 계획

> 작성일: 2026-04-14
> 기반 보고서: [report-security-audit-2026-04-13.md](report-security-audit-2026-04-13.md)

## 작업 목표

보안 분석 보고서에서 식별된 **긴급 4건 + 단기 4건**을 단계별로 수정한다.
- 인증 우회로 인한 비인가 데이터 접근/변조 차단
- 운영 환경에 즉시 배포 가능한 수준으로 보안 기준 끌어올리기
- 기존 기능 동작은 그대로 유지(수술적 변경)

## 작업 범위 (Scope)

### 포함
- NEXTAUTH_SECRET 교체 가이드
- middleware.ts 신규 추가
- Server Action 인증/권한 가드 일괄 적용
- backup.ts ADMIN 권한 체크
- 엑셀 업로드 검증(타입/크기/확장자)
- next.config.ts 보안 헤더
- auth.ts debug 비활성화
- 에러 메시지 일반화

### 제외 (별도 작업)
- Rate Limiting 도입 (중장기)
- 의존성 정리 (별도 PR)
- Zod 검증 확대 (별도 PR)
- OneDrive 외부 경로 이동 (인프라 작업)

---

## 단계별 접근

### Phase 1 — 인증 가드 헬퍼 신설 (선행 작업)

**신규 파일**: `lib/auth-guard.ts`

공통 헬퍼 3종을 만들어 모든 Action에서 재사용:
```ts
requireSession()  // 세션 존재만 확인 (USER 이상)
requireAdmin()    // ADMIN role 확인
requirePermission(perm: string) // 특정 permission 확인
```

`actions/user.ts`에 이미 있는 `requireAdmin` 패턴을 헬퍼로 승격하고, 이 파일은 헬퍼를 import하도록 리팩터.

---

### Phase 2 — Server Action 인증 적용 (긴급 #2, #3)

#### 적용 대상 (12개 파일)
| 파일 | 적용 가드 | 비고 |
|------|----------|------|
| `actions/backup.ts` | `requireAdmin` | 기존 세션 체크를 ADMIN으로 강화 |
| `actions/stock.ts` | `requireSession` | 모든 export 함수 |
| `actions/milling.ts` | `requireSession` | 모든 export 함수 |
| `actions/release.ts` | `requireSession` | 모든 export 함수 |
| `actions/admin.ts` | `requireAdmin` | 품종/생산자 CRUD |
| `actions/excel.ts` | `requireSession` | 입출력 모두 |
| `actions/stock-excel.ts` | `requireSession` | |
| `actions/release-excel.ts` | `requireSession` | (보고서 누락분 함께 조치) |
| `actions/milling-excel.ts` | `requireSession` | (보고서 누락분 함께 조치) |
| `actions/audit.ts` | `requireAdmin` | 감사 로그 열람 |
| `actions/dashboard.ts` | `requireSession` | |
| `actions/settings.ts` | `requireAdmin` | 시스템 설정 변경 |
| `actions/statistics.ts` | `requireSession` | (보고서 누락분) |
| `actions/stock-statistics.ts` | `requireSession` | (보고서 누락분) |
| `actions/output-statistics.ts` | `requireSession` | (보고서 누락분) |

각 파일의 모든 export 함수 첫 줄에 `await requireXxx()` 추가.

---

### Phase 3 — middleware.ts 신설 (긴급 #3)

**신규 파일**: 프로젝트 루트 `middleware.ts`

NextAuth `withAuth` 사용:
- `/login`, `/api/auth/*`, `/_next/*`, 정적 파일 → 통과
- 그 외 모든 경로 → 세션 필요
- `/admin/*` → ADMIN role 필요(JWT token.role 검사)

매처(matcher) 설정으로 정적 자원 제외.

---

### Phase 4 — 파일 업로드 검증 (높음 #4)

`actions/excel.ts`, `actions/stock-excel.ts`, `actions/release-excel.ts`, `actions/milling-excel.ts`에 공통 검증 추가:

**신규 파일**: `lib/file-validation.ts`
```ts
validateExcelUpload(file: File): void
  - MIME: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        | application/vnd.ms-excel
  - 확장자: .xlsx, .xls
  - 최대 크기: 10MB
  - 위반 시 throw
```

---

### Phase 5 — next.config.ts 보안 헤더 (중간 #5)

`headers()` 함수 추가:
- `Content-Security-Policy`: 우선 Report-Only로 시작 (운영 영향 최소화)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

CSP는 Next.js inline script와 충돌 가능성 있어 첫 배포는 Report-Only 권장.

---

### Phase 6 — 잡다한 정리 (중간 #6, 낮음 #7)

- `auth.ts:100`: `debug: true` → `debug: process.env.NODE_ENV === 'development'`
- 에러 메시지 일반화: `error.message` 그대로 반환하던 곳을
  - 클라이언트엔 일반 메시지(`'작업 처리 중 오류가 발생했습니다'`)
  - 서버 로그엔 상세 `console.error(error)` 유지
  - 대상: `backup.ts`, `admin.ts`, `milling.ts`, `release.ts`, `stock.ts`

---

### Phase 7 — NEXTAUTH_SECRET 교체 안내 (긴급 #1)

코드 변경 없음. 사용자에게 가이드 제공:
1. `openssl rand -base64 32` 실행 결과 받기
2. 로컬 `.env`와 Vercel 환경변수 양쪽 교체
3. 교체 후 모든 사용자 강제 재로그인됨을 안내

(이 항목은 사용자가 직접 처리해야 하므로 마지막 단계로 안내만 함)

---

## 변경 파일 요약

### 신규 파일 (3)
- `lib/auth-guard.ts`
- `lib/file-validation.ts`
- `middleware.ts`

### 수정 파일 (약 19)
- `auth.ts`
- `next.config.ts`
- `app/actions/*.ts` × 16
- `app/actions/user.ts` (헬퍼 사용으로 리팩터)

---

## 검증 방법

1. **타입 체크**: `npm run build` 통과
2. **수동 시나리오**:
   - 비로그인 상태로 `/admin` 접근 → `/login` 리다이렉트
   - 일반 USER로 `/admin/users` 접근 → 차단
   - 일반 USER로 `/admin/backup` 접근 → 차단
   - 로그인 후 정상 기능(재고/도정/출고 CRUD) 동작 확인
3. **엑셀 업로드**:
   - 정상 .xlsx 업로드 OK
   - .txt 파일 업로드 거부
   - 11MB 이상 파일 거부
4. **헤더 확인**: 브라우저 DevTools Network에서 응답 헤더 확인

---

## 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| middleware 매처 누락 | 정적 자원까지 차단되어 페이지 깨짐 | 매처에 `_next`, 이미지 확장자 제외 패턴 명시 |
| Action 가드 추가 후 호출부 에러 처리 누락 | 화면에 throw가 그대로 노출 | 클라이언트 호출부 try/catch 확인, 필요 시 toast 처리 |
| CSP가 Next.js inline script 차단 | 화면 깨짐 | Report-Only로 시작, 위반 로그 본 뒤 enforcing 전환 |
| ADMIN 권한 강화로 기존 USER가 backup 접근 못함 | 의도된 동작 | 사용자에게 사전 공지 |

---

## 작업 순서

1. Phase 1 (헬퍼) → 2. Phase 2 (Action 가드) → 3. Phase 3 (middleware)
4. Phase 4 (업로드 검증) → 5. Phase 5 (헤더) → 6. Phase 6 (debug/에러)
7. `npm run build` 검증 → 8. 결과보고서 작성 → 9. Phase 7 안내

---

## 승인 요청 사항

- [ ] 위 범위(Phase 1~6 코드 변경 + Phase 7 안내)로 진행해도 될지
- [ ] CSP는 처음에 Report-Only로 둘지, 아예 enforcing으로 갈지
- [ ] backup.ts를 ADMIN 전용으로 강화해도 되는지(기존 일반 USER 사용 사례 있는지)
- [ ] 단일 PR로 묶을지, Phase 단위로 나눌지
