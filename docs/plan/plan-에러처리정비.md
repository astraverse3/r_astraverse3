# 계획서 — 에러 처리 정비 (+ dry-run 감사로그 · §39 잔여)

> 작성: 2026-09-29 · 상태: **승인 대기**
> 발단: 9/28 할일 전수 「2. 알려진 결함」 A·B·C ([[session_initial_injection]] · [[permission_system_2way]] · [[date_utc_slice_off_by_one]])

---

## 0. 조사 결과 — 메모보다 크다

| 항목 | 메모 | **실측(2026-09-29)** |
|---|---|---|
| 클라이언트 `.then()`에 `.catch()` 없음 | 10곳 | **17곳** (`.then` 21곳 중 4곳만 catch 있음) |
| 서버 가드가 `try` 밖 | 28개 | **108개** (액션 142개 중) |
| 가드가 `try` 안 | — | 4개 |
| `try` 자체가 없음 | — | 19개 (statistics·stock-statistics·output-statistics·settings·user) |
| 가드 자체가 없음 | — | 11개 → 7개는 위임·전용 가드(`requireNoticeManage` 등)로 정상, **4개 진짜 없음** |

조사 스크립트는 저장소 밖(scratchpad)에 뒀다. 완료 검증 때 같은 스크립트로 다시 센다.

### 왜 문제인가 — 실패 경로가 둘 다 막혀 있다

1. **서버**: 가드(`requireSession`·`requirePermission`)가 `try` 밖이라 권한·세션 오류가 결과 DTO에 안 담기고 **throw로 샌다.**
   프로덕션 Next는 throw된 메시지를 가린다 → 클라이언트는 "무슨 오류인지" 알 길이 없다.
