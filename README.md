# Milling-Log

도정공장 운영관리 PWA. 도정 작업·농가 재고·출고 내역을 한 곳에서 기록하고, 통계 페이지에서 수율·재고·출고 현황을 분석한다.

## 주요 기능

- **도정 기록** — 배치별 투입/생산량, 도정구분, 품종, 비고
- **농가/재고 관리** — 입고, 처리 상태, 미처리 잔량 추적
- **출고 관리** — 포장 규격별 출고, 출고처 관리
- **통계 분석** — 도정 실적(수율), 농가/재고, 포장/출고 3종 페이지
- **사용자/권한** — 카카오 OAuth 로그인, USER/ADMIN 권한 분리
- **감사 로그 / 백업·복원** — ADMIN 전용
- **PWA** — 오프라인 캐싱, 모바일 홈 화면 추가, 바텀 네비게이션

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, Server Actions) |
| UI | React 19, TypeScript 5, Tailwind CSS 4, Radix UI, lucide-react |
| 차트 / 테이블 | Recharts, TanStack React Table |
| 인증 | NextAuth v4 (카카오 OAuth) + Prisma Adapter |
| DB / ORM | PostgreSQL (Neon) + Prisma 5 |
| 검증 | Zod, react-hook-form |
| PWA | next-pwa (workbox 기반 서비스워커) |
| 엑셀 | xlsx |
| 배포 | Vercel |

## 폴더 구조

```
app/
├── (dashboard)/       인증된 사용자 영역
│   ├── milling/       도정 기록
│   ├── stocks/        농가/재고
│   ├── releases/      출고
│   ├── statistics/    통계 (milling, stock, output, millingtype)
│   └── admin/         ADMIN 전용 (사용자/감사로그/백업)
├── login/
├── api/auth/          NextAuth
└── actions/           Server Actions

components/            재사용 컴포넌트 (UI, 차트, 통계)
lib/                   유틸 / 인증 가드 / 검증 / Prisma 클라이언트
prisma/                schema.prisma + 마이그레이션 + seed
docs/                  계획서(plan-*) / 결과보고서(report-*) / 작업일지(worklog)
public/                정적 자산, manifest, 서비스워커
```

## 개발 환경 셋업

### 1. 의존성 설치

```bash
npm install
```

`postinstall`에서 `prisma generate`가 자동 실행된다.

### 2. 환경변수 (`.env.local`)

```bash
# DB
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<openssl rand -base64 32>"

# Kakao OAuth
KAKAO_CLIENT_ID="..."
KAKAO_CLIENT_SECRET="..."
```

### 3. DB 마이그레이션

```bash
npx prisma migrate dev
npx prisma db seed   # 선택: 초기 데이터
```

### 4. 개발 서버 실행

```bash
npm run dev          # localhost:3000
npm run dev:host     # 0.0.0.0 바인딩 (모바일 LAN 테스트용)
```

## 빌드 & 배포

```bash
npm run build
npm run start
```

Vercel 자동 배포. 환경변수는 Vercel 대시보드에서 설정.

## 기여 가이드

본 프로젝트는 **계획 → 작업 → 보고**의 워크플로우를 따른다.

1. **계획서 작성** — `docs/plan-{작업명}.md`에 목표·범위·접근 방식 기록
2. **승인 후 작업** — 승인된 계획만 코드 변경
3. **결과보고서** — 작업 완료 후 `docs/report-{작업명}-{날짜}.md`에 변경 요약·결정 사항 기록
4. **작업일지** — 커밋 시 `docs/worklog.md`에 일별 항목 추가

### 코딩 원칙

- **불변성**: spread operator로 새 객체 생성, 직접 변경 금지
- **시크릿**: 하드코딩 금지, 항상 환경변수
- **파일 800줄 / 함수 50줄** 제한
- **시스템 경계에서만 검증**: 사용자 입력·외부 API는 Zod로 검증, 내부 코드는 신뢰
- **수술적 변경**: 요청한 것만 변경, 인접 코드 정리는 별도 작업

### 보안

- 모든 Server Action은 `requireSession()` / `requireAdmin()` 가드 적용
- `/admin/*` 라우트는 [proxy.ts](proxy.ts)에서 권한 체크
- CSP·HSTS·X-Frame-Options 등 보안 헤더는 [next.config.ts](next.config.ts)에서 설정
- 파일 업로드는 [lib/file-validation.ts](lib/file-validation.ts)에서 MIME/확장자/크기 검증
