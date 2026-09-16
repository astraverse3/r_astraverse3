# 계획서 — 발주서 매칭실패 수동지정 제거 (안내 전용 전환)

- 작성일: 2026-09-16
- 발단: 사용자 판단 — 「초기 안정화되면 거의 발생하지 않을 일. 굳이 이 기능을 안 써도 된다.
  품종 관리에서만 관리하고 안내만 해 주면 된다」
- 되돌리는 대상: D2e 결정 N·O·S·T (`plan-발주서판매처리-D2e.md`), 구현 `c0f9f97`
- 연쇄: `plan-품종별칭-관리화면.md` 결정 V·§2.2가 무효 → 같이 고친다

---

## 1. 작업 목표

**매칭실패 셀 팝오버에서 「고치는 기능」을 전부 걷어내고 「어디로 가서 무엇을 하면 되는지」만 남긴다.**

지금은 팝오버 안에서 품종을 고르고 SKU를 고르고 별칭까지 학습시킬 수 있다. 이걸 없애고,
매칭실패를 푸는 경로를 **마스터 화면(품종 관리 / 제품유형 관리) → 재매칭** 하나로 단일화한다.

### 왜 없애나 — 근거 3가지

1. **쓸 일이 거의 없다.** 사용자 판단. 초기 카탈로그가 채워지면 매칭실패 자체가 드물어진다.
2. **입구가 둘이면 별칭이 중구난방이 된다.** 팝오버 학습은 「이 발주서를 넘기려고」 누르는 것이라
   품종 마스터 전체에 남는 규칙이라는 감각 없이 쌓인다. 사용자: 「별칭을 중구난방으로 관리하면 안 될 것 같아.」
