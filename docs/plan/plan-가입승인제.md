# 계획서 — 가입 승인제 · 삭제 사용자 세션 차단 · /admin 기본 거부 (백로그 §83)

작성 2026-09-30 · 근거 `docs/handoff/점검-2026-09/작업지시-1-보안.md` S1·S3·S4, `작업지시-3-디자인결정.md` T4 (둘 다 9/30 14:41 이후 수정 없음 확인)

## 목표

1. **S1** 카카오로 처음 로그인한 계정은 **승인 대기(PENDING)**. 관리자가 승인하기 전엔 `/pending` 화면만 보이고 서버 액션은 전부 실패한다
2. **S3** DB에서 삭제한 사용자는 **다음 요청부터** 막힌다(REVOKED)
3. **S4** `/admin` 아래 매핑 안 된 경로는 ADMIN이 아니면 홈으로 보낸다

- 기존 11명(ADMIN 1 · USER 10)은 **그대로**. 행을 하나도 안 바꾼다
- 공용 계정 「땅끝황토친환경」은 손대지 않는다(사용자가 직원들과 정함)

## 🔴 스키마는 안 바꾼다 (사용자 9/30 합의)

작업지시는 `User.role` 기본값을 `"PENDING"`으로 바꾸라고 하지만 **마이그레이션 없이** 간다.
- 사용자를 만드는 경로는 카카오 로그인 하나뿐이고, `auth.ts` `profile()`이 `role`을 **직접 넣는다** → DB 기본값은 실제로 안 쓰인다(`user.create` 다른 호출 0 — grep 확인)
- `role`은 `String`이라 `"PENDING"`·`"REVOKED"`를 넣는 데 스키마 변경이 필요 없다
- 로컬 = 실서버 DB라 마이그레이션은 배포 때 돈다 — 9/22 P1002 이력([[deployment_db_infra]]). 얻는 것(이중 안전장치)보다 위험이 크다

## 역할 (`lib/user-role.ts` 신규 — 단일 원천)

| 역할 | 뜻 | 들어가는 곳 |
|---|---|---|
| `ADMIN` | 전권 | 전부 |
| `USER` | 승인됨. 업무 권한은 `permissions` | 대시보드 |
| `PENDING` | 첫 로그인 · 승인 대기 | `/pending`만 |
| `REVOKED` | DB에서 지워진 사용자의 남은 세션 (**DB엔 저장 안 하는 토큰 전용 값**) | `/pending`만(문구가 다름) |

`isApprovedRole(role)` = `ADMIN`·`USER`만 true. **모르는 값·빈 값도 막힌다**(허용 목록 방식). 가드·레이아웃·`/pending`이 이 함수 하나를 쓴다.

## 변경 파일

| # | 파일 | 내용 |
|---|---|---|
| 1 | `lib/user-role.ts` (신규) + `lib/user-role.test.ts` | 역할 상수 · `isApprovedRole` · 테스트(모르는 값·빈 값·undefined → 차단) |
| 2 | `auth.ts` | `profile()` `role: "PENDING"` · `session` 콜백 기본값 `\|\| "USER"` → `\|\| "PENDING"`(비면 승인 안 된 것으로) · `jwt` 콜백 `dbUser` 없으면 `role = "REVOKED"`, `permissions = []` (S3) |
| 3 | `lib/auth-guard.ts` | `requireSession()`이 `isApprovedRole` 아니면 `AuthError` → `requirePermission`·`requireAdmin`도 이걸 거치므로 **모든 서버 액션 자동 차단** |
| 4 | `app/(dashboard)/layout.tsx` | 맨 앞에서 `getServerSession` → 승인 안 됐으면 `redirect('/pending')`(jwt 콜백이 DB를 읽어 최신값). ADMIN이면 승인 대기 인원을 `getYieldRates`와 **병렬로** 읽어 사이드바·모바일 헤더에 전달 |
| 5 | `app/pending/page.tsx` (신규, 서버) + `app/pending/pending-actions.tsx` (신규, 클라이언트) | T4 시안: 로그인 화면과 같은 중앙 카드 · 「관리자 승인을 기다리고 있어요」 · 이니셜 아바타·이름·첫 로그인 시각 · [새로고침](`router.refresh()`) · [다른 계정으로 로그인](`signOut`) · 하단 안내. **승인된 사람이 오면 `/`로.** REVOKED면 제목만 「이 계정은 더 이상 쓸 수 없어요」 |
| 6 | `middleware.ts` | S4: `/admin` 아래 매핑 없는 경로는 ADMIN 아니면 `/`로(지금 `/admin` 루트도 결국 그렇게 된다 — 동작 변화 없음) |
| 7 | `app/actions/user.ts` | `approveUser(id)` 신규 — ADMIN만, **PENDING인 행만** USER·permissions `[]`로(`updateMany where role=PENDING` — 이미 처리된 걸 다시 바꾸지 않게) + 감사로그 · `countPendingUsers()` 신규(ADMIN만) · 승인·삭제 뒤 `revalidatePath('/', 'layout')`(사이드바 뱃지가 레이아웃에 있다) |
| 8 | `app/actions/notice.ts` | `getActiveNotices`에 가드가 **아예 없다**(9/30 전수 대조) → `requireSession` 추가. PENDING 직접 호출 차단 |
| 9 | `app/(dashboard)/admin/users/page.tsx` | PENDING은 표에서 빼서 위 블록으로, 「총 N명」은 승인된 사람만 |
| 10 | `components/admin/PendingUsersBlock.tsx` (신규) | T4: PENDING 있을 때만 amber 블록 「승인 대기 N」 · 행마다 아바타·이름·첫 로그인 · [거절](`confirmDialog` 후 기존 `deleteUser`) [승인] |
| 11 | `components/desktop-sidebar.tsx` · `components/mobile-header.tsx` | 「사용자 관리」 옆 대기 인원 뱃지(ADMIN만, 0이면 없음). 시안은 사이드바만인데 관리자가 폰도 쓰니 모바일 메뉴에도 같이. **임시** — 2단계에서 헤더 종 아이콘으로 바꾼다(아래) |
| 12 | `docs/permission-matrix.md` | 「역할」 절 추가 · 변경 이력 |

