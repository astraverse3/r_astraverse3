# 계획서 — 포장 내역 수정을 diff 방식으로

- 작성일: 2026-08-27
- 배경: `docs/plan/plan-재고재포장-R3.md` #61을 고치다 **저장 방식 자체가 원인**임이 드러나 분리
- 선행: R3 정합성 수정(같은 브랜치, 미커밋)
- 다음: 이 작업 → **D2 매트릭스**

---

## 1. 문제 — 전부 지우고 다시 만든다

```ts
// milling.ts updatePackagingLogs
await tx.millingOutputPackage.deleteMany({ where: { batchId } })   // 2. 전부 삭제
for (const output of outputs) { /* 3. 새로 생성 */ }
```

포장 내역을 **「배치에 딸린 단순 값」**으로 본 초기 설계다. 그 뒤에 `PackageMovement`(판매·재포장 차감) ·
`productTypeId`(SKU) · `Repack`이 이 행을 **참조**하기 시작하면서 전제가 깨졌다.

> 「포장내역 수정 프로세스 자체가 잘못된거 아니야? 전부 삭제하고 다시 저장하다니.」 — 2026-08-27 사용자

참조당하는 행을 지웠다 새로 만들면:

| 증상 | 설명 |
|---|---|
| 🔴 **저장이 실패한다** | `PackageMovement.package`의 `onDelete`가 Prisma 기본값 `Restrict`. movement가 붙은 행은 못 지운다 |
| 행 id가 매번 바뀐다 | movement가 가리키던 대상이 사라진다. 참조 무결성이 우연에 기댄다 |
| 이력이 날아간다 | `createdAt`이 매 저장마다 초기화된다 |

### 실측 (2026-08-27 Neon)

```
전체 배치 181개
포장 수정이 FK로 막히는 배치: 16개 (9%)
  ├ REPACK만 원인: 16개
  └ SALE 포함:      0개
```

🔴 **지금 SALE이 0건인 건 발주서 판매처리가 아직 안 돌아서다.**
**D2가 가동되면 판매된 포장이 있는 배치가 전부 여기 걸린다.** D2 전에 고쳐야 하는 이유다.

⚠️ R3 #61에서 `deleteMany`에 `repackId: null`을 붙였지만 **이 문제는 안 풀린다** —
막는 건 재포장 *결과*가 아니라 *소스(원본)* 행이고, 원본은 `repackId`가 null이라 필터를 통과한다.
(그 필터 자체는 유지한다. 원본에 movement가 없는 경우 재포장 결과를 삭제로부터 지킨다.)

---

## 2. 결정

### 결정 #62 — 입력에 `id`를 실어 diff로 반영한다

**다이얼로그는 이미 서버 행의 `id`를 들고 있다.** `restoreOutputs`(`add-packaging-dialog.tsx:99`)가
`...o`로 전체 필드를 복사하고, 저장 시 `validOutputs`가 그대로 서버에 간다.
**타입(`MillingOutputInput`)에만 없어서 서버가 안 쓰고 있었다.**

→ 타입에 `id?: number`를 명시하고 저장 경로를 갈아끼운다. UI 변경은 사실상 없다.

| 입력 상태 | 처리 |
|---|---|
| `id` 있고 기존에도 있음 | **update** — 변한 필드만 |
| `id` 없음 | **create** |
| 기존에 있는데 입력에 없음 | **delete** — 단, movement가 있으면 **거부**(§2.2) |

### 결정 #63 — 차감된 포장은 지우지도, 차감량 밑으로 줄이지도 못한다

`deleteMany`가 FK 에러를 뱉던 자리를 **도메인 규칙**으로 바꾼다.

```
이미 판매·재포장된 포장은 지울 수 없어요.
  · 20kg × 3 (3개 중 3개 차감됨)
포장을 되돌리려면 판매를 취소하거나 재포장을 정리해 주세요.
```

- **삭제**: `SUM(movements.count) > 0`이면 거부. **어느 줄인지 · 몇 개가 차감됐는지** 함께 알린다
- **수량 축소**: `count >= SUM(movements.count)`를 지켜야 한다.
  3개 중 3개가 팔렸는데 2개로 줄이면 가용이 음수가 된다
- 차감이 없는 줄은 지금처럼 자유롭게 지우고 고친다