2. **클라이언트**: 그 reject를 받는 `.catch()`가 없으면 로딩 상태가 영영 안 풀린다.
   예: [add-packaging-dialog.tsx:278](../../app/(dashboard)/milling/add-packaging-dialog.tsx#L278) — `setOutputsLoading(false)`가 안 돌아 **저장 버튼이 잠기고 토스트도 안 뜬다(진짜 먹통)**.

🔴 **가드만이 원인이 아니다.** 세션 만료 시 middleware가 액션 POST를 로그인으로 리다이렉트하고,
배포 직후 열려 있던 탭은 「Server Action을 찾을 수 없음」으로 실패하고, 폰은 네트워크가 끊긴다.
**이 셋은 서버를 아무리 고쳐도 reject로 온다** → 클라이언트 `.catch()`가 실질적으로 더 급하다.

🔴 **배송업체 순서 변경은 더 나쁘다** — [shipping-vendor-section.tsx:80](../../app/(dashboard)/admin/settings/shipping-vendor-section.tsx#L80)이 저장 큐를 `.then` 체인으로 잇는다.
한 번 reject되면 **체인 전체가 rejected로 굳어 그 뒤 순서 변경이 전부 조용히 안 된다.**

### 안전 확인 — 가드를 `try` 안으로 넣어도 되는가

가드를 안에 넣으면 권한 오류가 catch로 간다. **catch가 `return []`이면 「권한 없음」이 「데이터 0건」으로 둔갑한다** — 그래서 108개의 catch를 전부 분류했다.

| catch 모양 | 개수 |
|---|---|
| `{ success: false, error: sanitizeErrorMessage(...) }` | 40 |
| `{ success: false, error: '고정 문구' }` | 64 |
| 결과 객체에 `success=false` (import 계열 등) | 4 |
| **빈 값 반환(위험)** | **0** |

→ **둔갑하는 곳이 없다.** 옮겨도 된다.

### 가드 없는 4개 — 급한 보안 구멍은 아니다

`getPackages` · `listMovements` · `getPurchaseVendors` · `listPurchaseUploads` (전부 읽기).
[middleware.ts](../../middleware.ts) matcher가 전 경로에 로그인을 요구해 **비로그인은 호출 자체가 막힌다.**
다른 읽기 액션들이 `requireSession()`을 거는 것과 맞추는 **방어 심층**이다.

---

## 1. 목표

- **A. 에러 처리**: 액션이 실패하면 **어떤 경로로 실패하든** 화면이 멈추지 않고, 권한·세션 오류는 **그 이유가 한글로** 보인다
- **B. dry-run 감사로그**: 원물 엑셀 가져오기의 **미리보기가 감사로그를 남기지 않는다**
- **C. §39 잔여**: 도정 통계 버킷·기본 생산연도가 **Vercel(UTC)에서도 KST 기준**으로 나뉜다

## 2. 범위

### A-1. 서버 — 가드를 `try` 안으로 (커밋 1)

- [lib/error-sanitize.ts](../../lib/error-sanitize.ts): `AuthError` → 「로그인이 만료됐어요. 새로고침 후 다시 로그인해 주세요.」,
  `ForbiddenError` → 「이 작업을 할 권한이 없어요.」로 바꾸는 `guardErrorMessage(error, fallback)` 추가.
  `sanitizeErrorMessage`도 이걸 먼저 거친다
- 108개 액션: 가드 줄을 `try` 안 첫 줄로 옮긴다
  - 🔴 **가드와 `try` 사이에 코드가 있으면 가드를 내리지 말고 `try`를 가드 위로 올린다** — 가드가 먼저 도는 순서를 지킨다
  - `const session = await require…`가 `try` 뒤에서 쓰이면 스코프가 깨진다 → tsc가 잡는다. 그 자리는 개별 처리
- 고정 문구 64개: `error: '고정 문구'` → `error: guardErrorMessage(error, '고정 문구')`.
  **고정 문구는 그대로 두고 권한·세션 오류만 갈라낸다**(수술적 변경 — 다른 오류 메시지 노출 정책은 안 바꾼다)
- 가드 없는 읽기 4개에 `requireSession()` 추가(`try` 안)
- 파일: `app/actions/*.ts` 약 25개 + `lib/error-sanitize.ts` (+ 테스트)

### A-2. 클라이언트 — `.catch()` 17곳 (커밋 2)

- 공용 헬퍼 `lib/settle-action.ts`: reject를 `{ success: false, error: '서버와 연결이 끊겼어요. 새로고침 후 다시 시도해 주세요.' }`로 바꿔 준다
  → 각 자리의 **기존 실패 분기(`!res.success`)가 그대로 받는다.** 자리마다 catch를 새로 짜지 않는다
- DTO가 아닌 반환(`getYieldRate` → 숫자 등)은 그 자리에서 `.catch()`로 기본값 처리
- 배송업체 저장 큐는 **체인이 끊기지 않게** 각 단계에서 catch 후 `router.refresh()`
- 파일(16개): add-farmer-dialog · shipping-vendor-section · add-packaging-dialog(4곳) · edit-misc-package-dialog · edit-misc-purchase-dialog ·
  misc-package-dialog(2곳) · misc-purchase-dialog · movement-history-dialog · cell-allocation-popover · review-gate-dialog ·
  tonbag-popover · unmatched-popover · use-sku-spec-buttons

### A-3. `try` 없는 19개 — 확인만 (A-1 커밋에 포함 또는 없음)

statistics·stock-statistics·output-statistics·settings·user. 가드뿐 아니라 **DB 오류도 전부 throw**로 나간다.
착수 시 **호출부가 `try/catch`로 받는지** 확인하고, 안 받아서 멈추는 곳만 고친다. 반환 타입을 DTO로 바꾸는 건 호출부가 줄줄이 바뀌므로 **이번 범위 밖**(§29 판별 유니온과 같이).

### B. dry-run 감사로그 (커밋 3)

- [stock-excel.ts:340](../../app/actions/stock-excel.ts#L340) `recordAuditLog`를 `if (!dryRun)`으로 감싼다. 한 줄
- 화면([stock-excel-buttons.tsx:70](../../app/(dashboard)/raw-stocks/stock-excel-buttons.tsx#L70))은 미리보기 → 실제 두 번 부르므로 **지금은 한 번 가져오기에 로그가 2건** 남는다
- 이미 쌓인 중복 로그는 **안 지운다**(감사로그는 지우는 게 더 나쁘다). 보고서에 기록만

### C. §39 잔여 (커밋 4)

- [statistics.ts:98-145](../../app/actions/statistics.ts#L98-L145) 버킷 함수 3개(`getBucketKey`·`getTooltipLabel`·`generateAllBucketKeys`)를
  `lib/stats-bucket.ts` 순수 함수로 빼고 [lib/kst-date.ts](../../lib/kst-date.ts) 기준으로 다시 짠다. 조회 범위 `toEndOfDay.setHours(23,59,59)` 3곳도 KST 하루 끝으로
- `:274` 목록 날짜 `format(…, 'yyyy-MM-dd')` → `toKstDate`
- [production-year.ts](../../lib/production-year.ts) 5개 함수의 `getFullYear()`·`getMonth()` → `todayKst(now)`에서 연·월을 뽑는다
  (지금은 **9월 1일 00~09시 KST에 Vercel이 아직 8월로 본다** — 경계일 9시간만 틀린다)
- 덤: `getTooltipLabel`이 **올해 연도**로 주 범위를 계산한다 — 작년 데이터 주별 툴팁이 틀릴 수 있다. 같은 자리라 같이 고친다
- 파일: statistics.ts · production-year.ts · 신규 stats-bucket.ts (+ 테스트 2개)

## 3. 범위 밖 (알고 둔다)

- 이벤트 핸들러의 `await action()`이 `try` 없이 로딩 상태를 여는 자리 — `.then` 패턴이 아니라 이번 grep에 안 걸린다. **전수 안 했다.** 별건 후보
- 액션 반환 타입 판별 유니온(§29), `try` 없는 19개를 DTO로 바꾸는 것
- 고정 문구 64개의 메시지 품질(「조회에 실패했습니다」 수준) 자체

## 4. 검증

- `npx tsc --noEmit` · `npx eslint .`(기준선 0/0 유지) · `npm test`
- C는 테스트를 **`TZ=UTC`와 `TZ=Asia/Seoul` 두 번** 돌린다. 기대값은 UTC 순간 리터럴로(로컬 자정으로 쓰면 어느 TZ에서나 통과해 버린다)
- 조사 스크립트 재실행: **가드 `try` 밖 0개 · 가드 없음 7개(위임·전용만) · `.catch` 없는 `.then` 0곳**
- 🖐 브라우저(사용자): 개발자도구 Network를 **Offline**으로 두고 도정관리 포장 다이얼로그를 연다 → 멈추지 않고 토스트가 떠야 한다.
  발주서 셀 팝오버도 같은 식으로. (dev 검증에 `next build`는 안 돌린다 — [[dev_verification_no_build]])

## 5. 위험

| 위험 | 대응 |
|---|---|
| 108곳 기계적 이동 중 순서가 바뀌어 가드보다 앞선 코드가 생긴다 | 가드–`try` 사이 코드가 있으면 `try`를 올린다. 이동 후 스크립트로 「가드가 함수 본문 첫 문장인지」 재확인 |
| `session` 스코프 깨짐 | tsc가 잡는다 |
| 파일 수 많음(약 45개) | 커밋 4개로 쪼개고 커밋마다 tsc·eslint·test |
| 액션 동작 변화 | 성공 경로는 한 줄도 안 바뀐다. 바뀌는 건 **실패 시 throw → `{success:false}`** 뿐이고, 호출부는 이미 그 분기를 갖고 있다 |

## 6. 결정할 것 (추천안 먼저)

1. **오류 문구**: 세션 「로그인이 만료됐어요. 새로고침 후 다시 로그인해 주세요.」 / 권한 「이 작업을 할 권한이 없어요.」 / 연결 「서버와 연결이 끊겼어요. 새로고침 후 다시 시도해 주세요.」 — 이대로?
2. **고정 문구 64개**: 권한·세션만 갈라내고 나머지는 고정 문구 유지(추천) vs 전부 `sanitizeErrorMessage`로 바꿔 실제 오류 메시지 노출
3. **순서**: A-1 → A-2 → B → C (추천). 먹통을 먼저 막고 싶으면 A-2 → A-1
