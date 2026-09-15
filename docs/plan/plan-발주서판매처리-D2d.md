# 계획서 — 발주서 D2d (톤백 셀 수동 자루 지정 + 쪼개기)

- 작성일: 2026-09-14
- 상위 계획: `docs/plan/plan-발주서판매처리-D2매트릭스.md` §4 D2d (결정 #34·#43)
- 선행: D2c 종결 `6e938b7`(셀 팝오버·`confirmCell`·`cancelCell`·클라이언트 피벗)
- 관련 백로그: §40(요구 vs 실제 차이 — 같은 계산을 `lib/`로)

---

## 1. 작업 목표

톤백 셀을 누르면 **자루(재고 행)를 사람이 직접 고른다.** 자동 FIFO는 없다(#34).
자루가 요구 중량과 안 맞으면 그 자리에서 **쪼개서**(`createRepack` 재사용, #43) 맞는 쪽을 고른다.
「요구 1,000 / 실제 1,005 (+5)」 차이를 **보여주되 막지 않는다**(§40).

D2c가 `getCellAllocation`에서 톤백을 오류로 막아 둔 그 자리를 채운다. 매칭실패(D2e)는 여전히 범위 밖.

---

## 2. 착수 전 실측 (2026-09-14, Neon)

| 항목 | 값 |
|---|---|
| 톤백 라인 | **4건, 전부 묶음 #19 시아스(order 177)** — pt18(가바백미) 1,000kg·200kg / pt24(가바현미) 1,000kg·200kg, 각 `orderedQty=1` |
| pt18 가용 자루 | 11행 전부 `count=1`: 1,014·1,005·887·876·788·587·550·450·375·332·203kg (이광용·이진현·박오주·오치백) |
| pt24 가용 자루 | 2행: 1,004(이광용)·203(이진현) |
| 톤백 행 전체 | 216행. **`count>1`인 행 43개**(1,000~1,005kg 균일 자루 N개 묶음, pt 11·54·41·68) → 행 = 「같은 중량 자루 N개」, 차감은 자루 개수 |
| `createRepack` 결과 | 결과 줄 `packageType='톤백'`이면 포장지를 `'톤백'`으로 **강제**하고 `findOrCreateProductType(품종·도정·톤백·톤백포장지)` → **원래 SKU로 돌아온다** = 쪼갠 자루가 바로 차감 후보가 된다. 반환은 `repackId`뿐(결과 행 id 없음) |
| 재포장 손실 | 결과>소스 차단, 부족분 `lossKg`, 1% 초과 시 `needsLossConfirm` |

🔴 **개수 기준 규칙이 톤백에서 깨지는 지점 3개** (D2c 코드 그대로면 생기는 일)

| 위치 | 규칙 | 톤백에서 |
|---|---|---|
| `applyAllocations` | `already + addQty > orderedQty` 차단 | 1자루 주문에 587+450 두 자루를 고르면 **차단** — 정상 업무인데 못 한다 |
| `splitAllocationsByLine` | 배분 합 > 남은 개수면 던짐 | 같은 이유로 던짐 |
| `cellStatusOf` | `allocatedQty >= orderedQty` → 완료 | 자루 개수로 판정 — 985kg 자루 1개도 완료, 두 자루도 완료. **이건 맞다**(아래 결정 F) |

---

## 3. 설계 결정

### 결정 E — ~~자루 목록, 추천 없음, 근접순~~ → 🔴 **E′ (2026-09-14 사용자 결정) kg FIFO 추천, 넘기는 자루 하나만 쪼갠다**

구현 후 사용자 지적: 쪼개기가 있는 이상 「근접순」은 의미가 없다 — 어느 자루를 고르든 딱 안 맞으면 쪼개고 나머지는 남으니
정렬이 결과를 바꾸지 않는다. 「원칙대로 오래된 것부터, 자루가 여러 개 쓰여도」로 확정(2efc798).

- 후보 = 가용 자루 행, **FIFO 순**(도정/입고일 → id). 표시: 자루중량 · 로트 · 생산자 · 날짜 · 가용 N자루
- 추천 = `suggestBulkAllocation(남은 요구 kg, 후보)` — 오래된 자루부터 **통째로** 담다가 다음 자루가 남은 요구량을 넘기면
  **그 자루에서 남은 만큼만 쪼개 쓰고** 멈춘다. 예: pt18 1,000kg → 587 + 332 + (450에서 81) = 3자루, 369kg 자루가 남는다
- 추천이 **기본 체크**로 뜬다. 사람이 바꿀 수 있다 — 통째 자루 체크 해제/추가, 쪼갤 몫 끄기(그러면 1,005 통째 같은 「차이 감수」)
- **확정 한 번**에 끝난다: 쪼갤 몫이 켜져 있으면 `createRepack`(되돌리기 없음 confirm) → 재조회로 새 자루 찾기 → `confirmCell`
- ~~행별 가위(수동 즉시 쪼개기)는 남긴다~~ → 🔴 **결정 K로 삭제**(2026-09-15). 쪼갤 몫을 +/-로 조절하는 것으로 대체
- `count>1` 행은 맞는 만큼 통째 + 나머지 한 자루 쪼개기(예: 1,005×4에서 2,500 → 2자루 + 490)
- `sortBulkCandidates`(근접순)는 **삭제**. 서버 `getBulkCellOptions`는 `sortFifo`로 정렬해 넘긴다

### 결정 F — 톤백 완료 판정은 「자루 개수」 그대로, 초과 차단만 푼다

kg으로 완료를 판정하면 985kg 자루를 통째 낸 셀이 영원히 「부분(남은 15kg)」이다.
사람이 「이걸로 낸다」고 확정한 순간 그 셀은 끝난 것이다 — 차이는 §40이 보여준다.

- **완료 판정 = `computeLineStatus(orderedQty, allocatedQty)` 그대로**(자루 수). 1자루 주문에 2자루면 2≥1 완료 ✓, 3자루 주문에 2자루면 부분 ✓
- **초과 차단만 푼다** — `applyAllocations`에 `guard?: 'count' | 'open'` 옵션(기본 `'count'`).
  `'open'`은 「이미 완료된 라인(`already >= orderedQty`)엔 더 못 넣는다」만 본다. 톤백 경로만 쓴다
- 🔴 **`lib/purchase-order-db.ts`는 이 옵션 한 줄만 바뀐다.** 일반 규격 경로는 기본값이라 동작 불변

### 결정 G — 자루를 라인에 나누는 규칙: 남은 개수만큼 채우고 **넘치는 자루는 마지막 라인에**

`splitAllocationsByLine(lines, allocations, { overflow: 'last' })` 옵션 추가.
- 2자루 / 라인 1(남은 1) → 라인1에 2자루
- 2자루 / 라인 2(남은 1·1) → 1자루씩
- 3자루 / 라인 2 → 1자루 + 2자루
- 기본(`overflow` 없음)은 지금처럼 던진다 — 일반 규격 경로 불변

같은 셀에 톤백 라인 2줄은 C0-a 이후 「같은 SKU·같은 중량 2줄」일 때만 생긴다(현재 0건). 방어용.

### 결정 H — 쪼개기는 팝오버 안에서, `createRepack` 그대로

자루 행의 「쪼개기」 → 그 줄이 펼쳐져 분할 중량 입력(기본값 = 남은 요구 kg, 상한 = 자루중량 − 1kg).
- `sources: [{packageId, takeCount: 1}]` · `results: [톤백 X kg ×1, 톤백 (w−X) kg ×1]`(둘 다 `packagingId: null` → 서버가 톤백 강제) · `inheritFromPackageId = 그 자루` · `note: '발주서 톤백 분할 (묶음 #N)'`
- 손실 0이라 `needsLossConfirm`은 안 뜬다. 뜨면(계산 어긋남) 오류로 보여준다
- 🔴 **쪼개기 전 `confirmDialog`** — 「되돌리기 없음. 잘못 쪼개면 역방향 재포장(제품재고 화면)으로 합칩니다」(상위 계획서 리스크 표)
- 성공 → **후보 재조회**(`getBulkCellOptions` 다시) → 새로 생긴 X kg 자루를 **자동 체크**(로트·중량으로 찾는다. `createRepack`이 결과 행 id를 안 돌려줘서)
- `count>1` 행에서 쪼개면 `takeCount 1`, 나머지 N−1자루는 원행에 남는다 ✓

### 결정 I — 「요구 vs 실제」 계산은 `lib/purchase-order-bulk.ts` 순수 함수 (§40 재사용)

```ts
requiredKgOf(line)            // orderedQty × unitWeightKg
bulkDelta(requiredKg, actualKg) // { deltaKg, deltaPct, level: 'exact'|'over'|'under' }
sortBulkCandidates(targetKg, rows)  // 근접순 + FIFO tie-break
```
`level` 임계는 **±1%**(§40 예시). 팝오버는 색만 바꾼다. D5 엑셀이 같은 함수를 쓴다.

### 결정 J — 차감·취소·갱신은 D2c 그대로

- 확정 = `confirmCell(itemIds, allocations)` **재사용**. 톤백이면 서버가 `guard:'open'` + `overflow:'last'`로 분기(라인의 `unitWeightKg !== null`로 판정 — 클라이언트 플래그를 믿지 않는다)
- 취소 = `cancelCell` 그대로. 쪼갠 자루는 남는다(재고 형태가 바뀐 건 별개 사실이고 되돌리기는 기각 #57)
- 갱신 = `CellPatch` 그대로 — `loadCellPatch`가 `availabilityKg`도 이미 돌려준다(C0-a). 쪼개기만 하고 안 나가도 SKU 가용 kg은 그대로라 패치 불필요

---

### 결정 K — 쪼갤 몫은 **요구 + 3kg(고정)**으로 추천하고 **사용자가 ±1kg로 조절**한다 · 행별 가위는 삭제 (2026-09-15 사용자 결정)

브라우저 확인에서 사용자 지적: 마지막 자루를 요구량에 **딱 맞게** 자르면 실업무와 안 맞는다.
1톤 주문엔 보통 1,005kg 정도로 맞춰 보낸다. 그리고 행별 가위(「지금 나누기」)는 뭘 하는 버튼인지 이해가 안 됐다.
2차 정정: 스텝은 5kg 말고 **1kg**. 대신 **기본값을 발주량 + 3kg**(톤백 자루 무게가 그 정도)로.

- 추천 목표 = **남은 요구 kg + 3kg 고정**(`BULK_TARE_KG`·`bulkTargetKg`, lib 신규 + 테스트). `suggestBulkAllocation` 자체는 불변 — 호출부가 목표 kg를 넣는다.
  예: 1,000kg 1자루 → 목표 1,003 → 587 + 332 + (450에서 **84**). 요약은 「실제 1,003 · +3(+0.3%)」 초록.
  ~~자루당(2자루면 +6)~~ → 3차 정정(2026-09-15): **자루 수와 무관하게 +3 한 번**. 포장할 때 발주량 +3~5로 맞춰 만드니 여유분이지 자루 무게가 아니다
- 쪼개기 행에서 사람이 그 자리에서 조절한다
- 쪼개기 행이 `☑ ✂ 확정 때 [−] 1,005 [+] kg만 쪼개 씀 · 295kg 남김`으로 바뀐다
  - `−`/`+`는 **1kg** 단위. 숫자 칸에 직접 입력도 된다
  - 범위 `1 ≤ kg ≤ 자루중량 − 1`. 자루를 통째로 쓰려면 위 체크박스(기존 그대로)
  - 요약의 **실제 · 차이**와 확정 버튼의 kg가 같이 움직인다(이미 `split.kg` 상태에서 계산하므로 표시만 따라온다)
- 행별 **가위 버튼 · 인라인 수동 입력 · 「지금 나누기」 · 그 뒤 재조회(`load`)는 삭제**.
  팝오버 = 「추천 확인 → 조절 → 체크 → 확정」만 남는다. 쪼개기는 확정 때 한 번(결정 H 그대로)
- 범위 밖: 추천이 딱 떨어져 쪼갤 자루가 없을 때(예 500×2 = 1,000) 1,005로 늘리는 것. 톤백 중량이 124종이라 드물다.
  그땐 통째 자루 하나를 빼고 다른 자루를 쪼개는 식으로 사람이 만든다 — 필요해지면 「이 자루 쪼개 쓰기」 토글을 행마다 추가

### 결정 L — 추천은 **발주 자루 단위**: 자루중량 ~ +1% 안의 재고 자루는 통째로 1자루 만족, 남는 발주 자루만 kg FIFO (2026-09-15 사용자 결정, K의 4차 정정)

K까지는 셀을 kg 한 덩어리로 봤다(요구 3,000 + 3). 사용자 예시: 1,000×3 발주에 재고 1003·1005·890·350이면
**앞 둘은 그냥 1톤 자루로 치고 통째 차감**, 나머지 발주 1자루만 890 + (350에서 113) = 1,003으로 만든다.
「톤백 발주량은 1%까지 넘쳐도 만족」 = 1,000 발주면 1,000~1,010.

- `fitsUnit(w, unitKg)` = `unitKg ≤ w ≤ unitKg × (1 + BULK_TOLERANCE)`. 하한은 발주 중량 그대로(999는 아님). 임계는 §40 차이 표시와 같은 상수
- `suggestBulkUnits(unitKg, units, bags)` — 1) FIFO로 `fitsUnit` 자루를 통째 1자루씩(count>1 행은 남은 발주 수만큼) 2) 남은 발주 자루 × unitKg + 3(한 번)을
  나머지 풀에서 `suggestBulkAllocation`. 1,014 같은 1% 밖 자루는 풀로 가서 1,003만 쪼개 쓴다(11 남음)
- ⚠️ 결과가 바뀌는 곳: 실데이터 pt18 1,000×1은 이제 587+332+84가 아니라 **1,005(8/10) 통째** — 맞는 자루가 오래된 조각보다 앞선다(사용자 예시 그대로)
- 팝오버는 `suggestBulkUnits(lines[0].unitWeightKg, remainingQty, candidates)`. 셀의 라인은 열 분리(C0-a)로 자루중량이 같다.
  남은 요구 kg도 `remainingQty × unitKg`(기차감이 1,005였을 때 1,995로 어긋나던 것 정리)
- 테스트 +8 = 22건

## 4. 구현 단계

### D1. 순수 함수 2건 + 테스트 ✅ **구현 완료 `77ef717`** (13건)

- `lib/purchase-order-bulk.ts` 신규(결정 I) + `.test.ts`: 차이 부호·1% 경계·근접순 정렬·동률 FIFO
- `lib/purchase-order-cell.ts` — `splitAllocationsByLine` 3번째 인자 `{ overflow?: 'last' }`(결정 G) + 테스트 3건(위 표)

### D2. 서버 ✅ **구현 완료 `0f9c88e`**

- `lib/purchase-order-db.ts` — `applyAllocations` `guard` 옵션(결정 F). **다른 줄은 손대지 않는다**
- `app/actions/purchase-order-matrix.ts`
  - 신규 `getBulkCellOptions(itemIds)` — 라인(itemId·orderedQty·unitWeightKg·allocatedQty), `requiredKg`, `allocatedKg`(SALE movement `count × weightPerUnit` 합), 후보 자루(packageId·weightPerUnit·available·lotNo·producer·date·source, 근접순), 기차감 목록(kg 포함)
  - `confirmCell` — 라인이 톤백이면 `overflow:'last'` + `guard:'open'`(결정 J). 반환 동일
  - `getCellAllocation`의 톤백 차단 문구는 유지(일반 경로에 톤백이 들어오면 여전히 막는다)
- 532줄 → 약 650줄. 800 이내

### D3. 팝오버 ✅ **구현 완료 `0f9c88e`** · 🔴 **브라우저 미확인** — 보고서 `docs/report-발주서-D2d-2026-09-14.md`

- 신규 `tonbag-popover.tsx`(상위 계획서 리스크 표가 지정한 파일명) — `TonbagBody` export
  - 헤더 밑 요약: **요구 1,000kg · 고른 1,005kg · +5 (+0.5%)**
  - 자루 목록(체크 + count>1이면 stepper) · 행마다 「쪼개기」 → 인라인 분할 입력 + 확인(결정 H)
  - 「이 셀 차감 확정 · N자루 · 1,005kg」 / 기차감 있으면 「차감 취소」(D2c `CancelButton` 재사용 — export)
  - 차이 ±1% 넘으면 요약을 주황으로. **막지 않는다**
- `cell-allocation-popover.tsx` — `Body`에서 `cell.bulk`면 안내문 대신 `<TonbagBody>`. `CancelButton`·`Head` export. 그 외 불변
- `matrix-client.tsx` 변경 없음(이미 `bulk`·`itemIds`를 넘긴다)

### D4. 문서 ✅

- 계획서 본 파일 상태 · `docs/report-발주서-D2d-2026-09-XX.md` · worklog · 백로그 §40에 「D2d에서 `lib/purchase-order-bulk.ts`로 뺐음, D5는 이걸 쓸 것」 한 줄

---

### D5. 쪼갤 몫 조절 + 가위 삭제 (결정 K) ✅ · 발주 자루 단위 추천 (결정 L) ✅ **구현 완료** · 🔴 **브라우저 미확인**(§7 3′·3″)

- `tonbag-popover.tsx`만 — `SplitPlan.kg`를 바꾸는 `onSplitKg` 추가(`clamp(1, w−1)`), `CandidateRow`에서 가위·`manualOpen`·`defaultManualKg`·`onManualToggle`·`onManualSplit`·`kg` 로컬 상태 삭제,
  `TonbagBody`에서 `manualSplit`·`manualSplitNow`·`load` 삭제. `Step` 컴포넌트 재사용(±1)
- `lib/purchase-order-bulk.ts` — `BULK_TARE_KG = 3`·`bulkTargetKg(remainingKg, remainingBags)` + 테스트 1건. 서버 변경 없음. 검증 = `tsc`·`eslint` + 브라우저(§7 3′)

## 5. 변경 파일

| 파일 | 종류 |
|---|---|
| `lib/purchase-order-bulk.ts` · `.test.ts` | 신규 |
| `lib/purchase-order-cell.ts` · `.test.ts` | 수정(`overflow` 옵션) |
| `lib/purchase-order-db.ts` | 수정(`guard` 옵션 — 한 곳) |
| `app/actions/purchase-order-matrix.ts` | 수정(`getBulkCellOptions` 신규 · `confirmCell` 톤백 분기) |
| `app/(dashboard)/sales/purchase/[uploadId]/tonbag-popover.tsx` | 신규 |
| 〃 `cell-allocation-popover.tsx` | 수정(bulk 위임 · 2개 export) |
| `docs/리팩토링-백로그.md` §40 | 한 줄 |

---

## 6. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| **중** | `guard:'open'`이 일반 규격 경로로 새면 초과 차감이 열린다 | 서버가 `unitWeightKg !== null`로만 켠다. 기본값 `'count'`. 테스트로 기본 동작 고정 |
| 중 | 쪼개기는 되돌릴 수 없다(#57) | `confirmDialog` 문구에 명시. 손실 0이라 데이터는 안 준다(자루 하나가 둘로 갈릴 뿐) |
| 중 | 쪼갠 뒤 새 자루를 자동 체크할 때 결과 행 id가 없다 | 재조회 후 로트·중량·`repackId` 최신으로 찾는다. 못 찾으면 체크 없이 목록만 갱신(사람이 고른다) |
| 낮 | `createRepack`이 `revalidatePath('/packages')`·`'/'`를 부른다 → D2c 교훈대로 **현재 페이지가 응답에 재렌더**된다 | 쪼개기는 드문 동작이라 1.4초를 받아들인다. 대신 재렌더가 와도 로컬 상태가 서버 값으로 되돌아가므로(`serverInput !== seen`) 어긋나진 않는다. 자주 쓰이면 그때 뺀다 |
| 낮 | 후보 자루가 많을 때(pt11 같은 SKU는 수십 행) | 목록 `max-h` 스크롤. 근접순이라 위쪽만 보면 된다 |

---

## 7. 검증

- 단위: `npm test`(bulk·cell 신규) · `npx tsc --noEmit` · `npx eslint`(변경 파일). **`next build` 금지**
- 브라우저(`/sales/purchase/19` 시아스):
  1. 가바백미 1,000kg 셀 → 후보 맨 위가 1,005(+5)·1,014(+14) → 1,005 체크 → 확정 → 셀 완료 · 가용 행 kg 감소 → `/packages`에서 그 자루 가용 0 → 취소 → 복원
  2. 200kg 셀 → 203(+3) 체크 → 확정
  3. ~~**쪼개기**: 1,000kg 셀에서 1,014 자루 「쪼개기」 → 1,000 입력 → 확인 다이얼로그 → 새 1,000 자루가 체크된 채 목록 갱신 → 확정 → `/packages`에 **14kg 톤백** 남는지~~ (가위 삭제, 결정 K)
  3′. **조절**(결정 L 뒤엔 1,005·1,014를 먼저 빼고 봐야 이 그림): 1,000kg 셀 → 추천 587+332+(450에서 **84**) · 요약 실제 1,003 · +3(+0.3%) 초록 → `+` 두 번 → 86 · 실제 1,005 · 확정 버튼 1,005kg → 확정 다이얼로그가 86 + 364 → 확정 → `/packages`에 **364kg 톤백**이 원본 포장일로 남는지 · 취소 → 복원
  3″. **자루 단위**(결정 L): 시아스 1,000kg 셀 그대로 열면 **1,005(8/10) 하나만 체크**·쪼개기 없음·요약 +5(+0.5%) 초록. 200kg 셀은 203이 1% 밖(202까지)이라 풀로 → 200+3=203을 203에서 쪼개면 0 남음 ← 🔴 확인 필요(w−1 상한에 걸려 202가 될 것)
  4. 두 자루(587+450) 체크 → 확정이 **막히지 않고** 완료로 뜨는지(결정 F), 요약이 +37(+3.7%) 주황인지
  5. 가바현미 1,000kg 셀(pt24) → 1,004 · 203 두 행만 뜨는지
  6. 일반 규격 셀(자연주의 1kg 등)이 D2c 그대로 동작하는지(회귀)
  7. 차감 직후 숫자 == F5 후 숫자
