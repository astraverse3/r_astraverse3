# 계획서 — 발주서 D3 (행 일괄선택 + 검토 게이트)

_작성: 2026-09-16 · 상위: `docs/plan/plan-발주서판매처리-단계6.md` §D3 · 시안: `docs/handoff/발주서판매처리/검토게이트-일괄차감.html`_

**승인 대기** — 아래 §6 미결 2건 확인 후 착수.

---

## 1. 목표

매트릭스에서 **행(수령처)을 여러 개 골라 한 번에 차감**한다. 차감 직전 **검토 게이트**로
「얼마가 빠지는지 · 무엇이 막혔는지」를 보여주고, 확정은 그 화면에서만 할 수 있다.

셀 하나씩 누르는 기존 경로(D2c 팝오버)는 그대로 둔다 — 단일 셀은 게이트 예외(시안 결정 3).

---

## 2. 🔴 현재 코드 전수 대조 — 상위 계획서·시안이 틀린 곳 7개

착수 전 `app/actions/purchase-order*.ts` · `lib/purchase-order-*.ts` · 매트릭스 화면 4개를 전수 확인했다.
**상위 계획서(2026-08-18 작성)와 시안(D2 이전)은 그 뒤 D2c·D2d·D2e를 겪지 않은 전제 위에 있다.**