12곳(신규 5) → HARD-GATE, 승인 후 착수.

## 판단한 것

- **REVOKED도 `/pending`으로** — 작업지시는 「로그인으로 보내도 됨」이라 했지만, 미들웨어가 로그인 상태의 `/login`을 `/`로 되돌려서 **무한 왕복**이 된다. `/pending`에서 「다른 계정으로 로그인」(signOut)으로 푼다
- **거절 = 삭제**(작업지시 그대로). 거절된 사람이 다시 카카오로 들어오면 새 PENDING으로 또 뜬다 — 영구 차단은 없다. 11명 규모라 이걸로 충분하다고 봄
- 승인은 기존 `updateUserRole`(ADMIN↔USER 토글)을 넓히지 않고 **전용 액션**으로 — PENDING → USER 한 방향만
- 미들웨어로 PENDING을 막지 않는다 — 쿠키 토큰은 낡을 수 있다(작업지시도 레이아웃에서 막으라고 함)

## 2단계 — 헤더 종 아이콘 (디자이너 다녀온 뒤, 사용자 9/30) — ✅ 2026-09-30 완료 (`docs/plan/plan-헤더알림.md`, 작업지시 ⑥ 간단안)

- 관리자 알림을 메뉴 뱃지 대신 **헤더 종 아이콘 + 목록**으로. 첫 항목은 「승인 대기 N명 → 사용자 관리」
- 저장하지 않고 **상태에서 계산**한다(테이블 없음). 알림 모으는 함수 하나(`getNotifications()` 식)에 종류를 한 줄씩 더하는 구조
- 요청서: `docs/handoff/요청-헤더-알림아이콘.md`. 시안이 오면 뱃지를 걷어내고 교체
- 개인별 알림·쪽지(저장 · 읽음 상태)는 별건 — 백로그 §90

## 하지 않는 것

- S2·S5·S6(백업·CSP), 공용 계정 처리, 카카오 로그인 때 계정 선택 강제
- `user.ts`의 가드가 `try` 밖인 문제(기존 패턴) — 백로그에 번호로 남긴다

## 확인 방법

- `npm test`(새 `user-role` 테스트) · `npx tsc --noEmit` · `npx eslint .` 0/0
- 🔴 **실제 PENDING은 새 카카오 계정이 있어야 볼 수 있다** — 사용자 브라우저에서:
  1. 기존 계정(ADMIN)으로 평소처럼 들어가지는지 · 사이드바에 뱃지 없는지 (**회귀가 더 위험 — 11명 전원이 영향권**)
  2. 가능하면 안 쓰는 카카오 계정으로 로그인 → `/pending` · 주소창에 `/raw-stocks` 쳐도 `/pending`
  3. ADMIN이 사용자 관리에서 승인 → 그 계정에서 새로고침 1회로 대시보드
- 배포 뒤 첫 로그인에서 기존 사용자가 막히면 **즉시 되돌릴 것**(한 커밋으로 묶는다)
