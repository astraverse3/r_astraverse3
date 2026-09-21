# 26년산 전환 — 생산연도 경계 + 원물 엑셀 업로드 권한

> 작성 2026-09-21 · 기준 커밋 `b33dd4e`
> 배경: 26년산 벼 첫 입고(2026-09-15). 시스템 가동 후 **처음으로 생산연도가 넘어가는 시점**이다.

---

## 1. 목표

두 가지를 같이 고친다. 둘 다 "26년산이 들어왔다"가 드러낸 문제다.

1. **원물 엑셀 업로드가 ADMIN 말고는 전부 실패한다** — 정윤미 PC에서 "실패"만 뜨던 것의 원인
2. **벼 기본 생산연도 경계가 현실보다 한두 달 늦다** — 26년산을 등록해도 기본 목록에서 안 보인다

---

## 2. 원인 규명 (조사 완료)

### 2.1 엑셀 업로드 실패 — 가드와 버튼 노출 조건 불일치

| 위치 | 조건 |
| --- | --- |
| 버튼 노출 `stock-excel-buttons.tsx:30` | `hasPermission(user, 'SUPPLY_MANAGE')` |
| 서버 액션 `stock-excel.ts:131` `importStocks` | **`requireAdmin()`** |
| 원물 수동 등록 `stock.ts:22` `createStock` | `requirePermission('SUPPLY_MANAGE')` |
| 생산자 엑셀 `excel.ts:74` `importFarmers` | `requirePermission('SUPPLY_MANAGE')` |

**`importStocks` 한 곳만 ADMIN**이다. 같은 성격의 생산자 엑셀 import도, 같은 데이터를 손으로 넣는 수동 등록도 전부 `SUPPLY_MANAGE`다.

실 DB 계정 현황 (조회 결과):

```
문희준   ADMIN  []                                             ← 유일한 ADMIN
정윤미   USER   [NOTICE_MANAGE, OPERATION_MANAGE, SUPPLY_MANAGE]
이민화   USER   [NOTICE_MANAGE, OPERATION_MANAGE, SUPPLY_MANAGE]
윤상훈   USER   [NOTICE_MANAGE, OPERATION_MANAGE, SUPPLY_MANAGE]
땅끝황토 USER   [NOTICE_MANAGE, SUPPLY_MANAGE]
```

→ **ADMIN 1명을 뺀 전원이 "버튼은 보이는데 누르면 무조건 실패"** 상태였다.

증상이 "그냥 실패했다고만 나온다"인 이유:

- `requireAdmin()`이 **`try` 블록 밖**(`stock-excel.ts:131`)이라 `ForbiddenError`가 `ExcelImportResult`로 안 담기고 그대로 reject된다
- 클라이언트는 `catch (error)`에서 `toast.error('파일 분석 중 오류가 발생했습니다.')`만 띄운다 (`stock-excel-buttons.tsx:74`)
- 실패 지점이 **dry-run 단계**라 "몇 건 중 몇 건" 미리보기 요약조차 안 뜬다
- 권한 문제라서 새로고침·재접속 무관하게 항상 같다 — PC·캐시 문제가 아니다

### 2.2 연도 경계 — 26년산이 9월에 들어왔다

`lib/production-year.ts` 현재 값:

| 상수 | 값 | 의미 | 오늘(9/21) 결과 |
| --- | --- | --- | --- |
| `RICE_HARVEST_MONTH` | 10 | 검색이 2년분을 보기 시작하는 달 | `['2025']` — **26년산 안 보임** |
| `RICE_NEW_CROP_MONTH` | 11 | 등록 폼이 당해년도를 찍는 달 | `2025` — 손으로 고쳐야 함 |

DB 실측: **2026년산 벼가 이미 1행 있다** (`#2313` 슬로미2 / 톤백1 / 803kg / 입고 2026-09-15 / 등록 2026-09-21).
등록은 정상인데 기본 필터가 `[2025]`라 **목록에서 사라진 것처럼 보인다.**

주석에 적힌 원래 근거("10월엔 아직 당해년도 벼가 안 들어온다")가 올해 조생종 입고로 무너졌다.

---

## 3. 결정 사항 (사용자 확정 2026-09-21)

| # | 결정 |
| --- | --- |
| A | 엑셀 업로드 권한을 **`SUPPLY_MANAGE`로 연다** (ADMIN 유지 + 버튼 숨김 안 함) |
| B | 벼 연도 경계는 **검색·등록 둘 다 9월로** 당긴다 |

B의 대가(수용): 9월 초에 25년산 잔여 톤백을 등록할 일이 있으면 등록 폼 기본값을 손으로 바꿔야 한다.