3. **D2e 실측이 이미 말해 줬다.** 매칭실패의 절반은 이름이 아니라 **SKU 카탈로그 빈칸**이라
   수동지정으로 풀 수 없었다. 실제 지정 가능 케이스는 18건 중 2건뿐(#16 천지향5세 10kg · #17 가바현미 PET).
   나머지는 어차피 마스터 화면에 가야 했다 — **팝오버가 풀어 주는 척만 하고 있었다.**

### 사용자 지적 2번의 처리

「SKU 없는 매칭실패인데 품종 셀렉트박스가 나오는 건 의미 없다」 → 맞다. 지금 코드는
`varietyId === null`일 때만 「품종 관리에서 등록하세요」를 띄우고, 품종을 골라야 비로소
「이 품종에 제품유형이 없어요」(`NoSku`)가 나온다. **실패 사유를 이미 서버가 아는데 사용자에게
셀렉트박스를 한 번 만지게 한 뒤에야 알려 준다.** 안내 전용으로 바꾸면 이 우회가 사라진다.

---

## 2. 설계 결정

### 결정 N′ — 결정 N·O 철회. 팝오버는 안내만 한다

D2e 결정 N(열 단위 지정)·O(후보는 기존 활성 SKU뿐)은 **지정 기능 자체가 없어지므로 함께 폐기**한다.
단, **「지정이 열 전체에 닿는다」는 관점은 안내에 남긴다** — 이 셀 하나가 아니라
「N수령인 · M라인이 같이 걸려 있다」를 보여 줘야 마스터를 고칠 동기가 생긴다.

### 결정 S′ — 결정 S·T 철회. 별칭 학습은 코드에서 제거

`learnVarietyAlias`를 지운다. 별칭을 만드는 경로는 **품종 관리 화면 하나뿐**이 된다.

🔴 결정 S·T의 **판정 규칙 자체는 사라지지 않는다.** 별칭 계획서 결정 X의 `lib/variety-alias.ts`가
그 규칙을 이어받는다(다른 품종 이름과 충돌 금지 = S, 도정 단어 섞임 금지 = T). `hasMillingToken`은
그래서 **남긴다** — 테스트 4건도 그대로.

### 결정 Z — 안내는 실패 사유 3종을 그대로 구분해서 말한다

서버가 `MatchFailReason`을 이미 알고 있으니 사유별로 **갈 곳이 다르다는 걸 명시**한다.
「매칭 실패했습니다」 한 줄로 뭉개면 사용자가 품종 관리와 제품유형 관리 중 어디로 갈지 모른다.

| 실패 사유 | 화면이 말할 것 | 갈 곳 |
|---|---|---|
| `variety_unresolved` | 「'가바현미'가 어느 품종인지 몰라요」 | **품종 관리** — 이 이름을 별칭으로 등록 (또는 품종 자체를 신규 등록) |
| `packaging_unresolved` | 「'서농22호'는 찾았는데 포장지 'PET'에 맞는 2kg 제품유형이 없어요」 | **제품유형 관리** — SKU 등록 |
| 그 외(제품유형 없음) | 「'서농22호'에 등록된 제품유형이 없어요」 | **제품유형 관리** — SKU 등록 |

- 공통 꼬리: 「등록한 뒤 위의 **재매칭**을 눌러 주세요」
- 🔴 **링크로 새 탭을 열지 않는다** — D2e에서 이미 내린 판단(2026-09-15)을 그대로 지킨다.
  등록하고 와도 재매칭을 눌러야 해서 링크가 흐름을 완결시키지 못한다. **메뉴 이름만 일러 준다.**
- `variety_unresolved`인데 이름에 도정 단어가 섞여 있으면(`hasMillingToken`) 한 줄 덧붙인다 —
  「'백미 천지향5세'처럼 도정이 섞인 이름은 별칭으로 등록할 수 없어요」. 품종 관리에 가서
  거절당하는 헛걸음을 미리 막는다.

### 결정 V′ — 🔴 별칭 편집 권한은 `SUPPLY_MANAGE` (별칭 계획서 결정 V를 뒤집는다)

사용자 결정: **「품종관리 메뉴 권한자가 수정하는 걸로 하자.」**

별칭 계획서 결정 V는 `OPERATION_MANAGE`를 주장했고 근거가 §2.2 「학습이 이미 그 권한으로 열려 있으니
보기·지우기도 같아야 앞뒤가 맞는다」였다. **그 학습 경로가 이번에 없어지므로 근거가 통째로 사라진다.**
§2.2가 말한 「만들 수는 있는데 되돌릴 수는 없는 상태」도 **만들 수도 없어져서** 자연 해소된다.

- `updateVarietyAliases`는 `SUPPLY_MANAGE` — 품종 관리의 다른 액션과 같다
- 별칭을 `VarietyFormData`에 넣을지는 별칭 계획서 A2에서 다시 판단(권한이 같아졌으므로 섞어도 무방)
- 영향: 임승원·민채·이영명(`OPERATION_MANAGE`만)은 **별칭을 못 만든다.** 매칭이 막히면
  `SUPPLY_MANAGE` 보유자에게 요청해야 한다. 사용자가 「중구난방 방지」를 위해 감수한 비용.

---

## 3. 변경 범위

### 3.1 화면

| 파일 | 변경 |
|---|---|
| `.../[uploadId]/unmatched-popover.tsx` | **재작성** — 안내 전용. 품종 셀렉트·SKU 목록·별칭 체크박스·「지정 저장」·`NoSku` 전부 삭제. `useState`/`submit`/`toast` 불필요 |
| `.../[uploadId]/cell-allocation-popover.tsx` | `onMatch` prop 삭제(`Body`·`CellPopover` 두 군데 타입·전달) |
| `.../[uploadId]/matrix-client.tsx` | `onMatch={...}` 전달 1줄 삭제 (`applyMatches`는 **재매칭이 계속 쓰므로 유지**) |

### 3.2 서버 액션

| 파일 | 변경 |
|---|---|
| `app/actions/purchase-order-assign.ts` | `assignUnmatchedColumn`·`AssignResult` 삭제. `getUnmatchedCellOptions` **축소** — `varieties`·`skusByVariety`·`SkuCandidate`·`VarietyOption` 제거, `alias`는 `blockedByMilling` 한 줄만 남김. `rematchUpload`·`loadMatchPatch`는 **유지** |

축소 후 `UnmatchedCellOptions`:

```
{ rawItemName, packageType, rawPackaging,
  scope: { recipientCount, lineCount, orderedQty },   // itemIds 불필요 — 지정할 게 없다
  fail: { reason, varietyToken, varietyName, millingType },  // varietyName 추가: 안내에 품종 이름을 쓴다
  blockedByMilling }
```

🔴 축소하면 마스터 로딩(`loadMatcherMasters`)은 **여전히 필요**하다 — 매처를 돌려 실패 사유를
알아내야 하고, 「지금은 자동 매칭됩니다 → 재매칭을 누르세요」 조기 반환도 유지해야 한다.

### 3.3 lib (데드코드 정리)

| 파일 | 변경 | 근거 |
|---|---|---|
| `lib/purchase-order-masters.ts` | `learnVarietyAlias` **삭제** | 호출부가 `assignUnmatchedColumn` 하나뿐 |
| `lib/purchase-order-matcher.ts` | `sortSkuCandidates` **삭제** | 호출부가 `getUnmatchedCellOptions`의 SKU 후보 정렬 하나뿐 |
| `lib/purchase-order-matcher.test.ts` | `sortSkuCandidates` 테스트 2건 삭제 | 위와 짝 |

🔴 `hasMillingToken`과 그 테스트 4건은 **남긴다** — 안내(결정 Z)와 별칭 계획서 결정 X가 쓴다.

### 3.4 문서

| 파일 | 변경 |
|---|---|
| `docs/plan/plan-발주서판매처리-D2e.md` | 결정 N·O·S·T에 **철회 표시 + 사유**. 지우지 않는다(왜 만들었다 없앴는지가 기록으로 남아야 한다) |
| `docs/plan/plan-품종별칭-관리화면.md` | 결정 V → V′(`SUPPLY_MANAGE`), §2.2 문제 해소 표시, A2의 `learnVarietyAlias` 교체 항목 삭제, §8 ① **해결됨**으로 |

**합계 8개 파일** → 이 계획서가 HARD-GATE.

---

## 4. 구현 단계

1. **B1** — `unmatched-popover.tsx` 재작성 (결정 Z 안내 3종 + 도정 단어 한 줄)
2. **B2** — `cell-allocation-popover.tsx`·`matrix-client.tsx`에서 `onMatch` 체인 제거
3. **B3** — `purchase-order-assign.ts`에서 `assignUnmatchedColumn` 삭제 + `getUnmatchedCellOptions` 축소
4. **B4** — lib 데드코드 3건 정리, 테스트 2건 삭제
5. **B5** — 문서 2건 갱신 (D2e 철회 표시 · 별칭 계획서 결정 V′)
6. **B6** — 검증 (§6)

순서 주의: B1→B2→B3이 역방향이면 타입 에러가 중간에 잔뜩 뜬다. **화면부터 걷어내고 서버를 줄인다.**

---

## 5. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| 중 | 마스터를 못 고치는 사람(`OPERATION_MANAGE`만)은 **매칭실패를 스스로 풀 수 없다** | 결정 V′에서 사용자가 감수한 비용. 안내가 「어느 메뉴」인지 정확해야 요청이 빨라진다 |
| 낮 | 되살릴 일이 생기면 재구현 | git에 남는다(`c0f9f97`). D2e 계획서에도 철회 사유를 적어 두므로 판단 근거가 보존된다 |
| 낮 | 축소한 `getUnmatchedCellOptions`가 안내에 필요한 값을 빠뜨림 | `varietyName`을 새로 채운다(지금은 `varietyId`만 있어 안내에 이름을 못 쓴다) |
| 낮 | `sortSkuCandidates` 삭제가 다른 곳을 깨뜨림 | grep으로 호출부 1곳 + 테스트만 확인됨 |

---

## 6. 검증

1. `npx tsc --noEmit` · `npm run lint` · `npm test`
   - 🔴 `next build`는 돌리지 않는다(dev 서버 상시 기동)
2. grep 잔재 확인 — `assignUnmatchedColumn` · `learnVarietyAlias` · `sortSkuCandidates` · `onMatch` 0건
3. 브라우저(사용자)
   - 매트릭스에서 매칭실패 셀 클릭 → 안내만 뜨는지, 「지정 저장」이 없는지
   - 사유 3종이 실제로 구분돼 보이는지 (현재 데이터에 `variety_unresolved`·SKU 없음 둘 다 있다)
   - 도정 단어 섞인 이름(`백미 천지향5세`)에 추가 안내가 붙는지
   - 「재매칭」 버튼이 여전히 동작하는지 (**유일한 해소 경로가 됐으므로 필수 확인**)

---

## 7. 확인 필요 (사용자)

없음 — 두 결정(정리 범위 · 별칭 권한) 모두 2026-09-16에 확정됨.

다만 **별칭 계획서 §8 ②(별칭을 목록에 항상 보일지)는 여전히 미결**이다. 그건 별칭 계획서를
승인할 때 정한다.
