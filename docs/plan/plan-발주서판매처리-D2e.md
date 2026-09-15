# 계획서 — 발주서 D2e (매칭실패 셀 수동지정 + 재매칭)

- 작성일: 2026-09-15
- 상위 계획: `docs/plan/plan-발주서판매처리-D2매트릭스.md` §4 D2e · `plan-발주서판매처리-단계6.md` §4 D2 (결정 #18·#22)
- 선행: D2d 종결 `ae6d4be`(결정 M). D2c 결정 C(액션 뒤 서버 재조회 없음)·결정 A(셀 = 트랜잭션 하나) 그대로 따른다
- 이전 시안: `docs/handoff/발주서판매처리/_이전시안/건상세-C안-모바일.html`(품종 선택 → 규격 → 포장지 → 별칭 학습 체크 → 재매칭/지정 저장)

---

## 1. 작업 목표

매트릭스의 **매칭실패(빨간) 셀을 눌러 SKU(제품유형)를 지정**하고, 원하면 그 품목명을 품종 별칭으로 학습시킨다(#22).
지정이 끝나면 그 열은 보통 열이 되어 D2c 팝오버로 바로 차감할 수 있다.
덤으로 **「재매칭」** 한 번으로, 업로드 뒤에 등록된 SKU·별칭을 묶음 전체에 다시 적용한다.

D2c가 `Body`에서 「매칭실패 셀은 다음 단계(D2e)에서 지정합니다」로 막아 둔 자리를 채운다.

---

## 2. 착수 전 실측 (2026-09-15, Neon 읽기만)

매칭실패 라인 **27건 / 원본 조합 17종**(묶음 #15 택배 · #16 해남급식 · #17 이마트 · #18 서울급식). 매처를 지금 다시 돌린 결과:

| 실패 사유 | 종 | 조합 | 해소 경로 |
|---|---|---|---|
| **이미 매칭됨** (업로드 뒤 SKU 등록) | 2 | 찰보리 1kg · 가바 발아현미 800g | **재매칭 버튼**이면 끝 |
| `sku_unresolved` — 품종은 풀렸는데 그 규격 SKU가 없음 | 7 | IPS 10kg · 수수 1kg · 차조 1kg · 가바흑미 800g · 보리 1kg · 흑미 500g · 발아현미 1kg | **`/admin/product-types`에 SKU 등록 → 재매칭**. 수동지정으로 못 푼다(고를 SKU가 없음) |
| `packaging_unresolved` — 지정 포장지 SKU 없음 | 1 | 가바현미 1kg PET (1kg은 자연주의·땅끝미가만 있음) | 수동지정(다른 포장지 SKU 선택) 또는 PET SKU 등록 |
| `variety_unresolved` — 품종/별칭 해석 실패 | 7 | 누룽지 · 프로틴 라이스 IPS 907g · **백미 천지향5세** 10kg · 귀리쌀 420g · 혼합곡/율무/녹두 **(친환경)** | **수동지정 + 별칭 학습**(품종이 마스터에 있을 때). 누룽지·프로틴라이스·귀리쌀·천지향5세는 품종 자체가 없어 마스터 등록이 먼저 |

🔴 **핵심 발견 두 가지**

1. 실패의 절반은 이름이 아니라 **SKU 카탈로그 빈칸**이다. 매처는 find-or-create를 안 한다(카탈로그에 없는 SKU는 재고도 0 — `purchase-order-matcher.ts` 머리 주석). 그래서 수동지정 팝오버는 **기존 SKU 중에서 고르는 것**이고, 없으면 등록 화면으로 보내는 게 맞다.
2. 업로드 시점 매칭이 그대로 굳어 있다 — 찰보리·가바발아현미는 지금 돌리면 붙는데 화면엔 여전히 실패. **재매칭이 수동지정만큼 중요**하다.

기타 실측
- `Variety.aliases` 현재 5건(가바→서농22호 · 가바흑미→흑미 · 가바발아현미→발아현미 · 천지향→천지향1세 · 찹쌀→백옥찰). 품종 41 · 활성 SKU 75
- 기존 액션 `setOrderItemProductType`(라인 1개+별칭 학습) · `autoMatchOrderItem`(라인 1개) — **호출 화면이 없다**. 둘 다 `revalidatePath('/sales')`를 부른다(결정 C 위반 — 매트릭스에서 부르면 페이지 통째 재렌더 1초+)
- `app/actions/purchase-order-matrix.ts` **697줄** → 액션 2개를 더 얹으면 800줄 초과. **새 파일**로 간다
- `cell-allocation-popover.tsx` 424줄 → 수동지정 본문은 **별도 컴포넌트 파일**
- 매칭실패 열 키는 `raw:품목명|규격|포장지(|자루중량)` — 같은 열의 라인은 원본 조합이 완전히 같다

---

## 3. 설계 결정

### 결정 N — 지정 단위는 「열」(같은 원본 조합, 이 묶음 안 전부)

셀 하나를 눌렀어도 **그 열의 모든 라인**(같은 품목명·규격·포장지)에 같은 SKU를 넣는다. 원본이 같은데 수령인마다 다른 SKU일 이유가 없고, 유기농 차조 1kg 같은 건 한 묶음에 여러 수령인이 있다.
팝오버 머리에 「이 품목 열 **N수령인 · M라인** 전부 지정」을 적어 범위를 보인다. 선택지(이 셀만/열 전부)는 두지 않는다.

### 결정 O — 후보는 **기존 활성 SKU만**, 없으면 등록 화면으로

find-or-create 안 함(매처와 같은 원칙). 고른 품종에 SKU가 없으면 「이 품종의 제품유형이 없어요 → `/admin/product-types`에서 등록한 뒤 **재매칭**」 안내 + 링크(새 탭).
**같은 규격**의 SKU를 위에 강조해 먼저 보이고, 다른 규격도 아래에 둔다(800g 주문을 1kg SKU로 억지로 붙이는 건 사람 판단).

### 결정 P — 팝오버는 2단: 품종 → SKU 라디오

시안의 「품종 → 규격 → 포장지」 3단 셀렉트는 각 단에서 막다른 골목이 생긴다(규격 골랐더니 포장지 없음). SKU가 75개뿐이라 **품종 하나 고르면 그 품종 SKU를 전부 라디오로** 펼치는 게 빠르고 안 틀린다.

- 왕복 **1회** `getUnmatchedCellOptions(itemIds)` → `loadMatcherMasters()`(품종 41 + 활성 SKU 75 = 이미 있는 헬퍼) + 매처 부분해석(`reason`·`varietyToken`·`varietyId`·`millingType`) + 열 범위(수령인 수·라인 수)
- 품종 select 기본값 = 매처가 부분해석한 품종(있으면). 라디오 = 그 품종 활성 SKU, `도정 · 규격 · 포장지` 한 줄(찰벼 표시는 `getDisplayMillingType`), 같은 규격 먼저
- **별칭 학습 체크박스**는 `reason === 'variety_unresolved'`일 때만 보이고 기본 켬. 라벨 `「혼합곡 (친환경)」을 {품종}의 별칭으로 학습`. 품종이 이미 풀린 경우엔 학습할 게 없어 숨긴다
- 저장 → `assignUnmatchedColumn(itemIds, productTypeId, { learnAlias })`

### 결정 Q — 갱신은 결정 C 그대로: 액션이 「바뀐 것」만 돌려주고 클라이언트가 `buildMatrix` 재실행

새 패치 타입 `MatchPatch = { itemIds, productTypeId, sku: MatrixSkuInput, availability, availabilityKg }`.
클라이언트는 `items[].productTypeId` 갈아끼우고 `skus`에 SKU를 붙이고(중복 방지) 가용 두 맵을 채운다 → 열이 `raw:`에서 `pt:`로 옮겨가며, 이미 있는 SKU 열이면 **자연히 합쳐진다**(`columnKeyOf`가 productTypeId를 본다). 이 적용은 순수 함수 `applyMatchPatch(input, patch)`로 `lib/purchase-order-matrix.ts`에 두고 테스트한다.
🔴 `revalidatePath` 부르지 않는다(C3 교훈). `/sales` 묶음목록의 매칭실패 수는 뒤로 갈 때 서버가 다시 조회한다.

### 결정 R — 재매칭은 **묶음 단위** 버튼 하나

헤더의 수치 옆에 매칭실패가 있을 때만 「매칭실패 N · **재매칭**」. `rematchUpload(uploadId)` → 그 묶음의 `productTypeId=null` 라인 전부에 매처를 다시 돌려 붙는 것만 UPDATE(라인 루프 안 쿼리 금지 — `updateMany`를 SKU별로 묶어 왕복 ≤ SKU 종수) → `MatchPatch[]` 반환. 0건이면 「여전히 N라인 실패」 토스트.
팝오버 단위 재매칭은 두지 않는다(묶음 단위가 그 경우를 포함).

### 결정 S — 별칭 학습 헬퍼를 공용으로 빼고, 죽은 액션 2개는 지운다

`learnVarietyAlias(tx, varietyId, rawItemName)`를 `lib/purchase-order-masters.ts`(서버 헬퍼 파일)에 둔다. 기존 `setOrderItemProductType` 안의 로직 승계 + **보강 2개**:

1. 학습 토큰이 **다른 품종의 이름·별칭과 같으면 학습 안 하고 경고**(매처가 첫 매치를 집어 엉뚱한 품종에 붙는 사고 방지)
2. 🔴 **도정 단어가 섞인 토큰은 학습 거부** — 아래 결정 T

호출자 없는 `setOrderItemProductType`·`autoMatchOrderItem`(`purchase-order.ts`)은 새 액션이 대체하므로 **삭제**한다(revalidate 함정을 남기지 않는다). 사용자 승인됨.

### 결정 T — 도정 단어가 섞인 이름은 **별칭으로 학습하지 않는다** (사용자 결정 2026-09-15)

도정유형이 이름 **앞**에 오는 표기(`유기농 백미 천지향5세`)를 별칭으로 학습하면 조용한 오매칭이 난다.

- 매처의 접미 분리는 끝만 본다 → `백미 천지향5세`는 도정이 분리되지 않고 통째로 품종토큰이 된다
- 이걸 천지향5세 별칭으로 학습하면 도정은 품종 category 기본값(RICE→백미)으로 잡힌다. **우연히 맞는다**
- 나중에 `유기농 현미 천지향5세`가 오면 또 실패하고, 거기서 또 학습하면 도정은 **여전히 백미** → 현미 주문이 백미 SKU로 붙는다. 아무도 모른다

따라서 `learnVarietyAlias`는 토큰에 `백미·현미·오분도미·칠분도미`가 들어 있으면 **학습을 건너뛰고 사유를 돌려준다**(`skipped: 'milling_token'`).
**지정 자체는 정상으로 처리**된다 — 막는 건 별칭뿐. 팝오버는 체크박스를 숨기고 「도정유형이 섞인 이름이라 별칭으로 학습하지 않아요」 한 줄을 띄운다.

이 표기를 근본으로 풀려면 매처에 **도정 접두 분리**를 넣어야 한다. 그건 파서 정규화를 건드리는 별건이고, 실측 대상(`백미 천지향5세` 1종)은 **품종 자체가 마스터에 없어** 지금은 수동지정도 불가능하다 —
즉 이 결정이 D2e 구현을 막지 않는다. 🔴 **천지향5세 품종을 등록하는 시점에 다시 꺼낸다.**

### 범위 밖 (백로그)

- 잘못 매칭된(초록/회색) 셀의 **재지정** — D2e는 매칭실패 셀만. 차감이 없는 라인만 허용해야 해서 별도 규칙이 필요
- 매처 정규화 확장(`(친환경)` 꼬리, `백미 천지향5세`처럼 도정이 **앞**에 오는 표기) — **결정 T로 보류**. `(친환경)` 꼬리는 별칭이 정확 문자열(공백 무시)로 커버하고, 도정 접두는 학습 거부로 막아 둔다
- 품종·SKU 마스터 등록 자체(누룽지·프로틴 라이스·귀리쌀·천지향5세 품종, 수수·차조·보리 등 1kg SKU) — 사용자 작업. **확인 필요 ②**

---

## 4. 구현 단계

### E1. lib 순수 함수 + 테스트 ✅ **구현 완료** (테스트 7건, 299/299)
- `lib/purchase-order-matrix.ts`: `MatchPatch` 타입 · `applyMatchPatch(input, patch)` (items 갱신 · skus 중복 없이 추가 · 가용 두 맵)
- `lib/purchase-order-matcher.ts`: `MatcherVariety.type?: string | null` 추가(찰벼 표시용, 선택 필드라 기존 테스트 무영향) · `sortSkuCandidates(skus, packageType)` (같은 규격 먼저, 그다음 기본 SKU)
- 테스트: `applyMatchPatch` 3건(열 이동 · 기존 SKU 열과 합침 · skus 중복 없음) · `sortSkuCandidates` 2건

### E2. 서버 헬퍼 + 액션 (새 파일 `app/actions/purchase-order-assign.ts`) ✅ **구현 완료**
- `lib/purchase-order-masters.ts`: `loadMatcherMasters`에 `variety.type` 포함 · `learnVarietyAlias(tx, …)` 신설(결정 S)
- `getUnmatchedCellOptions(itemIds)` — 라인 읽기(전부 `productTypeId=null`·한 열인지 검증) + 마스터 + 부분해석 + 열 범위 수치
- `assignUnmatchedColumn(itemIds, productTypeId, opts)` — 트랜잭션 하나: 재검증(여전히 null인지 — 다른 세션이 먼저 지정했으면 거부) → `updateMany` → 별칭 학습 → `loadAvailability`·`loadSkuMeta`로 `MatchPatch` (두 헬퍼는 `purchase-order-matrix.ts` 액션 파일 안 private → `lib/purchase-order-db.ts`로 옮겨 공유. C1과 같은 이동)
- `rematchUpload(uploadId)` — 결정 R
- `purchase-order.ts`: 죽은 액션 2개 삭제(승인됨)
- 권한 전부 `OPERATION_MANAGE`

### E3. 팝오버 UI (새 파일 `unmatched-popover.tsx`) ✅ **구현 완료** — 🔴 브라우저 확인 대기
- `cell-allocation-popover.tsx` `Body`의 `blocked` 분기 → `<UnmatchedBody>` 로 교체. 로딩·오류·편집·저장중 4상태(D2c `Loaded`와 같은 골격)
- 머리: 「이 품목 열 N수령인 · M라인 전부 지정」 · 매처 실패 사유 한 줄(「품종을 해석하지 못했어요」/「이 규격의 제품유형이 없어요」/「포장지 PET 제품유형이 없어요」)
- 품종 select → SKU 라디오(같은 규격 강조) → 별칭 체크(조건부) → [지정 저장]. SKU 없음이면 안내 + `/admin/product-types` 링크
- `matrix-client.tsx`: `onMatch(patch)` → `applyMatchPatch` · 헤더 「매칭실패 N · 재매칭」 버튼(결정 R, `useTransition`)

### E4. 검증 (아래 §7) — tsc·lint·test 통과. **브라우저 확인은 사용자 몫**

---

## 5. 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/purchase-order-matrix.ts` | `MatchPatch` · `applyMatchPatch` |
| `lib/purchase-order-matrix.test.ts` | +3 |
| `lib/purchase-order-matcher.ts` | `type` 선택 필드 · `sortSkuCandidates` |
| `lib/purchase-order-matcher.test.ts` | +2 |
| `lib/purchase-order-masters.ts` | `type` 포함 · `learnVarietyAlias` |
| `lib/purchase-order-db.ts` | `loadAvailability`·`loadSkuMeta` 이동(내용 동일) |
| `app/actions/purchase-order-matrix.ts` | 위 두 헬퍼 import로 교체 (−60줄) |
| `app/actions/purchase-order-assign.ts` | **신규** 액션 3종 |
| `app/actions/purchase-order.ts` | 죽은 액션 2개 삭제 |
| `app/(dashboard)/sales/purchase/[uploadId]/unmatched-popover.tsx` | **신규** |
| `app/(dashboard)/sales/purchase/[uploadId]/cell-allocation-popover.tsx` | `blocked` 분기 교체 |
| `app/(dashboard)/sales/purchase/[uploadId]/matrix-client.tsx` | `onMatch` · 재매칭 버튼 |

3개 이상 → 이 계획서가 HARD-GATE.

---

## 6. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| 중 | 별칭이 엉뚱한 품종에 붙으면 이후 **모든 업로드**가 조용히 오매칭 | 체크박스 기본 켬이되 라벨에 토큰·품종을 그대로 적음. 다른 품종 이름·별칭과 충돌 시 학습 거부(결정 S). 별칭 삭제 UI는 없음 → 사고 시 `/admin` 품종 편집(백로그로 남김) |
| 중 | 열 단위 일괄 지정이 실수면 라인 여러 개가 한 번에 틀린 SKU | 차감 전엔 되돌릴 수 있어야 한다 → 잘못 지정한 열의 재지정은 범위 밖이라 **이번엔 D2c 취소처럼 「매칭 해제」는 없음**. 저장 전 확인 문구로 방어. 재지정은 백로그 1순위 |
| 낮 | 다른 세션이 먼저 지정한 열 | 트랜잭션 안에서 `productTypeId=null` 재검증, 아니면 거부 → `router.refresh()` |
| 낮 | 재매칭 `updateMany` 횟수 | SKU별 그룹으로 묶어 왕복 ≤ 붙은 SKU 종수(현재 데이터면 ≤ 2) |

---

## 7. 검증

1. `npx tsc --noEmit` · `npm run lint` · `npm test` (기존 + 신규 5건)
2. 브라우저(사용자) — 묶음 #18 서울급식:
   - 「혼합곡 (친환경) 1kg」 셀 → 품종 select에 후보 없음 확인(품종 미등록이면 안내) → 대신 **「율무 (친환경)」**이나 실제 등록된 품종으로 지정 + 별칭 학습 → 열이 초록/회색 열로 이동, 가용 표시, D2c 팝오버로 차감까지
   - 저장 뒤 F5 → 로컬 재계산 결과와 서버 결과 동일
3. 재매칭 — 묶음 #15 택배: 헤더 「매칭실패 N · 재매칭」 → 찰보리 1kg·가바 발아현미 800g 두 열이 붙고 N이 2 줄어듦
4. 별칭 영속 — 스크립트로 `Variety.aliases` 확인 · 같은 시트 재업로드(force) 시 자동 매칭
5. `/sales` 묶음목록으로 돌아가면 매칭실패 수 감소

---

## 8. 사용자 확정 (2026-09-15)

① **매처 정규화는 안 건드린다** → 대신 **결정 T**(도정 단어 섞인 토큰은 별칭 학습 거부 + 경고). 근본 해결(도정 접두 분리)은 천지향5세 품종을 등록하는 시점에 다시 판단.
② **마스터 등록은 사용자 몫**(승인) — 품종 없음 4종(누룽지·프로틴 라이스 IPS·귀리쌀·천지향5세) · SKU 없음 7종. D2e가 끝나도 이건 등록해야 실패가 0이 된다. 누룽지·프로틴라이스처럼 **도정 제품이 아닌 것**을 품종으로 넣을지는 별도 판단.
③ **죽은 액션 2개 삭제**(승인) — `setOrderItemProductType`·`autoMatchOrderItem`.

별건 미결(이 계획과 무관): `fitsUnit` 하한(999 불인정) · 81+369 테스트 자루 합치기.