---

## 4. 변경 범위 — 4파일

### 4.1 `app/actions/stock-excel.ts` (1줄 + import)

```diff
-import { requireAdmin, requireSession } from '@/lib/auth-guard'
+import { requirePermission, requireSession } from '@/lib/auth-guard'
...
-    await requireAdmin()
+    await requirePermission('SUPPLY_MANAGE')
```

`exportStocks`의 `requireSession()`은 그대로 둔다 — "조회는 누구나" 정책과 맞다.

### 4.2 `lib/production-year.ts` (상수 2개 + 주석)

```diff
-const RICE_HARVEST_MONTH = 10
+const RICE_HARVEST_MONTH = 9
-const RICE_NEW_CROP_MONTH = 11
+const RICE_NEW_CROP_MONTH = 9
```

주석도 같이 고친다. 지금 주석이 "10월엔 아직 당해년도 벼가 안 들어온다"라고 **틀린 근거**를 적고 있어서, 값만 바꾸면 다음 사람이 되돌린다.
→ 갱신 근거: **2026-09-15 조생종 26년산 입고 실측**.

두 상수가 같은 값이 되지만 **합치지 않는다.** 의미가 다르고(검색 범위 vs 등록 기본값), 실제로 한 번 갈렸던 이력이 있다.

### 4.3 `lib/production-year.test.ts` (기대값 갱신)

고칠 케이스:

| 기존 테스트 | 변경 |
| --- | --- |
| `벼: 수확 전(1~9월)은 전년 한 해만` | 1~**8**월로 범위 축소 (`[1,3,6,9]` → `[1,3,6,8]`) |
| `벼: 수확기(10~12월)는 올해와 전년을 함께` | **9**~12월로 확대 |
| `벼 등록: 11월부터 당해년도` | **9월부터** 당해년도 |
| `벼 검색은 10월에 올해를 포함하지만, 벼 등록은 아직 전년을 찍는다` | **삭제** — 결정 B로 두 경계가 같아져 이 테스트의 전제가 사라졌다 |

마지막 케이스는 값만 고치면 통과하는 게 아니라 **주장 자체가 폐기**되는 것이라, 삭제하고 그 자리에 "검색·등록 경계가 같다"는 테스트를 넣는다. 잡곡 테스트는 손대지 않는다.

### 4.4 `docs/permission-matrix.md` (표 2곳 + 이력)

- `### ADMIN 전용 (requireAdmin)` 표에서 `stock-excel.ts | importStocks` **행 삭제**
- `### 원물·마스터 (SUPPLY_MANAGE)` 표에 `app/actions/stock-excel.ts | importStocks` **행 추가**
- 하단 변경 이력에 2026-09-21 항목 추가
- 문서 맨 위 "마지막 갱신" 날짜 갱신

---

## 5. 검증

| 항목 | 방법 |
| --- | --- |
| 연도 순수함수 | `npm test` — 기존 378건 + 갱신분 전건 통과 확인 |
| 타입·린트 | `npx tsc --noEmit`, `npx eslint` |
| 엑셀 업로드 권한 | **사용자 브라우저 확인** — 정윤미 계정으로 실제 업로드 (dev 서버, `next build` 안 함) |
| 목록 표시 | `/raw-stocks` 기본 진입 시 `#2313`(26년산 슬로미2)이 보이는지 |
| 등록 폼 기본값 | 원물 등록 다이얼로그 생산연도가 **2026**으로 찍히는지 |

---

## 6. 범위 밖 (확인만 하고 손대지 않음)

| 항목 | 판단 |
| --- | --- |
| **로트번호 UTC 날짜 밀림** | 실측 결과 **문제 없음.** 입고일이 전부 UTC 자정으로 저장돼 있어 `toISOString().slice(2,10)`와 KST 변환이 최근 12건 전부 일치(어긋남 0/1838). 26년산 로트 생성은 안전하다 |
| **제품재고(`/packages`) 연도 기본값** | `defaultProductionYears`를 안 쓴다(기본값 없이 빈 값). 26년산 도정품이 나오기 시작하면 별도 검토 |
| **잡곡 경계(6월)** | 이번 건과 무관. 손대지 않음 |
| **서버 액션 예외가 "실패"로만 뭉개지는 구조** | 권한을 맞추면 이번 증상은 사라지지만, 다른 예외에서 같은 일이 반복된다. `ForbiddenError`를 사용자에게 보이는 메시지로 바꾸는 건 **별도 작업**으로 제안 |
| 🔴 **dry-run도 감사로그를 남긴다** | 확인 중 발견. `importStocks`가 `dryRun` 분기 없이 `recordAuditLog`를 부른다(`stock-excel.ts` 말미) → **미리보기만 하고 취소해도 "가져오기 완료 성공 14건"이 찍힌다.** 실제로 2026-09-21 IMPORT 로그 3건 중 저장된 건 1건뿐이었다. 감사로그가 실제보다 부풀어 있다 — **별도 작업** |
| `shipping-vendor.ts`의 `requireAdmin` | 배송처 마스터. 이번 범위 아님 |

