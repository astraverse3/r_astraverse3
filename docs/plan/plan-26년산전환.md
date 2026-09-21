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
| `shipping-vendor.ts`의 `requireAdmin` | 배송처 마스터. 이번 범위 아님 |

---

## 7. 작업 순서

> **2026-09-21 사용자 결정: 두 단계로 쪼갠다.** 정윤미가 업로드를 못 하는 게 급해서, 배포 범위가 좁은 권한 1줄만 먼저 띄운다. 연도 경계는 화면 기본값이 바뀌는 변경이라 따로 간다.

### 1단계 — 권한 (선행, 완료)
1. ✅ `app/actions/stock-excel.ts` 가드 교체 (`requireAdmin` → `requirePermission('SUPPLY_MANAGE')`)
2. ✅ `docs/permission-matrix.md` 갱신 (표 2곳 + 변경 이력 + 갱신일)
3. ✅ `npx tsc --noEmit` 통과 · `npm test` 389/389 통과
   - `npx eslint` 기존 `any` 5건(19·20·150·166·241행)은 변경 위치와 무관 — 손대지 않음
4. ⬜ 커밋 + 푸시(=Vercel 배포)
5. ⬜ **정윤미 계정으로 실제 업로드 확인** — 배포 완료 후

### 2단계 — 연도 경계 (1단계 확인 후)
6. ⬜ `lib/production-year.ts` 상수·주석 수정 (§4.2)
7. ⬜ `lib/production-year.test.ts` 갱신 → `npm test` (§4.3)
8. ⬜ 브라우저 확인: `/raw-stocks` 기본 진입에 `#2313`(26년산) 노출 · 등록 폼 기본값 2026
9. ⬜ 커밋 + 푸시

### 마무리
10. ⬜ `docs/worklog.md` 갱신
