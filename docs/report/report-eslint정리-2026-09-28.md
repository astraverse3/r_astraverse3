# eslint 기존 오류 정리 — 결과보고서

- 날짜: 2026-09-28
- 계획서: `docs/plan/plan-eslint정리.md`
- 커밋: `83cb2d0`(P0) · `8876d9d`(P1) · `cb4adef`(P2) · `2a6376b`(P3) · `4fa97fc`(P4-a) · `1fc3765`(P4-b) · `b0d6038`(P4-c) · `f3e9c6e`(P5)

## 1. 결과

| 기준 | 시작 | 끝 |
|---|---:|---:|
| `npx eslint .` (= `npm run lint`, 프로젝트 전체) | 517 (오류 366 · 경고 151) | **0** |
| `npx tsc --noEmit` | 통과 | 통과 |
| `npm test` | 445 통과 | 445 통과 |

단계별 수치: 517 → P0 348 → P1 310 → P2 205 → P3 159 → P4 37 → P5 **0**.
앞으로 보고할 때 「eslint 0」은 **프로젝트 전체 기준**이다.

## 2. 변경 요약

| 단계 | 내용 | 동작 영향 |
|---|---|---|
| P0 | `eslint.config.mjs` — `docs/**` 제외(디자인 핸드오프 시안 130건), CommonJS(`*.js`·`*.cjs`)의 `no-require-imports` 해제, `no-img-element` 해제 | 없음 |
| P1 | `types/next-auth.d.ts`에 `permissions` 선언 → `@ts-ignore` 41건 · `session.user` 캐스트 5곳 삭제 | 없음 |
| P2 | 안 쓰는 import·변수·함수·catch 바인딩 삭제, JSX 따옴표 엔티티화, scripts `prefer-const` | 없음 |
| P3 | `catch (e: any)` → `unknown` · `(result as any).error` → `'error' in result` · Prisma 조회 조건 → `Prisma.*WhereInput` 등 · 엑셀 행 → `Record<string, unknown>` | 없음 |
| P4 | 화면 props·그룹 집계·차트 콜백의 `any` → **읽는 필드만 적은 구조 타입**(도정 목록 · 원물재고 벼/잡곡 · 장바구니 · 생산자 · 감사로그 · 출고 · 공지 · PWA · 통계 차트) | 없음 |
| P5 | react-hooks 37건 — 건별 분류 후 줄마다 `-- 이유`를 단 `eslint-disable-next-line` | 없음(주석만) |

## 3. 주요 결정 · 발견

- **`@ts-ignore` 41건 중 실제로 억제하던 건 3건뿐** — 전부 `session.user.permissions` 타입 누락 한 원인(`auth.ts`는 이미 세션에 싣고 있었다). 나머지 38건은 잔재.
- **`as any`가 가리던 것들** (동작은 그대로 두고 타입만 사실에 맞춤)
  - `UserPermissionDialog` — `updateUserPermissions`는 `error`를 반환한 적이 없다(실패=throw). 에러 문구 가지는 원래 죽은 코드였다 → 고정 문구만 남김.
  - `MillingOutputInput.stockId` — DB에서 복원한 포장 줄은 `null`이 오가는데 선언은 `number`였다 → `number | null`. 서버 `resolveStock`은 원래 null을 받는다.
  - 원물재고 래퍼에 `actualFarmer`가 빠진 `Stock` 복사본이 있었다(모바일 카드가 읽는 필드) → `page.tsx`의 `Stock` 하나로.
  - 도정 목록 `title` — 필수로 선언돼 있었지만 아무도 안 읽고, 대시보드가 넘기는 목록엔 없었다 → 제거.
  - 벼 `StockGroup.items` — 서버가 빈 배열만 넣고 아무도 안 읽었다 → 제거.
- **그룹 집계의 `_farmerIds` 몰래 붙이기** — 그룹 객체에 임시 필드를 붙였다 지우던 것을 별도 맵으로(서버 벼 · 클라이언트 잡곡). 결과 동일.
- **인계 메모의 「쓸모없는 disable 4건」은 틀렸다** — 3건은 작성자가 억제하려던 것이 `useEffect(` 줄에 붙어 **한 줄 빗나간** 것이었다. 제자리로 옮기고, 진짜 불필요한 1건만 삭제.
- **P5는 고치지 않았다** — 37건 전부 의도된 패턴(열릴 때 URL 복원 · 마운트 후 브라우저 값 · 로드 뒤 반응 · 일부러 뺀 의존성 · React Compiler 미사용이라 참고용). 30곳 가까운 UI 동작을 key 초기화·`useSyncExternalStore`로 다시 짜는 건 이득 없이 위험만 크다(사용자 선택 A안).
- 새 파일: `components/statistics/chart-tooltip.ts`(차트 툴팁 공용 구조 타입).

## 4. 확인이 필요한 사항

- **브라우저 확인은 필요 없다** — 모든 단계가 타입·주석·미사용 코드 삭제뿐이고, 로직을 바꾼 곳(`admin getFarmers` 작목반 조건 누적, 그룹 집계 맵)은 같은 쿼리·같은 결과를 만든다. 그래도 한 번 둘러본다면: **생산자 관리 검색(작목반명+인증+연도 조합)**, **원물재고 그룹의 생산자 수**, **잡곡 원물 그룹의 생산자 수**.
- 미푸시 커밋 8개 + 문서 커밋.
- 남은 부채(이번 범위 밖)
  - 백로그 §29 뿌리(공용 `ActionResult<T>`) — 이번엔 호출부만.
  - `misc-stock` `sourceType`은 URL 문자열을 검증 없이 enum으로 캐스트(기존 동작 = Prisma가 거절) — 경계 검증은 별건.
  - P5의 disable 자리들은 React 권장 패턴으로 옮길 수 있다(원하면 별도 작업).
  - `app/(dashboard)/raw-stocks/page.tsx`의 `Stock.farmer.group`은 non-null로 선언돼 있으나 실제론 null일 수 있다(읽는 곳은 전부 `?.`라 무해).