---

## 7. 작업 순서

> **2026-09-21 사용자 결정: 두 단계로 쪼갠다.** 정윤미가 업로드를 못 하는 게 급해서, 배포 범위가 좁은 권한 1줄만 먼저 띄운다. 연도 경계는 화면 기본값이 바뀌는 변경이라 따로 간다.

### 1단계 — 권한 (선행, 완료)
1. ✅ `app/actions/stock-excel.ts` 가드 교체 (`requireAdmin` → `requirePermission('SUPPLY_MANAGE')`)
2. ✅ `docs/permission-matrix.md` 갱신 (표 2곳 + 변경 이력 + 갱신일)
3. ✅ `npx tsc --noEmit` 통과 · `npm test` 389/389 통과
   - `npx eslint` 기존 `any` 5건(19·20·150·166·241행)은 변경 위치와 무관 — 손대지 않음
4. ✅ 커밋 + 푸시 `27212fc` — `origin/main` 위에 권한 커밋만 cherry-pick(로컬에 브라우저 확인 전 M1 커밋 4개가 쌓여 있어 통째 푸시 불가)
5. ✅ **정윤미 업로드 성공 확인** — 감사로그 `2026-09-21T05:11:44 | 정윤미 | 총 14건 중 성공 14, 실패 0`. 2026년산 벼 **15행 11,700kg** 적재됨

### 2단계 — 연도 경계 (완료, 확인 대기)
6. ✅ `lib/production-year.ts` 상수 2개 + 주석 4곳 수정 (§4.2)
7. ✅ `lib/production-year.test.ts` 갱신 — **test 390/390** (구 테스트 1개 삭제, 신규 2개 추가) · `tsc` 0 · `eslint` 0
8. ⬜ 브라우저 확인: `/raw-stocks` 기본 진입에 26년산 15행 노출 · 등록 폼 기본값 2026
9. ⬜ 커밋 + 푸시

### 3단계 — 연도 입력 위젯 + 연도 목록 단일 원천 (2026-09-21 추가)

브라우저 확인 중 사용자 지적: **벼 입고 등록창만 연도를 텍스트로 친다.**

확인해보니 같은 화면의 잡곡은 이미 `<Select>`다(`add-misc-stock-dialog.tsx:314`). 벼만 `<Input type="number">`이고, 실동작도 나쁘다:

- `parseInt(e.target.value) || defaultYear` — **지우면 즉시 기본값으로 튀어** 지우고 다시 칠 수 없다
- 타이핑 중간값이 그대로 state에 들어간다. `2`인 순간 생산자 목록이 `group.cropYear !== 2`로 전부 걸러져 텅 빈다
- `min`/`max`가 없어 `226`·`20026`이 통과한다

🔴 **오타의 대가가 크다.** 연도가 틀리면 기본 필터에 안 잡혀 "등록했는데 사라졌다"가 되고(2단계에서 고친 바로 그 증상), 톤백 중복검사가 `(연도+생산자+품종+번호)`라 **연도가 틀리면 중복 검사까지 무력화**돼 같은 톤백이 두 번 들어간다.

**같이 푸는 것 — 연도 목록이 5곳에 복붙돼 있다.**

| 파일 | 목록 |
| --- | --- |
| `stock-filters.tsx` · `misc-stock-filters.tsx` · `package-search-dialog.tsx` · `add-misc-stock-dialog.tsx` | 2026~2023 |
| `farmer-filters.tsx` | **2026~2024** (혼자 3년치) |

지금은 전부 2026이 있어 안 터지지만 **2027년이 되면 5곳을 손으로 고쳐야 한다.** 이 파일이 애초에 풀려던 문제(같은 규칙의 복붙)가 연도 목록에 그대로 남아 있던 것이다.

**`lib/production-year.ts`에 추가할 함수**

```ts
productionYearOptions(now)            // number[]  올해부터 과거 3년, 최신 앞
productionYearFilterOptions(now)      // {label,value}[]  MultiSelect용
productionYearOptionsWith(value, now) // 기존 값이 목록 밖이면 끼워 넣는다
```

