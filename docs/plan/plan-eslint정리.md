# eslint 기존 오류 정리 — 계획서

- 작성: 2026-09-28
- 계기: 사용자 「eslint 에러 계속 따라다니는데, 큰 작업 끝나고 나면 확인한번 하자」 — 발주서 M1 종결 후 착수
- 🔴 HARD-GATE 대상(파일 90개 이상) — **승인 후 착수**

## 1. 목표

`npm run lint`(= `eslint`, 프로젝트 전체)를 **오류 0 · 경고 0**으로 만든다.
그동안 보고서의 「eslint 0」은 변경 폴더만 돌린 값이었다 — 이번에 전체 기준으로 맞추고, 앞으로 보고할 때도 전체 기준을 쓴다.

**동작은 바꾸지 않는다.** 타입·주석·미사용 코드 정리가 원칙이고, 동작이 바뀔 수 있는 건 P5(react-hooks) 한 묶음뿐이다 — 거기만 브라우저 확인을 받는다.

## 2. 현황 (2026-09-28 실측, HEAD `a20a076`)

| 범위 | 오류 | 경고 | 합계 |
|---|---:|---:|---:|
| `eslint .` (전체 = `npm run lint`) | 366 | 151 | **517** |
| └ `app` `components` `lib` | 242 | 96 | 338 |
| └ `docs/handoff/**` (디자인 핸드오프 번들) | | | 130 |
| └ `scripts/` · 루트 일회성 js | | | 44 |
| └ `auth.ts` `middleware.ts` `next.config.ts` `types/` | | | 8 |

**app·components·lib 338건 규칙별**

| 규칙 | 건수 | 성격 |
|---|---:|---|
| `no-explicit-any` | 169 | `: any` 100 · `: any[]` 32 · `as any` 20 · `catch (e: any)` 9 · 기타 8 |
| `no-unused-vars` (경고) | 80 | 미사용 import·변수 |
| `ban-ts-comment` | 33 | **전부 `@ts-ignore`, 전부 `session.user` 한 뿌리** |
| `react-hooks/set-state-in-effect` | 27 | effect 안 setState (동작 관련) |
| `react/no-unescaped-entities` | 11 | JSX 안 `'` `"` |
| `@next/next/no-img-element` (경고) | 8 | 로고·아바타 `<img>` |
| 쓸모없는 disable 지시문 (경고) | 4 | `set-state-in-effect` 규칙이 이미 조용해진 자리 |
| `react-hooks/exhaustive-deps` (경고) | 3 | |
| `react-hooks/purity` · `refs` · `incompatible-library` | 1·1·1 | |

### 사전 실험 — `@ts-ignore` 33건을 전부 지우고 tsc

- **30건은 억제할 대상이 없는 잔재**(지워도 tsc 통과).
- **남는 3건은 전부 같은 원인** — `session.user.permissions`가 `types/next-auth.d.ts`에 선언돼 있지 않다.
  `auth.ts:40`은 실제로 `permissions`를 세션에 싣는데 타입만 빠져 있었다(권한 5→2 단순화 때 누락 추정).
- 실험 후 `git checkout`으로 원복함(현재 작업트리 깨끗).

## 3. 먼저 정할 것 (사용자 결정)

### 결정 A — lint 대상 범위

| 대상 | 건수 | 제안 |
|---|---:|---|
| `docs/**` | 130 | **ignore** — Claude Design 핸드오프 번들(시안 코드). 우리 코드가 아니고 고칠 이유도 없다 |
| `scripts/**/*.js`·`*.cjs`, 루트 `check_db.js` `test.js` `verify-release.js` `replace-colors.js` | 36 중 32 | **CommonJS 파일만 `no-require-imports` 끔** — `require`가 틀린 게 아니라 그 파일 형식이 원래 그렇다 |
| `scripts/*.ts` 나머지 (prefer-const 3 · any 1 · unused 몇 건) | ~8 | 그냥 고친다 |

→ 제안대로면 scripts는 lint 대상에 **남는다**(새로 만드는 스크립트의 실수는 계속 잡힘). 통째로 ignore하는 것보다 낫다고 봄.
→ 루트 일회성 js 4개(2월 이후 안 건드림)는 **지우지 않는다** — 수술적 변경 원칙. 지울지는 별건.

