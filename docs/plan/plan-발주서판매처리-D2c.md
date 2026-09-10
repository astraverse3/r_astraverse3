# 계획서 — 발주서 D2c (셀 FIFO 배분 팝오버)

- 작성일: 2026-09-10
- 상위 계획: `docs/plan/plan-발주서판매처리-D2매트릭스.md` §4 D2c
- 선행 상태: D2a(`060ce3a`) · D2b(`fdbee5b`) 완료, 브라우저 확인 끝(코너 헤더 반투명 1건 수정)

---

## 1. 작업 목표

매트릭스 셀을 눌러 **FIFO 추천 배분으로 재고를 차감**하고, 차감된 셀을 다시 눌러 **취소**한다.
행 머리글(수령처)을 누르면 그 건의 **주문 상세 패널**이 열린다.

D2c 범위는 **일반 매칭 셀**뿐이다. 톤백은 D2d, 매칭실패는 D2e.

---

## 2. 착수 전 실측 (2026-09-10)

| 항목 | 값 | 영향 |
|---|---|---|
| 라인 총계 / 셀 총계 | 126 / **124** | — |
| 셀당 라인 수 | 1개=122 · 2개=2 | **2건 모두 톤백이고, 사실은 열을 잘못 묶은 결함이었다** → C0 |
| 톤백 라인(`unitWeightKg` 있음) | 4 | D2c에서 제외(D2d) |
| 매칭실패 라인 | 27 | D2c에서 제외(D2e) |
| **차감 UI 진입점** | **없음** | `confirmOrderItem`·`getPurchaseOrderDetail`은 D1에 만들어졌지만 **어떤 화면도 호출하지 않는다**(`grep` 확인). D2c가 첫 진입점 |

---

## 3. 설계 결정

### 결정 A — 셀 차감은 라인 단위로 쪼개되 트랜잭션은 하나

한 셀(수령처 × 규격)에 라인이 여러 개일 수 있는데, 기존 `confirmOrderItem`은 **라인 1개 = 트랜잭션 1개**다.
그대로 여러 번 호출하면 뒤엣것이 실패했을 때 앞엣것만 차감된 채로 남는다.

→ **신규 `confirmCell(itemIds, allocations)`** 하나로 묶는다.
   - 배분을 라인에 나누는 계산은 **순수 함수 `splitAllocationsByLine()`**(신규 `lib/purchase-order-cell.ts`) — 단위테스트 대상
   - DB 쓰기는 기존 `applyAllocations`를 **그대로 재사용**(가용 검증·초과 차단이 이미 들어있다)
   - 취소도 같은 이유로 **`cancelCell(itemIds)`** 한 트랜잭션

⚠️ **근거 정정(2026-09-10).** 착수 실측에서 잡힌 「셀당 라인 2개」 2건은 **전부 C0의 결함**이었다.
C0로 열을 중량까지 갈라 세우면 그 2건은 각자 다른 열로 흩어져 **현재 데이터의 라인 2개 셀은 0건**이 된다.
그래도 셀 API를 `itemIds` 배열로 두는 이유는 두 가지다.

1. 같은 수령처가 **같은 SKU·같은 중량**을 두 줄로 적으면 여전히 한 셀에 모인다(양식이 막지 않는다)
2. D2d 톤백에서 어차피 셀 = 라인 여럿을 다뤄야 한다 — 나중에 시그니처를 갈아엎느니 처음부터 배열로 둔다

즉 **지금 당장을 위한 설계가 아니라 방어**다. 라인이 1개면 `splitAllocationsByLine`은 그대로 통과한다.

### 결정 B — 서버 헬퍼를 `lib/`로 옮긴다

`applyAllocations` / `loadAvailablePackages` / `allocatedQtyOfItem` / `recalcOrderStatus`는
`purchase-order.ts`의 **비공개 함수**인데, 새 액션 파일에서 써야 한다.
`'use server'` 파일은 **export한 모든 것이 서버 액션**이 되므로 `tx`를 받는 헬퍼를 export할 수 없다.

→ **신규 `lib/purchase-order-db.ts`** 로 4개를 옮긴다(`'use server'` 없음, `tx`를 인자로 받는 기존 형태 유지).
   D1b에서 `lib/purchase-order-masters.ts`를 뗀 것과 같은 패턴. `purchase-order.ts`는 import만 바꾼다.
   🔴 **동작은 한 줄도 바꾸지 않는다** — 순수 이동.

### 결정 C — 차감 후 갱신은 **순수 함수 재실행**(서버 재조회 없음)

피벗은 `buildMatrix(input)` 순수 함수 하나이고 입력은 `{orders, items, skus, availability}` 4개뿐이다.
셀 상태·재고부족 판정·행 진행률이 **전부 여기서 파생**된다.