FK 에러(원인 불명)를 **차단 이유가 적힌 메시지**로 바꾸는 게 이 결정의 핵심이다.

### 결정 #64 — diff 계산은 순수 함수로 분리한다

`lib/packaging-diff.ts` 신규. DB 접근 없이 `(기존 행, 입력)` → `{ toCreate, toUpdate, toDelete, errors }`.

`lib/repack.ts`와 같은 결이다 — **재고를 직접 만들고 지우는 로직은 단위테스트가 붙어야 한다.**
`updatePackagingLogs`는 그 결과를 트랜잭션으로 실행만 한다.

### 결정 #65 — 파생 필드는 필요할 때만 다시 계산한다

지금은 전부 새로 만들기 때문에 `lotNo` · `productCode` · `productTypeId`를 **매번** 계산한다.
update 경로에서는 입력이 바뀐 줄만 다시 계산한다.

| 필드 | 다시 계산하는 조건 |
|---|---|
| `lotNo` · `productCode` | `stockId`가 바뀌었을 때 (로트는 stock에서 파생) |
| `productTypeId` | `packageType` 또는 `packagingId`가 바뀌었을 때 |
| `totalWeight` | `weightPerUnit` 또는 `count`가 바뀌었을 때 |

**바뀌지 않은 줄은 UPDATE 자체를 보내지 않는다** — 왕복도 줄고 `createdAt`도 지켜진다.

---

## 3. 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/packaging-diff.ts` | **신규** — 순수 diff 계산 + 차감 검증(#63·#64) |
| `lib/packaging-diff.test.ts` | **신규** — 단위테스트 |
| `app/actions/milling.ts` | `MillingOutputInput.id?` 추가 · `updatePackagingLogs` diff 방식으로 재작성 |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | `id` 명시 전달(이미 흘러다니므로 타입 정리 수준) |

`addPackagingLog`(단건 추가, `milling.ts:360`)는 create 전용이라 건드리지 않는다.

## 4. 단계

1. `lib/packaging-diff.ts` + 테스트 — 매칭·검증 규칙부터 고정
2. `updatePackagingLogs` 재작성 — 트랜잭션 안에서 delete → update → create 순
   - ⚠️ **루프 안 INSERT 금지**(배송·상차 D1b 교훈). create는 `createManyAndReturn`으로 묶고
     update는 변경된 줄만. `timeout: 30000`
3. 다이얼로그 `id` 전달 정리
4. 검증

## 5. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| **높** | **도정 포장의 핵심 저장 경로다.** 잘못되면 포장 데이터가 깨진다 | diff 계산을 순수 함수로 빼고 단위테스트 먼저. 트랜잭션 1회 |
| 중 | 자연키 매칭이 어긋나 엉뚱한 줄을 update | 자연키를 쓰지 않는다 — **`id`로만** 매칭(#62). id 없으면 무조건 create |
| 중 | 기존 데이터에 id가 안 실려 오는 경로가 있으면 전부 create된다 | 서버에서 「입력 id가 기존에 없음」이면 create로 처리하되, **기존 행이 남아 delete 대상**이 되므로 결과적으로 교체된다. 차감 있는 행은 #63이 막는다 |
| 낮 | 잔량·톤백 특례(SKU 미부여/고정)가 update 경로에서 빠짐 | 파생 계산 헬퍼를 create·update가 **공유** |

## 6. 검증

- `lib/packaging-diff.test.ts` — 매칭·차감 거부·수량 축소 한계·파생 재계산 조건
- `npm test` · `npx tsc --noEmit` · `npx eslint`
- **`next build` 금지**
- **실DB** — 지금 막혀 있는 16개 배치 중 하나로 다음을 확인
  1. 차감 없는 줄 수정 → 저장되는지
  2. 차감된 줄 삭제 시도 → **이유가 적힌 메시지**가 뜨는지 (FK 에러가 아니라)
  3. 차감된 줄의 수량을 차감량 밑으로 → 거부되는지
  4. 저장 후 **재포장 결과 행과 movement가 그대로 살아 있는지**
  5. 안 바뀐 줄의 `id`·`createdAt`이 **유지되는지** (전부 새로 만들지 않았다는 증거)
- 완료 시 `docs/report/report-포장수정diff-{날짜}.md` + `docs/worklog.md`