### 결정 B — `<img>` 경고 8건

로고 3곳 + Google 아바타(외부 URL) 5곳. `next/image`로 바꾸면 아바타는 `next.config`에 `remotePatterns`를 추가해야 하고 렌더링이 달라진다.
→ **제안: 설정에서 이 규칙을 끈다**(이유 주석). 이득(이미지 최적화)이 거의 없는 작은 로고·아바타뿐이다.

## 4. 단계 (규칙 단위로 커밋 분리)

각 단계 끝마다 `tsc --noEmit` · `npm test` · `npx eslint .` 수치를 확인하고 커밋한다. (`next build` 금지 — dev 서버 상시 기동)

| 단계 | 내용 | 파일 수(추정) | 동작 영향 |
|---|---|---:|---|
| **P0** | `eslint.config.mjs` — `docs/**` ignore, CommonJS `no-require-imports` off, `no-img-element` off | 1 | 없음 |
| **P1** | `types/next-auth.d.ts`에 `permissions: string[]` 추가(Session.user · User · JWT) → `@ts-ignore` 33건 + `middleware.ts` 2건 삭제 → 덤으로 `session.user as any` 4곳(`mobile-header`·`header-user-profile`·`notice.ts:60`·`desktop-sidebar` 캐스트)도 캐스트 없이 | ~27 | 없음(타입만) |
| **P2** | 기계적 정리 — 미사용 import·변수 80 · unescaped 11 · 쓸모없는 disable 4 · scripts ts 몇 건 | ~40 | 없음 |
| **P3** | `any` 중 **패턴형** — `catch (e: any)` 9 → `unknown` + `instanceof Error` · `(result as any).error` → `'error' in result`(백로그 §29의 호출부 방식) · `XLSX.sheet_to_json(...) as any[]` → `Record<string, unknown>[]` | ~15 | 없음 |
| **P4** | `any` 중 **타입 작성형** — 컴포넌트 props·그룹 객체의 `: any`(`stock-list-client` 21 · `misc-stock-list-client` 12 · `stock.ts` 12 · `farmer-list` 10 · `recent-logs-list` 9 · 도정 행/카드 15 · 통계 차트 13 …). **실제로 읽는 필드만 적은 구조 타입**으로(Prisma 페이로드로 못 박지 않는다). 폴더 단위로 커밋 쪼갬 | ~40 | 없음(타입만) |
| **P5** | react-hooks 33건 — 건별로 분류해서 **(가) 고칠 것**은 고치고 **(나) 의도된 동기화**(열릴 때 URL→입력칸 복원 같은)는 `eslint-disable-next-line` + **이유 한 줄**. 분류표를 먼저 보여주고 진행 | ~25 | 🔴**있을 수 있음** — (가)만 브라우저 확인 요청 |

## 5. 하지 않는 것

- 백로그 **§29 뿌리 수정**(공용 `ActionResult<T>` + 액션 전체에 명시적 반환 타입) — 액션 파일 전체가 바뀌는 별건. 이번엔 호출부 `'error' in result`까지만.
- 루트 일회성 js 삭제, `next/image` 전환, eslint 규칙 강화.
- 파일 800줄·함수 50줄 초과 정리(별건).

## 6. 위험과 대응

- **P1** — 타입을 넓히면서 `permissions` 없는 옛 세션(재로그인 전)이 런타임에 `undefined`일 수 있다 → 이미 모든 사용처가 `|| []`로 받고 있는지 확인하고, 아닌 곳은 손대지 않고 보고.
- **P4** — 구조 타입이 실제 데이터와 어긋나면 tsc가 호출부에서 잡는다(그게 목적). 막히면 그 자리만 좁은 타입으로 두고 보고.
- **P5** — 동작 변경 가능. 분류표 → 승인 → 수정 → 사용자 브라우저 확인 순서. P0~P4와 분리해 **다른 날 해도 됨**.

## 7. 완료 기준

- `npx eslint .` → **0 errors, 0 warnings** (P5까지 끝났을 때. P4까지면 react-hooks 33건만 남음)
- `npx tsc --noEmit` 통과 · `npm test` 통과
- 결과보고서 `docs/report-eslint정리-{날짜}.md` · worklog 갱신