→ 차감 후 서버를 다시 부르지 않는다.
   - 서버 페이지가 `Matrix`가 아니라 **`BuildMatrixInput`을 클라이언트에 넘긴다**
   - `confirmCell`/`cancelCell`이 **바뀐 두 값만 반환** — 그 라인들의 `allocatedQty`, 그 SKU의 `availability`
   - 클라이언트가 input의 그 두 값만 갈아끼우고 **`buildMatrix`를 다시 돌린다**
   - **1.4초(전체 재조회) → 15ms**(D2a 실측 앱 처리 시간)

🔴 **파생을 손으로 다시 쓰지 않는 것이 이 방식의 전부다.** 셀 상태를 클라이언트에서 따로 계산하면
그 순간 판정 규칙이 두 곳이 된다. 같은 SKU를 쓰는 다른 행이 재고부족으로 바뀌는 것까지
`buildMatrix` 재실행이 알아서 맞춘다.

**낡음 처리** — 다른 세션이 동시에 차감하면 내 화면 숫자만 낡는다.
잘못된 차감 자체는 `applyAllocations`가 서버에서 가용을 다시 검증해 막는다.
→ **확정이 실패하면 그때 전체 재조회**(`router.refresh()`)로 진실에 맞춘다. 성공 경로만 로컬 재계산.

### 결정 D — D2c가 다루지 않는 셀

| 셀 | 클릭 시 |
|---|---|
| 톤백(`unitWeightKg` 있음) | 「수동 지정이 필요합니다」 안내 — D2d에서 팝오버 |
| 매칭실패 | 「품종 지정이 필요합니다」 안내 — D2e에서 팝오버 |
| 완료 | 배분 내역 + 「차감 취소」 |
| 대기·부분·재고부족 | FIFO 추천 팝오버 |

---

## 4. 구현 단계

### C0. 🔴 D2b 결함 수정 — 톤백 열이 중량을 무시한다 (선행)