| # | 낡은 전제 | 실제 | 영향 |
|---|---|---|---|
| **1** | 「재사용 가능(신규 불필요): `confirmOrderItem` / `cancelOrderItemMovements`」 (단계6 §3) | 🔴 **둘 다 호출처 0건.** `confirmOrder`·`listPurchaseOrders`도 마찬가지 — **죽은 코드 4개**. 현행 차감 경로는 `confirmCell`/`cancelCell`(`purchase-order-matrix.ts`) | 재사용 대상을 갈아탄다. 죽은 4개는 §5에서 **삭제**(남겨두면 다음 사람이 또 현행으로 읽는다) |
| **2** | 시안 버튼 「SKU 지정하러 가기」 | 🔴 수동지정은 **2026-09-16 철회·삭제**(`c2fc6f3`). 매칭실패를 푸는 유일한 경로는 **재매칭**(마스터 보완 후) | 게이트의 차단 배너는 「품종 관리 / 제품유형 관리에서 보완 후 재매칭」 안내로 바꾼다 |
| **3** | 시안 「되돌리려면 **라인마다** 개별 취소」 | 취소 단위는 **셀**(`cancelCell` = 수령인×규격) | 문구를 「셀 단위로 취소」로 교정 |
| **4** | 톤백 개념 없음 (시안은 D2d 이전) | `unitWeightKg !== null` 라인은 **자루를 직접 골라야** 한다(개수 추천이 성립 안 함). `getCellAllocation`도 톤백을 거부한다 | **톤백 라인은 일괄에서 제외**하고 게이트에 「셀에서 직접」으로 안내 |
| **5** | 「택배 묶음 1,700라인」 (단계6 §6 리스크 1) | 실측(2026-09-16 Neon): 최대가 **택배 67건 / 79라인**. 나머지는 4~24라인 | 렌더 성능은 문제가 아니다. **쓰기 왕복이 문제**(#7) |
| **6** | dry-run은 `suggestAllocation`을 「그대로 재사용」 | 🔴 라인마다 독립 호출하면 **같은 SKU를 쓰는 라인들이 같은 재고를 각자 세어** 차감예정이 과대 계상된다. 실측 택배 79라인은 SKU가 겹친다 | 가용 풀을 **메모리에서 깎아가며** 순차 배분하는 새 순수함수가 필요 (결정 C) |
| **7** | — (없던 항목) | 🔴 **`applyAllocations`는 allocation 1건당 쿼리 4회**(기차감 집계·재고 조회·사용량 집계·INSERT). Neon 왕복 250~300ms → **1건당 ~1초**. 68라인 × 1~2배분이면 **100초+**, 트랜잭션 timeout 30초를 훨씬 넘는다 | **일괄 전용 배치 쓰기 경로**가 D3의 실제 알맹이 (결정 F) |

📌 #1·#2는 메모리에 남은 교훈 그대로다 — **「기존 X를 그대로 쓴다」는 X가 살아 있는지부터 본다.**
📌 #7은 적재 타임아웃 사고(2026-08-26)와 같은 뿌리 — **루프 안 INSERT는 20회가 한계.**

---

## 3. 설계 결정

| 키 | 결정 | 근거 |
|---|---|---|
| **A** | 선택 단위 = **행(수령처 = `orderId`)**. 이름칸 왼쪽에 체크박스, 머리글에 전체선택 | 상위 계획서 원안. 열 단위·셀 단위는 이미 다른 경로가 있다 |
| **B** | 일괄 배분은 **자동 FIFO만**. 로트를 직접 고르려면 셀 팝오버로 | 게이트는 「확인하고 넘긴다」는 화면이지 편집 화면이 아니다 |
| **C** | dry-run과 확정이 **같은 순수함수**(`planBatchAllocations`)를 쓴다. 가용 풀을 메모리에서 깎아가며 **`itemId` 오름차순**으로 순차 배분 | #6. 두 곳에서 따로 계산하면 게이트 숫자와 결과가 갈린다 |
| **D** | 제외 규칙 3종 — ① 매칭실패(`productTypeId = null`) ② 톤백(`unitWeightKg ≠ null`) ③ 이미 전량 차감된 라인 | ①은 차감 불가, ②는 사람이 자루를 골라야, ③은 할 일이 없다 |
| **E** | **재고부족은 차단이 아니다** — 가능한 만큼 차감하고 `PARTIAL`로 남는다 | 시안 v2 확정안. 차단 사유는 매칭실패 하나뿐 |
| **F** | 쓰기는 **한 트랜잭션 · 배치**: 조회 3회 → 메모리 배분 → `createMany` 1회 → 건 상태 `updateMany` 최대 3회. **왕복 ≈ 8회(2초 내외)** | #7. 라인 루프로 짜면 못 쓴다 |
| **G** | 확정은 preview가 낸 **`expected`(라인별 배분 총합)** 를 함께 받아, 서버 재계산 결과와 다르면 **아무것도 쓰지 않고 중단**하고 재검토를 돌려준다 | 상위 계획서 「조용한 부분차감 금지」. 게이트를 띄운 사이 다른 사람이 같은 재고를 가져간 경우 |
| **H** | 반환은 **바뀐 값만**(결정 C 승계). 단 일괄은 SKU가 여럿이라 `CellPatch`(SKU 1개 전제)를 **`BatchPatch`(다SKU)** 로 확장 | `revalidatePath`를 부르면 매트릭스가 1.4초 통째 재조회된다(2026-09-14 실측) |
| **I** | 전량 차단(=고른 행에 차감할 게 하나도 없음)일 때도 **같은 모달이 축약**되어 뜬다 | 시안 v2 「별도 프레임을 두지 않는다」 |

---

## 4. 작업 단계

### D3a. 순수함수 + 단위테스트 (DB 없음)

**신규 `lib/purchase-order-batch.ts`**

```ts
export type BatchLine = {          // 화면·서버 공통 입력
  itemId: number; orderId: number; productTypeId: number | null
  orderedQty: number; allocatedQty: number; unitWeightKg: number | null
}
export type BatchSkip = 'UNMATCHED' | 'BULK' | 'DONE'
export type BatchPlanLine = {
  itemId: number; orderId: number; productTypeId: number
  need: number; allocations: Allocation[]   // FIFO 결과
  shortage: number                          // 못 채운 개수(>0 이면 부분)
}
export type BatchPlan = {
  lines: BatchPlanLine[]                    // 실제로 쓸 것만
  skipped: { itemId: number; orderId: number; reason: BatchSkip }[]
  totals: { full: number; partial: number; skippedUnmatched: number
            units: number; kg: number; lots: number }
}
export function planBatchAllocations(
  lines: BatchLine[],
  pools: Record<number, AvailablePackage[]>,   // SKU → 가용 패키지(FIFO 정렬 전)
  weights: Record<number, number>,             // SKU → 1개당 kg (kg 합계용)
): BatchPlan
```

- `sortFifo` · `suggestAllocation`(기존 `purchase-order-allocation.ts`)을 **재사용**하되,
  배분한 만큼 풀에서 깎고 다음 라인으로 넘어간다 (결정 C)
- 순서는 `itemId` 오름차순 **고정** — dry-run과 확정이 같은 순서여야 예측이 맞는다
- 테스트: 같은 SKU 2라인이 재고를 나눠 갖는가 · 부족 시 부분 배분 · 제외 3종 · 합계(개수/kg/로트수) · 빈 입력

### D3b. 서버 액션 2개

**신규 `app/actions/purchase-order-batch.ts`** (`purchase-order-matrix.ts`가 이미 655줄 → 분리)

| 액션 | 내용 |
|---|---|
| `previewBatch(orderIds)` | 권한 `OPERATION_MANAGE` → 라인·기차감·가용패키지 **배치 조회 3회** → `planBatchAllocations` → 게이트 표시용 DTO. **쓰지 않는다** |
| `confirmBatch(orderIds, expected)` | 한 트랜잭션에서 같은 3회 조회 → 다시 `planBatchAllocations` → `expected`와 대조(결정 G) → `packageMovement.createMany` 1회 → 건 상태 `updateMany` ≤3회 → 감사로그 → `BatchPatch` 반환 |

- 게이트 이슈 목록에 필요한 이름(수령인·품목·규격)은 **매트릭스가 이미 갖고 있다** → 액션은
  `itemId` 기준 수치만 돌려주고 **문자열 조립은 클라이언트**가 한다(서버가 이름을 또 만들면 두 곳이 된다)
- 🔴 `revalidatePath` 호출 금지 (결정 H)
- 🔴 `applyAllocations`의 검증 3종(SKU 일치 · 가용 초과 · 주문 초과)은 배치 경로에서 **순수함수가 보장**한다:
  SKU는 라인의 `productTypeId`로 풀을 만들고, 가용·주문 초과는 `planBatchAllocations`가 구조적으로 못 넘는다.
  트랜잭션 안에서 조회→계산→쓰기가 한 번에 끝나므로 창이 짧다. (§6 리스크 1)

### D3c. 화면

**수정 `matrix-client.tsx`**
- sticky 좌측에 **체크박스 칸(W_CHECK = 32)** 추가 → `L_STATUS`·`L_PROGRESS`·`W_LEFT` 상수만 고치면 된다(좌표는 한 곳)
- 머리글 코너에 전체선택 체크박스(부분선택 표시 포함)
- 선택이 1개 이상이면 **하단 고정 바** — 「N수령처 선택 · 차감 예정 확인」 + 해제
- 확정 성공 시 `BatchPatch`를 `input`에 갈아끼우고 `buildMatrix` 재실행(결정 H), 선택 해제

**신규 `review-gate-dialog.tsx`** (시안 760px 컴팩트 v2)
- ① 차감 예정 kg(최상위) + 포장 N개 · 로트 N개
- ② 정상/부분/제외 **스택 바 하나**
- ③ 매칭실패가 있을 때만 **차단 배너** — 문구는 재매칭 안내(#2), 버튼은 모달 닫고 헤더 재매칭으로
- 이슈 목록 2종(제외 · 부분) — 행 클릭 시 모달 닫고 해당 셀로 스크롤+하이라이트
- 톤백 제외가 있으면 한 줄 안내(#4)
- 푸터: 「돌아가 수정」 / 「N라인 차감 확정」 + 취소 단위 경고(#3)
- 🔴 `flex flex-col`로 짠다(grid면 푸터가 잘린다 — 기존 교훈)

---

## 5. 죽은 코드 정리 (같은 커밋)

`app/actions/purchase-order.ts`에서 **호출처 0건**인 4개를 삭제한다 — `confirmOrder` ·
`confirmOrderItem` · `cancelOrderItemMovements` · `listPurchaseOrders`.
`getPurchaseOrderDetail`(상세 패널이 쓴다) · `deletePurchaseUpload` · `deletePurchaseOrder`는 유지.

**왜 지금**: D3가 「일괄 차감」을 새로 만드는데 같은 이름의 옛 일괄 차감(`confirmOrder`)이 남아 있으면
다음 사람이 어느 쪽이 현행인지 못 가린다. 이번 대조에서 내가 실제로 한 번 헛짚었다.

---

## 6. ~~미결~~ → 확정 (2026-09-16, 사용자)

1. **선택 단위 = 행 체크박스 + 전체선택** (결정 A 확정). 「묶음 전체」 별도 버튼은 두지 않는다 —
   전체선택 체크 한 번이 같은 결과다. 열 머리글 선택은 범위 밖.
2. **확정 중 숫자가 어긋나면 전부 중단하고 재검토** (결정 G 확정). 부분 커밋 없음.

미결 0건.

---

## 7. 검증

- `npm test` — `lib/purchase-order-batch.test.ts` 신규 + 기존 전부 통과(현재 356개)
- `npx tsc --noEmit` · 신규 파일 eslint 클린
- 🔴 `next build` 금지(dev 서버 상시 기동) — 화면은 **사용자 브라우저 확인**
- 브라우저 확인 항목(사용자):
  1. 택배 묶음(67건 79라인) 전체선택 → 게이트 수치 = 확정 후 실제 차감 일치
  2. 매칭실패 11라인이 제외로 잡히고 배너가 뜨는가
  3. 시아스 묶음(톤백 4라인) — 톤백 제외 안내가 뜨는가
  4. 확정 소요 시간(목표 3초 이내) · 확정 후 매트릭스가 서버 재조회 없이 갱신되는가
  5. `/packages` 가용재고 감소 = 게이트의 「포장 N개」와 일치