🔴 **`productionYearOptionsWith`가 핵심 방어다.** 수정 다이얼로그는 옛 재고를 연다 — 연도가 목록에 없으면 Select가 빈칸이 되고 **저장하는 순간 연도가 날아간다.** (현재 DB엔 2025·2026뿐이라 당장은 안 터지지만, 이건 시간이 지나면 반드시 온다)

⚠️ `Select`는 `name`으로 FormData에 안 실린다 — 두 다이얼로그 모두 `formData.get('productionYear')`를 쓰고 있으니 **state를 직접 넘기도록** 같이 고친다.
⚠️ 배열 반환이라 클라이언트에서 `useMemo` 필수 ([[search_filter_single_sources]]와 같은 함정).
⚠️ `farmer-filters.tsx`는 3년 → 4년으로 **늘어난다**(통일). 생산자 작목반 `cropYear` 필터라 무해.

**변경 파일 9개**

1. `lib/production-year.ts` (함수 3개 추가)
2. `lib/production-year.test.ts`
3. `add-stock-dialog.tsx` — Input → Select, formData → state
4. `edit-stock-dialog.tsx` — Input → Select, `productionYearOptionsWith`
5. `add-misc-stock-dialog.tsx` — 로컬 `YEAR_OPTIONS` 제거
6. `stock-filters.tsx` · 7. `misc-stock-filters.tsx` · 8. `package-search-dialog.tsx` · 9. `farmer-filters.tsx` — 로컬 상수 제거

### 4단계 — 대시보드 집계 기준 (2026-09-21 추가)

3단계 배포 후 사용자 확인: **대시보드가 26년 기준으로 세팅돼 버렸다.**

원인은 2단계와 무관했다. `dashboard.ts:11`이 기준 연도를 `production-year.ts`가 아니라 **"DB에 있는 가장 최신 productionYear"**로 잡고 있었다 — 그래서 26년산 15행이 적재되는 순간 통째로 넘어갔다.

| 카드 | 25년산 기준 | 26년산 기준(사고 당시) |
| --- | --- | --- |
| 보유 재고 | 398,790kg | **10,884kg** |
| 도정 진행률 | 76.4% | **7.0%** |
| 마감 배치 | 197건 | **0건** |
| 총 생산량·수율 | 실적 있음 | **0** |

**결정(사용자)**: 집계 기준은 **11월 1일**에 넘긴다. 두 해를 섞지 않는다 — "연도가 섞이면 의미가 희석된다". 최근 도정 내역은 연도 기준에서 제외(원래 필터가 없었고 그대로 둔다).

🔴 **등록·검색(9월)과 일부러 다른 경계다.** 등록·검색은 신곡이 들어오는 즉시 보여야 하지만, 한 해를 통으로 보는 값(진행률·수율)은 신곡 몇 톤백에 기준이 옮겨가면 의미가 사라진다.

```ts
dashboardProductionYear(now)   // 11월부터 당해년도
```

⚠️ **폴백 한 줄을 넣었다** — 신곡 입고가 11월을 넘겨 늦어지면 그 해 재고가 0일 수 있다. 그때는 전년으로 물러선다(화면이 통째로 비는 것보다 낫다).

**연도 토글은 넣지 않았다.** 비용을 재보니 구현 자체는 작지만(액션 파라미터 + `searchParams` + 배지 4곳) **전환할 때마다 2초 재조회**가 붙고, 모바일 카드가 터치 스와이프 캐러셀이라 충돌 확인이 필요했다. 무엇보다 11월 경계면 **오늘부터 내년 10월까지 계속 25년산이 보여** 당장 필요가 없다. 과거 조회는 `/statistics/stock`이 이미 연도 필터를 갖고 있다.

**곁가지 — 결과를 아무도 안 읽는 쿼리 2개 삭제.** `millingBatch.count()`(`totalBatches`)와 투입량 `millingBatch.aggregate`는 반환 객체에 담기기만 하고 화면 참조가 0이었다(수율 분모는 9번 `yearBatches`가 따로 구한다 — 결정 #61). 실측 **418ms → 209ms**.

12. ✅ `lib/production-year.ts` `dashboardProductionYear` 추가 · `dashboard.ts` 기준 교체 + 죽은 쿼리 2개 삭제 · `tsc` 0 · **test 401/401** — `aff3ece`
13. ✅ 브라우저 확인 완료(사용자) → 푸시

### 마무리
10. ✅ `docs/worklog.md` 갱신
11. ✅ **연도 관련 커밋만** `origin/main`에 cherry-pick 푸시 (M1 커밋은 계속 보류)