**증상**(묶음 #19 시아스, 실데이터):

```
라인 310  유기농 가바백미  톤백  unitWeightKg=1000  pt=18
라인 311  유기농 가바백미  톤백  unitWeightKg= 200  pt=18   ← 중량만 다름
```

`columnKeyOf`가 매칭 라인을 `pt:18` 하나로만 식별해서 **1,000kg짜리와 200kg짜리가 같은 열로 합쳐진다.**
규격별 소계에 「톤백 2개」라는, 중량이 다른 것을 더한 의미 없는 수가 찍힌다.

**딸린 결함 2개** — 톤백 재고는 자루마다 중량이 제각각이다(pt=18 가용 11자루: 203·332·375·450·550·587·788·876·887·1005·1014kg).

| # | 위치 | 증상 |
|---|---|---|
| 1 | `columnKeyOf` | 중량 다른 톤백이 한 열로 합쳐짐 |
| 2 | `buildColumns`의 `unitWeightKg` | 열 중량이 **먼저 만난 라인 값으로 굳는다**(1000) |
| 3 | `matrix-client.tsx:82` 총 가용 kg | `가용개수 × 열 unitWeightKg` = 11×1000 = **11,000kg**, 실제는 **7,067kg** |

**수정**

- `columnKeyOf` — `unitWeightKg`가 있으면 키에 넣는다: `pt:18|w:1000`
  (실측상 `unitWeightKg != null` ⟺ 톤백. 일반 규격은 전부 null이라 키가 안 바뀐다)
- 열 헤더 — 규격 행에 자루중량을 적는다(지금은 `packageType`뿐이라 「톤백」만 보인다)
- **톤백 열의 가용은 kg 총량으로 표시한다**(사용자 결정 2026-09-10)
  - 자루가 제각각이라 **개수는 의미가 없다.** 1,000kg 주문에 203kg 자루 11개는 답이 아니다
  - 액션이 `availability`(개수) 옆에 **`availabilityKg`(SKU별 실제 kg 합)** 를 함께 반환한다
    — 지금처럼 개수×요구중량으로 환산하면 틀린다
  - 가용 재고 행에서 톤백 칸만 단위를 `kg`으로 적어 개수 칸과 구분한다
- **재고부족(SHORTAGE) 판정도 톤백은 kg 기준**으로 낸다(개수 비교는 성립하지 않는다)
- 총 가용 kg 합계는 `availabilityKg`를 그대로 더한다

검증: `lib/purchase-order-matrix.test.ts`에 톤백 케이스 추가(중량 분리·kg 가용·부족 판정)
· 브라우저에서 `/sales/purchase/19`(시아스)가 **1,000kg / 200kg 두 열로** 서는지 확인

### C1. 서버 헬퍼 이동 (결정 B)

- 신규 `lib/purchase-order-db.ts` ← `purchase-order.ts`에서 4개 함수 이동
- `purchase-order.ts`는 import로 대체 (627줄 → 약 540줄)
- 검증: `npx tsc --noEmit` · `npm test` (동작 변화 없음이 근거)

### C2. 순수 배분 분배 (결정 A)

- 신규 `lib/purchase-order-cell.ts` — `splitAllocationsByLine(lines, allocations)`
  - 라인을 **남은 수량이 있는 순서(id 오름차순)** 로 채운다
  - 배분 1건이 라인 경계에 걸치면 **쪼갠다**(같은 packageId가 두 라인에 나뉜다)
  - 합이 안 맞으면 던진다(계산 오류를 조용히 넘기지 않는다)
- 신규 `lib/purchase-order-cell.test.ts` — 라인1개 / 라인2개 / 경계 걸침 / 부분차감 후 재차감 / 초과

### C3. 셀 액션 3종

`app/actions/purchase-order-matrix.ts`에 추가(209줄이라 여유):

| 액션 | 내용 |
|---|---|
| `getCellAllocation(itemIds)` | 라인별 주문·기차감 + **사람이 읽는 재고 후보 목록**(로트코드·포장일·생산자·가용개수) + FIFO 추천 + 부족분 |
| `confirmCell(itemIds, allocations)` | 결정 A. 한 트랜잭션, `timeout: 30000` 명시. **갱신된 `allocatedQty`(라인별) + `availability`(SKU) 반환**(결정 C) |
| `cancelCell(itemIds)` | 라인들의 `type=SALE` movement 하드삭제 + 건 status 재계산 + 감사로그. **반환값은 `confirmCell`과 동일** |

- 권한 `OPERATION_MANAGE` · `revalidatePath('/sales')` + `'/packages'`
- 🔴 후보 목록은 `packageId`만으로는 사람이 못 고른다 → 로트코드·포장일을 함께 반환

### C4. 팝오버 UI

- 신규 `cell-allocation-popover.tsx` (매트릭스 클라이언트가 800줄을 넘지 않게 — D2 §5 리스크)
  - 헤더: 수령처 · 품목 · 규격 · 「주문 12 / 차감 0」
  - 추천 배분 행 목록(로트·포장일·개수), 개수 조정 가능, 합계와 부족분 표시
  - 버튼: 「차감 확정」 / 완료 셀이면 「차감 취소」
- 신규 `order-detail-panel.tsx` — 행 머리글 클릭 시 그 건의 전 라인 목록(`getPurchaseOrderDetail` 재사용, 첫 호출부)
- `matrix-client.tsx` — 셀·행머리글 클릭 연결, 결정 D 안내, **input 상태 보유 + `buildMatrix` 재실행**(결정 C)

---

## 5. 변경 파일

| 파일 | 종류 |
|---|---|
| `lib/purchase-order-matrix.ts` · `.test.ts` | 수정(C0 — 톤백 열 분리) |
| `lib/purchase-order-db.ts` | 신규(이동) |
| `lib/purchase-order-cell.ts` · `.test.ts` | 신규 |
| `app/actions/purchase-order.ts` | 수정(import만) |
| `app/actions/purchase-order-matrix.ts` | 수정(액션 3종 추가) |
| `app/(dashboard)/sales/purchase/[uploadId]/matrix-client.tsx` | 수정 |
| 〃 `cell-allocation-popover.tsx` · `order-detail-panel.tsx` | 신규 |

---

## 6. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| 중 | C0가 열 키를 바꾼다 — 이미 쓰던 화면의 열 구성이 달라진다 | 일반 규격은 키가 그대로다(`unitWeightKg`가 null). 바뀌는 건 톤백 4라인뿐 |
| 중 | 헬퍼 이동이 기존 차감 경로(`confirmOrder` 등)를 건드린다 | 순수 이동만, 로직 변경 금지. `npm test` + tsc가 근거 |
| 중 | 라인 2개 셀의 배분 쪼개기 오류 → 차감 수량이 어긋난다 | 순수 함수 + 단위테스트. 합 불일치는 예외로 던진다 |
| 중 | 트랜잭션 안 쿼리 수(배분 1건당 2회 + INSERT) | 셀 단위라 소규모. `timeout: 30000` 명시(적재 사고 교훈) |
| 중 | 로컬 재계산이 서버 진실과 어긋난다 | 파생은 `buildMatrix` 재실행만. 확정 실패 시 전체 재조회로 복구(결정 C) |
| 낮 | `BuildMatrixInput` 페이로드 증가(1,700라인 시) | 지금 126라인. 파생(cells)이 빠지므로 `Matrix`보다 오히려 작다 |

---

## 7. 검증

- **C0 먼저**: `/sales/purchase/19` 톤백이 1,000kg·200kg 두 열로 서고 가용이 kg으로 뜨는지
- `npm test`(신규 cell 테스트 + 톤백 열 테스트 포함) · `npx tsc --noEmit` · `npx eslint`(변경 파일)
- **`next build` 금지** — dev 서버 상시 기동
- 브라우저 왕복(사용자): 셀 차감 → `/packages` 가용재고 **감소 확인** → 취소 → **복원 확인**
- 라인 2개 셀 1건을 실제로 차감해 두 라인 모두 채워지는지 확인
- **로컬 재계산 == 서버 진실**: 차감 직후 화면 숫자 → 새로고침(F5) 후 숫자와 일치하는지 확인
- 완료 후 `docs/report/report-발주서-D2c-2026-09-10.md` + `docs/worklog.md`
