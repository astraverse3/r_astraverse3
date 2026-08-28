# 작업일지

## 2026-08-28

### 포장 내역 수정을 diff 방식으로 `fix`

계획서 [plan-포장수정-diff.md](docs/plan/plan-포장수정-diff.md) (결정 #62~#65) · 보고서 [report-포장수정diff-2026-08-28.md](docs/report/report-포장수정diff-2026-08-28.md).

`updatePackagingLogs`가 저장할 때마다 **배치의 포장 행을 전부 지우고 새로 만들던 것**을 id 기반 diff로 바꿨다. 포장 내역을 「배치에 딸린 단순 값」으로 본 초기 설계였는데, 그 뒤 `PackageMovement`(판매·재포장 차감)·`productTypeId`(SKU)·`Repack`이 이 행을 **참조**하면서 전제가 깨졌다 — 참조당하는 행은 FK(Restrict)에 걸려 저장이 통째로 실패했고(실측 **16/181 배치**), 성공해도 행 id와 `createdAt`이 매번 새로 잡혔다.

**#62 id로 매칭** — **UI는 바꿀 게 없었다.** `restoreOutputs`가 `{ ...o }`로 서버 행 전체를 복사해 `id`가 이미 서버까지 흘러가고 있었다. **타입(`MillingOutputInput`)에만 없어서 서버가 안 쓰던 것**이다. 자연키 매칭은 쓰지 않는다 — id가 없으면 무조건 create(엉뚱한 줄을 고치는 것보다 낫다).

**#63 차감된 포장은 지우지도, 차감량 밑으로 줄이지도 못한다** — FK 에러(원인 불명)를 도메인 규칙으로 바꿨다. 「이미 판매·재포장된 포장은 지울 수 없어요 · 잔량 × 1 (1개 중 1개 차감됨) · 판매를 취소하거나 재포장을 정리해 주세요」처럼 **어느 줄이 · 몇 개가 · 어떻게 풀지**를 함께 낸다. 차단은 장애가 아니므로 throw 없이 `{ success: false, error }`로 돌려보낸다(아직 아무것도 안 쓴 시점).

**#64 순수 함수 분리** — [lib/packaging-diff.ts](lib/packaging-diff.ts) 신규(DB 접근 없음) + 단위테스트 31개. 액션은 트랜잭션 실행만.

**#65 파생 필드 조건부 재계산** — `lotNo`·`productCode`는 `stockId`가, `productTypeId`는 `packageType`·`packagingId`가 바뀔 때만. **안 바뀐 줄은 UPDATE 자체를 안 보낸다** — 실DB 181개 배치 전수 시뮬레이션에서 **쓰기 0건**(id·`createdAt` 보존 확인).

**🔴 계획에 없던 발견 — 유효성 검사가 기존 데이터를 인질로 잡았다.** `repack.ts` 패턴대로 줄 유효성을 **모든 입력 줄**에 걸었더니 실DB 검증에서 **배치 #73이 통째로 잠겼다** — 과거 오입력된 「잔량 0kg × 5」(#269) 한 건 때문에 **그 줄을 건드리지도 않는 저장까지** 막혔다. 없던 제약을 만든 회귀다. → **유효성은 「실제로 쓰는 줄」에만** 건다. 안 건드리면 통과, 고치려 할 때 비로소 막고, **삭제는 막지 않는다**(정리 경로 확보). 차감 규칙을 유효성보다 먼저 봐 「0개로 줄일 수 없어요」가 「개수는 1개 이상」보다 먼저 나오게 했다.

**왕복** — 삭제 `deleteMany` 1회 · 추가 `createMany` 1회 · 수정은 바뀐 줄만 · SKU는 조합별 1회 캐시(배송·상차 D1b 교훈).

- `lib/packaging-diff.ts`, `lib/packaging-diff.test.ts` — 신규
- `scripts/check-packaging-diff.ts` — 신규, 실DB 판정 검증(읽기 전용)
- `app/actions/milling.ts` — `MillingOutputInput.id?` 추가, `updatePackagingLogs` 재작성
- `app/(dashboard)/milling/add-packaging-dialog.tsx` — 차단 사유 줄바꿈 표시(`toastBlocked`), id 흐름 주석

검증: 단위테스트 31 / 전체 115 통과 · `tsc` 통과 · eslint 신규 3파일 0건(기존 부채는 오히려 감소) · `next build` 미실행.

**브라우저 실동작 확인 완료(배치 #13)** — 차감 없는 `4kg × 169 → 170` 저장 성공, 차감된 `잔량` 삭제 시도는 이유가 적힌 메시지로 차단. 저장 직후 실DB가 증거를 다 남겼다: 행 id 68·69·70 **그대로**, `createdAt` 셋 다 2026-02-23 **원본 유지**, **안 고친 두 줄은 `updatedAt`조차 안 움직였고**(UPDATE 미발송 = #65 작동), `#69`의 REPACK movement도 살아있다. 🔴 **예전 코드였다면 이 저장 자체가 FK로 실패했다** — 4kg를 고치는 것조차 안 됐다. (4kg는 검증 흔적으로 170에 남아 있다.)

**이 작업이 D2 매트릭스의 마지막 선행 블로커였다.** 지금 SALE 차감이 0건인 건 발주서 판매처리가 아직 안 돌아서고, D2가 가동되면 판매된 포장이 있는 배치가 전부 걸렸을 것이다.

---

## 2026-08-27

### 재포장 R3 — 정합성 수정 (되돌리기 기각) `fix`

계획서 [plan-재고재포장-R3.md](docs/plan/plan-재고재포장-R3.md) (결정 #57~#61) · 보고서 [report-재포장정합성-2026-08-27.md](docs/report/report-재포장정합성-2026-08-27.md).

**원안(배지 + 되돌리기)을 통째로 기각하고 정합성 수정으로 바꿨다.** 계획서를 다 쓴 뒤 사용자가 「되돌리기가 꼭 필요한 기능인가」를 물었고, 따져보니 아니었다. 그 과정에서 **이미 숫자를 틀리게 하고 있던 버그**가 드러나 작업 내용이 통째로 바뀌었다.

**#57 되돌리기·배지 기각** — 역방향 재포장(결과를 다시 소스로 골라 합치기)이 정식 우회로다. `getRepackSources`가 `repackId`를 안 봐서 재포장 결과도 그냥 소스가 된다. 게다가 **재포장의 재포장은 정상 동선**(톤백→20kg→5kg, 실물 작업과 일치)이라 두 번째 재포장 순간 첫 재포장은 되돌릴 수 없게 된다 — `cancelRepack`이 유효한 창 자체가 짧다. 빈도도 낮다(실수·착오뿐). 처음엔 역방향 경로를 「행이 늘어 지저분」하다고 봤는데 **그 근거가 틀렸다** — 소진된 행은 목록에서 아예 빠진다([packages.ts:204](app/actions/packages.ts#L204)). `cancelRepack`은 지우지 않고 **의도적 미연결**로 주석을 달아 남겼다.

**🔴 #58 생산 통계 이중 계상 — 이미 발생 중이었다**

재포장 결과 행은 원본의 `batchId`를 승계하는데([repack.ts:394](app/actions/repack.ts#L394), 로트·농가·품종을 이어받으려면 필요하다) **생산 집계가 `repackId`를 안 봤다.** 톤백 1,004kg을 1,000+4로 재포장하면 생산 2,008kg으로 잡힌다. 실측 **85kg**(Repack 2건 / 결과 6행).

**🔴 #61 그리고 더 큰 게 나왔다 — `batch.outputs` 전수 정리**

#58을 고친 뒤 **사용자가 eslint 결과를 그냥 넘기지 않아** 드러났다. 첫 조사는 `millingOutputPackage`를 **직접** 조회하는 곳만 훑었는데, `millingBatch`를 조회하며 **`outputs` 관계로 접근**하는 경로가 따로 있었다. 그쪽이 더 많고 더 위험했다.

- **수율 분자를 잘못 짚었다** — 1차 수정 때 `dashboard.ts` 3번에 「이 값이 수율 분자」라고 주석을 달았는데 틀렸다. 그건 카드의 총 생산량 전용이고 **수율은 9번 쿼리가 따로 계산한다.** 실측: 배치 #145 수율 **63.50% → 62.67%**, #56 66.17% → 65.66%
- **도정관리 포장 내역에 재포장 결과가 도정 포장인 척 복원**되고 있었다([milling.ts](app/actions/milling.ts) `getMillingLogs`)
- 통계 요약·버킷별 집계·엑셀 수율 필터도 전부 오염

**공용 상수로 묶었다**(사용자 확정) — 지점마다 손으로 붙이면 또 누락된다(실제로 두 번 놓쳤다). [lib/batch-outputs.ts](lib/batch-outputs.ts) 신규: `MILLED_OUTPUT_ONLY` / `MILLED_OUTPUTS`. `statistics.ts`×3 · `dashboard.ts`×3 · `output-statistics.ts` · `milling-excel.ts` · `milling.ts`×2 적용.

**일부러 안 고친 두 곳** — 필터를 붙이면 오히려 위험해서 주석만 남겼다. 배치삭제 `_count`(재포장 결과를 빼면 그것만 남은 배치가 삭제를 통과해 함께 지워진다) · `deleteMillingBatch`의 deleteMany(배치를 통째로 없애는 자리라 재포장 결과만 남기면 고아가 된다. FK가 막는 게 옳다).

**#59 재포장 결과 행 일반 삭제 차단** — `deleteMiscPackage`/`deleteMiscPurchase`가 결과만 지우고 원본의 REPACK movement를 남겨 **재고를 증발시킬 수 있었다.** 실질 위험은 낮으나(잡곡 재고 1행 100kg, 벼는 삭제 기능 없음) 조건 한 줄이라 막았다. 차단 메시지가 역방향 재포장을 안내한다.

**검증** — `npm test` 84/84 · `tsc` 0 · `eslint` 22 problems(**수정 전과 동일**, `git stash`로 같은 파일 목록 대조. 신규 0건). 실DB: 총생산 712,772 → 712,687kg(−85) · 평균수율 65.925% → 65.917%.

🔴 **못 고친 것 — 포장 수정이 막혀 있다(16/181 배치).** `updatePackagingLogs`에 `repackId: null`을 붙여도 안 풀린다. 막는 건 재포장 *결과*가 아니라 *소스(원본)* 행이고, 원본은 `repackId`가 null이라 필터를 통과한다. 진짜 원인은 **저장 전략** — 「전부 지우고 다시 만들기」가 참조당하는 행과 양립할 수 없다. 지금 SALE이 0건인 건 발주서 판매처리가 안 돌아서일 뿐, **D2가 가동되면 판매된 포장이 있는 배치가 전부 걸린다.** → [plan-포장수정-diff.md](docs/plan/plan-포장수정-diff.md) (결정 #62~#65), **D2 전에 처리**.

---

### 재포장 R2-후속 UI 개선 `fix`

계획서 [plan-재고재포장-R2후속UI.md](docs/plan/plan-재고재포장-R2후속UI.md) (결정 #44~#52) · 보고서 [report-재포장UI개선-2026-08-27.md](docs/report/report-재포장UI개선-2026-08-27.md).

실사용 지적 6건에서 출발했는데, 파보니 **재고를 조용히 망가뜨리는 버그 2건**이 함께 나왔다.

**「폭 줄이기」는 다이얼로그가 아니었다** — 상위 계획서 R2-후속의 그 항목은 **목록 하단 선택 바**를 가리킨 것이었다(#49, 전폭 → 내용 폭 + 우측 정렬). 다이얼로그 폭 940→720px은 2열→1열 개편의 **결과**이지 목표가 아니었다.

**화면 구조 — 2열에서 1열로**
- **#44** 좌측 340px 「쓸 재고」 패널 → 상단 접이식 요약 한 줄. 개수를 줄이는 건 예외 동선(기본이 전량 소진)이라 접어둔다
- **#45** **규격 버튼이 곧 「줄 추가」**([add-packaging-dialog.tsx](<app/(dashboard)/milling/add-packaging-dialog.tsx>) `addToGroup` 패턴). 버튼 9개가 줄마다 반복 렌더되던 걸 상단 한 벌로. 「줄 추가」 버튼 폐기
- **#46** 결과 줄 = 1행 압축 그리드(약 120px → 44px). 개수 `⊖ n ⊕` stepper · 자루당 kg 62px · 줄 번호 제거
- **#51** 남는 폭은 포장지가 아니라 **로트**가 가져간다 — 포장지 최장 이름은 8자(`땅끝에서보냅니다`)지만 로트는 `251119-11-15100914-391` 꼴이라 폭이 곧 판독성이다

**🔴 #50 — 「같은 규격 다른 로트」를 만들 수 없었다 (1차 구현의 결함)**

병합 판정을 (규격 + 로트)로 잡고 새 줄이 직전 로트를 상속하게 했더니(#47), 20kg 버튼을 다시 눌러도 로트가 같아 기존 줄에 합쳐졌다. **「로트 B짜리 20kg 줄」을 만들 진입점이 아예 없었다.** 사용자가 실사용 전에 발견했고, 1차 검증 시나리오 4번도 성립하지 않는 시나리오였다.
→ 로트 **1종이면 개수 +1**, **2종 이상이면 항상 새 줄**. 같은 로트로 여러 개는 stepper로 올리므로 손이 늘지 않는다.

**🔴 #52 — 못 파는 재고를 만들 수 있었다**

포장지 미지정으로도 **저장이 정상적으로 됐다.** 에러 없고 재고 행도 생기고 kg도 맞고 목록에도 보인다. 그런데 `productTypeId`(SKU)가 안 붙고([repack.ts:336](app/actions/repack.ts#L336)), 발주서 판매처리는 SKU로만 재고를 찾는다([purchase-order.ts:53](app/actions/purchase-order.ts#L53) `where: { productTypeId }`).
→ **실물은 창고에 있는데 발주가 들어오면 「재고 부족」으로 뜬다.** 잔량은 자체 판매를 안 해 SKU 없는 게 정상이고 톤백은 서버가 `'톤백'`을 강제하므로, **일반 규격만** 새는 구멍이었다. 저장 차단으로 막았다.
⚠️ **재포장만의 구멍이 아니다** — 도정 포장 등록도 같다([milling.ts:482](app/actions/milling.ts#L482)). 이번엔 재포장만 막았고 등록 3경로 공통 처리는 **백로그**.

**🔴 손실 경고가 꺼지지 않았다 (R2부터 있던 버그)**

`lossPrompt`는 서버가 `needsLossConfirm`을 돌려줄 때 켜지는데 **끄는 곳이 없었다.** 딱 맞게 고쳐도(`0kg`) 경고가 남는 게 사용자가 마주친 증상이고, 더 위험한 쪽은 **「손실 인정」을 누른 뒤 양을 바꿔도 인정이 유지되는 것** — 바뀐 수치에 확인을 받은 적이 없는데 손실이 그대로 기록될 수 있었다. `results`·`takeCounts`가 바뀌면 둘 다 비운다.

**한 원칙을 세 번 적용했다 — 아직 아무것도 안 한 상태를 실수처럼 꾸짖지 않는다**
1. 결과 줄이 0개로 시작하니 **열자마자** 푸터에 붉은 경고가 떴다 → `quiet` 플래그(저장은 막되 붉게 알리지 않음)
2. 손실 경고 리셋(위)
3. 포장지 추천이 낙관적이라 줄이 생긴 직후는 **언제나** 미지정이다. 그대로 판정하니 경고가 **번쩍였다 사라졌다** → 추천 대기 중인 줄은 `pkgPending`에 담아 조용히 막고, 응답이 오면(성공·실패 무관) 정상 판정

**#48 포장지 기본값 자동 채움** — [suggestProductType](app/actions/product-type.ts#L269) 재사용. 줄을 먼저 그리고 응답이 오면 **아직 비어 있는 줄만** 채운다(사람이 먼저 고르면 그 선택이 이긴다). 서버 왕복이 줄 추가를 막지 않는다.

**검증** — `npm test` **84/84**(서버 로직 무변경이라 숫자가 그대로여야 정상) · `tsc --noEmit` 0 · `eslint` 0. [repack.ts](app/actions/repack.ts) · [lib/repack.ts](lib/repack.ts) · 테스트는 한 글자도 안 건드렸다 — `createRepack` 입력 형태가 그대로라 서버는 이 개편을 모른다. 다음 = **R3**(재포장 이력 + 되돌리기 진입점).

---

## 2026-08-26

### 재고 재포장 R2 — 제품재고 선택 + 재포장 다이얼로그 `feat`

계획서 [plan-재고재포장.md](docs/plan/plan-재고재포장.md) §4-R2. 시안 `재포장-UI점검-시안.html`(A안).

**화면 3층 구조** — 선택 상태는 [package-list-client.tsx](<app/(dashboard)/packages/package-list-client.tsx>) 한 곳에만 두고 행·카드는 prop만 받는다.
1. **목록 체크박스** — 먼저 고른 행이 기준(anchor)이 되어 품종·도정유형·출처가 다른 행은 자동 비활성 + 툴팁. 그룹 헤더는 품종 묶음이라 체크 대상이 아니다
2. **선택 바** — 데스크탑은 목록 아래 `sticky`, 모바일은 하단 탭바 위 floating pill
3. **[repack-dialog.tsx](<app/(dashboard)/packages/repack-dialog.tsx>)** — 좌(쓸 재고·개수) / 우(만들 규격 줄) 2열 + 푸터 계기판

**🔴 실데이터가 뒤집은 전제 — 같은 로트번호에 품종이 섞여 있다**

검증 시나리오로 잡았던 로트 `251119-11-15100914-391` 잔량 10행(84kg)을 돌려보니 `MIXED_VARIETY`로 차단됐다. 그 10행이 **하이아미 8행 + 서농22호 2행**이었다. 로트번호는 `입고일-제품코드-인증번호-농가그룹+농가번호`라 **품종이 코드에 들어가지 않는다**(일반 우루치는 전부 `11`). 같은 농가가 같은 날 들여온 다른 품종은 로트번호가 같아진다.
→ **동질성을 품종 기준으로 판정한 §3.2가 옳았다.** 로트로 묶었다면 두 품종을 섞어 포장할 뻔했다. 계획서 §2.2.1·§7 검증 시나리오를 실측에 맞게 교체했다.

**도정구분 열 추가** — 재포장 동질성이 도정유형에 걸리는데 목록에 그 정보가 없었다. `PackageRow`에 판정용 `millingType`(저장값)과 표시용 `millingTypeLabel`을 **따로** 뒀다 — 찰벼는 [milling-type-display.ts](lib/milling-type-display.ts)로 찹쌀/찰현미로 바뀌므로, 표시값으로 판정하면 같은 백미가 품종에 따라 갈려 엉뚱하게 차단된다. 실데이터 확인: 백미 520 · 현미 37 · 찹쌀 35 · 오분도미 6 · 칠분도미 5 · 찰현미 2.

**UI 점검 A안 반영 4건** — 액션 라인 순서 교정(`[엑셀][검색] │ [재포장][+포장][+매입]`) + 모드 중 나머지 버튼 `disabled`(필터가 바뀌면 선택이 날아간다) · 행 높이 36→44px · 선택 바 `fixed` 중앙→`sticky`(fixed 중앙은 사이드바 256px 포함 윈도우 기준이라 콘텐츠 중앙과 128px 어긋나고 마지막 행을 덮었다) · 다이얼로그 2열 + 계기판 푸터 이동(규격을 넣는 내내 잔여 kg이 보여야 한다).

**잡은 버그 3건**
1. **effect 무한 루프** — 부모가 `selectedRows.map()`으로 매 렌더 새 배열을 넘겨 `useEffect([open, packageIds])`가 끝없이 돌 뻔했다. 내용 기반 키(`idsKey`)로 교체
2. **조용히 삼켜지던 에러** — `getRepackSources`는 권한 가드가 `try` 밖이라 실패 시 reject되는데 `.catch`가 없어 **로딩만 끝나고 빈 화면**이 남았다. 원인을 화면·콘솔 양쪽에 표시
3. **펼침 상태가 닫히던 것** — 모드 전환 초기화를 리마운트 `key`로 처리했더니 펼쳐둔 그룹까지 닫혔다. `useEffect`는 lint(`set-state-in-effect`)에 걸리고 `key`는 이 부작용이 있어, React 공식 「prop이 바뀔 때 state 조정」(렌더 중 `setState`)으로 바꿔 **선택만 비우고 펼침은 보존**

**검증** — `npm test` 84/84 · `tsc --noEmit` 0 · `eslint` 0(신규·수정 파일). 화면 확인은 사용자 진행 중. 다음 = 다이얼로그 폭 축소 + UI 개선(계획서 §4 R2-후속), 그 뒤 R3.

---

### 재고 재포장 R1 — 스키마 + 순수 검증 + 액션 `feat`

계획서 [plan-재고재포장.md](docs/plan/plan-재고재포장.md) §4-R1.

**왜 새 작업으로 갈라졌나** — D2 매트릭스 착수 전에 남아 있던 🔴 미결 「재고 분할 차감」(양식통일 계획서 §7)을 파다가, **분할과 병합이 같은 기능**임이 드러나 독립 작업으로 분리했다.

실측이 방향을 정했다.
- **분할이 필요한 건 톤백뿐** — 톤백 199행 중 자루중량 **124종**, 100kg 배수는 **29행**. 「1,000kg 주문에 1,004kg 자루」는 예외가 아니라 기본값이다. 반면 일반 규격(1·3·4·5·8·10·20kg)은 낱개라 `PackageMovement.count` 정수로 이미 전부 표현된다.
- **잔량이 7,006kg 쌓여 있다** — 96행 전부 가용(도입 이래 소진 0건). `milling.ts:15`가 잔량을 「재포장 소진」으로 정의해 놓고 **그 수단이 없었던** 것.
- **병합 대상이 널려 있다** — 같은 로트에 규격 2종 이상 공존이 **86/115 로트**. 로트 `251119-11-15100914-391`은 잔량만 10행 84kg.

**결정 #43 — 가용재고 공식을 건드리지 않는다**

`PackageMovement`에 중량(kg) 필드를 더하는 안을 버렸다. `available = count - SUM(movements.count)`가 [packages.ts:189](app/actions/packages.ts#L189)·[purchase-order.ts:66](app/actions/purchase-order.ts#L66)·[:140](app/actions/purchase-order.ts#L140)·[:331](app/actions/purchase-order.ts#L331) 네 곳에 박혀 있어, kg 차감을 얹으면 가용재고가 「개수」와 「kg」 두 갈래로 갈라지고 비판매 차감·통계까지 재작성해야 한다.

대신 **소스 소진을 movement로 표현**한다 — `MovementType.REPACK` 1개 추가로 그 네 곳이 자동으로 재포장을 반영한다.
```
소스 소진 = PackageMovement(type=REPACK)  →  결과 생성 = MillingOutputPackage(repackId)  →  Repack이 둘을 묶는다
```

**로트 제약은 실무를 따랐다** — 원칙은 동일 로트지만 도정 때 같은 품종이면 실제로 섞이고, 로트 다른 잔량을 합쳐 하나의 로트로 지정해 파는 일이 있다(사용자 확인). 그래서 **로트는 달라도 되고**, 결과 줄이 승계할 로트를 사람이 고른다. 품종·도정유형·출처(MILLED/PURCHASED)·분류(벼/잡곡)만 같아야 한다.
이건 새 개념이 아니다 — 도정 포장 입력 [add-packaging-dialog.tsx:62](<app/(dashboard)/milling/add-packaging-dialog.tsx#L62>) `computeLotGroups`가 이미 같은 결로 동작한다(비율 자동배분은 `9defc62`에서 제거됨).

**손실은 허용한다** — 실물이라 오차가 존재한다. 결과 합이 소스를 **초과하면 차단**, 부족분은 `Repack.lossKg`로 기록하고 1%를 넘을 때만 확인을 한 번 받는다.

**변경 파일**
- `prisma/schema.prisma` + 마이그레이션 `20260826000000_repack` — **Neon 실DB 적용 완료**. enum append + nullable 컬럼 + 신규 테이블이라 전부 비파괴
- [lib/repack.ts](lib/repack.ts) — `validateRepack`(동질성·가용·중량보존·손실) / `buildLotOptions`(같은 로트는 묶고, lotNo 없는 매입 잡곡은 행마다 별개) / 중량 합산. DB 접근 없음
- [lib/repack.test.ts](lib/repack.test.ts) — 22개. 세 행위(병합 84kg → 20kg×4+잔량4kg · 분할 1,004 → 1,000+4 · 규격변경 4kg → 1kg×4)를 그대로 케이스로
- [app/actions/repack.ts](app/actions/repack.ts) — `getRepackSources`(동질성을 **서버가** 판정) / `createRepack` / `cancelRepack`(결과에 차감 없을 때만). 전부 `OPERATION_MANAGE` + 감사로그

⚠️ **트랜잭션 왕복 4회 고정 + `timeout: 30초`** — 같은 날 배송·상차에서 겪은 적재 타임아웃(Neon 왕복 250~300ms × N > 기본 5초)의 교훈을 처음부터 적용했다. 결과 줄의 SKU는 **고유 (규격+포장지) 조합 수**만큼만 `findOrCreateProductType`을 호출한다.

**검증** — `npm test` **84/84**(기존 62 + 신규 22) · `tsc --noEmit` 0 · `eslint` 0 · 실DB에서 `MovementType`에 REPACK 존재·`repackId` 컬럼 2곳·`Repack` 조회 확인.

---

### 배송·상차 S3·S4 — 등록 모달 배송 블록 + 목록 상차 열 `feat` `fix`

계획서 [plan-배송상차정보.md](docs/plan/plan-배송상차정보.md) §4-S3·S4. 보고서 [report-배송상차-S3S4-2026-08-26.md](docs/report/report-배송상차-S3S4-2026-08-26.md).

**S3 — 등록 모달**
1. **추천 배송업체** [shipping-recommend.ts](lib/shipping-recommend.ts) — 채널별 최근 3건 **최빈값이 유일할 때만** 추천(결정 #38). 계획서 §6은 「파일에 등장하는 채널만」이었으나 **5채널 전부** 조회로 바꿨다 — 사용자가 화면에서 채널을 바꿀 수 있어(#31) 등장 채널만 조회하면 바꾼 채널의 추천이 비고, 채널당 `take: 3`이라 전부 조회해도 최대 15행으로 비용이 같다. 비활성 업체가 추천되면 걸러낸다.
2. **배송 블록** — 시트를 체크하면 배송업체·상차일·시각 토글(「시간 미정」 기본)이 펼쳐진다. 추천으로 채워진 값은 **파란 테두리**(시안 `.sel.auto`). 채널을 바꾸면 배송업체가 따라오되 **`vendorTouched`면 놔둔다** — 고쳐놓은 값이 채널 변경으로 되돌아가면 안 된다.
3. **「직접 입력」인데 시각이 비면 등록 버튼 차단** — 제출 직전에 조용히 null로 되돌리려다 말았다. 그러면 slot은 EXACT인 채 시각만 사라져 서버 refine에 그대로 걸린다. 채널 미선택과 같은 결로 막는 게 맞다.
4. **`SheetRow` 분리** [sheet-row.tsx](<app/(dashboard)/sales/sheet-row.tsx>) — 계획서 §5 리스크 대응. `upload-dialog.tsx` 508 → **400줄**.

**S4 — 묶음 목록**
5. **상차 열 + 임박순 정렬** [loading-schedule.ts](lib/loading-schedule.ts) — 시안이 요구하는 순서가 **오늘 이후(임박순) → 배차 미정 → 지난 상차(최근부터)** 3그룹이라 `ORDER BY loadingDate ASC NULLS LAST` 한 줄로 안 된다(지난 상차가 맨 위로 온다). 정렬키 `[그룹, 일수, 시각]`을 만들어 조회 후 JS 정렬. `findMany`는 `createdAt desc`로 두고 **`Array.sort`가 안정 정렬**인 점을 이용해 동순위를 업로드 최신순으로 잇는다 → **상차 정보가 빈 기존 묶음은 지금과 같은 순서**로 보인다.
6. **상차 완료는 플래그 없이 `loadingDate < 오늘(KST)`로만** 판정. 오늘 판정이 KST라 라벨은 서버에서 만들어 내려보낸다(`createdAt`과 같은 이유 — hydration 불일치 회피). 완료된 줄엔 업체명을 붙이지 않는다.
7. **그 자리에서 채우기** [loading-cell.tsx](<app/(dashboard)/sales/loading-cell.tsx>) — 시안은 「배차 미정」만 버튼이지만 배차는 자주 바뀌어 **채워진 셀도** 같은 Popover로 연다. 배송업체 목록은 `product-sales-section`에서 병렬 조회해 미리 내려보낸다(셀 열 때마다 왕복 없음).

**🔴 실왕복에서 드러난 기존 버그 — 적재 트랜잭션 타임아웃**

브라우저에서 처음 올려보자 「N건 등록」에서 실패. 파싱·조회는 멀쩡했고 **적재 트랜잭션**이 원인이었다.
적재가 건·라인마다 INSERT를 하나씩 순차로 도는데, **Neon 클라우드라 왕복 1회가 250~300ms**이고 Prisma 인터랙티브 트랜잭션 기본 타임아웃은 **5초**다.
실제 적재 경로를 트랜잭션 안에서 돌리고 **강제 롤백**하는 스크립트로 실측: 택배 67건 시트가 INSERT 22회 **5,033ms**에서, 서울급식이 20회 **5,112ms**에서 죽었다. 통과한 이마트도 3,917ms로 사실상 운.

**S3·S4가 만든 버그가 아니다** — D1b 적재 로직 그대로고, 「실왕복 검증」이 D1b → D1c로 계속 이월되다 이번에 처음 돌아본 것.

수정은 **왕복 수 축소가 근본**: `createManyAndReturn` + `createMany`로 **묶음 1 + 건 전체 1 + 라인 전체 1 = 왕복 3회**. 타임아웃만 늘리는 건 대증요법(67건이면 20초, 더 큰 파일이면 또 터진다).
**타임아웃도 5초 → 30초**로 함께 올렸다 — 시트를 여러 장 고르면 왕복이 시트 수만큼 늘어 5시트가 6초라 근본 수정만으로는 여전히 빠듯했다.
⚠️ **순서 전제**: 건과 라인을 잇는 근거가 `createManyAndReturn`의 **반환 순서 = 입력 순서**(PostgreSQL `INSERT ... RETURNING`). 깨지면 라인이 엉뚱한 건에 붙으므로 개수 검증 후 어긋나면 트랜잭션을 되돌린다.

**검증**: `tsc`·`eslint` 통과, `npm test` **64 pass**(기존 40 + 추천 8 + 상차 16).
**실업로드 확인 완료** — 택배 67건 + 해남급식 2건 적재, 배송업체·상차일·시각 저장, 라인 89건(매칭 73/실패 16), **라인 없는 발주 건 0건**으로 순서 전제 실증. 상차 셀 팝오버·오늘 강조·배차 미정 전환까지 브라우저 확인.
**다음**: 🔴 재고 분할 차감 결정 → D2 매트릭스.

---

### 배송·상차 S2 — 배송업체 관리화면 + 설정 2단 레이아웃 `feat`

[plan-배송상차정보.md](docs/plan/plan-배송상차정보.md) §4-S2. 보고서 [report-배송상차-S2관리화면-2026-08-26.md](docs/report/report-배송상차-S2관리화면-2026-08-26.md).

1. **서버 액션** [shipping-vendor.ts](app/actions/shipping-vendor.ts) — `list`(requireSession) / `create`·`rename`·`move`·`toggleActive`(requireAdmin) 5종.
   감사로그는 create·rename·toggle 3종에만(`move`는 표시 순서일 뿐). **삭제 없음**(결정 #39 — 과거 묶음이 참조).
   권한을 `OPERATION_MANAGE`가 아니라 `requireAdmin`으로 둔 건 [middleware.ts:14](middleware.ts#L14)에서 `/admin/settings`가 이미 ADMIN 전용이기 때문.
2. **관리화면** [shipping-vendor-section.tsx](<app/(dashboard)/admin/settings/shipping-vendor-section.tsx>) — 인라인 이름수정(Enter 저장/Esc 취소) · ↑↓ 순서 · 사용 토글 · 추가 폼.
   미사용 업체는 관리화면에서 **숨기지 않고** 구분선 아래로 — 결정 #39의 "목록에서 숨긴다"는 등록 화면 드롭다운 이야기라, 관리화면에서까지 사라지면 되돌릴 방법이 없다.
   순서 조정은 사용중 목록에서만(미사용은 드롭다운에 안 뜨니 순서가 의미 없다).
3. **순서 swap 로직을 구현 중 한 번 고쳤다** — 처음엔 `findFirst` + `sortOrder: { lte/gte }`로 이웃을 찾았는데,
   그 쿼리의 동순위 tie-break(`id`)가 목록 정렬의 tie-break(`name`)와 달라 **화면에 보이는 이웃과 실제 맞바꾸는 대상이 어긋날 수** 있었다.
   → 목록과 같은 정렬로 형제 전체를 뽑아 `findIndex`로 인접 항목을 고른다.
4. **설정 화면 A안(2단 컬럼)** — Claude Design 핸드오프 가이드 수령 후 적용.
   컨테이너 `space-y-4` → `columns-1 xl:columns-2 gap-4`(긴 카드인 배송업체를 앞에), `SettingSection`을 [setting-section.tsx](<app/(dashboard)/admin/settings/setting-section.tsx>)로 분리하며 헤더 우측 `action` 슬롯 추가,
   수율 저장 버튼을 카드 하단 → 헤더로, 행 높이 축소(`py-2` → `h-[30px]`/`h-8`).
   ⚠️ `columns-*`와 `space-y-*`는 같이 못 쓴다(컬럼 경계에서 마진이 어긋남) → 세로 간격은 카드의 `mb-4`가 담당.
5. **순서 이동을 낙관적 처리로** — 사용자가 「↑↓ 누를 때마다 쿼리하는 것 같다」고 지적. 맞았다.
   `sortOrder`를 즉시 확정하고 `router.refresh()`로 페이지를 다시 읽어 **클릭당 쿼리 6번**이 돌았다.
   → 목록을 로컬 상태로 들고 배열에서 맞바꿔 즉시 반영, 저장은 뒤에서. **6 → 3**으로.
   연타는 `saveQueue` ref 프로미스 체인으로 **직렬화**(병렬로 나가면 sortOrder 맞바꾸기가 서로를 덮는다),
   실패 시 부분 롤백 대신 `router.refresh()`로 서버 상태를 다시 읽는다.
   props 재동기화는 `useEffect` 대신 **렌더 중 동기화**(옛 목록이 한 프레임 비치지 않게).

**검증**: `tsc`·`eslint` 통과, `npm test` 40 pass. 브라우저에서 순서 이동·업체 추가 2건 확인 완료.
**다음**: S3 등록 모달 배송 블록(`upload-dialog.tsx` 441줄 → `SheetRow` 분리 동반) → S4 목록 상차 열.

---

## 2026-08-21

### 발주서 등록 모달 UX 수정 5건 + 문구 정리 `fix`

D1c 화면을 브라우저에서 처음 돌려보며 나온 문제들.

1. **시트 목록이 잘리는데 스크롤이 안 생기던 버그** — [upload-dialog.tsx](<app/(dashboard)/sales/upload-dialog.tsx>). 진단이 두 번 빗나갔다: 처음엔 모달에 높이 제한이 없어서라고 봤고(`max-h` 추가), 다음엔 `height:auto + max-height` 조합 탓이라고 봤다(확정 높이). 둘 다 증상이 그대로였다. **실제 원인은 스크롤 컨테이너 자신이 `flex flex-col`이었던 것** — 자식인 시트 목록 박스에 `flex-shrink:1`이 걸려 박스가 눌리고, 박스의 `overflow-hidden`(라운드용)이 행을 잘라냈다. 컨테이너는 넘치지 않으니 스크롤바가 생길 이유가 없었다. 결정적 단서는 **맨 아래 안내문이 항상 보였다**는 점 — 잘렸다면 안 보여야 한다. → 블록 레이아웃(`space-y-4`)으로 교체.
2. **목록만 스크롤** — 파일카드·안내문을 스크롤 영역 밖으로 빼 모달 직속 자식으로 올리고, 스크롤은 목록 박스가 담당(`flex-1 min-h-0 overflow-y-auto`). 열 헤더는 `sticky top-0`.
3. **드래그앤드롭이 파일 다운로드로 새던 문제** — DropZone에 드롭 핸들러가 아예 없어 브라우저 기본 동작이 그대로 나갔다. `onDragOver`/`onDrop` 등을 붙여 파일 선택과 **같은 경로**(`runPreview`)를 타게 하고, 드래그 중 테두리 강조 + 파싱 중엔 드롭 무시.
4. **바깥 클릭으로 닫히던 문제** — 시트 선택 단계에서만 `onInteractOutside`를 막았다. 채널·발주일·비고를 다 입력하고 실수로 날리는 걸 방지. 1단계(파일 선택)는 잃을 게 없어 그대로 닫힌다.
5. **기본 체크를 최신 시트 하나만으로** — 대부분 한 번에 한 장만 올린다. 엑셀엔 시트 생성일이 없어 **시트명에서 뽑은 발주일**(`suggestedOrderDate`)로 판정. 판정에 다른 시트가 필요해져 `initialDraft`(시트 1개 기준) → `buildDrafts`(목록 전체 기준)로 교체.
6. **문구 정리** — 서브타이틀 「발주서 판매처리」 제거(헤더·탭과 층이 겹침), 버튼·모달 제목·빈 상태를 「엑셀 업로드」 → **「발주서 등록」**으로. 수단이 아니라 행위를 가리키게.

**검증**: `tsc`·`eslint` 통과. 화면 동작은 사용자 브라우저에서 확인.

### 배송·상차 정보 계획서 `docs`

시안 `docs/handoff/발주서판매처리/배송상차정보-시안.html` 수령 → [plan-배송상차정보.md](docs/plan/plan-배송상차정보.md).
**결정 #36~#41 확정**: 배송방법은 enum이 아니라 **마스터 테이블 + 관리자 CRUD**(수출건은 그때그때 업체를 먼저 등록해 쓴다) · 상차 정보 전부 nullable · 채널 기본값은 `SystemConfig` key-value 재사용 · 삭제 대신 비활성 · 설정 화면은 `/admin/settings`에 섹션으로 쌓기 · 차량 톤수 미도입.
D2 매트릭스(🔴 재고 분할 차감 결정 대기)와는 독립이라 먼저 진행 가능.

협의 중 **결정 #38이 뒤집혔다**. 처음엔 채널별 기본 배송업체를 `SystemConfig`에 저장하고 관리화면에서 설정하는 안이었는데,
사용자가 "관리화면은 업체 목록만 관리하는 것 아니냐"고 짚었고 시안이 금지한 **이력 자동 추론** 쪽을 택했다.
시안의 경고는 **직전 1건을 그대로 쓰는 방식**을 겨눈 것이라(예외 한 번이 곧 기본값), **최근 3건 최빈값**이면 예외가 다수에 묻히고
업체를 실제로 바꾸면 두 건 만에 따라온다. 이 방식이면 저장할 곳도, 채널 설정 UI도, 초기 시드도 전부 사라진다.
용어도 배송방법 → **배송업체**로 통일(`ShippingVendor`).

### 배송·상차 S1 — 스키마 + Neon 마이그레이션 + 업체 7종 `feat`

1. **스키마** — `ShippingVendor`(name unique·sortOrder·active) + `LoadingTimeSlot` enum(UNKNOWN|AM|PM|EXACT) + `PurchaseOrderUpload`에 `shippingVendorId`·`loadingDate`·`loadingTimeSlot`·`loadingTime`. **전부 nullable 또는 DEFAULT라 기존 묶음 백필 불필요**(결정 #37).
2. **인덱스 2개** — `loadingDate`(묶음목록 상차 임박순), `channel+createdAt`(최근 3건 최빈값 추천 조회, 결정 #38).
3. **마이그레이션** `20260821000000_shipping_vendor_and_loading` — SQL은 손으로 쓰지 않고 `prisma migrate diff --from-schema-datasource`로 실 DB와 비교해 생성, 헤더 주석만 붙였다. `migrate deploy`로 **Neon 적용 완료**. FK는 `ON DELETE SET NULL`(결정 #39 — 업체는 삭제 대신 비활성이라 과거 묶음이 끊기면 안 된다).
4. **시드** [seed-shipping-vendors.ts](scripts/seed-shipping-vendors.ts) — 경동/대신/전국/해남원형화물·롯데택배·직접배송·방문수령 7건, sortOrder 10단위. 재실행 대비 `upsert`이되 **`update: {}`** — 관리화면에서 순서를 바꿔놨을 수 있어 덮지 않는다.

**검증**: `tsc`·`eslint` 통과, `npm test` 40 pass, 시드 실행 결과 7건 확인.
**다음**: S2 관리화면(`/admin/settings`에 배송업체 섹션) → S3 등록 모달 배송 블록 → S4 목록 상차 열.

---

## 2026-08-20

### 버그 수정 2건 — 판매관리 탭 미렌더 + dev 서비스워커 캐시 `af8e7c9` `3c5458a` `7f8d339` `fix` `chore`

**배경**: D1c 화면을 붙였는데 `/sales` 본문이 통째로 빈 화면. 추적 과정에서 **기존 버그 2개**가 드러났다(D1c와 무관, 단계5부터 잠재).

1. **판매관리 탭이 통째로 렌더 안 되던 버그** `af8e7c9` — `DEFAULT_SALES_TAB`·`SalesTabValue`가 `'use client'` 파일([sales-tabs.tsx](<app/(dashboard)/sales/sales-tabs.tsx>))에 있었고 서버 컴포넌트 `page.tsx`가 그걸 import. **Next.js는 클라이언트 모듈의 export를 서버에서 가져갈 때 실제 값이 아니라 클라이언트 참조(함수)로 바꾼다** → `tab`이 함수가 되어 `tab === 'product'`·`'release'` 비교가 **모두 false** → 두 탭 다 아무것도 안 그려졌다. 진단은 `page.tsx`에 임시 로그를 심어 `tab = [Function (anonymous)]` 확인(로그는 제거). **신규 [sales-tab-constants.ts](<app/(dashboard)/sales/sales-tab-constants.ts>)**(`'use client'` 아님)로 상수·`resolveSalesTab()` 분리, 아이콘 매핑만 클라이언트에 유지.
2. **dev에서 서비스워커가 캐시를 물고 있던 문제** `3c5458a` — `next.config`의 next-pwa는 `disable: NODE_ENV === 'development'`인데 [sw-register.tsx](<components/sw-register.tsx>)가 **환경 구분 없이 `/sw.js`를 등록**해 우회. `public/sw.js`가 저장소에 커밋돼 있어 dev 서버가 **6월 빌드본을 그대로 서빙**했고, 그 sw가 JS 청크를 StaleWhileRevalidate로, `/api/*`를 NetworkFirst로 캐싱했다. → 프로덕션에서만 등록 + dev에서는 기존 등록분 `unregister`.
3. **PWA 산출물 추적 해제** `7f8d339` — `public/sw.js`·`workbox-*.js`를 `.gitignore`로. 배포 시 `build`가 재생성하므로 서비스 영향 없음. 커밋본이 6월에 멈춰 있어(`/admin/product-types` 등 이후 화면이 precache 목록에 없었음) 로컬 빌드마다 무의미한 dirty만 생기고 있었다.

**교훈**: dev 서버가 떠 있는 동안 `next build`를 돌리면 같은 `.next`를 건드려 dev가 깨진다. 앞으로 검증은 tsc·eslint까지만, 빌드가 필요하면 dev를 멈추거나 별도 `distDir`로.

**검증**: `/sales` 제품판매 탭 정상 렌더 확인(헤더 · 엑셀 업로드 버튼 · 빈 상태), `tsc`·`eslint` 통과.

---

### 발주서 판매처리 D1c — 업로드 2단계 모달 + 묶음 목록 + 박스 입수 `2dc5177` `feat` `docs`

**배경**: 사용자가 결정 #30·#31에 맞춰 시안을 갱신(`docs/handoff/발주서판매처리/엑셀업로드-2단계-데스크탑.html`) — 구 시안의 「파싱 요약 1블록」이 **시트 표**로 바뀌었다.

1. **업로드 2단계 모달** — [upload-dialog.tsx](<app/(dashboard)/sales/upload-dialog.tsx>). ① 드롭존 → `previewPurchaseOrder` ② 시트 표(체크·채널 select·발주일·건/라인·확인 필요) + 체크한 시트 아래 인라인 비고(500자) → `uploadPurchaseOrder`. 상태 4종을 시안대로 구분: 정상 / 경고(등록 가능) / **채널 미확정**(체크 시 등록 버튼 비활성) / 체크 불가(미인식·이미 적재됨).
2. **묶음 목록** — [upload-table.tsx](<app/(dashboard)/sales/upload-table.tsx>)(채널 필터칩 + 테이블, 1열=시트명·파일명은 서브라벨) + [upload-row-menu.tsx](<app/(dashboard)/sales/upload-row-menu.tsx>)(⋮ = 엑셀 다운로드[D5 비활성] / 비고 수정 / 묶음 삭제). 채널 라벨·색은 [lib/purchase-channel.ts](<lib/purchase-channel.ts>) 공용 상수. **행 클릭은 D2까지 비활성**.
3. **액션 보강** — `listPurchaseUploads`에 **`deletable`**(묶음에 movement 0건일 때만 true, `_count` 집계라 추가 쿼리 없음) + `createdAt`을 표시용 `MM.DD HH:mm`(KST 고정, hydration 불일치 회피)로.
4. **박스 입수(#35)** — `upsertProductType`에 `unitsPerBox`(1 이상 정수 또는 null, 서버·클라 검증) + `/admin/product-types` 다이얼로그 입력칸 + 목록 규격 셀 옆 `16개/박스` 보조 표기(열 추가 없이).

**검증**: `npx tsc --noEmit` 통과, `npx eslint`(신규·수정 10파일) 경고 없음, **`npx next build --webpack` 빌드 성공**, `npm test` 40 pass.

**🔴 브라우저 확인 대기**: D1b에서 이월된 **「실파일 다채널 2시트 → 묶음 2건」 왕복**을 여기서 확인해야 한다. 중복 재업로드 「이미 적재됨」·비고 수정·묶음 삭제·박스 입수 저장까지 7가지 확인 항목은 보고서 §4 참고.

**미구현 1건**: 시안 1단계 푸터의 **「양식 내려받기」** — 링크 대상 파일이 없고 양식 배포 기능이 계획에 없어 뺐다(별도 결정 필요).

**다음**: D2 매트릭스 + 셀 FIFO 배분. **착수 전 🔴재고 분할 차감 결정 선행 필요.** 상세: [docs/report/report-발주서판매처리-D1c화면-2026-08-20.md](<docs/report/report-발주서판매처리-D1c화면-2026-08-20.md>)

---

### 발주서 판매처리 D1b — 업로드 액션 2단계 + 파일 분리 `ca9c4fd` `feat` `refactor` `docs`

**배경**: #31 「업로드 2단계 + 시트 선택 UI」의 서버 쪽. D1a까지는 파서 추측값을 그대로 쓰는 임시 경로(`TODO(D1b)`)였다.

1. **신규 [app/actions/purchase-order-upload.ts](<app/actions/purchase-order-upload.ts>)** — `previewPurchaseOrder`(파싱만, DB 무변경) / `uploadPurchaseOrder(formData, selections)`(선택 시트만 확정 채널·발주일로 적재) / `updateUploadNote`(묶음 비고).
   - **파싱 결과 클라이언트 왕복 없음**(#31 조작 방지) — 적재 때 파일을 다시 받아 **서버 재파싱**하고, 클라이언트가 보내는 건 「어떤 시트를 어떤 채널·발주일로」뿐.
   - `selections` zod 검증(채널 enum 5종·발주일 `yyyy-mm-dd`·비고 500자) + `validateSelections()`가 **같은 시트 2회 선택 / 파일에 없는 시트 / 발주 없는 시트**를 사용자 문구로 차단.
   - 미인식 시트도 미리보기에 `recognized:false`+`reason`으로 함께 반환(시트명 오타로 조용히 빠지는 것 방지).
   - 중복은 preview에서 `alreadyUploaded` 플래그로 예고, upload에서 실제 차단(강제진행 없음 — DB unique와 같은 키).
2. **파일 분리(800줄 상한)** — `app/actions/purchase-order.ts` 831 → **581줄**(조회·매칭·차감만), 신규 upload 액션 **365줄**, 공용 헬퍼 **[lib/purchase-order-masters.ts](<lib/purchase-order-masters.ts>)** 46줄(`loadMatcherMasters`·`toDateOrNull`). `'use server'` 파일은 async 함수만 export할 수 있어 헬퍼를 액션 파일에 둔 채로는 공유가 안 된다.
3. **계획서 표기 정정** — 반환 필드는 `uploads`가 아니라 `bundles`(D1a에서 이미 그렇게 만들었고 도메인 용어와 일치).

**검증**: `npx tsc --noEmit` 통과, `npm test` **40 pass / 0 fail**, `npx eslint`(3파일) 경고 없음.

**🔴 미검증**: 계획서의 D1b 기준인 **「실파일 다채널 2시트 선택 → 묶음 2건」 실왕복은 못 했다.** 이 액션을 부르는 화면이 아직 없고, 액션은 세션·권한을 요구해 스크립트로 대신 호출할 수 없다. **D1c 업로드 모달을 붙이는 즉시 검증한다.**

**다음**: D1c — 업로드 모달(드롭존 → 시트 표) + 묶음 목록 테이블 + `/admin/product-types` `unitsPerBox` 입력칸(#35). 상세: [docs/report/report-발주서판매처리-D1b액션-2026-08-20.md](<docs/report/report-발주서판매처리-D1b액션-2026-08-20.md>)

---

### 발주서 판매처리 D1a — 묶음=시트 스키마 + Neon 마이그레이션 `0ada585` `feat` `test` `docs`

**배경**: D0 파서가 「시트 1장 = 묶음 1개」(#30)로 재구성됐는데 스키마는 아직 「파일 1개 = 묶음 1개」라, 파서 결과를 저장할 자리가 없었다.

1. **스키마 4필드 + unique** — [prisma/schema.prisma](<prisma/schema.prisma>): `PurchaseOrderUpload.sheetName`·`.channel`(둘 다 NOT NULL)·`.note`, `PurchaseOrderItem.unitWeightKg`(#34 톤백), `ProductType.unitsPerBox`(#35 박스 입수). 중복 감지 키를 `@@index([fileName, orderDate])` → `@@unique([fileName, sheetName, orderDate])`로 교체(#16 개정).
2. **마이그레이션** `20260820000000_purchase_order_sheet_bundle` — `prisma migrate diff` 생성 SQL + 주석. **Neon 실DB 적용 완료**. 적재 전 3테이블 0건 재확인해 백필 없이 NOT NULL 추가.
3. **중복 감지 키 교체** — [lib/purchase-order-allocation.ts](<lib/purchase-order-allocation.ts>): `bundleDuplicateKey()` 신규. 구 `orderDuplicateKey`(발주처+수령인)는 **같은 파일 다른 시트에 같은 거래처가 정상적으로 겹쳐** 오탐이 나므로 묶음 판정에서 뺐다(함수·테스트는 유지).
4. **액션 시트 단위화** — [app/actions/purchase-order.ts](<app/actions/purchase-order.ts>): `insertSheetBundle()` 헬퍼 신규, 인식된 시트마다 묶음 1건 적재(단일 트랜잭션). `UploadResult`가 `uploadId` 단수 → `bundles[]`+합산 `summary`+파서 `warnings`로. 라인에 `unitWeightKg` 저장 연결(D0에서 파서가 넘기기만 하고 버리던 값). `listPurchaseUploads()`에 `sheetName`·`channel`·`note` 추가(G5 해소). 화면 호출부가 0건이라 깨진 곳 없음.
5. **묶음 중복 force 제거** — DB unique와 같은 키라 강제진행이 성립하지 않는다. 「기존 묶음 삭제 후 재업로드」 안내로 변경, `opts.force` 파라미터 삭제. 모달에서 삭제를 대행할지는 D1c에서 결정.

**검증**: `npm test` **40 pass / 0 fail**(`bundleDuplicateKey` 케이스 추가), `npx tsc --noEmit` 통과, `npx eslint`(변경 3파일) 경고 없음.
- 실DB에서 컬럼 5개·UNIQUE 인덱스 존재 확인, 구 인덱스 제거 확인.
- unique 실동작 확인 — 같은 (파일명, 시트명, 발주일) 2건 insert 시 두 번째 차단. **일부러 롤백하는 트랜잭션**에서 돌려 실데이터 0건 유지.

**⚠️ 남는 구멍**: `orderDate`가 null인 시트는 PostgreSQL NULL 특성상 **DB unique가 안 잡는다**(앱의 `bundleDuplicateKey`가 방어 중). D1b에서 발주일을 사용자가 확정하게 하면 닫힌다.

**다음**: D1b — `previewPurchaseOrder` 신설 + `uploadPurchaseOrder`를 「선택 시트 + 확정 채널·발주일」 수신형으로 개정(#31). 🔴 **미결 = 재고 분할 차감**(D2 착수 전 결정). 상세: [docs/report/report-발주서판매처리-D1a스키마-2026-08-20.md](<docs/report/report-발주서판매처리-D1a스키마-2026-08-20.md>)

---

### 발주서 판매처리 D0 재구성 — 통일양식 #27~#34 파서 대응 `e397f48` `feat` `test` `docs`

**배경**: 8/19 양식 협의로 결정 #27~#34가 확정(계획서 [plan-발주서판매처리-양식통일.md](<docs/plan/plan-발주서판매처리-양식통일.md>))되면서, 8/18 D0에서 맞춘 파서를 재구성. 8/18 미결이던 「표준 양식 미확정」이 해소됐다.

1. **파서 재작성** — [lib/purchase-order-parser.ts](<lib/purchase-order-parser.ts>) 397→633줄.
   - **#30 묶음 단위 = 시트** — 파일 대표 채널(`channel`·`channels`·`orderDate`)과 채널 혼합 거부 삭제. `ParsedUpload = { fileName, sheets, skipped }`.
   - **#31 인식/추측 분리** — 시트 인식 판정은 헤더 구조(`포장지`·`중량`)로만. 시트명은 `suggestChannel()`·`suggestOrderDate()`로 추측만 하고 못 뽑으면 null. 시트명·제목 날짜 불일치 경고.
   - **#27** `normalizeLabel()`로 괄호·공백 무관 라벨 인식(`(발주처)`=`발주처`), 소계는 포함 매칭, 품목명 빈 괄호 제거(`stripEmptyParens()`).
   - **#28** 음수 수량은 라인 제외 + 경고(구 파서는 `qty>0` 필터로 조용히 버려 **50개 과차감**이 나던 자리).
   - **#29** `verifySubtotals()` 순수함수 — 소계 셀 vs 데이터 합계 대조, 불일치는 경고(차단 아님).
   - **#32 시아스형** — `FIRST_SPEC_COL=2` 하드코딩 폐기, 규격 열 = **중량 행에 직접 값이 있는 열**. 라벨 행 없으면 데이터 = 소계+1, 수령인 = 발주처.
   - **#33** 중량 셀은 `cell.w` 우선 → 서식(`0\ "kg"`)에 든 단위 확보. `normalizeSpec()`이 공백·콤마 제거 + kg 환산, 단위 없으면 경고.
   - **#34 톤백** — 포장지가 `톤백`이면 규격을 `톤백`으로 치환하고 발주 중량은 `unitWeightKg`로 분리.
2. **계획서에 없던 규칙 2건**(실파일 대조에서 발견, 계획서 §3.2에 기재):
   - **하단 별도 표 종료** — 이마트 시트는 발주 아래 빈 행 2줄 뒤 **박스 환산표**가 있고 A열이 `이마트`로 차 있어 그대로 두면 **같은 수령처가 2배 적재**된다. 판정 = 「A·B 비었는데 규격 열에 텍스트」인 행부터 중단 + 경고. **빈 행은 종료 신호로 못 쓴다** — 택배 시트는 빈 행 2줄(72·73행) 뒤에 실제 발주(해남로컬푸드)가 이어진다.
   - **소계 합계는 열 단위** — 같은 품목명+규격이 여러 열에 나뉜 시트(택배 하이아미 5kg=I·K열, 시아스 톤백=B·C열) 때문에 품목 기준으로 세면 가짜 불일치 경고가 뜬다. `extractOrders()`가 `sumsByCol`을 함께 반환.
   - 포장지 줄바꿈(`자연⏎주의`→`자연 주의`)은 **매처가 이미 `stripSpaces` 비교**를 해 조치 불필요. 톤백 판정만 공백 제거 비교로 맞춤.
3. **테스트 재작성** — [lib/purchase-order-parser.test.ts](<lib/purchase-order-parser.test.ts>) 13→22개. 순수함수 단위 + 실파일 5시트 + 구 양식 실파일 + 합성(음수·빈 괄호·소계 없는 구 템플릿·단위 누락).
4. **액션 최소 대응** — [app/actions/purchase-order.ts](<app/actions/purchase-order.ts>): DTO 변경분만 반영해 컴파일 유지. 파서 추측값을 그대로 쓰는 **임시 경로**(`TODO(D1b)`)이고 채널 미판별 시트가 있으면 업로드 거부. 2단계 업로드 재설계는 D1b.
5. **결정 #35 추가** — 이마트 **박스 환산표를 시스템이 생성**하기로. 입수는 규격이 아니라 **SKU 속성**(실파일 역산: 가바백미 1kg 자연주의=16개/박스 vs 가바현미 1kg PET=10개/박스) → `ProductType.unitsPerBox Int?` 신설을 D1a 마이그레이션에 동반. 파렛은 기준이 불규칙해 자동화하지 않고 비고에 수기. 낱개는 없음(사용자 확인).

**검증**: `npm test` **39 pass / 0 fail**, `npx tsc --noEmit` 통과, `npx eslint`(변경 3파일) 경고 없음.
- 새 템플릿 5시트 전부 인식, **소계 전 시트 전 열 일치**. 시아스 톤백 `unitWeightKg` 1000/200 분리, 서울급식 서식 단위 `1kg`·`500g` 정규화, `서울급식_060818` 오타 경고 확인(→ 사용자가 `서울급식_260818`로 수정, 테스트도 갱신).
- 구 양식 실파일 `2026.08.xlsx` 20시트 **전부 미인식** → 「공장동만 올리기」가 별도 작업 없이 성립.

**다음**: D1a 스키마(`sheetName`·`channel`·`note`·`unitWeightKg`·`unitsPerBox`) + Neon 마이그레이션. 🔴 **미결 = 재고 분할 차감**(1,004kg 자루에서 1,000kg만 빼기, `PackageMovement.count`가 정수 개수만) — D2 착수 전 결정 필요. 상세: [docs/report/report-발주서판매처리-D0파서재구성-2026-08-20.md](<docs/report/report-발주서판매처리-D0파서재구성-2026-08-20.md>)

---

## 2026-08-18

### 발주서 판매처리 단계6 착수 — 계획 수립 + D0 파서 채널 5종 대응 `91d49fe` `docs` `feat`

**배경**: Claude Design 시안(`docs/handoff/발주서판매처리/`, 데스크탑 5 STEP + 모바일 6화면)이 나와 화면 구현 단계6 착수. 진행 순서는 **데스크탑 차감 흐름 먼저 → 모바일 → 엑셀 내보내기**(B안)로 합의 — 모바일 3모드 판정 경계값이 아직 잠정이라 데스크탑에서 실측한 뒤 확정하기 위함.

1. **계획서 작성** — [docs/plan/plan-발주서판매처리-단계6.md](<docs/plan/plan-발주서판매처리-단계6.md>). D0~D5·M1~M2 단계 분해 + 현행 코드 갭 12건(G1~G12) 정리. 주요 갭: 매트릭스용 조회 액션 부재·`getPurchaseOrderDetail`의 N+1(택배 1,700라인이면 수천 쿼리)·묶음 channel/note 필드 부재·dry-run 조회 부재.
2. **D0 파서 통일양식 대응** — [lib/purchase-order-parser.ts](<lib/purchase-order-parser.ts>): 시트명 `채널_YYMMDD` 해석(`parseSheetName` 신규, 고정 prefix 4종 + 그 외 기업별), 3줄 헤더 탐지, 수령인 빈칸→발주처 복사(#26), 발주일 추출, 미인식 시트 `skipped[]` 반환, 파일 대표 채널(혼합이면 null).
3. **액션 5채널화** — [app/actions/purchase-order.ts](<app/actions/purchase-order.ts>): `OrderRow`/`OrderDetail`의 channel이 `'DELIVERY'|'EMART'` 하드코딩이라 5종으로 확장. **채널 혼합 파일 업로드 거부**(파일 1개=채널 1개). `orderDate`를 upload·order에 저장 — 기존엔 항상 null이라 중복감지 키(`orderDuplicateKey`)가 날짜 없이 돌고 있었음.
4. **DB enum 5종 마이그레이션** `20260818000000_purchase_channel_5types` — 스키마 파일은 5종이었으나 실제 마이그레이션 SQL은 `ENUM ('DELIVERY','EMART')` 2종이라 Prisma Client도 2종으로 생성되고 있었음. 값 3종 append(비파괴). **Neon 실DB 적용 완료**, `pg_enum` 조회로 5종 확인.
5. **매처 테스트 파일 의존 제거** — [lib/purchase-order-matcher.test.ts](<lib/purchase-order-matcher.test.ts>): 구 양식 `발주서.xlsx`에서 품목명을 뽑아 18종 대조하던 구조라 파서 양식 변경에 깨짐. 기대표 키 순회로 변경(검증 내용 동일).

**검증**: `npm test` 31 pass / 0 fail, `npx tsc --noEmit` 통과, `npx eslint`(변경 4파일) 경고 없음, `prisma migrate deploy` 적용 확인.

**⚠️ 미결(다음 작업 전 확인)**: **표준 양식 미확정.** 사용자가 표준으로 지목한 `해남급식_20260619.xlsx`의 `공장동06.19` 시트는 D0에서 맞춘 통일양식 템플릿과 헤더 구조가 다름(농가명·소계·`(발주처)` 행 있음, 품목명에 농가명 괄호 포함). 현재 파서는 이 양식을 미인식으로 버림. **양식 재협의 후 `detectHeaderLayout`·파서 테스트만 재조정 예정** — D0의 나머지는 양식과 무관하게 유효. 음수 수량(보관요청 -50)은 일단 무시로 결정. 상세: [docs/report-발주서판매처리-D0파서통일양식-20260818.md](<docs/report-발주서판매처리-D0파서통일양식-20260818.md>)

---

### 도정관리 엑셀 다운로드 필터 버그 수정 + 수율 필터 구현 `fix` `refactor` `feat`

**배경**: 도정관리 목록에서 품종 5개를 골라 엑셀을 받으면 빈 파일이 나옴(전체 다운은 정상).

1. **멀티값 필터 버그** `501cd63` — [app/actions/milling-excel.ts](<app/actions/milling-excel.ts>): MultiSelect(품종·도정구분·생산자명)를 여러 개 고르면 URL에 콤마 조인 문자열로 들어오는데, 엑셀 export만 split 없이 통째로 `contains` 비교 → 0건 매칭 → 빈 파일. 목록 조회(`getMillingLogs`)와 동일하게 split 후 `{ in }`/OR 조건으로 처리. (전수조사 결과 재고·잡곡·제품·출고 등 다른 목록은 공유 헬퍼/재호출 구조라 동일 버그 없음)
2. **`daa`→`data` 오타 정리** `3536028` — export 액션 3곳(milling·release·farmers)의 반환 필드가 오타(daa), 수신 버튼 3곳도 같은 오타로 받아 동작은 했으나 혼란 유발. 반환·수신 6곳 모두 `data`로 통일.
3. **수율 필터 구현** `56a2dc5` — 수율 필터가 UI만 있고 로직이 통째로 미구현이라 화면 목록에서도 안 걸러졌고 엑셀에도 미반영. 수율은 outputs 합산 계산값이라 DB where로 못 걸러 post-query 필터로 구현. [lib/milling-yield.ts](<lib/milling-yield.ts>) 공유 헬퍼 `matchesYieldFilter` 신규(미마감 배치 제외, 경계 이하≤/이상≥) → `getMillingLogs`/`exportMillingLogs`가 동일 헬퍼 사용해 화면·엑셀 결과 통일. 부수 효과로 화면 목록 수율 필터도 처음으로 실제 동작.

**검증**: `npx tsc --noEmit` 통과. 수율 헬퍼 로직 9케이스(미마감 제외·경계 70% 양쪽 포함·각 구간) 직접 실행 확인.

**참고(범위 밖·미변경)**: 생산자 목록 export(`exportFarmers`)는 화면 필터를 무시하고 전체 출력 — 데이터가 적어 전체 백업 의도로 판단, 그대로 유지.

---

## 2026-07-22

### 포장 기록 관리 다이얼로그 — 입력 편의성 3종 개선 `feat`

**대상**: [app/(dashboard)/milling/add-packaging-dialog.tsx](<app/(dashboard)/milling/add-packaging-dialog.tsx>) 단일 파일.

1. **수량 입력칸 확장**: 모바일 그리드 수량 컬럼 64px→88px(포장지 1fr 자동 축소, PC 포장지 140→120px), 입력칸 `w-5`(20px)→`w-11`(44px). 3자리에서 잘리던 문제 해소.
2. **규격별 합계 밴드 신설**: 헤더 고정(스크롤 밖). 전체 생산자 합산 규격별 `수량·중량`을 개별 박스(테두리+shadow, 잔량=노랑)로 구분 표시. 노출 조건=다중 생산자 or 규격 2종↑. 여러 투입건 계산 편의.
3. **규격 버튼 클릭 시 포커스 이동**: `scrollToBottom()`(맨아래 튐) 제거 → `pendingFocus` ref + `outputs` useEffect로 방금 추가/증가한 행 입력칸에 자동 포커스+select+`scrollIntoView({block:'nearest'})`. 일반 규격=수량칸, 톤백·잔량=중량칸. `data-count-index`/`data-weight-index`로 대상 탐색.

**검증**: `npx tsc --noEmit` 통과.

---

## 2026-06-25

### 발주서 판매처리 — 단계6 화면 Claude Design 핸드오프 준비 `docs`

**배경**: 백엔드(단계1~5) 완료 후 화면(§8.4) 비주얼은 Claude Design 위임(계획서 결정 [!]). 핸드오프 번들 작성.

**산출**: [docs/handoff/발주서-판매처리/README.md](handoff/발주서-판매처리/README.md) — 화면 8개(묶음목록/건목록/**건상세★**/업로드모달/개별판매/비판매차감/제품재고행트리거/모바일) 각 데이터·상호작용 요구사항 + **연결할 서버 액션 시그니처**(단계3·4 실 타입: `DetailLine` FIFO `suggestion`/`shortage` 등 정확 명시) + 상태색 규칙(완료 emerald/부분 amber/대기 slate/실패 red) + 디자인토큰(Primary #2563eb·slate·shadcn) + 시안 우선순위(건상세 먼저).

**⚠️ 식별된 구멍(단계6 구현 시 보완)**: 매칭실패 라인 수동지정용 **활성 SKU 목록 조회 액션 부재** → `product-type.ts`에 추가 필요(품종→규격→포장지 후보). README에 명시. export(원본 양식 복원)도 미구현=별도.

**다음**: Claude Design 시안(HTML) 수령 → Next.js 구현(액션 연결) = 단계6 본작업.

---

### 발주서 판매처리 — 본구현 단계5: /sales 2탭 골격 + 권한 등록 `feat`

**배경**: 계획서 [plan-발주서판매처리.md](plan/plan-발주서판매처리.md) §8.5 단계5·결정 #13. 백엔드(단계1~4) 위에 화면 골격을 올려 진행을 가시화. 실제 업로드·매칭·차감 UI는 단계6(Claude Design).

**변경**:
- [sales-tabs.tsx](<../app/(dashboard)/sales/sales-tabs.tsx>) — 구 3탭(벼/잡곡 준비중 + 출고) → **제품판매(product)/원물출고(release) 2탭**. grid-cols-3→2, 아이콘 Package/Truck, '준비중' 배지 제거, 기본탭 `DEFAULT_SALES_TAB='product'`(export 상수).
- [page.tsx](<../app/(dashboard)/sales/page.tsx>) — VALID_TABS=['product','release'], 기본 product, 분기(product→ProductSalesSection / release→ReleaseSection 기존).
- [product-sales-section.tsx](<../app/(dashboard)/sales/product-sales-section.tsx>) 신규 — server component, 실 `listPurchaseUploads()` 연결 발주서 묶음 목록 골격(파일명·업로드일·건수·상태배지 완료/부분/대기·매칭실패수). 0건이면 빈상태 안내. **업로드 버튼은 시각만(cursor-not-allowed)** — 기능 연결은 단계6.
- [coming-soon-panel.tsx] **삭제**(rice/misc placeholder, 코드 참조 0=무손실).
- [permission-matrix.md](permission-matrix.md) — 발주서/차감 "(향후)" 제거→실 함수명. `purchase-order.ts` 8 write 함수 + `package-movement.ts` 3 함수 = `OPERATION_MANAGE`, 조회 공개, export=requireSession 예정. /sales 클라이언트 가드 표에 발주서·개별판매·비판매차감 행 추가.

**검증**: `tsc --noEmit` 0 · 신규/수정 화면 파일 eslint clean. ⚠️cutoff 제거(단계3)로 `/packages`에 과거 도정산 노출 중 + `/sales` 기본탭이 product로 바뀜 → **사용자 dev에서 화면 확인 권장**. **다음=단계6 화면**(발주서 업로드·건상세·차감·개별판매·비판매차감, Claude Design 핸드오프) + export 분리.

---

### 발주서 판매처리 — 본구현 단계4: 발주서 액션 (export 제외) `feat`

**배경**: 계획서 [plan-발주서판매처리.md](plan/plan-발주서판매처리.md) §8.3.1·§8.5 단계4. 적재→매칭→차감 전 흐름. export(원본 양식 복원)는 분량(현 747줄, 800 제한)·복잡도로 별도 파일 분리 예정.

**변경(신규 3)**:
- [lib/purchase-order-allocation.ts](<../lib/purchase-order-allocation.ts>) 순수 로직 — `suggestAllocation`(FIFO 그리디 배분+부족분#3·#4) · `computeLineStatus`/`computeOrderStatus`(라인 충족→건 status 파생#12) · `orderDuplicateKey`/`detectDuplicateOrders`(재업로드 중복감지#16). DB·매칭 안 함(액션이 조회결과 주입).
- [lib/purchase-order-allocation.test.ts](<../lib/purchase-order-allocation.test.ts>) node:test 8케이스(FIFO 순서·부족·tie-break·status 경계·중복키). **전체 21/21 통과**.
- [app/actions/purchase-order.ts](<../app/actions/purchase-order.ts>) (747줄) 액션 10개:
  - `uploadPurchaseOrder(formData, {force?})`: 파일검증→`parsePurchaseOrder`→**중복감지**(같은 파일명의 vendor+recipient 겹침→`{duplicate, conflicts}` 경고, force로 강제진행#16)→트랜잭션 적재(Upload+Order+Item, PENDING)→라인 **자동매칭**(`matchPurchaseOrderItem`, productTypeId)→요약(orderCount/itemCount/matched/failed).
  - 조회(공개): `listPurchaseUploads`(묶음+상태요약+매칭실패수)·`listPurchaseOrders(uploadId)`·`getPurchaseOrderDetail(orderId)`(라인별 매칭결과·차감현황·가용재고·**FIFO 추천배분**·부족분).
  - 매칭: `autoMatchOrderItem`(재매칭)·`setOrderItemProductType(itemId, productTypeId, {learnAlias})`(수동지정+**별칭 학습** push #22).
  - 차감: `confirmOrderItem(itemId, allocations)`·`confirmOrder(orderId)`(전 라인 FIFO 자동) — 트랜잭션 내 SKU 일치·가용 재검증→`PackageMovement`(SALE, orderItemId)→`recalcOrderStatus`. `cancelOrderItemMovements`(하드삭제+복원+감사#17).
  - 삭제: `deletePurchaseUpload`/`deletePurchaseOrder` — movement 달린 건 **차단**(선검사), upload는 order先삭제(item Cascade).
  - 내부 헬퍼: `loadMatcherMasters`·`loadAvailablePackages`(FIFO sortKey=MILLED createdAt/PURCHASED incomingDate)·`allocatedQtyOfItem`·`recalcOrderStatus`·`applyAllocations`(가용재검증+movement 생성 공용).
- 권한: write 전부 `OPERATION_MANAGE`, 조회 공개.

**검증**: `tsc --noEmit` 0 · 신규 3파일 eslint clean · `npm test` 21/21. 서버액션 실동작(세션)은 단계6 화면 왕복에서. **다음=`exportPurchaseOrders` 분리 구현 또는 단계5(권한 matrix 등록 + `/sales` 2탭 골격)**.

---

### 발주서 판매처리 — 본구현 단계3: 제품재고 차감 공용 액션 `feat`

**배경**: 계획서 [plan-발주서판매처리.md](plan/plan-발주서판매처리.md) §8.3.2·§8.5 단계3. 단계2(파서·매처)는 `dce1eeb`로 커밋. 발주서와 독립적으로 동작하는 개별판매·비판매차감 먼저 구현(발주서 일괄은 단계4 `purchase-order.ts`).

**변경(신규 1 + 수정 1)**:
- [app/actions/package-movement.ts](<../app/actions/package-movement.ts>) 신규 — PackageMovement 통합모델(결정#19) 공용 액션. `createSale`(type=SALE, 거래처) · `createNonSaleMovement`(GIFT/LOST/DAMAGED/OTHER, 사유메모) · `cancelMovement`(하드삭제+가용복원+감사, #17) · `listMovements`(판매·비판매 통합 이력, 공개). 권한=`OPERATION_MANAGE`(list 제외). 금액 미관리(#25).
  - **가용 재검증**: 트랜잭션 내 `count - SUM(movement.count)` 검증 후 생성. **동시성 보강**(Prisma FOR UPDATE 부재): 생성 후 총 차감이 보유 초과면 롤백(사후검증).
  - **cancelMovement 가드**: `orderItemId≠null`(발주서 라인 차감)은 차단 → 발주서 상세(`cancelOrderItemMovements`, 단계4)에서 취소. 혼선·이중경로 방지.
- [app/actions/packages.ts](<../app/actions/packages.ts>) `getPackages` 수정 — 1달 cutoff 임시블록 **제거**(#9·#19), `movements` include로 **`available=count-SUM(movement.count)` 동봉** + `PackageRow.available` 필드 추가 + **available≤0 행 제외**(flatMap). 백로그 §13 종료. ⚠️cutoff 제거로 차감 데이터 쌓이기 전엔 과거 도정산 재고가 노출됨(사용자 승인: "계획서대로 지금 제거"). `qty`(=count)는 유지, 화면의 가용 기준 전환은 단계6.

**검증**: `tsc --noEmit` exit 0 · 신규 `package-movement.ts` eslint clean · `getPackages` 수정분 clean(기존 `any` 4개는 pre-existing=HEAD에 이미 존재, 수술적 원칙으로 미수정). 서버액션 실동작 왕복(세션 필요)은 화면 단계6에서. **다음=단계4 발주서 액션**(`app/actions/purchase-order.ts` upload·list·detail·match·confirm·cancel·export + FIFO 헬퍼).

---

## 2026-06-23

### 발주서 판매처리 — 본구현 단계2: 파서·매처 순수함수 + 단위테스트 `feat`

**배경**: 계획서 [plan-발주서판매처리.md](plan/plan-발주서판매처리.md) §8.2(파싱·매칭)·§8.5 구현순서 단계2. 단계1(스키마) 후속.

**조사**: 실파일 `docs/resources/발주서.xlsx` raw 셀 덤프로 §2.1 실측 재확인(택배 A1:AJ30 규격 34열·이마트 A1:I8 규격 7열, 병합/4줄헤더 구조 일치, **단 주문 데이터 행은 빈 템플릿**). DB 마스터 조회로 품종 41·SKU 63·포장지 10 확인 → aliases 시드(서농22호=가바·천지향1세=천지향·백옥찰=찹쌀·흑미=가바흑미·발아현미=가바발아현미) 정상 반영 확인.

**변경(신규 4)**:
- [lib/purchase-order-parser.ts](../lib/purchase-order-parser.ts) — raw 셀 좌표 파서(순수). A열 라벨로 헤더 행 자동탐지, `!merges` 병합 펼치기(품목명·포장지), CRLF→공백 정규화, 시트명→channel. `parsePurchaseOrder`(주문 DTO) + `parseSpecCatalog`(헤더만으로 규격 종류 추출 — 빈 템플릿·업로드 미리보기용). Zod 출력검증.
- [lib/purchase-order-matcher.ts](../lib/purchase-order-matcher.ts) — 매칭 파이프라인(순수). ①접두제거(유기농/프로틴 라이스/자스민 라이스)+도정접미 분리(백미/현미/오분도미/칠분도미, **흑미·발아현미 제외 #1·#24**) ②품종 name→aliases(공백무시) ③도정 미분리 시 category 디폴트(RICE→백미/MISC→기타, '찹쌀'·'천지향' 등 자동커버) ④(품종+도정+규격+포장지) SKU 조회. 실패는 사유별(variety/packaging/sku_unresolved)+학습용 토큰 보존. find-or-create 안 함.
- [lib/purchase-order-parser.test.ts](../lib/purchase-order-parser.test.ts)·[lib/purchase-order-matcher.test.ts](../lib/purchase-order-matcher.test.ts) — node:test. 실파일 18종 품종 전수매칭(§6.1.1 기대표 대조)·SKU 케이스·정규화 단위·합성 워크북 병합/수량 파싱. **13/13 통과**.
- [package.json](../package.json) `test` 스크립트(`tsx --test`) + `tsx` devDependency 추가(seed도 사용).

**설계 보강(계획서 미명시 → 추가)**: ①포장지 매칭 공백 무시 비교(발주서 `자연\r\n주의`→`자연 주의` vs DB `자연주의`) ②품종토큰 공백 무시(`유기농\n가바\n발아현미`→`가바 발아현미` vs alias `가바발아현미`) ③도정 미분리 시 category 디폴트(찰벼 '찹쌀'=백미 등). 찰벼정리(millingType 백미/현미 통일)와 정합.

**검증**: `npm test` 13/13 · `tsc --noEmit` exit 0 · 신규 4파일 eslint clean. **다음=단계3 차감 공용 액션**(`app/actions/package-movement.ts`)+`getPackages` cutoff 제거.

---

## 2026-06-22

### 발주서 판매처리 — 본구현 단계1: 스키마 + 마이그레이션 `feat`

**배경**: 발주서 판매처리 설계(§8.2~8.5) 검토·승인 → 본구현 착수. 계획서 [plan-발주서판매처리.md](plan/plan-발주서판매처리.md) §8.5 구현순서 단계1. 결과보고서 [report-발주서판매처리-단계1-2026-06-22.md](report/report-발주서판매처리-단계1-2026-06-22.md).

**설계 재검토(착수 전)**: 설계 §8.2~8.5를 실 코드와 대조 → ①권한 표기가 옛 키(SALES/MILLING_MANAGE)로 남아있어 실제 `OPERATION_MANAGE` 단일로 치환(§8.3~8.5 표·결정#14 소멸 주석), export=`requireSession` 확정 ②스키마 선행분(`Variety.aliases`·`MillingOutputPackage.productTypeId`·`ProductType`)은 이미 반영 확인 ③`getPackages` cutoff·`/sales` 탭(rice/misc 제거)·감사로그 action 유니온은 후속 단계에서 반영 메모.

**변경**: [schema.prisma](../prisma/schema.prisma)
- 신규 모델 4개: `PurchaseOrderUpload`(업로드 묶음·중복감지#16) → `PurchaseOrder`(건=발주처+수령인) → `PurchaseOrderItem`(라인=셀, `productTypeId` 1:1 매칭) → `PackageMovement`(제품재고 차감 통합, 결정#19 세 경로 단일 테이블).
- enum 3개: `PurchaseChannel`(DELIVERY/EMART)·`OrderStatus`(PENDING/PARTIAL/COMPLETED)·`MovementType`(SALE/GIFT/LOST/DAMAGED/OTHER).
- 역참조 2개: `ProductType.orderItems`·`MillingOutputPackage.movements`. 금액 필드 없음(결정#25), 발주서경로만 `orderItemId`.
- 마이그레이션 [20260622000000_add_purchase_order_domain](../prisma/migrations/20260622000000_add_purchase_order_domain/migration.sql) — `migrate diff`(from-datasource)로 SQL 생성, 신규 테이블/타입/FK만(기존 데이터 무영향).

**검증**: `prisma format`+`validate` 통과 · `migrate deploy` 실 Neon DB 적용 성공 · `prisma generate` 완료. **다음=단계2 파서·매처 순수함수**(`lib/purchase-order-parser.ts`·`matcher.ts`)+실파일 단위테스트.

---

### 권한 단순화 — 비즈니스 5→2 + USER/SYSTEM ADMIN 흡수 `refactor`

**배경**: 발주서 판매처리 설계 중 권한 #14 검토에서 파생. 실 DB 사용자 11명 권한 조합 진단 → MILLING↔SALES 100% 동행, VARIETY↔FARMER 동행, STOCK↔가공판매 분리 확인 → 2분할 확정. 계획서 [plan-권한단순화.md](plan/plan-권한단순화.md), 보고서 [report-권한단순화-2026-06-22.md](report/report-권한단순화-2026-06-22.md).

**변경**:
- `SUPPLY_MANAGE`(STOCK+VARIETY+FARMER)·`OPERATION_MANAGE`(MILLING+SALES) 신설, 구 5키 폐기. `USER_MANAGE`·`SYSTEM_MANAGE`→ADMIN 흡수(개별 보유자 0). `NOTICE_MANAGE` 유지.
- [lib/permissions.ts](../lib/permissions.ts) 정의 교체 · [middleware.ts](../middleware.ts) 라우트 권한(users/logs/backup→null ADMIN 전용) · 서버 가드 ~45곳 + UI 가드 ~25곳 sed 일괄 치환 · [desktop-sidebar.tsx](../components/desktop-sidebar.tsx)·[mobile-header.tsx](../components/mobile-header.tsx) 관리자 메뉴 조건 재구성.
- [permission-matrix.md](permission-matrix.md) 전면 갱신 · 발주서 계획서 §8.3 권한 OPERATION_MANAGE 확정.
- **DB**: `scripts/migrate-permissions-2026-06-22.cjs` dry-run→apply, 7명 변환(합집합, 상실 0). 사용자 관리 화면은 동적 순회라 무수정.

**검증**: 폐기 7키 grep 0건(코드) · `tsc --noEmit` exit 0 · DB dry-run↔예측표 일치 · idempotent 재실행 변경 0. ⚠️기존 로그인자는 **재로그인** 시 새 권한 반영(JWT 캐싱).

---

### 도정 포장 다이얼로그 — 모바일 반응형 1행 + 흰 배경 `design`

**소스**: Claude Design 핸드오프 [docs/handoff/design_handoff_packaging_inline_row/](handoff/design_handoff_packaging_inline_row/) (모바일 시안 추가). 단계5(2/2) 1행 통합이 데스크탑 기준이라 모바일에서 깨지던 것 반응형 보강.

**변경**: [add-packaging-dialog.tsx](<../app/(dashboard)/milling/add-packaging-dialog.tsx>)
- 그룹 헤더 반응형: 모바일=생산자·품종(좌)/예상(우) + **로트번호 풀폭 둘째 줄**, 데스크탑=로트 인라인 + `투입→예상` 한 줄. 로트 폰트 11→11.5px.
- 규격 버튼: 모바일 **5열 2행**(`grid-cols-5`) / 데스크탑 10열 1행. 높이 h-8→h-7(밀도↑).
- 포장 라인 1행 반응형 그리드(`36/1fr/64/52/22` ↔ `40/140/1fr/58/24`), 잔량 노란 badge, 포장지 select 말줄임, 중량 단위 인라인. **수량 직접입력 동작 유지**(시안 readOnly는 동작 변경이라 미적용).
- 데스크탑 컬럼 헤더 힌트(규격·포장지·수량·중량) 추가.
- 다이얼로그 배경 `bg-white` 강제 — 테마 `--background:#f1f5f9`(slate-100 회색)라 시안 흰색과 달랐던 것 정정. 카드 좌우 여백 모바일 px-6→px-4.

**검증**: tsc 통과(exit 0). 동작·SKU 로직 불변(시각만).

---

## 2026-06-18

### 로트번호 — 발아현미 131 + 서농24호 흑미(BLACK) 정리 `feat`

**배경**: 발주서 판매처리 선행 데이터 정리(§6.1.1·§6.2) 연계. 색미류 로트코드 정합성.

**변경**:
- [lot-generation.ts](../lib/lot-generation.ts): `getProductCode`에 `'발아현미' → 131` 분기 추가(Special Rice 섹션 최상단). 흑미(15)/녹미(16)/홍미(17)/`BLACK→15`는 기존 유지.
- 데이터: 서농24호(id20) `Variety.type` URUCHI → **BLACK** 1건 수정. 이름에 '흑미'가 없어 로트코드가 백미(11)로 잘못 떨어지던 것을 `BLACK→15`로 정상화. category는 이미 RICE라 `deriveVarietyCategory('BLACK')=RICE`와 정합 → **부작용 0**(§6.2 해소: category 환원은 이미 돼 있었고 type만 정리).
- 관리화면 BLACK("흑미") 노출 3곳:
  - [variety-dialog.tsx](<../app/(dashboard)/admin/varieties/variety-dialog.tsx>): 곡종 구분 라디오에 "흑미"(인디카 다음) 추가.
  - [variety-list-client.tsx](<../app/(dashboard)/admin/varieties/variety-list-client.tsx>): 그룹 라벨·테이블 라벨 2곳에 `BLACK→'흑미'` 추가.
  - [variety-labels.ts](../lib/variety-labels.ts): `VARIETY_TYPE_LABELS`에 `BLACK: '흑미'` 추가.

**결정**: 흑미(id18)·녹미·홍미는 **미변경**. 흑미는 이름 매칭으로 이미 15가 나오고 잡곡(category=MISC_GRAIN) 유지가 §6.1.1 결정과 맞음. 녹미·홍미는 OTHER(기타)로 등록해도 이름으로 16/17 자동 산출. 즉 type 묶기·마이그레이션 불필요, 서농24호 1건만 정리.

**검증**: `tsc --noEmit` 통과(exit 0). 로트코드 실산출 확인 — 서농24호→15·흑미→15·발아현미→131·녹미→16·홍미→17·서농22호(가바)→11 전부 정상.

---

## 2026-06-17

### 도정 포장 다이얼로그 — 포장지 라인 1행 통합 `design`

**소스**: Claude Design 핸드오프 [docs/handoff/design_handoff_packaging_inline_row/](handoff/design_handoff_packaging_inline_row/).

**변경**: [add-packaging-dialog.tsx](<../app/(dashboard)/milling/add-packaging-dialog.tsx>) 포장 라인이 단계5(2/2) 1차 구현에서 **2행**(규격·수량·중량 / 포장지 별도 줄)이라 다이얼로그가 길어지던 것을 **1행 통합**. 그리드 `[52px_1fr_92px_28px]` → `[40px_140px_1fr_58px_24px]`, 포장지 select를 규격 옆 2번째 열(140px, custom 화살표 `appearance-none`)로 인라인. 잔량=`—`(stone-200), 톤백=`포장지: 톤백` 고정. py-1.5→py-[5px]. 동작 규칙·SKU 로직 불변(시각만).

**검증**: tsc 통과, 변경분 신규 lint 0(HEAD 대비 9=9).

---

### 제품유형 마스터 — 단계 5(2/2): 도정산(add-packaging) 라인별 포장지 SKU 연동 `feat`

**계획서** [plan-제품유형마스터.md](plan/plan-제품유형마스터.md) §단계5 — 난도 최상 도정산 경로. 이로써 **단계 5 전체 완료**.

**변경**:
- [milling.ts](../app/actions/milling.ts):
  - `MillingOutputInput`에 `packagingId?: number | null` 추가. sentinel 상수(`잔량`/`톤백`/`톤백` 포장지).
  - `updatePackagingLogs`(replace-all): 라인마다 SKU 결정 — **잔량=productTypeId null(SKU 미부여)**, **톤백=`톤백` Packaging 강제**(lazy 조회), 그 외=라인 `packagingId`로 `findOrCreateProductType(promoteDefaultIfNone)`. 포장지 미선택 일반 라인은 null 허용.
  - `getMillingLogs`: `outputs: true` → `outputs: { include: { productType: { select: { packagingId: true } } } }` — 다이얼로그 재진입 시 라인별 포장지 복원용.
  - `addPackagingLog`는 UI 미사용(데드코드)이라 이번 범위 제외.
- [add-packaging-dialog.tsx](<../app/(dashboard)/milling/add-packaging-dialog.tsx>):
  - `restoreOutputs`: `initialOutputs`의 `productType.packagingId`를 라인 `packagingId`로 평탄화 복원.
  - `LotGroup`에 `varietyId` 추가(suggestProductType 호출용). 활성 포장지 목록 lazy fetch.
  - `addToGroup`: 신규 규격 라인 추가 시 `suggestProductType`로 (품종+도정+규격) **기본 포장지 자동 부여**. 톤백/잔량은 포장지 입력 없음.
  - 라인 UI에 포장지 줄 추가 — 잔량=숨김, 톤백=`포장지: 톤백` 고정, 그 외 드롭다운(기본 자동선택+변경).

**검증**: `tsc` 통과. 변경분 신규 lint 0(stash 비교 16=16, 전부 기존 부채). **실 DB 동작 확인**(천지향1세 배치 재저장): 8kg/4kg/10kg/5kg 전부 `pt#…(기본)` 주입, 잔량 NULL 유지, 서농22호 4kg도 채워짐.

**UI 비주얼**: 동작 우선으로 "라인 아래 작은 드롭다운" 배치. 레이아웃 다듬기는 Claude Design 위임 여지.

---

### 제품유형 마스터 — 단계 5(1/2): 잡곡 매입·포장 등록 SKU 연동 `feat`

**계획서** [plan-제품유형마스터.md](plan/plan-제품유형마스터.md) §단계5 중 "쉬운 2곳"(매입·잡곡포장). 난도 최상인 도정산(add-packaging-dialog)은 별도.

**변경**:
- [packages.ts](../app/actions/packages.ts):
  - sentinel 상수 `MISC_MILLING_SENTINEL='기타'`·`MISC_PURCHASE_PACKAGING='매입포장'` + `findOrCreateProductType` import.
  - `createMiscPurchase`(매입): 단순 create → 트랜잭션으로 전환. `'매입포장'`(active=false) Packaging 조회 → `findOrCreateProductType(품종,'기타',규격,매입포장)` → `productTypeId` 주입. **UI 무변경**(포장지 자동).
  - `createMiscPackage`(잡곡포장): `CreateMiscPackageSchema`에 `packagingId` 추가. 트랜잭션 안에서 `findOrCreateProductType(stock.varietyId,'기타',규격,선택포장지)` → `productTypeId` 주입.
- [misc-package-dialog.tsx](<../app/(dashboard)/packages/misc-package-dialog.tsx>): 포장지 드롭다운 신설. `suggestProductType`로 (품종+'기타'+규격) 기본 포장지 자동선택 + 변경 가능. 규격 변경 시 재추천. `packagingId` 미선택이면 제출 차단.

**결정**: 잡곡 포장지는 "기본 자동선택 + 변경 가능 드롭다운"(사용자 확정). 잡곡 품종은 시드 ProductType 0건이라 첫 등록 시 기본 미지정 → **`findOrCreateProductType`에 `promoteDefaultIfNone` 옵션 추가**: 새 SKU 생성 시 그 (품종+도정+규격) 조합에 기존 기본이 없으면 첫 등록 포장지를 기본으로 자동 승격(admin 안 거쳐도 다음부터 자동선택). 기존 기본 있으면 미변경. 헬퍼도 upsert→find→(기본유무체크)→upsert로 재구성.

**검증**: `tsc --noEmit` 통과. 변경분 신규 lint 0(잔존 96/100줄 `setLoadingStocks` effect 부채는 변경 전부터 존재=stash 비교 확인, 미수정).

**남음**: 단계 5(2/2) add-packaging-dialog(도정산 라인별 포장지, 난도 최상, 라인별 UI=Claude Design 위임).

---

### 제품유형 관리 메뉴 위치 이동 — 관리자 메뉴 그룹 안으로 `feat`

**변경**: "제품유형 관리"를 Management 평면 목록에서 **접이식 "관리자 메뉴" 그룹 하위 항목**으로 이동.
- [desktop-sidebar.tsx](../components/desktop-sidebar.tsx): 그룹 펼침 영역 맨 위로. `adminActive`에 `/admin/product-types` 포함 → 제품유형 페이지 진입 시 그룹 자동 펼침(기존 useEffect). 미사용 `Package` import 정리.
- [mobile-header.tsx](../components/mobile-header.tsx): 드롭다운 구분선 아래 그룹 맨 위로.
- **권한**: 그룹 노출 조건에 `SALES_MANAGE` 추가(`hasAnyPermission([SALES_MANAGE, USER_MANAGE, NOTICE_MANAGE, SYSTEM_MANAGE])`), 항목은 `hasPermission(SALES_MANAGE)` 가드 → SALES_MANAGE만 가진 사용자도 정상 노출(middleware 가드와 일관). 기존 부채 2건(`@ts-ignore`·effect setState)은 미수정.

---

### admin 제품유형 카탈로그 — 벼/잡곡 탭 분리 + 등록 다이얼로그 레이아웃 `feat` `design`

**소스**: Claude Design 2차 핸드오프([docs/handoff/제품유형-핸드오프/](handoff/제품유형-핸드오프/)) — 탭-그룹화 작업지시. 직전 "전체 품종 단일 아코디언"을 탭 구조로 교체.

**변경**:
- **벼/잡곡 탭 분리**: [product-type-page-client.tsx](<../app/(dashboard)/admin/product-types/product-type-page-client.tsx>) 카탈로그를 `Wheat`(벼)/`Sprout`(잡곡) 탭으로 분리(raw-stocks 패턴, useState). **벼 탭**=품종 아코디언(도정 컬럼 O), **잡곡 탭**=평면 테이블(그룹화 X, 품종 컬럼 O, 도정 컬럼 X). `variety.category`로 분류(이미 `include: { variety: true }`로 내려옴). 상태토글·관리 버튼은 `statusButton`/`actionButtons` 헬퍼로 공통화.
  - ⚠️ 지시서와 다르게 **기본 접힘**(`?? false`)·**찰벼 도정 표시**(`getDisplayMillingType`) 유지 — 핸드오프 왕복에 미반영된 직전 사용자 지시 우선.
- **등록 다이얼로그 레이아웃**: [product-type-dialog.tsx](<../app/(dashboard)/admin/product-types/product-type-dialog.tsx>) 2행 그리드로 재배치(1행 품종|도정, 2행 규격|포장지). **잡곡 품종 선택 시 도정 구분 숨김** + `millingType='기타'` sentinel 자동 설정(벼 복귀 시 '백미' 복원). `VarietyOption`에 `category` 추가.
- 검증: tsc 통과, 변경분 eslint 클린.

---

### admin 제품유형 UI — 색상 시스템 정렬 + SKU 카탈로그 품종별 그룹화 `feat` `design`

**소스**: Claude Design 핸드오프([docs/handoff/](handoff/)) — 색상정렬·SKU그룹화 작업지시 2종.

**변경**:
- **색상 정렬**: admin 다이얼로그 3곳([product-type-dialog](<../app/(dashboard)/admin/product-types/product-type-dialog.tsx>)·[variety-dialog](<../app/(dashboard)/admin/varieties/variety-dialog.tsx>)·[add-farmer-dialog](<../app/(dashboard)/admin/farmers/add-farmer-dialog.tsx>))의 레거시 액션색(녹색 `#8dc540`/시안 `#00a2e8`) → 디자인 토큰 `primary`(`#2563eb`)로 통일. 녹색 버튼은 클래스 삭제로 Button 기본 variant 사용, 포커스링·체크박스·아이콘 hover 치환. 통계 의미색은 미변경.
- **SKU 카탈로그 그룹화**: [product-type-page-client.tsx](<../app/(dashboard)/admin/product-types/product-type-page-client.tsx>) 평면 테이블 → **품종별 아코디언**(A안). 품종 헤더(곡종 배지 + SKU 수·활성 수 집계, 클릭 접기/펼침, **기본 접힘**) + 하위 SKU 테이블(품종 컬럼 제거). 품종명 가나다순. 핸들러·다이얼로그는 그대로.
- **찰벼 도정 표시**: 도정 컬럼에 [getDisplayMillingType](../lib/milling-type-display.ts) 적용 — 찰벼(`GLUTINOUS`)는 저장값 백미/현미를 찹쌀/찰현미로 표시.
- 검증: tsc 통과, 변경분 eslint 클린.

---

## 2026-06-16

### 제품유형 마스터 — 단계 4: 시드 → 점검 → 백필 `feat`

**소스**: 사용자 제공 `docs/resources/규격별포장지종류.xlsx`(품종×도정×규격별 포장지 매핑).

**결정 반영**(계획서 [plan-제품유형마스터.md](plan/plan-제품유형마스터.md) §단계4):
- 포장지 보정: 삼광 20kg `20kg`→`PP마대`(오타), 서농22호 4kg `수출?`→`가바수출용`.
- 복수 포장지 조합 기본: 서농22호 백미4kg·1kg·현미1kg=자연주의, 하이아미 5kg=땅끝에서보냅니다, 4kg=자연주의.
- **톤백**=포장지 `톤백`으로 일반 SKU. **잔량**=백필 제외(productTypeId=null 유지). 발주처별 기본 포장지는 백로그.

**실행**:
- [seed-product-type.ts](../scripts/seed-product-type.ts): Packaging 9종(활성 8 + `매입포장` 비활성), ProductType 57개, `Variety.aliases` 5종(서농22호=가바 등) upsert(멱등).
- [check-product-type-backfill.ts](../scripts/check-product-type-backfill.ts): 백필 대상 44조합(잔량 제외) 기본 ProductType 누락 **0건** 확인.
- [backfill-product-type.ts](../scripts/backfill-product-type.ts): MillingOutputPackage **360건** productTypeId 주입(멱등), 잔량 72건 제외(null 유지). 잔존 null(잔량 제외) **0건**.

---

### 찰벼 도정유형 정리 — millingType 정규화(입력 백미/현미, 표시만 찹쌀/찰현미) `feat` `refactor`

**계기**: 제품유형 백필 점검 중 백옥찰(찰벼)이 `millingType`='백미'14·'찹쌀'12·'현미'2로 갈려 저장된 것 발견 → 같은 제품이 다른 SKU로 쪼개짐. 백필 선행 정리. 방향 A 확정(계획서 [plan-찰벼도정유형정리.md](plan/plan-찰벼도정유형정리.md)).

**변경**:
- **데이터 정규화**: [scripts/normalize-glutinous-milling-type.ts](../scripts/normalize-glutinous-milling-type.ts) 신규(멱등·dry-run·감사로그). `millingType='찹쌀'` batch 4건(전부 백옥찰) → '백미' 적용 완료, 잔존 0.
- **표시 헬퍼**: [lib/milling-type-display.ts](../lib/milling-type-display.ts) 신규 — `getDisplayMillingType(millingType, varietyType)`(찰벼+백미→찹쌀, +현미→찰현미). 기존 3중복 인라인(milling-table-row·mobile-milling-card·recent-logs-list)을 헬퍼로 통일.
- **입력 UI 3곳**(start-milling-dialog·stock-list-dialog·add-form): '찹쌀' 버튼 제거 + 찰벼 투입 시 백미/현미 버튼 라벨을 찹쌀/찰현미로 동적 표시(저장값은 백미/현미). 카트는 단일곡종 보장(milling-cart-context), selection 경로도 variety.type 보유 → 양 경로 작동.
- **필터/상수**: [milling-filters.tsx](<../app/(dashboard)/milling/milling-filters.tsx>) `MILLING_TYPE_OPTIONS`·[settings-constants.ts](../lib/settings-constants.ts) `MILLING_TYPES`에서 '찹쌀' 제거.
- 범위 제외: 통계 `MillingTable.tsx`(품종정보 부재, 저장값 표시 유지 — 별도 후속).
- 검증: tsc 통과, 변경분 eslint 클린(기존 any/effect 부채는 미수정).

---

### 제품유형 마스터 — 단계 3: 관리 메뉴 + 화면 `feat`

**변경**:
- [middleware.ts](../middleware.ts): `ADMIN_ROUTE_PERMISSIONS`에 `/admin/product-types`=`SALES_MANAGE` 한 줄 추가(기존 `/admin/*` 가드 재사용).
- [app/(dashboard)/admin/product-types/](<../app/(dashboard)/admin/product-types/>) 신규 3파일: `page.tsx`(server, 데이터 fetch), `product-type-page-client.tsx`(포장지 칩 토글·추가 + SKU 카탈로그 테이블), `product-type-dialog.tsx`(SKU 추가/수정 다이얼로그). 기존 admin/varieties 패턴 재사용. 비주얼 고도화는 추후 Claude Design.
- 진입 링크: [desktop-sidebar.tsx](../components/desktop-sidebar.tsx)·[mobile-header.tsx](../components/mobile-header.tsx) Management 섹션에 "제품유형 관리"(Package 아이콘), [breadcrumb-display.tsx](../components/breadcrumb-display.tsx) 경로 매핑 추가.
- [docs/permission-matrix.md](permission-matrix.md): `/admin/product-types` 라우트 + product-type.ts 액션 가드 등록.
- 신규/변경 코드 tsc·eslint 클린(기존 부채 desktop-sidebar:77·mobile-header:18은 수술적 변경 원칙상 미수정).

---

### 제품유형 마스터 — 단계 2: Server Actions `feat`

**변경**:
- [lib/product-type.ts](../lib/product-type.ts) 신규: `findOrCreateProductType(client, params)` 헬퍼. **`'use server'`가 아닌 순수 모듈** — 단계 5에서 매입/포장 등록 트랜잭션 내부에서 `tx`를 주입받아 호출하기 위함(RPC로 노출되면 비직렬화 인자 `tx`를 못 받음). upsert로 동시생성 경합 흡수. 계획서 §5 단계2의 헬퍼를 위치만 lib로 분리(의도 동일).
- [app/actions/product-type.ts](../app/actions/product-type.ts) 신규: `listPackagings`/`createPackaging`/`togglePackagingActive`(포장지 마스터), `listProductTypes`/`upsertProductType`/`deleteProductType`/`toggleProductTypeActive`/`suggestProductType`(SKU). 권한=조회 `requireSession`, write `SALES_MANAGE`. `upsertProductType`은 isDefault 단일성을 트랜잭션으로 보장(동일 품종+도정+규격 기존 기본 해제). 모든 write `recordAuditLog` + `revalidatePath('/admin/product-types')`.
- `tsc --noEmit` 통과.

---

### 제품유형(ProductType/SKU) 마스터 — 단계 1: 스키마 + 마이그레이션 `feat`

**배경**: 발주서 판매처리 선행 1순위. 매칭 4키(품종+도정구분+규격+포장지)를 단일 SKU 엔티티로 정규화. 계획서 [plan-제품유형마스터.md](plan/plan-제품유형마스터.md) 단계 1.

**변경**:
- [prisma/schema.prisma](../prisma/schema.prisma): `Packaging`(포장지명 마스터, `name @unique`·`active`)·`ProductType`(SKU 카탈로그, `(varietyId, millingType, packageType, packagingId)` `@@unique` + `(varietyId, millingType, packageType)` 인덱스) 신규. `MillingOutputPackage.productTypeId Int?`(nullable=백필용)·`Variety.aliases String[]`·양방향 관계 추가.
- `millingType` NOT NULL `@default("기타")` sentinel, `packagingId` NOT NULL('매입포장' sentinel 행 예정) — NULL 유니크 구멍 방지.
- 마이그레이션 `20260616000000_add_product_type_master`: Neon 비대화형 환경이라 `migrate diff`로 SQL 생성 → 파일 작성 → `migrate deploy` 적용(전부 additive). `prisma generate`·`tsc --noEmit` 통과.

---

## 2026-06-09

### 원물재고 검색 시 도정내역으로 튕기는 버그 수정 `fix`

**증상**: 모바일에서 원물재고 검색(필터 다이얼로그) 적용/초기화 후 가끔 도정내역(`/milling`) 페이지로 이동.

**원인**: [stock-filters.tsx](../app/(dashboard)/raw-stocks/stock-filters.tsx)의 `handleApply`(112)·`handleReset`(125)이 존재하지 않는 `/stocks`로 `router.push`. 잡곡재고관리 #4(`/stocks`→`/raw-stocks` 마이그레이션, 25곳 치환) 때 이 2곳이 누락됨. `next.config.ts`의 308 영구 리다이렉트가 받아주고 있었으나, 308 브라우저 영구 캐시 + next-pwa service worker 캐시 + 클라이언트 라우터의 redirect 추적이 엉키며 인접 하단탭(원물 옆 도정)으로 간헐적 오동작.

**변경**: 112·125번 `router.push` 대상을 `/stocks` → `/raw-stocks`로 수정(2줄). 이제 리다이렉트·SW 캐시 경유 없이 곧장 `/raw-stocks`로 이동. 잡곡 필터(`misc-stock-filters.tsx`)는 이미 `/raw-stocks?tab=misc`로 정상.

**참고**: 기존 기기의 308 영구 캐시·SW 캐시는 배포 후 SW 갱신/새로고침 시 해소.

---

### 로딩 화면 공용 컴포넌트 통일 + lint/타입 정리 `refactor` (e2ced45)

**배경**: 원물재고(/raw-stocks) 로딩 화면을 브랜드 스피너로 개선하다가, 동일한 `<div>Loading...</div>` fallback이 여러 메뉴에 흩어져 있어 공용 컴포넌트로 통일.

**변경**:
- `components/ui/section-loader.tsx` 신규 — `message`/`description` prop을 받는 Suspense fallback용 브랜드 스피너(`role="status"`·`motion-reduce:animate-none` 접근성). 액션 처리용 `full-screen-loader`와 역할 분리.
- fallback 6곳 교체: raw-stocks(재고)/packages(제품재고)/milling(도정 내역)/admin·varieties(품종 목록)/admin·farmers(농가 목록)/sales-release(출고 내역).

**부수 — lint/타입 부채 정리**(이왕 연 파일들): raw-stocks 미사용 import·`as any[]` 제거, admin/farmers의 `as any`를 떼다가 `FarmerPageClient`의 `Farmer` 타입이 `group`·`groupId`·`farmerNo`를 non-null로 잘못 정의한 불일치 발견 → 실제(nullable)에 정합(하위 컴포넌트는 이미 nullable 처리 중). 무의미한 `@ts-ignore`·미사용 `Suspense` import 제거. tsc·eslint 통과 확인.

---

### 발주서 판매처리 — §8.1 포장지 마스터 구현 설계 `docs`

**배경**: 도메인 결정 #1~#25 확정 후 설계 단계 착수. 의존순서대로 단계별 진행, 선행 1순위인 포장지 마스터부터. 계획서 [docs/plan/plan-발주서판매처리.md](plan/plan-발주서판매처리.md) §8.1.

**설계 내용**:
- 모델 4개: `Packaging`(마스터, name unique+active soft-delete) / `PackagingMapping`(품종×중량→포장지, isDefault, @@unique·@@index) / `MillingOutputPackage.packagingId?` / `Variety.aliases`. isDefault "조합당 1개"는 DB 제약 대신 Server Action 트랜잭션으로 보장(과설계 회피).
- `app/actions/packaging.ts` Server Action 7개. 마이그레이션 = 스키마→시드→누락조합 점검→백필(MILLED는 `stock.varietyId` 경유 분기).
- 화면 결정 3건 확정: 관리 화면=`/settings/packaging`(설정 메뉴 신규), 마스터 변경 권한=`MILLING_MANAGE`, 포장 등록 시 포장지=강제(DB nullable 유지·입력단 Zod required). 강제 때문에 매핑 정비가 포장 등록 입력 추가보다 선행.

**다음**: §8.2 발주서 파싱 + 도메인 모델 설계.

---

### 발주서 판매처리 — 품목명↔품종 매칭 전략 확정 (결정 #22~#25) `docs`

**배경**: 발주서 판매처리 계획서의 마지막 블로커였던 품목명↔품종 매칭을 실데이터 대조 + 담당자 미팅으로 해소. 계획서 [docs/plan/plan-발주서판매처리.md](plan/plan-발주서판매처리.md).

**실데이터 대조**: 발주서.xlsx 18종 ↔ DB Variety 전수 대조(§6.1.1). 순수 정규화로 15종 자동, 별칭 매핑 5품종(서농22호·흑미·발아현미·천지향1세·백옥찰) 필요. 가바=서농 가바미 통칭, 가바흑미=흑미(별도품종), 가바발아현미=발아현미(서농22호 현미를 발아위탁→잡곡 입고).

**확정 결정**:
- **#5 번복**: 별칭 없는 정확일치 → **정규화+별칭 하이브리드**(현장통칭↔행정품종명 문자유사성 0이라 별칭 불가피)
- **#1 보강**: 매칭키에 도정유형 추가(품종+도정유형+중량+포장지 4키). 흑미·발아현미는 도정 아닌 별도 잡곡품종이라 분리 대상에서 제외
- **#22**: `Variety.aliases String[]` 필드 신설(별도 테이블 아님). 수동매칭 시 학습형 append 권장
- **#23**: 매칭 파이프라인 3단계(정규화→품종해석→4키 FIFO 재고매칭)
- **#24**: 가공형태 이분(단순도정=원품종 유지 / 위탁가공=별도 잡곡품종 통째 매칭). ⚠️박태일 서농24호 ≠ 오점기 흑미(별개 품종) 확인, 서농24호 RICE 환원은 원물출고 도메인 별도 정리(§6.2)
- **#25**: 판매 금액 미관리(수량 차감만, 매출 정산은 외부 회계)

**계획서 점검·보완**: 전체 정독으로 빈틈 색출 — millingType 모델 모순(흑미/발아현미 null 처리), 문서 정합성(구버전 잔재 4곳), 금액 빈틈(#25로 결정) 정정. 도메인 결정 #1~#25 완결, 다음은 설계(엑셀 파싱·Server Actions·구현순서).

**검증**: DB 실데이터 쿼리로 품종/재고/필터 기준 확인(서농22·24호·흑미·발아현미 stock 분포, 재고목록 필터=`stock.category` / 품종 드롭다운=`variety.category` 구분). 계획서·메모리 동기화.

---

## 2026-06-05

### docs 폴더 분류별 정리 `chore`

**배경**: `docs/` 루트에 평면적으로 흩어진 문서 70여 개를 분류별 하위 폴더로 정리. 계획서 [docs/plan/plan-docs폴더정리.md](plan/plan-docs폴더정리.md).

**구조 변경**:
- `plan-*.md`(33) → `docs/plan/`, `report-*.md`(31) → `docs/report/`, `research-*.md`(5) → `docs/research/` (전부 `git mv`로 히스토리 보존)
- claude design 산출물 `docs/handoff/` 하위 통합: 현 활성 번들 → `handoff/디자인시스템/`, `handoff-잡곡재고관리/` → `handoff/잡곡재고관리/`(미추적 유지), `원물카드_상태간소화_A안/` 이동, 시안 html 3개(모바일·벼탭·투입내역) → `handoff/`
- 루트 유지: `worklog.md`, `permission-matrix.md`, `리팩토링-백로그.md`, `claude-design-workflow.md`

**참조 보정**:
- 문서 간 상호링크: 카테고리 교차 참조에 `../plan/`·`../report/`·`../research/` 경로 부여, `./`접두·`docs/`절대형 정규화, `status-migration.md`는 `handoff/디자인시스템/` 하위 경로로 조정
- 코드/설정: `scripts/seed-misc-grain-varieties.ts`(주석), `components/ui/milling-status-badge.tsx`(주석), `.gitignore`(`/docs/handoff/잡곡재고관리/`), `README.md`(워크플로 경로)
- 메모리(`project_misc_grain_feature.md` 등) docs 경로 일괄 보정

**검증**: 전체 `.md` 깨진 링크 전수 검사 — 이동으로 인한 깨짐 0건. 잔존 2건(`plan-stats-cleanup → README.md`, `report-도정상태3단계 → draft-공지`)은 **이동과 무관한 기존 깨짐**(draft 공지는 삭제된 파일)이라 미수정. 코드 변경은 주석/문자열뿐이라 빌드 영향 없음.

---

### 투입내역 팝업 — 요약 밴드 + 생산자별 소계 `feat` `5c375c0`

**출처**: 핸드오프 + 시안 `docs/투입내역-요약-소계-시안.html`(B안). 표시 UI만 추가, 기존 props·삭제/수정/메타편집 로직 그대로.

**변경** (`app/(dashboard)/milling/stock-list-dialog.tsx` 단일 파일):
- `Fragment` import 추가. 집계 로직 추가 — `farmerNames`/`varietyNames`/`groups`(생산자 첫 등장 순서 유지)/`showSummary`(톤백 ≥2)/`showSubtotal`(생산자 ≥2). 기존 `totalWeight` 재사용.
- 모듈 레벨 `Stat` 셀 컴포넌트 + **요약 밴드**(메타 밴드↔표 사이, `showSummary`일 때만. 톤백·생산자·품종·합계, 합계만 강조).
- `TableBody`를 `groups.map`+`Fragment` 구조로 변경. 각 생산자 그룹 끝에 `showSubtotal`일 때 **소계 행**(`소계`+개수+중량만, 이름 텍스트 없음). `canDelete` 분기에서 빈 `<TableCell/>` +1로 컬럼 정렬 일치.

**검증**: `tsc --noEmit` 통과. 엣지 3종(톤백1·단일생산자·다중생산자) 코드 분기 확인. 실데이터 600px 폭 육안 확인 권장.

---

## 2026-06-04

### 모바일 디자인 점검 PR-4 후속 — packages/sales 탭 Segmented 확장 `fix` `0b1a9c4`

**배경**: PR-4에서 raw-stocks만 모바일 segmented 적용했던 것을 사용자 확인 후 나머지 탭으로 확장. **모바일 화면만** 변경(데스크탑 underline 전부 유지).

**변경**:
- `app/(dashboard)/packages/packages-tabs.tsx` — 벼/잡곡 2탭. raw-stocks-tabs와 **동일 패턴**: 모바일 `grid grid-cols-2` segmented(활성 `bg-white shadow-sm`, `h-11`), 데스크탑 `hidden sm:flex` underline.
- `app/(dashboard)/sales/sales-tabs.tsx` — 벼/잡곡/출고 **3탭** + "준비중" 배지. 모바일 `grid grid-cols-3` segmented. 배지는 좁은 칸이라 칩 배경 제거하고 `text-[9px] text-slate-400` 텍스트로 축소. 데스크탑은 기존 underline + 칩 배지(`bg-slate-100`) 유지. wrapper `border-b`를 데스크탑 분기로 이동(`hidden sm:block`)해 모바일 segmented엔 밑줄 안 생기게.

**검증**: `tsc --noEmit` 통과, `next build` 통과. 사용자 실기기에서 (a) 제품/판매 탭 모바일 segmented, (b) sales 3칸에 "준비중" 배지 안 깨지는지, (c) 데스크탑 underline 유지 확인 권장.

---

### 모바일 디자인 점검 PR-7 — native confirm/alert → 공용 AlertDialog `fix` `c773053`

**출처**: `docs/모바일-디자인점검.html` P2. 사용자 결정으로 **공용 훅 방식 전체 통일**.

**신규 인프라**:
- `components/ui/confirm-dialog.tsx` — imperative `confirmDialog(msg | { description, destructive, confirmText, cancelText, title }): Promise<boolean>` + 루트 마운트 `<ConfirmDialogHost/>`. sonner `toast()`식 모듈 레벨 trigger라 컴포넌트 밖에서도 호출 가능. Host 미마운트 시 `window.confirm` 폴백. 삭제류는 `destructive`(빨강 버튼)+`confirmText:'삭제'`.
- `app/layout.tsx` — `<ConfirmDialogHost/>` 1회 마운트(Providers·Toaster와 같은 레벨).

**치환** (native `confirm` 28곳 → `await confirmDialog(...)`):
- raw-stocks 6: stock-list-client, stock-table-row, delete-stock-button, edit-stock-dialog, stock-page-wrapper, misc/misc-stock-list-client
- milling 8: add-packaging-dialog(4), close-batch-button, milling-table-row, stock-list-dialog, mobile-milling-card
- admin 5: farmers/excel-buttons, varieties/variety-dialog, varieties/delete-button, BackupManager, NoticeTable, UserTable(2)
- packages 4: edit-misc-purchase-dialog, misc-purchase-dialog, misc-package-panel(2)
- sales 3: mobile-release-card, release-history-list, release-page-wrapper
- 호출 함수 전부 이미 async → 호출측 수정 불필요. 메시지 원문·템플릿 리터럴 100% 보존. 삭제 의미 메시지는 destructive 적용.
- `milling-cart-sheet.tsx` `alert`(수정 실패) → `toast.error` (확인용 아닌 에러 알림이라 AlertDialog 대신 toast).

**범위밖**: `pwa-install-guard.tsx`의 안내성 `alert`(설치 가이드)은 유지.

**검증**: `tsc --noEmit` 통과, `next build` 통과(DB cold start로 1회 타임아웃 후 재시도 성공). 실코드 `confirm(` 0건(docs 핸드오프 원본 제외), 28곳 전부 `await` 직접 확인. 작업은 파일 그룹 3분할 병렬(에이전트) 후 일괄 검증.

---

### 모바일 디자인 점검 PR-6 — Dialog Shell 통일 `fix` `22776fc`

**출처**: `docs/모바일-디자인점검.html` §다이얼로그. 실측 후 `start-milling-dialog`는 이미 정합(grid-cols-2 없음·footer/색상 primary)이라 제외 → 실제 3파일.

**변경**:
- `components/milling-cart-sheet.tsx` (색상 DS 정합):
  - `text-blue-600` → `text-primary` (총중량·아이템중량 2곳)
  - 풋 버튼: 신규 `bg-blue-600...` → `bg-primary hover:bg-primary/90`, 수정모드 `bg-orange-500 shadow-orange-200`(DS 미정의색) → `bg-amber-600 hover:bg-amber-700` (색그림자 제거)
  - `hover:border-blue-300` → `hover:border-primary/40`
  - `SheetFooter` `pb-[max(1rem,env(safe-area-inset-bottom))]` 추가 (iOS 홈 인디케이터)
  - 마이크로 헤더 `Summary`(uppercase) → `요약`
- `app/(dashboard)/raw-stocks/add-stock-dialog.tsx` (sticky footer):
  - DialogContent `flex flex-col max-h-[85vh]` (twMerge로 기본 `grid`→`flex` 전환), form `id="add-stock-form"` + `flex-1 min-h-0 overflow-y-auto`(기존 `max-h-[80vh]` 제거)
  - 저장 버튼을 form 밖 `DialogFooter`로 분리 + `form="add-stock-form"` 속성. footer `-mx-6 px-6 pt-3 border-t pb-[max(0.75rem,env(safe))]` → 폼 길어도 버튼 항상 노출
  - grid: 생산자-농가명·품종-입고일자 → `grid-cols-1 sm:grid-cols-2` (모바일 1열). 생산년도-인증·톤백-중량은 2열 유지
- `app/(dashboard)/raw-stocks/edit-stock-dialog.tsx` (grid): 생산년도-입고일자·생산자-농가명 → `grid-cols-1 sm:grid-cols-2`. 톤백-중량 2열 유지

**판단**: grid 1열화는 점검 원칙("짝지어야 의미 있는 필드만 2열 유지") 그대로 — 긴 Select 값(생산자/품종) truncate 방지. 색상은 메모리 경고대로 실측 후 진행(cart-sheet는 벼탭 완료분과 무관, 아직 blue/orange 하드코딩 잔존이었음). `replace-colors.js` 미사용(수동 편집).

**미착수**: PR-7(native confirm → AlertDialog, P2)은 UX 변경이라 별도 PR로 분리.

**검증**: `tsc --noEmit` 통과, `next build` 통과. 사용자 실기기에서 (a) 입고등록 폼 길어도 저장 버튼 고정 노출, (b) 모바일에서 생산자/품종 필드 1열로 넓어짐, (c) 도정 장바구니 색상 primary/amber, (d) 시트 버튼 safe-area 확인 권장.

---

### 모바일 디자인 점검 PR-5 — 카드 폰트 방향전환 + 원물카드 A안 `fix` `2c3f3cb`

**방향 변경(사용자 지시)**: 당초 PR-5 핵심이던 "모바일 카드 본문 폰트 한 단계 상향"은 **전면 철회**. 도정 카드·원물 카드 모두 `shrink-0`/`truncate`/`nowrap`으로 한 줄에 욱여넣은 구조라, 폰트 키우면 줄이 넘어가 깨지는 게 더 큰 문제. → 카드 폰트는 현재 크기 유지.

**변경**:
- `components/mobile-nav.tsx:147,211` — 하단 네비 **비활성 라벨** `text-[9px]` → `text-[10.5px]` (2곳). 활성은 라벨 숨김(`text-[0px]`)이라 무관. `leading-none`+`max-h-3`(12px)로 wrap·잘림 없음 확인. (카드 아님 → 영향 없음)
- `raw-stocks/stock-list-client.tsx` `MobileStockDetailCard` — **A안 적용**(Claude Design 핸드오프 `docs/원물카드_상태간소화_A안/` 드롭인 교체본 그대로):
  - 기존 2줄(생산자+LOT 한 줄 / #톤백·무게 한 줄, 둘 다 truncate) → **테이블형 1행**: `체크박스 · #톤백번호(w-34 고정) · 생산자+LOT(flex-1 2줄) · 무게(w-52 고정) · ⋮`
  - **상태칩(Badge) 제거** → 가변폭 ~50px 확보, 긴 생산자명 안 잘림. 상태는 카드 배경(`bg-slate-50`)+흐림(`opacity-60`)으로 대체(기존 동작). import는 그룹헤더(270·434행)에서 계속 써서 유지.
  - 폰트 상향 없음(생산자 12.5px·LOT 10px). 정보 재배치로 해결.
- `tsconfig.json` — `exclude`에 `docs` 추가. 핸드오프 번들의 `.tsx`가 `**/*.tsx` include에 잡혀 `Cannot find name` 다수 발생하던 문제 차단(docs는 빌드 대상 아님).

**보류**: 도정 카드(`mobile-milling-card.tsx`) 레이아웃은 이번 범위 밖(폰트·구조 모두 현행 유지).

**검증**: `tsc --noEmit` 통과, `next build` 통과. 상태칩 제거는 정보 표현 변경이므로 사용자 실기기에서 (a) 긴 생산자명(유기농영농조합 등) 안 잘림, (b) 소진 행이 배경/흐림으로 구분되는지, (c) 톤백번호·무게 세로 정렬 확인 권장.

---

### 모바일 디자인 점검 PR-4 — 벼/잡곡 Segmented Tab `fix` `a10f7f7`

**출처**: `docs/모바일-디자인점검.html` §4.1. 모바일 underline 탭의 hit-area 협소(~40px)·화면 폭 미활용 해소. 사용자 사전 시안 확인 후 진행(게이트 통과).

**시안 확인**: `public/preview/raw-stocks-tab.html`로 3안 비교(현재 underline / A 흰카드+그림자 / B primary 파랑) → 사용자 **A(권장안, 중립 흰 카드)** 선택.

**변경** (1파일, `raw-stocks-tabs.tsx`):
- 모바일(sm 미만): `grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg` segmented. 활성 `bg-white shadow-sm font-bold`, 비활성 `font-semibold text-slate-500`. 각 탭 `h-11`(44px 터치 타깃) + 화면 폭 절반씩 full-width.
- 데스크탑(sm 이상): 기존 underline 탭(F안 애니메이션 하이라이트) **그대로 유지** — `hidden sm:flex` 분기.
- 두 모드 모두 폰트 14px 고정 → 활성/비활성 전환 시 layout shift 없음.

**판단**: 점검 권장안(§4.1 "권장 — full-width 2 segmented")을 클래스 단위까지 그대로 적용. 데스크탑 동작·시각 무변경. `packages-tabs.tsx`·`sales-tabs.tsx` 확장은 후속(사용자 피드백 후 결정).

**검증**: `tsc --noEmit` 통과, `next build` 통과(raw-stocks 라우트 정상). 사용자 실기기에서 (a) 모바일 segmented 전환, (b) 데스크탑 underline 유지, (c) layout shift 없음 확인 권장.

---

### 모바일 디자인 점검 PR-3 — 터치 타깃 hit-area 확장 `fix` `3fb20da`

**출처**: `docs/모바일-디자인점검.html`. P1 hit-area 3건 + P2 Dialog X 1건 묶음. **시각 변화 없는 사용성 개선**이 원칙.

**변경** (4파일, +10/−4):
- `stock-list-client.tsx:552` (DropdownMenu trigger) — `relative` + `<span aria-hidden absolute -inset-2.5>` pseudo로 시각 24px 유지, hit 44px 확보. Button 외곽 invisible 확장 패턴
- `mobile-milling-card.tsx:140` (MillingStatusBadge button) — `p-1.5 -m-1.5`로 padding+negative margin. row 높이/시각 위치 동일, hit 확장
- `packages/mobile-package-card.tsx:52` (DropdownMenu trigger) — 동일 pseudo span 패턴
- `components/ui/dialog.tsx:72` (X 버튼) — `top-2.5 right-2.5 size-9 inline-flex items-center justify-center rounded-md`로 hit 36px. svg 위치 4px 안쪽으로 미세 변동(허용 범위)

**판단**:
- **체크박스 hit-area 확장 (보고서 P1, 2건) → 보류**: stock-list-client / mobile-milling-card 모두 카드 전체에 `onClick=handleCardClick`(토글) + 체크박스만 `stopPropagation`으로 격리한 구조. 즉 사용자 입장에선 카드 어디 눌러도 토글되므로 체크박스의 16×16 hit-area는 실질 문제가 아님. 부모 div 확장은 옆 텍스트 영역과 충돌하여 부작용만 발생 → 의도 X.
- **mobile-milling-card에 DropdownMenu 없음** — 보고서 표기와 달리 실제 코드엔 없음(grep 0건). 해당 항목 제외.

**검증**: 시각 영역 무변화가 핵심. Button 컴포넌트가 `overflow`/`relative` 강제 안 함을 확인하여 pseudo span 확장 안전성 확보. 사용자 실기기에서 (a) 톤백 카드 더보기 버튼 hit, (b) 도정 상태 뱃지 hit, (c) 제품 카드 더보기, (d) 다이얼로그 X 버튼 hit이 모두 손가락 편안한지 확인 권장.

---

### 모바일 디자인 점검 PR-2 — Floating UI 정리 `fix` `9d7b7a5`

**출처**: `docs/모바일-디자인점검.html`. P0-3(Floating 충돌) + P1 BulkActionBar 아이콘화 + P1 Cart 배지색 + P2 잡곡 FAB 숨김 묶음.

**변경** (2파일):
- `stock-page-wrapper.tsx`:
  - `useSearchParams` 도입 → 잡곡 탭(`?tab=misc`) 판별. 잡곡일 때 Cart FAB 비표시(도정 카트는 벼 전용)
  - Cart Y 동적: `selectedIds.size > 0` 시 `bottom-[calc(12rem+safe)]`로 한 단 위, 아니면 기존 `7.5rem`. `transition-[bottom]` 추가
  - 카운트 배지: `bg-red-500/text-white/-top-1 -right-1` → `bg-white text-primary border-2 border-primary/top-0 right-0` (알림이 아닌 "담긴 수" 의미 정합)
  - 외곽 `border-2 border-white/50` 제거 (배지 보더와 중복)
- `stock-page-client.tsx` (BulkActionBar):
  - 모바일 정사각 아이콘 버튼(`h-9 w-9 p-0`), 라벨 `hidden sm:inline` → 6버튼 다 들어가도 라벨 잘림 없음
  - 카운트 텍스트 `"{n}건 선택"` → 모바일 `"{n}건"`·`text-[12px]`·`slate-700`·`semibold` (좁은 폭에 정보 손실 최소)
  - 컨테이너 padding 모바일 `px-2.5 py-1.5`로 축소

**판단**: BulkActionBar는 데스크탑 동작 100% 보존 (sm↑ 분기로 기존 클래스 유지). 모바일에서만 시각 변경.

**검증**: 변경은 시각·동작 두 측면 모두 모바일 전용 분기. 데스크탑은 영향 없음. 사용자 실기기 확인 권장 — 특히 (a) 톤백 선택 시 카트 위로 슬라이드, (b) 잡곡 탭에서 카트 사라짐, (c) 모바일 액션바 아이콘만 표시.

---

### 모바일 디자인 점검 PR-1 — P0 일괄 처리 `fix` `1e9a6f6`

**출처**: `docs/모바일-디자인점검.html` (Claude Design). P0 4건 중 단독 처리 가능한 3건 묶음.

**변경** (3파일):
- `stock-list-client.tsx:67,113` — 템플릿 리터럴 escape 버그 (`\${` → `${`) 2곳. `\${...}`가 문자열로 들어가 Tailwind 조건부 클래스(`bg-transparent`/`bg-white`/`py-3 gap-3`)가 통째로 무시되던 진성 버그
- `layout.tsx:24` — 모바일 컨텐츠 `pb` 4px 부족 해소. `pb-[calc(3.5rem+safe+1rem)]`(=72+safe) → `pb-[calc(60px+safe+1.5rem)]`(=84+safe). nav 실측치(`h-[60px]+mb-4+safe`=76+safe)와 동기화 + 주석 추가
- `mobile-milling-card.tsx:178` — 비고 영역 `📝` 이모지 → `lucide-react`의 `StickyNote` (DS §7 Voice & Tone 위반 해소). `line-clamp-1`이 `inline-flex`와 충돌해 `flex + truncate` 구조로 함께 재작성

**판단**: 보고서가 묶었던 P0-3(Floating Cart × BulkActionBar Y 충돌)은 카트/액션바 로직을 함께 손대야 해서 PR-2로 분리.

**검증**: 변경 규모 작음(3파일 8줄+/6줄-, 시각 변화 없음) → `next build` 생략, diff 시각 확인으로 갈음.

---

## 2026-05-22

### statistics UI 강조색 → primary (벼탭 디자인점검 마무리) `refactor` `5c1eed3`

**출처**: `docs/벼탭-디자인점검.html`. 어제 데이터 시각화색(`#0080c8`) 처리에 이어, statistics의 **UI 액션색**(데이터색 아님)을 `primary`로 통일.

**변경** (4파일):
- 모바일 필터 활성칩·카운트뱃지: `stock-stats-client`/`output-stats-client`/`milling-stats-client` — `bg-[#00a2e8]/10 text-[#00a2e8]`, `text-[#008cc9]` → `primary`
- `MillingTable` UI: 도정종류 뱃지·투입량 링크 hover·행 hover → `primary`
- `MillingTable` **데이터 강조 유지**: 생산량 링크·수율 뱃지(L218/235)는 데이터색 `#0080c8`/`#006097`로 통일 (UI색과 의미 구분, 디자인 §1.5)

**판단**: 점검 항목 중 다이얼로그(start-milling/release-stock/add-packaging)·§3.4 헤더 액션은 **어제 PR1 색상 토큰화 때 이미 primary로 정렬 완료** → 실측 후 작업 제외.

**검증**: `next build` 통과(TypeScript OK, 19페이지 생성). statistics 폴더 `#00a2e8`/`#008cc9`/`#007ab3` 잔존 0건.

---

### 원물재고 그룹체크 lazy-load 두번클릭 해소 (디자인 점검 FN) `fix` `95f08f9`

**출처**: `docs/벼탭-디자인점검.html` FN — 미펼침 그룹 체크박스를 누르면 펼침+로드만 되고 선택이 안 돼 다시 클릭해야 했음("User has to click again" 주석).

**변경** (`stock-list-client.tsx`):
- `pendingSelect: Set<string>` 대기열 도입 — 미로드 그룹 체크 시 `toggleGroup`(펼침+fetch) + 대기열 등록
- `loadedItems`/`loadingGroups` 변화 감지 `useEffect`로 로드 완료된 대기 그룹을 자동 전체선택 후 대기열 정리
- 무한루프 방지: `pendingSelect.size===0` early-return + 처리 후 즉시 비움
- 데스크탑(`GroupedStockRows`)·모바일(`GroupedStockMobileCards`) 동일 적용

**검증**: `next build` 통과. 단 실제 그룹 선택 동작은 로그인+재고 데이터 필요 → 사용자 실동작 확인 권장.

---

## 2026-05-21

### statistics 데이터 시각화 메벼색 #00a2e8 → #0080c8 (디자인 §1.5 팔레트) `refactor`

**출처**: `docs/벼탭-디자인점검.html` + design-system §1.5 Data Visualization. 데이터 시각화는 UI primary와 별도 팔레트(VARIETY_TOKENS): 메벼=`#0080c8`(코발트, 기존 `#00a2e8` 대체), 인디카=`#8dc540`, 찰벼=`#f89c1e`, 기타=`#94a3b8`.

**변경** (메벼색만 — 나머지 품종색은 이미 팔레트 일치):
- 차트 시리즈: `MillingChart`(COLOR_INPUT/OUTPUT), `MultiSeriesChart`(PALETTE[0]), `OutputChart`(생산량 fill) — `#00a2e8`/rgba → `#0080c8`, yield `#006097`
- 카드 지표: `SummaryCards`/`stock-summary-cards`/`output-stats-client` 메벼 카드 — dot/accent `#0080c8`, 숫자 text `#006097`

**남은 statistics (다음)**: UI 강조색(필터 활성칩 stock/milling/output-stats, MillingTable 행·링크 hover/뱃지, `#008cc9`) → `primary`. 데이터색이 아니라 UI 액션이라 토큰.

**검증**: `tsc --noEmit` 통과. 차트 색 실제 렌더는 사용자 검수 권장.

---

### 원물재고 빈 상태 EmptyState 공용 컴포넌트화 (디자인 점검 PR3) `refactor`

**출처**: `docs/벼탭-디자인점검.html` P2 §5.3/§7 — 잡곡은 아이콘+친근체 EmptyState, 벼는 "검색 결과가 없습니다" 텍스트 한 줄.

**변경**:
- `components/empty-state.tsx` 신규 — Inbox 아이콘 + 친근체 카피. `filtered`(공통 카피) / `emptyText`(도메인별) prop
- 잡곡 `misc-stock-list-client`: 자체 `EmptyState` 함수 → 공용 import, 미사용 `Inbox` import 정리
- 벼 `stock-list-client`: 텍스트 빈 상태 → `EmptyState` (데스크탑 colSpan + 모바일)

**범위 판단**:
- **CertBadge 공용화는 스킵** — 벼 인증뱃지 색이 이미 잡곡과 동일(앞 작업에서 통일)해 단일소스화는 체감 0인데 4파일 회귀 위험. ROI 안 맞음.
- 도정(milling) 빈 상태도 동일 적용 (모바일/데스크탑) — `milling-list-client`, 카피 "아직 등록된 도정 작업이 없어요."

**검증**: `tsc --noEmit` 통과.

---

### 벼 입고/수정 다이얼로그 shell 정렬 (디자인 점검 PR5-1) `refactor`

**출처**: `docs/벼탭-디자인점검.html` PR5 — 벼 다이얼로그의 form·footer spacing을 잡곡 `add-misc-stock-dialog` 기준으로.

**변경** (`add-stock-dialog.tsx`, `edit-stock-dialog.tsx`):
- form: `gap-4 py-4` → `gap-4 py-2 max-h-[80vh] overflow-y-auto px-1` (긴 폼 스크롤 일관)
- footer 패딩 `pt-4` → `pt-2`
- add-stock 저장 버튼 `bg-primary hover:bg-primary text-white` → 기본 Button(hover `/90` 복원, 중복 제거)
- edit-stock 저장 버튼은 이미 기본(앞선 PR1 부작용 수정에서 처리됨)

**검증**: `tsc --noEmit` 통과.

**남은 다이얼로그 (다음)**: start-milling / release-stock / add-packaging — 폼 구조가 제각각(특히 add-packaging은 이미 `flex-col max-h-[90dvh]` 스크롤)이라 각각 확인 후.

---

### 벼 탭 행 액션 DropdownMenu 통일 (디자인 점검 PR4) `refactor`

**출처**: `docs/벼탭-디자인점검.html` P1 — 벼 데스크탑은 인라인 수정/삭제 아이콘 2개, 잡곡은 점세개 드롭다운으로 달랐음.

**변경** (`stock-table-row.tsx`): 벼 데스크탑 행의 인라인 Edit/Trash 아이콘 → 점세개(`MoreVertical`) DropdownMenu(수정/삭제). 잡곡 `misc-stock-table-row` 패턴과 통일.
- 행 클릭=선택과 충돌 방지: 트리거 버튼·메뉴 아이템에 `stopPropagation` 유지
- 삭제는 기존대로 소진(CONSUMED) 시 비활성
- 미사용 import(`MoreHorizontal`/`AlertCircle`) 정리
- 모바일(MobileStockDetailCard)은 이미 드롭다운이라 데스크탑만 변경

**검증**: `tsc --noEmit` 통과 + 사용자 동작 확인(드롭다운 열림/수정·삭제/행 선택 비충돌).

---

### 원물재고 벼 탭 상단 여백 잡곡과 통일 `fix`

**증상**: 벼/잡곡 탭 전환 시 ① 탭라인↔버튼행, ② 버튼행↔테이블 여백이 서로 다름(사용자 지적).

**원인**: 벼 `StockPageClient`와 잡곡 `MiscStockPanel`의 레이아웃 클래스 차이.
- 컨테이너: 벼 `gap-1` vs 잡곡 `gap-2` → 버튼행↔테이블 여백 차이
- 헤더 section: 벼 `pt-2` 있음 vs 잡곡 없음 → 탭라인↔버튼행 여백 차이 (두 여백이 서로 반대로 어긋남)

**수정** (`stock-page-client.tsx`): 잡곡 기준으로 컨테이너 `gap-1`→`gap-2`, 헤더 `pt-2` 제거.

**검증**: `tsc --noEmit` 통과.

---

### 벼 탭 주요 버튼 색 보정 — emerald → primary (PR1 부작용 fix) `fix`

**증상**: 벼 입고등록 버튼이 초록(emerald)인데 잡곡 등록 버튼은 파랑(primary) — 색 불일치(사용자 지적).

**원인**: PR1 색상 치환에서 `#8dc540`을 유기농 인증색으로 보고 `emerald-600`에 매핑했으나, 이 hex가 일부 **주요 액션 버튼색으로도** 쓰여서 등록/저장 버튼이 초록으로 남음.

**수정** (3개 버튼 → 기본 `primary`):
- `add-stock-dialog.tsx`(벼 입고등록), `edit-stock-dialog.tsx`(수정 완료), `edit-release-dialog.tsx`(저장하기)
- `bg-emerald-600 hover:bg-emerald-700 text-white` 제거 → shadcn 기본 Button
- 엑셀 다운로드 버튼의 emerald hover는 잡곡도 쓰는 의도된 색이라 유지

**검증**: `tsc --noEmit` 통과.

---

### 벼 탭 시각 디테일 정렬 — 인증뱃지·체크박스 (디자인 점검 후속) `refactor`

**인증뱃지** (`stock-table-row.tsx`): 잡곡 `CERT_BADGE_CLASS`와 색 통일.
- 무농약 `primary`(파랑) → `sky-700`(하늘) — 두 탭 무농약 색 어긋남 해소
- 유기농 `emerald-600/10` → `emerald-50/700`, 일반 `slate-500` → `slate-600`

**체크박스** (`stock-list-client.tsx` 3곳): 커스텀 `data-[state=checked]:bg-primary border-primary` 제거. shadcn 기본 Checkbox가 이미 primary라 중복(시각 동일, 코드 일관성).

**기록**: §3.3 1줄 헤더 브레드크럼은 이미 `components/breadcrumb-display.tsx`로 layout 전역 구현돼 있음 → 점검 보고서의 "헤더 누락" 지적은 부정확(페이지 컴포넌트만 보고 전역 헤더 놓침). PageBreadcrumbHeader 신규 생성 불필요.

**검증**: `tsc --noEmit` 통과.

**남은 P1~ (구조 작업, 다음)**: 인증뱃지·EmptyState 공용 컴포넌트화, 행 액션 DropdownMenu 통일, 다이얼로그 shell 정렬, statistics 순수 hex.

---

### 벼 탭 그룹 펼침 톤 정렬 (디자인 점검 PR2) `refactor`

**출처**: `docs/벼탭-디자인점검.html` §4.2.6(펼친 그룹 primary 액센트 금지)/§4.2.7(모바일 묶음 컨테이너). 잡곡 `misc-stock-list-client` 기준 이식.

**변경** (`raw-stocks/stock-list-client.tsx` 5곳):
- 데스크탑 그룹 행: `bg-primary/[0.04]` → `bg-slate-50/60`(펼침)·`bg-slate-50`(평소), border `primary/20` → `slate-200/70`
- 모바일 그룹 카드: `border-blue-300 bg-primary/[0.08]` → 흰 배경 + shadow만으로 깊이 표현
- 모바일 하위 컨테이너: `border-l-4 border-blue-200` 좌측 라인 → `bg-slate-50/70` 회색 묶음 컨테이너
- 그룹 합계 숫자(데스크탑·모바일) `text-primary` → `text-slate-900`

**검증**: `tsc --noEmit` 통과.

---

### 벼 탭 레거시색 → 디자인 토큰 치환 (디자인 점검 PR1) `refactor`

**배경**: `docs/벼탭-디자인점검.html`(디자인 시스템 갭 분석) P0 §1.1 — 벼 탭이 레거시 시안톤(`#00a2e8`)을 하드코딩해 시스템과 어긋남. 잡곡 탭은 이미 토큰 기반.

**범위**: 벼 탭 3개 디렉토리만 (`raw-stocks/**`, `milling/**`, `sales/release/**`). admin·statistics·제품재고·구조 변경은 제외.

**변경**: 25개 파일 173곳 치환.
- `#00a2e8`·`#008cc9`·`#007ab3` → `primary`
- `#f0f9ff` → `blue-50`
- `#8dc540`·`#7db037` → `emerald-600`/`emerald-700` (유기농 인증색)
- opacity 전부 보존(`/[0.04]`·`/20` 등), 매핑 외 `#2a2a2a` 보존

**방식**: 역방향 치환 스크립트(dry-run 검토 → `--commit`, 실행 후 삭제). 벼 탭은 순수 hex 없이 className arbitrary뿐이라 패턴 치환 100% 커버.

**검증**: `tsc --noEmit` 통과 + 벼 탭 레거시 hex 잔여 0건(grep).

**남은 작업**: P1~(합계 slate-900 톤다운, 그룹 펼침 톤, 모바일 좌측라인 제거, 인증뱃지 CERT_BADGE_CLASS 공용화, 1줄 헤더, 행 액션 Dropdown 통일, 다이얼로그 shell), statistics 순수 hex, 제품재고 벼 탭(판매관리 연동 시).

**문서**: `docs/벼탭-디자인점검.html`(점검 원본), `docs/plan-벼탭-색상치환.md`, `docs/report-벼탭-색상치환-2026-05-21.md`

---

### 탭 아이콘 통일 + PC 사이드바 자동펼침 `feat`

**작업 A — 벼/잡곡 탭 아이콘 통일**: 원물재고·제품재고 탭 아이콘을 판매관리(`Wheat`/`Sprout`)와 동일하게 교체. `RiceIcon`/`GrainIcon`(category.tsx) → lucide `Wheat`/`Sprout`. F안 스타일 유지, lucide 기본 24px이라 크기 `w-3.5 h-3.5` 명시. 유일 사용처였던 `components/icons/category.tsx` 삭제. (raw-stocks-tabs.tsx, packages-tabs.tsx)

**작업 B — PC 사이드바 자동펼침**: `desktop-sidebar.tsx`의 통계·관리자 서브메뉴를 항상 펼침 → 경로 진입 시 자동 펼침 + 화살표(Chevron) 클릭 토글. `useState` 초기값(경로 기반) + `useEffect`로 SPA 이동 시 자동 펼침 동기화.

**검증**: `tsc --noEmit` 통과. 디자인 문서 §6은 아직 `GrainIcon`이라 코드와 불일치 — 핸드오프 산출물이라 코드 우선, 추후 디자인 측 정합.

**문서**: `docs/plan-탭아이콘통일-사이드바자동펼침.md`, `docs/report-탭아이콘통일-사이드바자동펼침-2026-05-21.md`

---

### 도정 포장내역 표시 버그 핫픽스 `fix`

**증상**: 도정목록에서 포장 다이얼로그를 열면 포장단위별 포장내역이 안 보이는 배치가 많음.

**원인 (회귀)**: 어제 `6428ba3`(도정 상태 3단계)에서 `getMillingLogs` stocks 조회에 `orderBy: [farmer.name, bagNo]` 추가 → `computeLotGroups`가 "정렬된 stocks의 첫 stock"을 그룹 대표로 잡는데 정렬이 바뀌어 대표 ID 변동 → 과거 `output.stockId`(옛 대표)와 단일 매칭 실패로 화면 누락. lot 그룹에 stock이 여러 개인 배치에서만 발생.

**수정** (`add-packaging-dialog.tsx` 1파일):
- `LotGroup`에 `stockIds: number[]` 추가, `computeLotGroups`가 그룹의 모든 stock.id 수집
- `getGroupOutputs`를 단일 대표 매칭 → **그룹 stockId 집합 매칭**으로 변경 (정렬·대표 변동에 무관)
- 어제 추가된 stocks orderBy는 그대로 유지 (부작용 없음)

**진단/검증** (read-only 스크립트, 실행 후 삭제):
- 122배치 중 **67배치, 180건** 표시 누락 확인 — **데이터 손실 아님**(DB output은 정상, 화면 매칭만 깨짐)
- 수정안 적용 후 안 보이는 건수 **0** (180건 전부 복구), `tsc --noEmit` 통과

**문서**: `docs/report-도정포장내역표시버그-2026-05-21.md`

---

## 2026-05-20

### 윤영식 유기농 IPS 92건 lot 번호 통일 마이그레이션 `chore`

**배경**: 같은 농가(윤영식)·품종(IPS)·인증(유기농) 조합인데 입고일자가 5일치(2025-10-20 / 10-21 / 10-22 / 11-04 / 2026-01-20)로 분산 등록되어 lot 번호가 5개로 분기됨. 정책상 같은 농가/품종/인증은 처음 입고일 기준으로 lot 통일 필요.

**변경 내용** (일회성 데이터 정정, 코드 변경 없음):
- Stock 80건: lotNo + incomingDate → 모두 `2025-10-20` 기준으로 통일 (12건은 이미 일치)
- MillingOutputPackage 2건: lotNo 첫 6자리만 갱신 (productCode 등 나머지 보존)
- 결과: 92건 모두 `251020-18-15102443-11` 단일 lot
- auditLog 1건 기록

**알고리즘**: 기존 lot의 4-segment(`YYMMDD-productCode-certNo-personalNo`)에서 첫 segment만 교체. 외과적 변경.

**스크립트**:
- `scripts/inspect-lot-yoonyoungsik-ips.js` — 사전 조사 (read-only)
- `scripts/backfill-lot-yoonyoungsik-ips.js` — 백필 (dry-run 기본 / --commit 플래그)

**검증**: 트랜잭션 적용 후 inspect 재실행 → 92건 모두 단일 lot 확인 ✅

**문서**: `docs/plan-lot번호통일-윤영식유기농.md`, `docs/report-lot번호통일-윤영식유기농-2026-05-20.md`

**후속 검토 필요**:
- 외부 출하 라벨/송장과 lot 불일치 여부 (마감 배치 108·110의 패키지 2건)
- 입고 등록 정책 자체 변경 (같은 농가·품종·인증 조합이면 첫 lot 재사용) — 별도 plan

---

### 도정 작업 상태 3단계 마이그레이션 — 도정중/포장중/마감됨 `feat`

**배경**: 기존 코드에서 `isClosed` 단일 플래그로 "완료/마감/포장"이 혼용되어 사용자/엑셀/대시보드 간 라벨이 제각각. 데이터 모델 변경 없이 `isClosed` + `outputs.length` 조합으로 3단계 도출.

**A. 공통 배지 컴포넌트 신설**:
- `components/ui/milling-status-badge.tsx` — `MILLING_STATUS` 상수 + `getMillingStatus()` 헬퍼 + `<MillingStatusBadge>` 컴포넌트
- 시안 색상 그대로: `milling`(sky) / `packaging`(amber + animate-pulse) / `closed`(emerald)

**B. 표시 교체 (5파일)**:
- `recent-logs-list.tsx` 대시보드 최근 로그 모바일/PC 인라인 배지
- `milling-table-row.tsx` PC 테이블 행
- `mobile-milling-card.tsx` 모바일 카드
- `milling-filters.tsx` Select 옵션 2→3개 (`milling`/`packaging`/`closed`)
- `active-milling-filters.tsx` 적용 필터 라벨 3단계 + `open` legacy alias("진행중") 유지

**C. 쿼리 분기 (2파일)**:
- `actions/milling.ts` `getMillingLogs` where 분기 3단계 + legacy alias(`open`/`active`/`completed`) 포함
- `actions/milling-excel.ts` 동일 분기 + `statusStr` 3분기 + 엑셀 컬럼 `진행상태` → `도정상태`

**D. 동시 수정**:
- 기존 status 필터 키 불일치 버그(URL `open`/`closed` ↔ 액션 `active`/`completed`) 발견 → legacy alias 모두 매칭으로 함께 해결
- `actions/dashboard.ts` outputs `orderBy` (farmer.name asc, bagNo asc) 추가 — 표시 순서 안정화

**핵심 결정**:
- 동사형 라벨("마감완료"/"포장하기"/"마감 해제") 그대로 유지 (상태 명사만 통일)
- URL `?status=open` 북마크 호환을 위해 legacy alias 유지
- `auditLog` 백필 없음 — 신규 변경분부터 세분화

**근거**: `docs/handoff/status-migration.md` (3단계 시안)
**문서**: `docs/plan-도정상태3단계.md`, `docs/report-도정상태3단계-2026-05-20.md`
**검증**: `tsc --noEmit` 통과 / 실서버 QA(필터·배지 전환·엑셀)는 사용자 측 미실시

---

## 2026-05-08

### 잡곡 재고관리 #9.5 — 권한 체계 정리 (그림 B + 매트릭스 문서) `feat`

**배경**: 잡곡 입고·포장·매입·판매 라인업이 정리되면서 단일 `STOCK_MANAGE` 권한으로 모든 업무를 통제하던 구조가 한계. 사용자 결정으로 **그림 B**(들여오기 STOCK_MANAGE / 가공 MILLING_MANAGE / 내보내기 SALES_MANAGE 신규) 채택.

**A. 단일 진실 원천 신설**:
- `docs/permission-matrix.md` — 권한 키 정의 + 페이지·버튼·행별 매핑 + server action 매핑 + 변경 이력. 향후 권한 변경 시 이 문서를 먼저 갱신

**B. 권한 키 마스터 갱신** (`lib/permissions.ts`):
- 상단 정책 요약 주석 + 매트릭스 docs 링크
- `STOCK_MANAGE` label "재고 관리" → "원물 관리" (출고 분리)
- `MILLING_MANAGE` label "도정 관리" → "도정·포장 관리"
- **`SALES_MANAGE` 신규 추가** (BUSINESS_PERMISSIONS)

**C. Server actions `requirePermission` 가드 일괄 주입** (5파일, 28함수):
- `stock.ts` (4) → STOCK_MANAGE
- `misc-stock.ts` (3) → STOCK_MANAGE
- `packages.ts` MILLED 3개 → MILLING_MANAGE / PURCHASED 3개 → STOCK_MANAGE
- `release.ts` (5) → SALES_MANAGE 신규
- `milling.ts` (10 직접 + 2 wrapper 자동) → MILLING_MANAGE
- read 함수는 `requireSession` 유지

**D. 클라이언트 가드 — 이중 권한 페이지 도입**:
- `/raw-stocks` 잡곡 탭: `canMill = MILLING_MANAGE` 신설, **포장 버튼 가드 STOCK_MANAGE → MILLING_MANAGE**, 입고/수정/삭제는 STOCK_MANAGE 그대로 (`misc-stock-list-client`/`misc-stock-table-row` prop drill)
- `/packages` 잡곡 탭: `canMill`/`canPurchase` 이중 권한 + `[+ 포장하기]`(MILLING) / `[+ 매입 등록]`(STOCK) 버튼 분리 가드 + 행 메뉴 source별 toast 안내 (`misc-package-panel`)
- `/sales/release`: STOCK_MANAGE → SALES_MANAGE (3파일)
- `/raw-stocks` 벼 페이지: 출고/출고취소 버튼만 SALES_MANAGE 분리 (`stock-page-client`)

**핵심 결정사항**:
- 코드명 `STOCK_MANAGE` 유지(label만 변경) → DB의 `User.permissions` 배열 호환성
- 메뉴 ≠ 단일 권한 (이중 권한 페이지가 자연 발생) → 매트릭스 문서로 일관성 확보
- `/packages` 콜백 가드는 panel 단에서 처리 (prop drill을 list-client/row까지 가져가지 않음 — 수술적 변경)

**운영 마이그레이션 필요**:
- `STOCK_MANAGE`만 보유한 출고 담당자에게 `SALES_MANAGE` 별도 부여 필요. ADMIN이 `/admin/users`에서 수동 부여.

**검증**: `tsc --noEmit` 통과 / 본 작업으로 새로 발생한 lint 에러 0건.

**계획서**: `docs/plan-잡곡재고관리-#9.5.md` / **결과보고서**: `docs/report-잡곡재고관리-#9.5-2026-05-08.md` / **매트릭스**: `docs/permission-matrix.md`

---

### `/releases` 디렉토리 정리 — `sales/release/` 이전 + dead route 삭제 `chore`

**배경**: 잡곡 #9(2026-05-07, `c6c5292`)에서 `/sales` 신설 시 308 리다이렉트 + import 재사용으로 임시 처리. 컴포넌트 위치-실 사용처 미스매치를 해소하기 위한 후속 클린업.

**변경 (총 11파일)**:
- `git mv` 8개 — `app/(dashboard)/releases/*.tsx` → `app/(dashboard)/sales/release/*.tsx` (release-page-wrapper / release-page-client / release-history-list / release-filters / release-excel-button / active-release-filters / mobile-release-card / edit-release-dialog). git이 모두 R(rename) 인식, 내부 `./` 상대 import 그대로 유효
- `git rm` 1개 — `app/(dashboard)/releases/page.tsx` (308로 도달 불가 dead route)
- 디렉토리 자동 삭제 — `app/(dashboard)/releases/`
- import 경로 수정 — `app/(dashboard)/sales/release-section.tsx`의 3줄 (`../releases/` → `./release/`)
- dead 매핑 제거 — `components/breadcrumb-display.tsx`의 `PAGE_CONFIG['/releases']` 항목 5줄 삭제

**유지**:
- `next.config.ts` 308 리다이렉트 (`/releases` + `/releases/:path*` → `/sales`) — 북마크 호환
- `app/actions/release.ts` — server action, 디렉토리와 무관

**결정사항**: 이전 위치는 `sales/release/` 서브폴더(평탄화 X). 출고는 sales의 한 탭이라는 의미 구조 유지. 향후 벼·잡곡 본구현 시 `sales/rice/`, `sales/misc/` 같은 동일 패턴으로 확장 가능.

**검증**: `tsc --noEmit` 통과 / 본 작업으로 새로 발생한 lint 에러 0건 (이동 파일들의 기존 경고는 수술적 변경 원칙으로 유지).

**계획서**: `docs/plan-releases-디렉토리정리.md` / **결과보고서**: `docs/report-releases-디렉토리정리-2026-05-08.md`

## 2026-05-07

### 잡곡 재고관리 #9 — 사이드바·모바일 네비 개편 + 판매관리 라우트 이관 `feat`

**배경**: 메모리/계획서상 다음 재개 지점이 #9 사이드바·네비 개편. 작업흐름 순서(원물→도정→제품→판매)로 메뉴 재배치 + Set C 듀오톤 주입 + `/sales` 라우트 신설(기존 `/releases`를 "출고" 탭으로 이관) + "출고분석"→"판매분석" 라벨 변경. 단일 커밋.

**`/sales` 신설 (`app/(dashboard)/sales/`)**:
- `page.tsx` server component — `searchParams.tab` 분기(`rice`/`misc`/`release`, default `release`)
- `sales-tabs.tsx` — F안 애니메이션 탭 (handoff §4.1)
- `release-section.tsx` — 기존 `/releases` 컴포넌트(`ReleasePageWrapper`/`ReleaseFilters`/`ReleaseExcelButton`) **import 재사용** (디렉토리 이동 X)
- `coming-soon-panel.tsx` — 벼/잡곡 탭 placeholder

**`/releases` 호환**:
- `next.config.ts` redirects: `/releases` + `/releases/:path*` → `/sales` 308
- `app/actions/release.ts`: `revalidatePath('/releases')` 3곳 → `'/sales'`
- `release-filters.tsx`: `usePathname()` 도입해 `router.push('${pathname}?...')` — 출고 탭 검색이 `/sales` 경로 유지

**사이드바 (`components/desktop-sidebar.tsx`)**:
- 6 메뉴: 홈(lucide Home) + 원물재고/도정관리/제품재고/판매관리(Set C 듀오톤) + 통계(StatsIcon)
- 듀오톤에 `active` prop 전달 → 활성 시 fill currentColor (primary 채움)
- 통계 하위: 수율분석/재고분석/**판매분석**
- active 색 `text-blue-600` → `text-primary` 통일
- MANAGEMENT 섹션(품종/생산자/관리자) 권한 가드 그대로

**모바일 네비 (`components/mobile-nav.tsx`)**:
- 5탭(홈 제거): 원물/도정/제품/판매(Set C 듀오톤) + 통계(StatsIcon)
- statsSubItems "출고분석" → "판매분석"
- Goo blob + cubic-bezier + safe-area 그대로 유지

**라벨 + 임시 카드 정리**:
- `output-stats-client.tsx:324` — `fileNamePrefix` `출고분석_` → `판매분석_`
- `app/(dashboard)/page.tsx` — TEMP `/packages` 임시 링크 카드 + `Package` import 제거 (#6에서 깔아둔 임시)

**사용자 추가 요청** (잡곡 원물재고 PC 모드 + 브레드크럼):
- `misc-stock-list-client.tsx`: PC 헤더 "생산자" `text-center` → `text-left`, Lot 헤더 `w-[60px] px-1` → `w-[110px] px-2`
- `misc-stock-table-row.tsx`: PC Lot 셀 `shortLot()` 제거 → 풀 표시, `cursor-help`/`title` 제거, dead 함수 `shortLot()` 정의 삭제
- `breadcrumb-display.tsx`: `PATH_DEFAULT_TAB`에 `/packages: 'rice'`, `/sales: 'release'` 추가 — 직접 진입 시 "/ 벼", "/ 출고" 자동 표시

**검증**: `npx tsc --noEmit` 통과 (수정 4회 반복, 매번 무에러)

**후속 fix** (별도 커밋): 모바일 5탭에서 홈(`/`) 진입 시 blob이 첫 탭(원물)에 박히는 문제 — `mobile-nav.tsx`에 `blobVisible = activeHref !== '/'` + 컨테이너 `transition-opacity duration-300` + `opacity` 토글로 fade-out 처리. `getActiveIndex` fallback `0` 자체는 유지(blob 위치는 첫 탭이지만 페이드아웃되어 안 보임)

**다음 재개 지점**: **#9.5 권한 분리** (`MISC_STOCK_MANAGE`/`PURCHASE_MANAGE`/`SALES_MANAGE` 등) — 사용자 합의됨 (2026-05-07)

---

### 잡곡 재고관리 #10 — 엑셀 다운로드 + 헤더 버튼 정리 (모바일 축약) `feat`

**배경**: plan §"엑셀 Seed/Import"에서 import 단계까지 예정이었으나, 25년산 데이터 13건뿐이라 import 스크립트 비용 대비 이득 적음 → **다운로드만** 처리하고 import는 폐기. 같은 흐름에서 헤더 버튼 위치/모바일 축약 정리도 함께.

**잡곡 원물재고 다운로드** (`app/actions/misc-stock.ts`, `app/(dashboard)/raw-stocks/misc/misc-stock-excel-buttons.tsx` 신규):
- `exportMiscStocks(params?: GetMiscStocksParams)` — `buildMiscWhere` 재사용해서 활성 필터 그대로 적용
- 컬럼 15개: 입고일자/생산년도/생산자/농가명/작목반/인증구분/품종/일련번호/입고유형(도정위탁/농가도정/발아위탁)/원물중량/입고중량/수율/위탁업체/로트번호/상태
- 도정위탁만 수율 자동 계산 (`weightKg / rawWeightKg * 100`)
- 빈 데이터도 헤더만 있는 시트 반환 (벼 export 패턴 동일)
- UI 컴포넌트는 다운로드 버튼 1개만 (벼 패턴의 업로드+미리보기 부분 제외 — import 안 하기로)

**제품재고 다운로드** (`app/actions/packages.ts`, `app/(dashboard)/packages/package-excel-buttons.tsx` 신규):
- `exportPackages(params: GetPackagesParams)` — 카테고리(RICE/MISC_GRAIN) + 필터 적용. **getPackages의 1달 cutoff는 미적용** (전체 노출)
- 컬럼 11개: 포장일자/출처(도정산/매입)/카테고리(벼/잡곡)/품종/생산자(매입처)/로트번호/규격/단중/개수/총중량/매입일
- source 분기: MILLED → stock 기반 / PURCHASED → variety+purchaseVendor+incomingDate
- 파일명에 `rice`/`misc` slug
- UI는 `category` prop으로 분기. 벼/잡곡 양쪽 패널에서 동일 컴포넌트 사용

**헤더 버튼 위치 정리**:
- 다운로드 버튼을 헤더 좌측으로 이동 (잡곡 원물 / 벼·잡곡 제품 모두) — 우측 끝은 추가/등록 버튼 위치라는 시각 일관성
- 변경 파일: `misc-stock-panel.tsx`, `rice-package-panel.tsx`, `misc-package-panel.tsx`

**모바일 축약** (`misc-package-panel.tsx`, `package-search-dialog.tsx`):
- `+ 포장하기` → 모바일 `+ 포장` (span "하기" `hidden sm:inline`)
- `+ 매입 등록` → 모바일 `+ 매입` (span " 등록" `hidden sm:inline`)
- 검색 버튼: `<span>검색</span>` → `<span className="hidden sm:inline">검색</span>` + 버튼 padding 모바일 축소 (`px-2 sm:pl-3 sm:pr-2`)
- 잡곡 원물 필터(`misc-stock-filters.tsx`)는 이미 동일 패턴 적용돼 있어 변경 없음

**page.tsx 보강**:
- `RicePanelLoader`/`MiscPanelLoader`에서 빌드한 `filters: GetPackagesParams`를 패널에 prop으로 전달 (`<RicePackagePanel filters={filters} />`, `<MiscPackagePanel filters={filters} />`)

**검증**:
- `npx tsc --noEmit` 통과
- 사용자 브라우저 검수 OK

**다음 재개 지점**: **#9 사이드바/모바일 네비 개편** — 새 세션에서 진행. 핸드오프 `잡곡재고관리 사이드바 & 모바일 네비.html` + plan §"#9" 참고. plan-잡곡재고관리-#9.md 신규 작성 예정.

---

### 잡곡 재고관리 #8c — 매입 수정/삭제 + 행 메뉴 + 품종관리 보완 `feat` (`fbf0b6f`)

**배경**: #8b 등록 흐름까지 마친 후 정정 흐름 + 관리자 화면 보완. 매입은 Stock 참조 없으므로 #7c와 달리 검증·트랜잭션 단순. 추가로 매입 도입에 따른 `deleteVariety` 참조 가드 보강.

**매입 수정 다이얼로그** (`app/(dashboard)/packages/edit-misc-purchase-dialog.tsx` 신규):
- open 시 `getMiscPurchaseEditContext` + `getPurchaseVendors` + `getPurchaseVarieties` 병렬 lazy fetch + prefill
- 등록 다이얼로그와 동일 구조 (datalist / 신규 품종 실시간 안내 / confirm 안전장치)
- 저장 후 toast 분기 (`varietyCreated` → "새 품종 'X' 등록 + 매입 수정 완료" / 그 외 "매입이 수정되었습니다.")

**행 메뉴 PURCHASED 활성화** (`misc-package-panel.tsx`, `package-row.tsx`, `mobile-package-card.tsx`):
- panel `handleEditRow` / `handleDeleteRow` source 분기:
  - MILLED → 잡곡 포장 수정/삭제 (#7c 흐름)
  - PURCHASED → 매입 수정/삭제 (#8c 흐름)
- 삭제 confirm 메시지 분기 ("이 매입을 삭제할까요?" 등)
- 행 메뉴 컴포넌트 (`RowActionMenu`)에서 `purchased` `disabled` 조건 + "매입 행 수정/삭제는 #8에서" 툴팁 제거 — 콜백 있으면 무조건 활성

**품종관리 UI 보완**:
- `variety-dialog.tsx` 라디오에 `PURCHASED` ("매입") 항목 추가 (관리자 수동 등록 가능)
- `variety-list-client.tsx` 라벨 매핑 3곳 + 정렬 우선순위(`typeOrder`) `PURCHASED: 6` (매입은 끝)

**`deleteVariety` / `deleteVarieties` 가드 보강** (`app/actions/admin.ts`):
- `checkVarietyReferences(id)` 헬퍼 신설 — Stock + MillingOutputPackage(varietyId) 카운트 + 한글 안내 문자열 반환
- 단건 삭제: 가드 호출 → 차단 시 `"흑보리: 재고 N건 / 포장 M건에서 사용 중이라 삭제할 수 없어요."` 안내
- 다중 삭제: 기존 `stockCount`만 체크하던 부분 동일 가드로 교체. 매입 케이스 잘못된 사유 표시 버그 해소

**다중 삭제 토스트 분기 버그 수정** (`use-bulk-delete-varieties.tsx`):
- 발견: `success.length=0, failed.length=1`일 때 `"0개 품종이 삭제되었습니다.\n\n삭제 실패..."` 같이 한 토스트로 묶여 어색
- 수정: success 카운트 / failed 카운트별 분리 토스트 (성공만→success / 실패만→error / 둘 다→두 개)
- AlertDialog 안내 문구도 "재고가 등록된 품종" → "재고/포장에 사용된 품종"으로 매입 포함 보완

**검증**: `npx tsc --noEmit` 통과. 사용자 브라우저 검수 OK (다중 삭제 토스트 분기 버그 발견 후 추가 수정).

**잡곡 #8 전체 완료** — 매입 등록·수정·삭제 + 행 메뉴 + 품종 격리 인프라 + 품종관리 UI + 참조 가드 보강. 다음 단계는 메모리 갱신 후 사용자와 결정.

---

### 잡곡 재고관리 #8b — 매입 등록 다이얼로그 + 패널 활성화 `feat` (`8318e7b`)

**배경**: #8a에서 깔아둔 매입 actions 5종을 사용자가 호출할 수 있는 진입점 마련. 잡곡 탭 헤더 `[+ 매입 등록]` 활성화 + 다이얼로그 신규.

**다이얼로그** (`app/(dashboard)/packages/misc-purchase-dialog.tsx` 신규):
- open 시 `getPurchaseVendors` + `getPurchaseVarieties` 병렬 lazy fetch
- 매입처 / 품종 모두 HTML datalist 자동완성 — 가벼움 + 키보드/터치 호환 OK
- 신규 품종 실시간 안내: 자동완성 매칭 X 시 amber `"새 품종 'XX' 으로 등록돼요"`, 매칭 시 회색 `"기존 품종 사용"` (대소문자 무시)
- 포장단위 7칸 그리드 (잡곡 포장과 동일 셋, 인라인 정의)
- "기타" 선택 시 규격 라벨 + 단중(kg) 두 칸
- 개수 인풋 `w-[140px]` 고정폭, 우측 상단 총 포장중량 미리보기 (#7d 정착 패턴)
- 저장 시 신규 품종이면 `confirm("새 품종 'XX'을(를) 추가하고 매입 등록할게요. 계속할까요?")` 마지막 안전장치
- 저장 후 toast 분기: `varietyCreated`면 "새 품종 'XX' 등록 + 매입 등록 완료" / 아니면 "매입이 등록되었습니다."

**패널 연결** (`misc-package-panel.tsx`):
- `[+ 매입 등록]` 버튼 `disabled` 제거 + onClick에서 다이얼로그 open
- `MiscPurchaseDialog` 마운트 (varieties prop 불필요 — 다이얼로그 내부 fetch)
- title 툴팁 "준비중 (#8에서 활성화)" 제거

**검증**:
- `npx tsc --noEmit` 통과
- 사용자 브라우저 검수 OK (시나리오 1~5 동작 확인 — 다이얼로그 진입, 자동완성, 신규 품종 안내, 충돌 가드 한글 토스트, 정상 등록 흐름)

**다음 진행**: #8c 매입 수정 다이얼로그 + 행 메뉴 PURCHASED 활성화 + 품종관리 UI에 "매입" 라디오 + `deleteVariety`/`deleteVarieties` 가드 보강.

---

### 잡곡 재고관리 #8a — 매입 격리 인프라 + 매입 Server Actions `feat`

**배경**: 외부매입 잡곡(`source=PURCHASED`) 등록 흐름의 토대 마련. 매입 품종을 `Variety.type='PURCHASED'` 플래그로 격리해서 다른 화면에 안 섞이게 인프라 구축 + 매입 CRUD 액션 5개 신설. 사용자 결정: D안(텍스트 입력 + findOrCreate) + 노출 격리 + name 충돌 시 한글 곡종명 안내 후 차단.

**격리 인프라**:
- `lib/variety-labels.ts` 신규 — `VARIETY_TYPE_LABELS` 매핑(메벼/찰벼/인디카/잡곡/기타/매입) + `getVarietyTypeLabel()` 헬퍼
- `app/actions/admin.ts`:
  - `deriveVarietyCategory()` 보강: `type='PURCHASED'`도 `category=MISC_GRAIN`로 분류
  - `getRiceVarieties()` 신설 (`where: { category: 'RICE' }`) — 벼 화면 전용
- `app/actions/misc-stock.ts:475` — `getMiscVarieties` where에 `type: { not: 'PURCHASED' }` 추가 (블랙리스트, 사용자 결정: type 더 안 늘어남)
- 호출자 3곳 교체: `raw-stocks/page.tsx`, `milling/page.tsx`, `packages/page.tsx`(RicePackagePanel 분기) — 모두 `getVarieties()` → `getRiceVarieties()`
- `/admin/varieties/page.tsx`는 그대로 (관리자 전체 노출 의도)

**매입 Server Actions** (`app/actions/packages.ts`):
- `getPurchaseVarieties()` — `type='PURCHASED'` distinct, 다이얼로그 자동완성용
- `createMiscPurchase(input)` — zod 검증 → `findOrCreatePurchaseVariety` (같은 type 매칭 우선 / 다른 type 충돌 시 한글 곡종명 포함 안내) → `MillingOutputPackage.create(source=PURCHASED, batchId/stockId/lotNo=null)` → `varietyCreated: boolean` 반환
- `getMiscPurchaseEditContext(id)` — 수정 prefill (variety include + readonly 가드)
- `updateMiscPurchase(id, input)` — findOrCreate 동일 흐름 + update
- `deleteMiscPurchase(id)` — Stock 참조 없으므로 단순 delete

**보장**:
- 매입 품종은 잡곡 입고·벼 화면 어디에도 노출 안 됨 (블랙리스트/카테고리 둘 다 가드)
- `Variety.name @unique` 충돌은 사전 검증 → 한글 안내 후 차단 (`"이미 '잡곡' 곡종으로 등록된 품종이에요. 다른 이름을 사용해주세요."`)
- 통계/대시보드는 기존 `batch null` / `category='RICE'` 필터로 자동 격리 — 추가 변경 불필요

**문서화**:
- `docs/plan-잡곡재고관리-#8.md` 신규 — 단일 진실 원천
- `docs/research-잡곡재고관리-#8.md` 신규 — 사전조사 결과 (위험도별 호출부 정리)

**검증**: `npx tsc --noEmit` 통과. 실데이터 검증은 #8b 다이얼로그 완성 후.

**다음 진행**: #8b 매입 등록 다이얼로그 + 패널 `[+ 매입 등록]` 활성화.

---

### 잡곡 재고관리 #7d — 모바일 UI 정리 (다이얼로그 fit + 원물 카드 재배치) `style` (`4e2615b`)

**배경**: #7d 잔여 항목인 모바일 다이얼로그 fit 검수 중 발견된 자잘한 정리들. 함께 사용자 검수에서 잡곡 원물재고 모바일 카드 정보 위계 재정의 요청 받아 일괄 처리.

**잡곡 포장 수정 다이얼로그 — LOT 풀 표시** (`app/actions/packages.ts`, `edit-misc-package-dialog.tsx`):
- `MiscPackageEditContext`에 `lotNo: string | null` 추가, `getMiscPackageEditContext`에서 `stock.lotNo` 전달
- readonly 헤더에 LOT 풀 뱃지(font-mono, `ml-auto` 우측 정렬, 폭 부족 시 `flex-wrap`으로 줄바꿈)

**개수 인풋 폭 축소** (`misc-package-dialog.tsx`, `edit-misc-package-dialog.tsx`):
- `grid-cols-[1fr_auto]` → `flex justify-between`, 인풋 wrapper에 `w-[140px]` 고정. 등록·수정 양쪽 동일 적용

**벼 포장 다이얼로그 — 모바일 그룹 헤더 2줄** (`milling/add-packaging-dialog.tsx`):
- 외부 wrapper로 묶고 `flex-wrap sm:flex-nowrap` 분기
- 모바일: LOT은 1행 인라인(폭 부족 시 자연 wrap), 입력kg→예상kg는 2번째 줄 우측 정렬
- PC(`sm:` 이상): 기존 한 줄 레이아웃 그대로
- 백로그 §16 (벼 포장 다이얼로그 모바일 짤림) 같이 처리

**잡곡 원물재고 모바일 카드 통일 재배치** (`raw-stocks/misc/misc-stock-table-row.tsx`, `misc-stock-list-client.tsx`):
- `MiscStockMobileCard`에 `inExpandedGroup` prop 추가 → 단일건/그룹 서브 분기
- **단일건** (그룹 헤더 없는 케이스): `[품종(14,bold) 년도 인증]` / `[생산자(13,bold) LOT풀 입고일]` / `[재고(14,black) kg]` (우측)
- **그룹 서브**: `[생산자 #번호 LOT풀 입고일]` / `[재고]` (우측). 품종/년도/인증은 그룹 헤더에 양도
- **모바일 한정 제거**: 소스타입 뱃지, 입고량, 원물·수율 (작업현장 실무 화면 컨셉)
- **#bagNo 정책**: 단일건 생략, 그룹 서브는 생산자 다음 위치(생산자별 sequence 의미)
- LOT 짧은 뱃지(`shortLot`) → 풀 텍스트로 변경
- 입고/재고 표시: `재고(강조) / 입고량(작게) kg` 슬래시 형태로 통일했다가 사용자 결정으로 입고량 자체 제거 → 최종 `재고 kg`만
- list-client: 그룹 펼친 서브 카드 호출에 `inExpandedGroup` prop 전달
- 데스크톱 테이블은 변경 없음 (모든 정보 유지)

**검증**:
- `npx tsc --noEmit` 통과 (각 변경 단계마다)
- 브라우저 모바일 검수: 사용자가 단계별로 직접 확인하며 위계·여백·정보 노출 조정 반복

**관련 메모리/메모**:
- 메모리 `project_misc_grain_feature.md` #7d 잔여 항목(모바일 다이얼로그 fit 검수) 처리 완료. 권한 정책(STOCK_MANAGE 분리)은 #9.5로 이월 (기존 결정 그대로)
- 백로그 §16 (벼 포장 다이얼로그 모바일 짤림) 본 작업에 흡수됨 → 백로그에서 처리 표시 필요

---

## 2026-05-06

### 잡곡 재고관리 #7c — 잡곡 포장 수정·삭제 + 행 액션 메뉴 `feat`

**배경**: #7b로 등록까지는 가능해진 잡곡 포장의 정정 흐름 추가. "포장 자체가 없었던 것으로 되돌림" — 수정 시 stock 한도 재검증, 삭제 시 stock 잔량/status 복원.

**Server Action** (`app/actions/packages.ts`):
- `getMiscPackageEditContext(id)` — 수정 다이얼로그 prefill용. stockWeightKg + otherSum 산출
- `updateMiscPackage(id, input)` — zod + 트랜잭션. 같은 stock 다른 포장 합 + 새 totalWeight ≤ stock.weightKg 검증 → update → status 재평가(0이면 CONSUMED, 양수면 AVAILABLE 복원). 동시성 가드는 status 분기 둘 다 조건부 updateMany
- `deleteMiscPackage(id)` — 트랜잭션. delete → MILLED는 `status='CONSUMED' → 'AVAILABLE'` 조건부 복원. PURCHASED는 단순 delete (stock 참조 없음)
- 본 #7c는 MILLED만 활성. PURCHASED 수정 폼은 #8 매입 다이얼로그와 함께

**수정 다이얼로그** (`edit-misc-package-dialog.tsx` 신규):
- open 시 `getMiscPackageEditContext` lazy fetch + prefill ("불러오는 중…" 표시)
- 포장단위 7칸 그리드 + 기타 직접입력 (등록 다이얼로그와 동일 셋)
- 한도 미리보기 박스: `원물 NN kg − 다른 포장 MM kg = 한도 LL kg`. 초과 시 빨간색 + 저장 비활성

**행 액션 메뉴** (`package-row.tsx` / `mobile-package-card.tsx`):
- 그리드에 8번째 액션 컬럼(36px 고정) 추가. `PKG_GRID` 업데이트
- `PackageRowActions { onEdit, onDelete }` 콜백 prop 흐름: panel → list-client → row → `RowActionMenu`
- 콜백 없으면 메뉴 자체 안 그림 → **벼 탭 자동 비활성** (도정관리 정책 유지)
- PURCHASED는 메뉴 항목 `disabled` + 툴팁 "매입 행 수정/삭제는 #8에서"
- 그룹 헤더 메뉴는 빈 셀(그룹 단위 액션은 의미 X), 펼친 서브행에만 노출
- 모바일 카드: 우측 상단 합계 옆에 `MoreVertical` 미니 버튼

**잡곡 패널** (`misc-package-panel.tsx`):
- `handleEditRow(row)` → `EditMiscPackageDialog` 마운트
- `handleDeleteRow(row)` → `confirm` 다이얼로그 → 액션 호출 → router.refresh()
- MILLED 외(`PURCHASED`)는 가드 조건으로 함수 자체 early return

**관련 메모 (백로그·plan)**:
- 백로그 §14 신설: 비판매 차감 처리(증정/분실/파손). 본 #7 범위 외 — **#9 판매처리와 통합 설계** (PackageMovement 같은 일반화 모델 추천). 사용자 결정 (2026-05-06)
- 백로그 §15 신설: 페이지별 추가 액션 버튼 색상 통일성 검토 — 디자인 시스템 단위 후속
- plan-#7.md §부록: 본 단계 범위 제외 항목 (차감 처리) 명시

**검증**:
- `npx tsc --noEmit` 통과
- 신규 lint 오류 0건 (기존 any/`@ts-ignore`, react-hooks/set-state-in-effect 잔존만)
- 브라우저 검증: 수정/삭제 동작, status 복원, 벼 탭 메뉴 비표시, PURCHASED disabled 모두 사용자 확인 완료

---

### 잡곡 재고관리 #7b — 잡곡 포장 다이얼로그 본구현 `feat`

**배경**: #7a에서 자리만 두었던 포장 트리거를 본 다이얼로그로 활성화. 양쪽 진입점(원물재고 행 / 제품재고 헤더) 공유.

**Server Action** (`app/actions/packages.ts`):
- `getAvailableMiscStocks()` — selector용. `category=MISC_GRAIN, status=AVAILABLE, remainingKg > 0`, FIFO(입고일 asc) 정렬
- `createMiscPackage(input)` — zod + 트랜잭션. 잔량 재계산 → 초과 시 차단(ε=0.001) → `MillingOutputPackage` 생성(`source=MILLED, category=MISC_GRAIN, batchId=null, varietyId=null, lotNo=stock.lotNo`) → 잔량 ≤ ε 시 `Stock.status='CONSUMED'` 조건부 update(동시성 가드). audit + revalidatePath 3개(`/raw-stocks`, `/packages`, `/`)

**다이얼로그 컴포넌트** (`misc-package-dialog.tsx` 신규):
- 진입점 ① (`initialStock` prop) — stock 정보 카드 고정
- 진입점 ② (prop 없음) — open 시 lazy fetch + 인라인 라디오 카드 목록
- 라디오 카드 한 줄: 품종 / 생산자 / 입고일 / 잔량 (lot은 selector 식별 정보로 결정적이지 않아 제외, `title` 툴팁으로 풀 표시)
- `max-h-[240px] overflow-y-auto` 스크롤
- 포장단위 7칸 그리드 (`10/5/1kg + 800/500/420g + 기타`)
- "기타" 선택 시 `규격 라벨` + `단중(kg)` 입력
- 총 포장중량 미리보기(초과 시 빨간색)
- 잔여 미리보기 박스: `포장 후 잔여 N kg / 소진 처리됨` 뱃지

**진입점 마운트**:
- `misc-package-panel.tsx`: `[+ 포장하기]` → 다이얼로그 open + `router.refresh()`
- `misc-stock-list-client.tsx`: `handlePackage(stock)` → stock 미리 지정한 다이얼로그

**잡곡 원물재고 그룹 서브행 시각 정리** (`misc-stock-table-row.tsx`):
- 다중 그룹 펼침 서브행에서 년도·품종 셀 비움 → 그룹 헤더의 년도·품종과 중복 제거, 묶음 시각 구분 강화
- 단일 건 그룹은 그대로(헤더 미표시 케이스)

**선택지 결정**:
- selector UX는 옵션 B(인라인 카드 목록) 채택. C(Combobox) / D(2단계) 대비 데이터 규모 작은 잡곡에 적합
- 폼 리셋은 `useEffect` 대신 `onOpenChange` 콜백에서 직접 처리. 단 selector용 fetch는 부모가 `open` prop을 직접 토글하므로 useEffect 사용(eslint-disable 1줄)

**검증**:
- `npx tsc --noEmit` 통과
- `npx eslint` 신규 오류·경고 0건 (기존 any/`@ts-ignore` 잔존만)

---

### 제품재고 컬럼 정리 — 순서·라벨·정렬·비율 `style`

**배경**: #7 작업 진행 중 사용자 결정으로 컬럼 디자인 핸드오프(§4.2.3)와 다르게 재정의. plan 본문 "번들과 충돌 시 계획서·CLAUDE.md 우선" 정책 적용.

**변경** (`app/(dashboard)/packages/package-row.tsx`):
- 순서: `품종 / 규격 / 개수 / 생산자 / 로트 / 날짜 / 합계` → **`품종 / 생산자 / 로트번호 / 규격 / 개수 / 총량 / 포장일자`**
- 라벨: `합계` → `총량`, `날짜` → `포장일자`
- 그리드 비율: `[1fr_0.55fr_0.6fr_1.1fr_1.2fr_0.9fr_0.9fr]` → `[0.7fr_0.85fr_1.5fr_0.55fr_0.6fr_0.9fr_0.85fr]`
  - 짧은 데이터(품종·생산자) 셀 압축, lot 셀 확장 (긴 코드 풀 표시)
- 헤더 정렬을 데이터 셀과 일치 (좌·중앙·우 분기). 핸드오프와 별개 결정
- 그룹 헤더의 메타데이터(`{N}종 규격`, `{totalQty}개`) 자동으로 규격/개수 셀로 따라옴, 마지막 포장일자 셀은 dash

**적용 범위**: 벼/잡곡 탭 공통(컴포넌트 동일)

**디자인 핸드오프 충돌 보고**: §4.2.3 명세는 `품종/규격/개수/생산자/로트/날짜/합계`. 본 변경으로 사용자 결정이 핸드오프와 분기됨. 핸드오프 문서는 historical reference로 유지.

---

### 잡곡 재고관리 #7a — 컬럼 정리 + 재고 노출 + 상태 셀 포장 트리거 `feat`

**배경**: #7 잡곡 포장 다이얼로그 착수. #7a는 본 다이얼로그 머지(#7b) 전 사전 정리 — 잔량(재고) 노출, 컬럼 슬림화, 상태 셀을 포장 트리거로 전환. 계획서: `docs/plan-잡곡재고관리-#7.md`.

**신규 파일**:
- `docs/plan-잡곡재고관리-#7.md` — #7 본 계획서. 4단계 분할(#7a/b/c/d), 데이터 일관성(삭제·수정 시 status 재평가) 명시.

**Server Action**:
- `app/actions/misc-stock.ts`:
  - `getMiscStocks` 반환에 `outputPackages: { totalWeight }` include + 매 조회 시 `remainingKg = max(0, weightKg - sum(totalWeight))` 산출. DB 컬럼 미추가 (정합성 리스크 회피)
  - `MiscStockGroup` 타입에 `remainingTotal` 필드

**컬럼 정리** (`misc-stock-table-row.tsx`):
- 수율 컬럼 제거 → "재고(kg)" 신설(primary 강조, 0이면 회색)
- 원료(kg) 셀에 점선 밑줄(`underline decoration-dotted`) + `title` 툴팁("수율 87.5%"). 도정위탁(CONSIGNMENT)에만 적용
- Lot No 컬럼 110→60px 축소, 짧은 뱃지(끝 4자리, 6자리 이하면 그대로) + `title` 툴팁(전체 lot)
- 모바일 카드: 메인 표시를 입고 → 재고로, 부분 포장 시 입고는 `line-through`로 옆에 작게

**상태 셀 포장 트리거**:
- `AVAILABLE && remainingKg > 0 && canManage` → "포장" primary 버튼(클릭 가능, hover/active 효과)
- `AVAILABLE && !canManage` → "보관중" 뱃지 (권한 없음)
- `CONSUMED` → "소진됨" 뱃지 (기존)
- 점세개 메뉴의 "포장하기" 항목은 중복 제거(수정/삭제만 남김)
- 모바일 펼친 그룹의 카드에도 액션 props 흐름 추가 (이전엔 `canManage`/`onEdit`/`onDelete` 미전달로 펼친 후 액션 불가했음)

**그룹 헤더 합계**:
- 입고 합계(slate-500 톤다운) + 재고 합계(primary 강조) 동시 표시

**제품재고 잡곡 패널** (`misc-package-panel.tsx`):
- `[+ 포장하기]` disabled 풀고 onClick → 토스트 "#7b에서 활성화"

**계획 변경 (1건)**:
- `app/actions/packages.ts` 액션 skeleton(create/update/delete Misc Package) 사전 추가는 폐기. 본구현(#7b·#7c)에서 한 번에 추가하는 게 lint warning 회피·코드 응집도 측면에서 깔끔. plan-#7.md §5 단계별 작업의 #7a에서 skeleton 항목 제거 필요(#7b 작업 시 함께 정리)

**검증**:
- `npx tsc --noEmit` 통과
- `npx eslint` 신규 오류·경고 0건 (기존 any/`@ts-ignore` 잔존만 존재)
- 브라우저 검증: 컬럼 헤더 정상, 원료/Lot 툴팁 동작, 포장 트리거 클릭 시 토스트, 점세개 메뉴 수정/삭제만 노출 (사용자 확인 완료)

---

## 2026-05-04

### 잡곡 재고관리 #6d — 대시보드 차트 라벨 분리 (백로그 §3) `chore`

**배경**: 백로그 §3 — 대시보드 원곡재고 카드 라벨이 "원곡 재고" 단일. 잡곡 도입 후 벼/잡곡 구분 모호. #6에서 함께 처리하기로 한 항목.

**변경**:
- `app/(dashboard)/_components/realtime-status.tsx`: "원곡 재고" → "**벼 원곡 재고**" (모바일 line 183, 데스크톱 line 437 두 곳)
- 잡곡 별도 카드 신설은 통계/대시보드 후속 단계로 미룸

**검증**: `npx tsc --noEmit` 통과. 백로그 §3 ✅ 완료 표시.

### 잡곡 재고관리 #6c — 검색 다이얼로그 + 적용 필터 칩 + 정렬 옵션 `feat`

**배경**: #6b 셸 위에 핸드오프 §3.4(헤더 액션)·§4.6(검색 다이얼로그) 적용. 사용자 검수 피드백 다수 즉시 반영(컬럼 정렬·간격·"외 N명" 모순 등).

**신규 파일**:
- `app/(dashboard)/packages/package-search-dialog.tsx` — 핸드오프 §4.6. 생산연도/품종(multi) + 정렬(select) + 출처(잡곡만 multi). 검색 버튼은 §3.4 신스펙대로 **항상 blue-50** + 활성 필터 카운트 배지
- `app/(dashboard)/packages/active-package-filters.tsx` — 검색결과 N건 + 적용 필터 칩 (Badge variant outline)

**수정**:
- `app/actions/packages.ts`:
  - `varietyId` / `productionYear` / `source` 파라미터 모두 **콤마 구분 multi-value** 지원 (`{ in: [...] }` 절 사용)
  - producer 로직 정정: 포장은 stock에 1:1 매핑이고 lot도 그 1농가 기준이라 "외 N명" 표시는 **모순** → 단일 농가 이름만 표시. 사용처 사라진 `formatProducerForBatch` 헬퍼 제거 + `batch.stocks` Prisma include 정리
- `rice-package-panel.tsx` / `misc-package-panel.tsx`: 검색 다이얼로그 + 적용 필터 칩 통합. 잡곡은 [+ 매입 등록]은 `bg-primary` (핸드오프 §3.4 추가 버튼 spec), [+ 포장하기]는 outline 보조
- `page.tsx`: `getVarieties` / `getMiscVarieties` 동시 fetch (Promise.all) 후 패널에 prop 주입
- `package-row.tsx`: 다단계 디자인 튜닝
  - 단위 "포" → "개"
  - 개수 컬럼 우측 정렬 + `pr-12` (생산자와 시각적 간격)
  - 규격 컬럼 우측 정렬 (개수와 인접 표시)
  - 생산자 / 로트 컬럼 가운데 정렬, 라벨 "로트" → "**로트번호**"
  - 그리드 비율 `[1fr_0.55fr_0.6fr_1.1fr_1.2fr_0.9fr_0.9fr]` (품종/규격 폭 축소, 생산자 폭 확대)
  - 서브행 첫 셀 "— 규격" 텍스트 라벨 제거 (들여쓰기 + dash만)
- `mobile-package-card.tsx`:
  - 단위 "포" → "개"
  - 그룹 헤더: 메타데이터(`N종·N개`)를 합계kg 옆에 묶음 (가운데 컬럼 빈 spacer로 단일 카드와 정렬 일치)
  - 모든 줄을 `grid grid-cols-[auto_1fr_auto]`로 통일 (#6b에서 작업)
- `package-search-dialog.tsx`:
  - useState/useEffect 정리: 빈 초기값 + URL 변경 시 항상 sync (SSR/CSR hydration 안전)
  - 품종 select 폭 축소 — grid-cols-2로 출처와 짝지움 (벼는 우측 빈 자리)

**정렬 옵션**: 재고량 많은순(기본) / 최신순 / 오래된순

**검증**: `npx tsc --noEmit` 통과. 사용자 브라우저 검수 완료(데스크톱 + 모바일).

### 잡곡 재고관리 #6b — 품종 그룹 펼침 테이블 + 모바일 카드 `feat`

**배경**: #6a의 빈 셸을 핸드오프 §4.2(품종 그룹 펼침 테이블)·§4.3(모바일 2줄 카드) 스펙으로 채움. 사용자 검수에서 추가 피드백 3건 즉시 반영.

**신규 파일**:
- `app/(dashboard)/packages/package-row.tsx` — `PackageColumnHeader` / `PackageGroupRow`(헤더+서브) / `PackageSingleRow`. 7열 그리드 공유, 매입 행은 LOT 자리에 amber `매입` 칩
- `app/(dashboard)/packages/mobile-package-card.tsx` — `MobilePackageSingleCard` / `MobilePackageGroupCard`. 모든 줄을 `grid grid-cols-[auto_1fr_auto]` 통일로 컬럼 정렬
- `app/(dashboard)/packages/package-list-client.tsx` — 펼침 상태 (`Set<varietyId>`) + 데스크톱 테이블/모바일 리스트 분기

**수정**:
- `rice-package-panel.tsx` / `misc-package-panel.tsx`: JSON 덤프 → `PackageListClient`. 잡곡은 빈 상태 메시지/힌트 주입
- `app/actions/packages.ts`:
  - `PackageRow.weightPerUnit` 추가 (FIFO 정렬 키)
  - **그룹 rows 내부는 항상 FIFO** `(weightPerUnit asc, date asc)` — 사용자 sort와 무관
  - 상위 items 정렬용 `repDate(item)` 헬퍼 (latest=max, oldest=min)
  - **기본 정렬: `latest` → `weight_desc`** (페이지 진입 시 큰 재고가 위)
  - **[임시] 1달 cutoff 필터** — `source=MILLED`만 `createdAt >= 오늘 - 1개월`. 판매처리 미구현 상태에서 노출 데이터 축소용. 백로그 §13에 정식 제거 시점 기록

**사용자 검수 피드백 즉시 반영**:
- 데스크톱 서브행 첫 셀 "— 규격" 텍스트 제거 (두 번째 셀 규격과 중복) → 들여쓰기 + dash만
- 모바일 카드 줄별 컬럼 정렬 통일
- 그룹 내부 정렬 FIFO + 기본 정렬 `weight_desc` (사용자 의견 반영)
- 1달 cutoff 도입(초기 2달 → 데이터 안 줄어서 1달로 단축)

**검증**: `npx tsc --noEmit` 통과. 브라우저 검수 사용자 OK.

### 잡곡 재고관리 #6a — `/packages` 라우트 + 액션 셸 `feat`

**배경**: #6 제품재고 페이지 신설 착수. 4커밋(#6a~d)으로 분할. #6a는 데이터 액션 + 라우트 셸(빈 패널)까지.

**변경**:
- `app/actions/packages.ts` 신규 — `getPackages({ category, varietyId, productionYear, source?, sort? })` 통합 조회. MILLED/PURCHASED 분기 include, 서버 사이드 품종 그룹핑(`varietyId` 기준 1행=single, 2행+=group). 정렬 옵션 `latest|oldest|weight_desc`. `getPurchaseVendors()` distinct (#8 자동완성용)
- `app/(dashboard)/packages/page.tsx` 신규 — 서버 컴포넌트, `?tab=rice|misc` 분기, RicePanelLoader/MiscPanelLoader
- `app/(dashboard)/packages/packages-tabs.tsx` 신규 — F안 탭 (raw-stocks-tabs 패턴, 탭 전환 시 필터 리셋)
- `app/(dashboard)/packages/rice-package-panel.tsx`, `misc-package-panel.tsx` 신규 — 빈 셸 + 검색결과 카운트. 잡곡은 [+ 포장]/[+ 매입] 비활성 버튼 + "준비중" title (#7·#8 활성)
- `app/(dashboard)/page.tsx` 수정 — 노티스 마키 아래에 임시 진입점 카드 ("제품재고 페이지로 이동", `Package` 아이콘). #9 사이드바 개편 시 제거
- `docs/plan-잡곡재고관리-#6.md` 신규 — 단계별 계획서, §8 확정 사항 4건

**확정 사항** (사용자 답변):
- 메뉴 진입점: 사이드바·네비는 #9 일괄 정리, 임시로 홈에 카드만
- 벼 탭 [+] 버튼: 숨김
- 정렬: 최신/오래된/중량순 — #6c에서 윤곽 보고 결정
- 4커밋 분할 진행

**검증**: `npx tsc --noEmit` 통과(EXIT=0). 브라우저: 홈 임시 카드 클릭 → `/packages` 진입, 벼 탭 JSON 덤프 정상 그룹핑, 잡곡 탭 빈 상태 + 비활성 버튼 사용자 확인 완료.

### 잡곡 재고관리 #5 결과보고서 `docs`

**배경**: #5-pre / #5a~#5e 본 흐름 + 후속 디자인·UX 정리 완료. DoD 마지막 항목인 종합 결과보고서 작성.

**변경**:
- `docs/report-잡곡재고관리-#5-2026-05-04.md` 신규 — 19개 커밋 단계별 변경 상세 / 핵심 설계 결정(계획 vs 실제) / 검증 / 영향 범위 / 미반영·이월 항목

**다음 재개 지점**: #6 제품재고 페이지 신설 (`/packages` 라우트, 벼/잡곡 탭).

### 최근 업데이트 표시에 날짜 추가 `feat`

**배경**: 페이지 하단 "최근 업데이트"가 시간(`HH:mm:ss`)만 표시. 어느 날짜 업데이트인지 알 수 없는 문제.

**변경**:
- `components/last-updated.tsx`: `toLocaleTimeString('ko-KR', ...)` → `toLocaleString('sv-SE', ...)` (sv-SE locale은 ISO `YYYY-MM-DD HH:mm:ss` 형식으로 떨어짐)
- year/month/day 옵션 추가, Asia/Seoul timeZone 유지

**출력 예**: `최근 업데이트: 11:23:45` → `최근 업데이트: 2026-05-04 11:23:45`

**검증**: `npx tsc --noEmit` 통과.

### 잡곡 목록 — 일괄 fetch (B안) + §4.2.6 디자인 적용 `refactor`

**배경**: 사용자 검증 — 잡곡 목록이 "각 행마다 불러오는 중"으로 느림. 원인은 단일 건 그룹 자동 펼침 useEffect가 그룹 N개마다 별도 라운드트립을 일으킨 것. 잡곡 데이터 규모가 작아 생산자 패턴(일괄 fetch)으로 전환. 동시에 Claude Design 핸드오프 §4.2 5/4 개편(primary 액센트 사용 X) 적용.

**B안 — 일괄 fetch 전환**:
- `misc-stock.ts`: `getMiscStockGroups`, `getMiscStocksByGroup` 제거(~140줄 감소). `MiscStockGroup` 타입은 클라이언트 그룹핑용으로 export 유지. `getMiscStocks`만 사용 (include: variety + farmer.group)
- `page.tsx`: `getMiscStockGroups(filters)` → `getMiscStocks(filters)` 호출 변경, prop `initialGroups` → `initialStocks`
- `misc-stock-panel.tsx`: prop 이름 변경, totalCount = `initialStocks.length`
- `misc-stock-list-client.tsx`: `loadedItems`/`loadingGroups` state + `fetchGroupItems` + 단일 건 자동 펼침 useEffect 모두 제거. `useMemo`로 클라이언트 그룹핑 (서버 로직 이식, 정렬 포함). `hiddenIds` state로 삭제 즉시 반영. 단일 건은 `isMulti=false`로 항상 펼침 처리

**§4.2.6 디자인 적용**:
- 펼친 그룹 헤더 + 서브행 모두 `bg-slate-50/60` 톤으로 통일 → 한 묶음 시각화
- `border-l-2 border-primary/40` 좌측 primary 라인 모두 제거 (PC 헤더·서브, 모바일 헤더 카드·펼침 본문)
- 모바일 펼침 본문 컨테이너 `bg-slate-50/70` 묶음 (§4.2.7)
- 단일 건 그룹 서브행은 `bg-white` (낱개 행 §4.2.4)
- 인증 뱃지: 그룹 헤더 품종 셀 → 생산자 셀(`N명` 뒤)로 이동, 서브행 정렬 일치
- `MiscStockTableRow`에 `inExpandedGroup?: boolean` prop 추가

**효과**:
- 첫 진입 라운드트립: 1번 + 단일 건 N번 자동 → **항상 1번**
- 다중 그룹 펼침: 1번 추가 fetch → **0번 (즉시)**
- list-client ~60줄 감소, 액션 ~140줄 감소

**검증**: `npx tsc --noEmit` 통과 (에러 0). 브라우저 검수는 사용자 확인 필요.

## 2026-04-30

### 잡곡 재고관리 #5e — 잡곡 입고 수정·삭제 `feat`

**배경**: #5 본 흐름 마무리. 잡곡 입고 수정/삭제 액션 + 행 더보기 메뉴 + edit 다이얼로그 활성화.

**변경**:
- `misc-stock.ts`:
  - `updateMiscStock(id, input)` 추가 — zod 검증, MISC_GRAIN 카테고리 + AVAILABLE 상태 체크, 로트 영향 필드 변경 시 재생성, bagNo 유지, audit log
  - `deleteMiscStock(id)` 추가 — CONSUMED 또는 outputPackages 연결 시 거절, audit log
- `add-misc-stock-dialog.tsx`:
  - `editTarget` prop + controlled `open`/`onOpenChange` 지원
  - 마운트 시 prefill (sourceType, 인증, 생산자, 품종, 입고일, 중량, 도정업체)
  - form input들을 controlled state로 전환 (incomingDate, actualFarmer)
  - 헤더 타이틀 분기 ("등록"/"수정"), `updateMiscStock` 분기 호출
- `misc-stock-table-row.tsx` (PC + 모바일):
  - `canManage`/`onEdit`/`onDelete` prop 추가
  - 더보기 메뉴 (`MoreVertical` → 수정/삭제), CONSUMED는 disabled
- `misc-stock-list-client.tsx`:
  - `useSession`/`hasPermission` 권한 체크
  - `editTarget` state + controlled edit dialog 렌더
  - delete 핸들러: confirm + `deleteMiscStock` + 캐시에서 해당 ID 제거
  - PC 헤더에 액션 헤드 추가, colSpan 12 → 13
- `misc-stock-panel.tsx`: list-client에 farmers/varieties/vendors 전달

**검증**: `npx tsc --noEmit` 통과

**다음**: 잡곡 #5 본 작업 완료. 후속은 #6(제품재고)~#13.

### 잡곡 후속 — 품종관리에 "잡곡" 곡종 옵션 추가 `feat`

**배경**: 사용자가 찰보리 품종 등록 시도 → 곡종 라디오에 잡곡 없음 발견. 백로그 §4·§5 항목 동시 처리.

**변경**:
- `app/actions/admin.ts`: `deriveVarietyCategory(type)` 헬퍼 — `type='MISC_GRAIN'`이면 자동 `category='MISC_GRAIN'`. createVariety/updateVariety에 적용
- `variety-dialog.tsx`: "잡곡" 라디오 추가 (기타 앞), DialogDescription "벼 품종" → "품종"
- `variety-list-client.tsx`: type 라벨 매핑에 `MISC_GRAIN → '잡곡'` 추가 (그룹화 + 평면 표시 두 군데), 정렬 순서 `URUCHI=1 / GLUTINOUS=2 / INDICA=3 / MISC_GRAIN=4 / OTHER=5` (기타 앞에 잡곡)

**검증**: `npx tsc --noEmit` 통과

**백로그 처리**:
- §4 처리 완료 표기
- §5 처리 완료 표기

### 잡곡 재고관리 #5 디자인 정리 (2차) — 핸드오프 누락 항목 보강 `style`

**배경**: 1차 정리(F안 탭, 색상 토큰화) 후 핸드오프 전체 재점검. 6개 누락 항목 일괄 적용.

**변경**:
- §4.2 펼친 상세 행: `bg-slate-50/60` + `border-l-2 border-primary/40` (그룹 active 강조)
- §4.2 chevron: 두 컴포넌트 교체 → `<ChevronRight>` 단일 + `rotate-90` transition (PC/모바일 모두)
- §1.2 `tabular-nums`: 합계kg, 입고kg, 원물kg, 수율, 일련번호, 그룹 카운트 등 모든 숫자
- §4.3 §4.5 LOT 칩: 모바일 카드의 mono 텍스트 → `bg-slate-100 border-slate-200 rounded px-1.5 py-[1px]` 칩
- §5.3 빈 상태: 텍스트만 → 아이콘(`Inbox`) + 메시지. 빈 상태 컴포넌트 분리
- §7 친근체: "없습니다." → "없어요.", "검색 결과가 없습니다." → "조건에 맞는 결과가 없어요. 필터를 바꿔보세요.". 다이얼로그 안내문도 친근체

**의도적 미적용** (도메인 차이):
- §4.3 모바일 상세 카드 정보 구조 — 잡곡 도메인(생산자/sourceType/원료/수율)에 맞게 자유 (사용자 결정 (나))
- 헤더 액션 4버튼 (업/다운로드)는 #10 엑셀 단계에서 추가
- 검색 필드 인증/입고유형/생산자명 — 잡곡 도메인 확장

**디자인 트랙 #0 범위** (잡곡 #5와 별개):
- Pretendard self-host (현재 CDN)
- 다크모드 토큰
- `text-slate-500` → `text-muted-foreground` 전역

### 잡곡 재고관리 #5 디자인 정리 — 핸드오프 번들 스펙 정렬 `style`

**배경**: #5b~#5d 작업 시 핸드오프 번들 스펙(F안 탭, §3.4 헤더 액션, §4.2 그룹 펼침)을 누락. globals.css 토큰은 이미 핸드오프 기준(#2563eb)이라 잡곡 코드만 토큰 사용으로 정렬하면 자동 적용됨. B안(통합 정리) 채택.

**변경**:
- `raw-stocks-tabs.tsx` 전면 재작성 — segmented control → **F안** (text-slate-400 ↔ text-slate-900, 폰트 크기 +1px, 활성 시 아래 2.5px 슬라이드 바)
- `add-misc-stock-dialog.tsx`:
  - 트리거 버튼 `bg-[#8dc540]` → 기본 default Button (auto primary)
  - 라디오 input 색상 `text-[#00a2e8]` → `text-primary focus:ring-ring`
  - 저장 버튼 임의 hex → 기본 default Button
- `misc-stock-filters.tsx`:
  - 검색 트리거 §3.4 패턴 적용 (`bg-blue-50 border-blue-200 text-primary` + 카운트 배지 white/blue-200/text-primary)
  - 로딩 spinner / 적용 버튼 임의 hex → primary 토큰
- `misc-stock-list-client.tsx`:
  - 데스크톱 그룹 헤더 amber → §4.2 `bg-slate-50 hover:bg-slate-100`
  - 모바일 그룹 카드 amber → slate
  - 펼침 카드 left border `border-l-4 border-amber-200` → `border-l-2 border-primary/40`
  - 합계kg 색상 `text-[#008cc9]` → `text-primary`
- `misc-stock-table-row.tsx`:
  - 도정위탁 sourceType 뱃지 색상 → `border-primary/30 text-primary bg-primary/10`
  - 입고중량/상태 뱃지 임의 hex → primary 토큰

**검증**:
- `npx tsc --noEmit` 통과
- `app/(dashboard)/raw-stocks/misc/`에 임의 hex 잔존 0건 (grep 확인)
- 의미 색(농가도정=emerald, 발아위탁=violet, 안내 박스=amber)은 의도적으로 유지

**남은 #5 작업**: #5e 수정/삭제

### 잡곡 재고관리 #5d — 잡곡 원물재고 목록·필터·그룹 `feat`

**배경**: #5b placeholder body를 본격 목록으로 교체. 벼 패턴 차용하되 잡곡 도메인에 맞게 단순화 (체크박스 선택·도정·장바구니·출고 모두 제거).

**변경**:
- `misc/misc-stock-filters.tsx` 신규 — 생산연도·품종·생산자명·인증·**입고유형**·상태 멀티 필터. tab=misc 유지하며 `/raw-stocks?tab=misc&...` 라우팅
- `misc/misc-stock-table-row.tsx` 신규 — 데스크톱 행 + 모바일 카드 export 두 컴포넌트
  - sourceType 뱃지 색상: 도정위탁=청, 농가도정=초록, 발아위탁=보라
  - 원료중량(rawWeightKg) 표시: 도정위탁=원물, 발아위탁=현미, 농가도정=숨김
  - 수율은 도정위탁만 (`weightKg / rawWeightKg`)
- `misc/misc-stock-list-client.tsx` 신규 — 그룹 lazy load, 펼침 시 `getMiscStocksByGroup` 호출. 데스크톱은 12컬럼 테이블, 모바일은 카드 패턴
- `misc/active-misc-filters.tsx` 신규 — 활성 필터 칩 + 검색결과 N건 카운터
- `misc/misc-stock-panel.tsx`: placeholder body 제거, 헤더에 `<MiscStockFilters />` 추가, `<ActiveMiscFilters />` + `<MiscStockListClient />` 결합
- `page.tsx` `MiscStockPanelLoader`: `GetMiscStocksParams` 추출 + `getMiscStockGroups` 5번째 prefetch 추가

**검증**:
- `npx tsc --noEmit` 통과
- 브라우저 검수: 필터·그룹 펼침·sourceType 뱃지·원료/수율 표시·모바일 카드. 잡곡 데이터 없으면 빈 상태 메시지 정상

**다음**: #5e 수정·삭제 (행 액션 메뉴, edit 모드 다이얼로그 활성화)

### 잡곡 재고관리 #5c 후속 — 발아위탁 sourceType 추가 + UI 라디오 전환 `feat`

**배경**: 사용자 도메인 검토 결과 입고 유형이 2가지가 아닌 3가지(도정위탁/농가도정/발아위탁). 발아위탁은 도정한 현미를 발아전문업체에 위탁해 발아현미로 입고하는 흐름. 컬럼 정책은 A안(`rawWeightKg`/`millingVendor`를 sourceType별로 일반화 — 도정위탁=원물중량/도정업체, 발아위탁=현미중량/발아업체).

**변경**:
- `prisma/schema.prisma` SourceType enum에 `GERMINATION` 추가 (`CONSIGNMENT`는 한글 라벨만 "도정위탁"으로 변경, 영문 enum 유지 — 기존 데이터 영향 없음)
- 마이그레이션 `20260430120000_add_germination_source_type` 생성·적용 (`ALTER TYPE ... ADD VALUE 'GERMINATION'`)
- `app/actions/misc-stock.ts`:
  - zod discriminated union에 `germinationSchema` 추가 (`rawWeightKg` 양수, `millingVendor` 1자 이상)
  - `createMiscStock`: `hasVendorAndRaw = CONSIGNMENT || GERMINATION`로 통합 분기, audit description은 sourceType별 라벨
  - `getSproutingVendors()` 신규 — sourceType=GERMINATION distinct
- `add-misc-stock-dialog.tsx`:
  - 토글 → 라디오 3개 (도정위탁 / 농가도정 / 발아위탁)
  - 라벨/필드 sourceType별 분기:
    - 도정위탁: 원물중량(kg) + 도정업체 (datalist=`milling-vendors`)
    - 농가도정: 두 필드 숨김
    - 발아위탁: 현미중량(kg) + 발아업체 (datalist=`sprouting-vendors`)
  - 수율 미리보기는 **도정위탁만** 노출 (발아위탁은 수율 관리 안 함 — 사용자 결정)
  - vendors prop을 `millingVendors`/`sproutingVendors` 두 개로 분리
- `misc-stock-panel.tsx` / `page.tsx`: prop 4개로 확장, `getSproutingVendors` prefetch를 Promise.all에 추가
- `docs/plan-잡곡재고관리.md`: 한글 라벨 "위탁도정" → "도정위탁" 일괄, enum 라인 갱신

**검증**: `npx tsc --noEmit` 통과. dev 서버 재시작 후 라디오·라벨·수율·자동완성 분리 검수 필요.

### 잡곡 재고관리 #5c — 잡곡 입고 등록 다이얼로그 `feat`

**배경**: #5b placeholder 위에 잡곡 입고 등록 기능을 결합. 본 단계는 등록만 — 목록/필터는 #5d, 수정/삭제는 #5e.

**변경**:
- `app/actions/misc-stock.ts`: `getMiscVarieties()` 추가 (`category=MISC_GRAIN`만)
- `app/(dashboard)/raw-stocks/misc/add-misc-stock-dialog.tsx` 신규
  - 위탁/농가 세그먼트 토글 (sourceType)
  - 공통 필드: 생산년도, 인증, 생산자(인증·년도 필터), 농가명(선택), 품종, 입고일, 일련번호(bagNo), 입고중량
  - 위탁 전용: 원물중량, 위탁 도정업체(`<datalist>` 자동완성)
  - 위탁 시 수율 미리보기(`weightKg / rawWeightKg * 100`)
  - 해당 인증·년도에 잡곡 농가가 없으면 안내 메시지 노출
  - 저장 → `createMiscStock` → toast + 다이얼로그 닫기 + form 리셋
- `app/(dashboard)/raw-stocks/misc/misc-stock-panel.tsx` 신규 — 헤더 [+ 잡곡 입고] 버튼 + 본문 placeholder. 권한(`STOCK_MANAGE`) 가드 포함
- `page.tsx`: `MiscStockPlaceholder` → `MiscStockPanelLoader`(server)로 교체. `getMiscFarmers / getMiscVarieties / getMillingVendors`를 `Promise.all`로 prefetch 후 panel에 prop 전달

**검증**:
- `npx tsc --noEmit` 통과
- 브라우저 검수 필요: 위탁/농가 토글, 수율 미리보기, 도정업체 자동완성, 인증 변경 시 농가 목록 갱신, 저장 후 toast/닫힘, 권한 없는 사용자에게 버튼 미노출

**계획서**: [docs/plan-잡곡재고관리-#5.md](plan/plan-잡곡재고관리-#5.md) §단계별 #5c

### 잡곡 재고관리 #5b — 탭 인프라 (벼/잡곡) `feat`

**배경**: `/raw-stocks` 페이지를 벼/잡곡 2탭 구조로 재편. 잡곡 탭 콘텐츠는 placeholder로 두고, 다음 단계에서 다이얼로그·목록을 결합.

**변경**:
- `raw-stocks-tabs.tsx` 신규 (Client) — URL 쿼리(`?tab=misc`) 동기화, 탭 전환 시 도메인-특화 필터 모두 리셋(벼/잡곡 필터 의미 달라 잘못된 상태 노출 방지)
- `page.tsx` 재구성:
  - `searchParams.tab`으로 분기 (`'misc'` / 기본 `'rice'`)
  - 벼 탭: 기존 `StockPageWrapper` 그대로 — 기존 동작·UI 변경 없음
  - 잡곡 탭: `MiscStockPlaceholder` (인라인) — "곧 추가됩니다" 안내 카드. #5c~#5d에서 본 wrapper로 교체
- 탭은 모든 탭 공통으로 페이지 최상단에 노출 (헤더 액션과 별도 줄)

**검증**:
- `npx tsc --noEmit` 통과
- 브라우저 검수: `/raw-stocks` 진입 → 벼 탭 기본 활성, 기존 동작 회귀 X / 잡곡 탭 클릭 → URL `?tab=misc`, placeholder 표시 / 벼 탭 복귀 시 필터 리셋 확인

**계획서**: [docs/plan-잡곡재고관리-#5.md](plan/plan-잡곡재고관리-#5.md) §단계별 #5b

### 잡곡 재고관리 #5a — 잡곡 Server Actions + zod `feat`

**배경**: #5 본 작업 진입. UI 빌드 전에 잡곡 원물재고 액션을 먼저 구현. UI/페이지는 다음 단계(#5b~)에서 결합.

**변경**:
- `app/actions/misc-stock.ts` 신규 (단일 파일 ~390줄)
- 액션 6종:
  - `createMiscStock(input)` — zod discriminated union(`sourceType`)으로 위탁/농가 분기 검증, 품종 MISC_GRAIN 확인, 중복 체크, 로트 생성, audit log
  - `getMiscStocks(params)` — 평면 조회 (카테고리/년도/품종/생산자/sourceType/인증/상태 필터 + 정렬)
  - `getMiscStockGroups(params)` — 그룹 키 `(년도, 품종, 인증유형)` 벼와 동일
  - `getMiscStocksByGroup(groupKey, params)` — 그룹 펼침
  - `getMillingVendors()` — 위탁 도정업체 distinct (자동완성용)
  - `getMiscFarmers()` — `producesMiscGrain=true` 농가만 (잡곡 다이얼로그 전용)
- 로트번호: 벼 동일 규칙 — 작목반 미소속/일반 인증은 null. millingType은 '백미' 고정 (`getProductCode`가 잡곡 품종명으로 21~215 산출)
- 위탁(CONSIGNMENT) 시 `rawWeightKg` + `millingVendor` 저장. 농가(FARMER_MILLED)는 두 필드 null
- 중복 체크 풀: `(category=MISC_GRAIN, productionYear, farmerId, varietyId, bagNo)` — 벼 풀과 분리

**검증**:
- `npx tsc --noEmit` 통과 (에러 0)
- 액션 호출 회귀는 #5c 다이얼로그 결합 후 브라우저 검증

**계획서**: [docs/plan-잡곡재고관리-#5.md](plan/plan-잡곡재고관리-#5.md) §단계별 #5a

### 잡곡 재고관리 #5-pre — Farmer 모델 확장 + admin 체크박스 `feat`

**배경**: 잡곡 입고 다이얼로그 생산자 풀 결정 — "잡곡 생산자는 대부분 기존 벼 생산자 중 일부"라는 도메인 특성상, 별도 테이블 분리는 비효율, 모든 농가 노출도 비효율. 절충안으로 `Farmer.producesMiscGrain` 플래그 도입.

**변경 (1차 — 다이얼로그 + 액션)**:
- `prisma/schema.prisma` Farmer에 `producesMiscGrain Boolean @default(false)` 추가
- 마이그레이션 `20260430000000_add_produces_misc_grain_to_farmer` 생성·적용 (non-interactive 환경 회피 위해 SQL 파일 직접 작성 후 `migrate deploy`)
- `app/actions/admin.ts`: `FarmerFormData`에 `producesMiscGrain?` 추가, `createFarmer` / `updateFarmer` / `createFarmerWithGroup` 모두 새 필드 처리
- `app/(dashboard)/admin/farmers/add-farmer-dialog.tsx`: 체크박스 신규 (연락처 아래, 저장 버튼 위), 수정 시 기존 값 prefill, 등록·수정 모두 액션에 전달

**변경 (2차 — 표시/필터 통합)**:
- B안 채택: `producesRice` 필드 X, 모든 농가 기본 "벼"로 가정
- PC 테이블: "품목" → "곡종"(벼/벼,잡곡 뱃지) + 새 "비고" 컬럼(items 뱃지, max-w 160px truncate + native title hover) + 연락처 뱃지(전화 아이콘 + tel: 링크)
- 모바일 카드: 좌측 곡종 라벨 추가, 우측 "품목" 배지 → "비고", 빈 phone/items 회색 placeholder 제거
- `farmer-filters.tsx`에 "잡곡 생산자만" 체크박스 추가 (URL `producesMiscGrain=1`)
- `app/actions/admin.ts` `GetFarmersParams.producesMiscGrain?: boolean` + where 조건
- `page.tsx`에서 `searchParams.producesMiscGrain === '1'` 파싱

**변경 (3차 — 엑셀 import/export)**:
- `exportFarmers`: 행 매핑에 `'잡곡생산'` 컬럼 추가 (`'Y'` 또는 빈 문자열). 위치는 `생산자명` 다음, `취급품목` 앞
- `importFarmers`: `'잡곡생산' / '잡곡 생산' / '잡곡'` 헤더 허용, `Y/O/TRUE/1/예/체크` truthy 매칭. 빈/없음은 `false`. create/update 모두 반영

**검증**:
- `npx tsc --noEmit` 통과 (에러 0)
- 브라우저 1차 검수 완료(PC), 2~3차 통합본은 커밋 후 검수 예정

**계획서**: [docs/plan-잡곡재고관리-#5.md](plan/plan-잡곡재고관리-#5.md) §단계별 #5-pre
**보고서**: [docs/report-잡곡재고관리-#5-pre-2026-04-30.md](report/report-잡곡재고관리-#5-pre-2026-04-30.md)

## 2026-04-29

### 잡곡 재고관리 #4 — `/stocks` → `/raw-stocks` 라우팅 이동 `feat`

**배경**: 잡곡 인프라 본 구현 전, 원물재고 라우트를 미래 의미(벼/잡곡 통합 원물재고)에 맞게 이동. 페이지 내부 동작·UI는 그대로(잡곡 탭은 #5에서).

**변경**:
- `git mv` 디렉터리 rename: `app/(dashboard)/stocks/` → `app/(dashboard)/raw-stocks/` (15 파일)
- import 경로 갱신 3곳 (`layout.tsx`, `milling-cart-sheet.tsx`, `milling/stock-list-dialog.tsx`) — `layout.tsx`는 사전조사에서 놓친 상대경로 `./stocks/...`를 tsc 단계에서 발견·보강
- `revalidatePath('/stocks')` → `/raw-stocks` 25곳 일괄 치환 (admin 11, milling 5, release 4, stock 4, stock-excel 1)
- 네비게이션 4곳: `desktop-sidebar` href+isActive, `mobile-nav` href+라벨 "재고"→"원물"(계획서 §107 정합), `milling/stock-list-dialog` `router.push`, `breadcrumb-display` `/stocks` 중복 매핑 제거
- `audit.ts:144` `pathname.startsWith('/raw-stocks')` 단순 치환 (옵션 A — 308 redirect로 `/stocks` 호출은 도달 불가능)
- `next.config.ts` `redirects()` 추가 — `/stocks`·`/stocks/:path*` → `/raw-stocks*` 308 영구 리다이렉트
- `stock.ts:336` 주석 단순화 (`벼 전용 페이지(\`/raw-stocks\` 벼 탭)에서만 호출됨`)

**검증**:
- `npx tsc --noEmit` 통과 (.next stale typegen 정리 후)
- `revalidatePath('/stocks')` / 디렉터리 import 잔존 0건
- 브라우저 스모크 9 시나리오는 사용자 검수 (보고서 §3.2)

**계획서**: [docs/plan-잡곡재고관리-#4.md](plan/plan-잡곡재고관리-#4.md)
**결과보고서**: [docs/report-잡곡재고관리-#4-2026-04-29.md](report/report-잡곡재고관리-#4-2026-04-29.md)

### 잡곡 재고관리 #3 — 포장단위 정책 확정 (코드 변경 0건) `docs`

**배경**: #3은 당초 "벼 포장에 800g/500g/420g 추가 + 잡곡 공용"이었는데, 사전조사·정책 검토 과정에서 벼는 g 단위가 거의 안 쓰여 현행 유지가 적절하고 잡곡은 톤백·잔량이 없는 별도 옵션 셋이라 **공용 상수 도입 자체가 부적합**으로 결론. #3은 정책 확정으로 축소.

**확정 정책**:
- 벼: `톤백/20/10/8/5/4/3/1kg/잔량 + 기타` (현행 유지)
- 잡곡: `10/5/1kg + 800g/500g/420g + 기타` (톤백·잔량 없음, #7 잡곡 포장 다이얼로그에서 인라인 정의)
- weightPerUnit kg 기준 (800g → 0.8)

**산출물 (코드 변경 0건, 문서만)**:
- `docs/plan-잡곡재고관리.md` 5곳 갱신: §139 packageType 주석 / §249 잡곡 포장 옵션 / §307 변경 파일 / §368 작업 단계 #3 / §405 위험요소
- `docs/research-잡곡재고관리-#3.md` 신규 (정책 반영본)
- `docs/리팩토링-백로그.md` 신규 — 사전조사 중 발견한 부수 이슈 2건 이관 (`add-form.tsx` dead PACKAGE_TEMPLATES, `output-statistics.ts` `Tonbag`↔`톤백` 미스매치)
- `docs/report-잡곡재고관리-#3-2026-04-29.md` 결과보고서

**다음**: 작업 단계 #4 (`/stocks` → `/raw-stocks` 라우팅 이동) 사전조사로 이동.

### prisma seed 정리 — stale `seed.js` 제거 + `seed.ts`로 통일 `chore`

**배경**: 잡곡 #2 작업 중 `prisma/seed.js`가 현 schema에 없는 `farmer.certifications.create` 관계를 사용하는 stale 파일이라는 게 드러남. `package.json`이 그 broken 파일을 가리키고 있어 `npx prisma db seed` 호출 시 실패하는 상태였음. (`seed.ts`는 정상)

**변경**:
- `prisma/seed.js` 삭제 (historical artifact)
- `package.json` `prisma.seed`: `node prisma/seed.js` → `npx tsx prisma/seed.ts`

**참고**: tsx는 devDependency 미추가 (`npx`로 즉석 실행), 신규 의존성 도입 없음.

### 잡곡 재고관리 #2 — 잡곡 품종 시드 `feat` `seed`

**배경**: #1 스키마 확장 완료 후, 잡곡 입고/포장 화면이 실제로 사용할 품종 마스터를 등록. 계획서 §품종 시드 정책에 따라 기존 RICE 품종은 절대 손대지 않고 잡곡 15종만 신규.

**시드 스크립트** (`scripts/seed-misc-grain-varieties.ts`):
- `findFirst → 없을 때만 create` 패턴으로 멱등 보장
- `prisma/seed.ts`/`.js`가 schema와 어긋난 dead 상태라 해당 파일은 손대지 않고 별도 스크립트로 분리
- 등록 품종 15종(계획서 §품종 시드 정책): 보리/검정보리/통밀/수수/기장/차조/백태/귀리/참깨/아마란스/율무/녹두/팥/서목태/서리태
- 슬래시 별칭(콩, 적두, 쥐눈이)은 lot-generation 매핑 첫 키워드 채택. 25년산 엑셀에 다른 표기가 있으면 #11에서 alias 보완 예정
- type='MISC_GRAIN' 통일 (lot-generation 잡곡 영역은 varietyName으로만 분기)

**검증**:
- `npx tsc --noEmit` 통과
- Neon prod 1차 실행: 신규 15건, 스킵 0건
- 2차 실행 (멱등 검증): 신규 0건, 스킵 15건
- 최종 Variety 분포: RICE=23 (그대로) + MISC_GRAIN=15

**결과보고서**: [docs/report-잡곡재고관리-#2-2026-04-29.md](report/report-잡곡재고관리-#2-2026-04-29.md)

### 잡곡 재고관리 #1 — Prisma 스키마 + RICE 필터 호출부 안전화 `feat` `schema`

**배경**: 잡곡 입고/포장/판매 통합 인프라 1단계로, 데이터 모델만 먼저 확장. 호출부를 명시적으로 RICE-only로 좁혀 #5 잡곡 액션이 추가됐을 때 기존 벼 화면에 잡곡이 섞여 보이는 사고를 사전 차단.

**스키마 변경** (`prisma/schema.prisma` + `prisma/migrations/20260429000000_add_misc_grain_support/`):
- enum 3개 신설: `StockCategory{RICE,MISC_GRAIN}`, `SourceType{CONSIGNMENT,FARMER_MILLED}`, `ProductSource{MILLED,PURCHASED}`
- `Stock` 확장: `category`(RICE 기본), `sourceType`, `rawWeightKg`, `millingVendor`
- `Variety` 확장: `category`(RICE 기본)
- `MillingOutputPackage` 확장: `source`/`category` + 매입 전용 `varietyId`(FK 신설)/`purchaseVendor`/`incomingDate`. `batchId` NOT NULL → NULL 허용
- CHECK 제약 2개 raw SQL: `pkg_milled_has_source`, `pkg_purchased_required_fields`

**호출부 수정** (`app/actions/{stock,stock-excel,stock-statistics,dashboard,output-statistics}.ts`):
- 11곳에 `category: 'RICE'` 기본 필터 주입 (사전조사 §1.HIGH/MEDIUM 기준)
- dashboard `millingOutputPackage.aggregate`에 `source: 'MILLED'` 명시
- nullable batch 변경 후속: `output-statistics.ts:160` non-null 단언 + 주석, `scripts/migrate-stock-id.ts` 가드 추가

**검증**:
- `npx tsc --noEmit` 통과
- `npx prisma migrate deploy` Neon prod 적용 성공
- 일회성 검증 스크립트로 backfill 확인: Stock RICE=2064, Variety RICE=23, Package MILLED=343, NULL category 0건
- CHECK 제약 2개 위반 시 차단 확인 (PURCHASED 필수 필드 누락 / MILLED인데 batch+stock null)

**충돌 처리**: 사전조사와 계획서 사이에서 매입 필드명(`purchaseFrom` vs `purchaseVendor`), CHECK 조건(AND vs OR)이 어긋났는데 단일 진실 원천(계획서) 우선 적용.

**결과보고서**: [docs/report-잡곡재고관리-#1-2026-04-29.md](report/report-잡곡재고관리-#1-2026-04-29.md)

### 잡곡 재고관리 #1 사전조사 산출물 커밋 `docs`

**배경**: 2026-04-28 진행한 잡곡 재고관리 #1(스키마 확장) 사전조사 산출물 2종이 untracked로 남아 있던 걸 #1 본 작업 착수 전에 정리.

**파일 추가**:
- `docs/research-잡곡스키마-호출부.md` — `prisma.stock`/`millingOutputPackage`/`variety` 호출부 위험 등급(🔴/🟡/🟢)별 전수조사. `category: 'RICE'` 기본 필터 주입이 필요한 10곳 식별
- `docs/research-판매관리-참고사항.md` — `StockRelease` ↔ 계획서 표기(`ReleaseLog`) 정리, 통계 쿼리에서 `batch=null` 매입품 자동 제외 이슈, 라우트 이관 영향 범위

**커밋**: `988ea19`

## 2026-04-28

### Claude Design 마이그레이션 산출물 커밋 `docs`

**배경**: 2026-04-23에 수행된 Stitch MCP → Claude Design 마이그레이션의 워크플로우/계획서/결과보고서 3개 파일이 untracked로 남아 있던 걸 잡곡 재고관리 #1 단계 착수 전에 별도 `docs:` 커밋으로 정리.

**파일 추가**:
- `docs/claude-design-workflow.md`
- `docs/plan-claude-design-migration.md`
- `docs/report-claude-design-migration-2026-04-23.md`

**제외**: `docs/잡곡대장 (25년산).xlsx`는 잡곡 재고관리 #11(엑셀 Seed) 단계에서 import 스크립트와 함께 커밋 예정이라 untracked 유지.

## 2026-04-24

### 잡곡 재고관리 — 디자인 시스템 이관 사전 단계 (B안) `feat` `design-system`

**배경**: 2026-04-24 Claude Design 핸드오프 번들 수령(`docs/handoff-잡곡재고관리/`). 잡곡 기능 본 구현 전에 디자인 인프라(전역 토큰·헤더 브레드크럼·Set C 듀오톤 아이콘)를 선제 정비하는 B안(점진적 이관) 착수.

**변경 내용**:
- **#0 전역 토큰 동기화** (`app/globals.css`)
  - `--ring`을 `#3b82f6`(Blue-500) → `#2563eb`(Blue-600)로 primary와 통일
  - 모바일 네비/헤더용 커스텀 shadow 토큰 2종 추가 (`--shadow-mobile-nav`, `--shadow-mobile-header`)
  - `.dark` 스코프 누락 토큰 보완 (popover·secondary·muted·muted-foreground·accent·accent-foreground·destructive·ring)
- **#0.5 헤더 1줄 브레드크럼 전역 교체** (`components/breadcrumb-display.tsx`, `app/(dashboard)/layout.tsx`)
  - path 기반 `PAGE_CONFIG` 매핑(정확 매치 → 긴 prefix 매치)
  - URL query `?tab=` 서브컨텍스트 파싱 (rice→벼, misc→잡곡, release→출고)
  - 아이콘 + 타이틀 + 서브컨텍스트 + 설명 레이아웃, 좁은 화면에서 설명 우선 truncate
  - 헤더 높이 `h-14` → `h-12`
- **#0.7 Set C 듀오톤 아이콘 5종 컴포넌트화** (`components/icons/duotone.tsx`)
  - RawStockIcon / MillingIcon / PackageIcon / SalesIcon / StatsIcon
  - `active` prop으로 내부 fill 토글 (활성 시 듀오톤 효과)
  - 브레드크럼의 핵심 5 메뉴 lucide 아이콘을 듀오톤 버전으로 교체
- **`.gitignore`**: Claude Design 핸드오프 번들 폴더(`docs/handoff-*/`) 제외 추가
- **`docs/plan-잡곡재고관리.md`**: B안 이관 정책 섹션 신설, 작업 단계 #0/#0.5/#0.7 삽입, 변경 파일·위험 요소 보강

**검증**: 각 단계마다 `npx tsc --noEmit` 통과, 브라우저 시각 확인 완료(헤더 톤·듀오톤 아이콘 렌더링 정상).

**후속**: 작업 단계 #1(Prisma 스키마 확장 + 마이그레이션)로 이어짐. 사이드바·모바일 네비의 Set C 전면 적용은 #9 단계.

**변경 파일**:
- `.gitignore`
- `app/globals.css`
- `app/(dashboard)/layout.tsx`
- `components/breadcrumb-display.tsx`
- `components/icons/duotone.tsx` (신규)
- `docs/plan-잡곡재고관리.md` (신규)

## 2026-04-23

### Stitch MCP → Claude Design 마이그레이션 `chore` `tooling`

**배경**: Anthropic이 2026-04-17에 Claude Design (Opus 4.7 기반) 출시. 기존 Stitch MCP 대비 코드베이스 직접 인식, "Send to Claude Code" 원클릭 핸드오프, Pro/Max 플랜 포함 무료 등 이점이 커서 전환 결정.

**변경 내용**:
- `~/.claude.json`에서 `mcpServers.stitch` 제거 (`mcpServers: {}`)
- `~/.claude/settings.json`의 `permissions.allow`에서 `mcp__stitch__*` 8개 제거
- 양쪽 모두 `.bak-20260423` 백업 보관
- `docs/plan-claude-design-migration.md`, `docs/claude-design-workflow.md`, `docs/report-claude-design-migration-2026-04-23.md` 신규 작성

**검증**: 두 JSON 파일 `JSON.parse` 통과, `mcpServers` 및 `allow` 배열 정상 확인.

**후속**: Stitch에 박혀있던 Google API 키는 노출 이력 있으므로 Google Cloud 콘솔에서 재발급 권고. VSCode Claude Code 재시작 후 `mcp__stitch__*` 툴 사라지는지 확인 필요.

**변경 파일**:
- `C:\Users\nbcue\.claude.json`
- `C:\Users\nbcue\.claude\settings.json`
- `docs/plan-claude-design-migration.md` (신규)
- `docs/claude-design-workflow.md` (신규)
- `docs/report-claude-design-migration-2026-04-23.md` (신규)

## 2026-04-21

### 공지사항 마키 애니메이션 미동작 수정 `fix`

**배경**: 대시보드 공지 마키 배너가 흐르지 않고 정지된 상태로 보이는 문제 제보. 원인은 overflow 판정 타이밍 — `isOverflowing` 체크가 mount 직후 한 번만 `scrollWidth`를 재는 구조라, 폰트가 아직 로드되지 않았거나 레이아웃이 확정되기 전에 측정되면 실제 넘치는 상황인데도 `false`로 고정돼 애니메이션 스타일이 적용되지 않았음.

**수정 내용**:
- `ResizeObserver`로 텍스트 span과 컨테이너 div 크기 변화를 감지해 overflow 여부를 반응형으로 재계산
- `document.fonts.ready` 이후에도 한 번 더 재계산해 웹폰트 로드 완료 시점의 너비 변화를 반영
- cleanup에서 observer disconnect 처리

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `app/(dashboard)/_components/notice-marquee.tsx`

### 공지사항 마키 최신 공지 시각 구분 `feat` `ux`

**배경**: 마키 배너가 모든 공지를 동일한 폰트·색상으로 흘려서 최신 공지인지 과거 공지인지 구분이 안 됐음.

**수정 내용**:
- 각 공지 앞에 `[MM-DD]` 날짜 prefix 추가 (본문과 동일 크기, `font-mono`)
- 가장 최신 1건: 굵은 진한 주황(`#c2410c`) + 3일 이내면 빨간 `NEW` 뱃지
- 나머지 공지: 얇은 연한 주황(`#fb923c`)로 차등화 (회색이 아닌 같은 주황 계열로 배너 톤 유지)
- 구분자 `•` 색도 연한 주황(`#fdba74`)으로 맞춤
- `NoticeTicker` 로컬 컴포넌트로 분리 (원본/복제본 span 둘 다에서 재사용)
- 애니메이션 duration 계산용 글자 수는 날짜/구분자 추가분 반영해 재계산

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `app/(dashboard)/_components/notice-marquee.tsx`

### 공지사항 팝업에 전체 목록 뷰 추가 `feat`

**배경**: 일반 사용자가 마키 팝업에서 공지 한 건만 볼 수 있고 과거 공지나 다른 공지로 이동할 수 없었음. 별도 목록 페이지 대신 기존 팝업 안에서 목록/상세를 토글하는 방식으로 구현.

**수정 내용**:
- `NoticeViewDialog`에 `notices?` prop과 `mode: detail | list` 내부 상태 도입
- 상세 뷰 푸터에 "전체 목록" 버튼 추가 (notices 전달된 경우에만 노출)
- 목록 뷰: 카드형 버튼 목록 (제목/내용 미리보기/작성자/등록일), 현재 선택 공지 주황 하이라이트
- 목록에서 항목 클릭 → 해당 공지 상세로 전환, "상세로" 버튼으로 복귀
- 팝업 재오픈 시 상세 모드 + 마키에서 전달한 공지로 초기화
- `notice-marquee.tsx`에서 전체 활성 공지 배열을 팝업에 전달 (author.name → authorName 매핑)
- 관리자 `/admin/notices`의 NoticeTable은 notices를 전달하지 않아 버튼 미노출 (기존 동작 유지)

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `components/admin/NoticeViewDialog.tsx`
- `app/(dashboard)/_components/notice-marquee.tsx`
- `docs/plan-notice-list.md` (계획서)
- `docs/report-notice-list-2026-04-21.md` (결과보고서)

### 재고에 농가명(actualFarmer) 필드 추가 `feat`

**배경**: 인증은 공식 생산자 명의로 되어있지만 실제로는 배우자 등 다른 가족이 농사짓는 경우가 있음. 톤백에도 실제 농가명이 적히는 경우가 있어 검색까지 필요.

**수정 내용**:
- `Stock` 모델에 `actualFarmer String?` 컬럼 추가 + 마이그레이션 파일 생성
- `StockFormData` 타입 확장, `createStock`/`updateStock`에서 저장 (trim 후 빈 값 null 처리)
- `getStocks`/`getStockGroups`/`getStocksByGroup`/`exportStocks`의 `farmerName` 검색을 **생산자명 OR 농가명** OR 조건으로 확장 (콤마 멀티값 유지)
- 등록/수정 다이얼로그에 "농가명 (선택)" 입력란 추가 (생산자 셀렉트 오른쪽 2-column)
- PC 테이블/모바일 카드에 `생산자(농가명)` 형태로 병기 (값 없으면 생산자명만)
- PC 테이블 생산자 컬럼 너비 60px → 120px 확장
- 검색 필터 라벨 "생산자 / 농가명"으로 변경, placeholder 안내 수정
- 엑셀 Export에 "농가명(선택)" 컬럼 추가 (생산자명 옆), Import에서도 `농가명`/`농가명(선택)` 헤더 수용
- `package.json` build 스크립트에 `prisma migrate deploy` 선행 추가 → Vercel 배포 시 production DB 자동 마이그레이션

**검증**: Neon DB에 `actualFarmer` 컬럼 추가 확인 (`information_schema.columns` 조회). 브라우저 동작 확인은 사용자 환경에서 수행.

**변경 파일**:
- `prisma/schema.prisma`
- `prisma/migrations/20260421000000_add_stock_actual_farmer/migration.sql` (신규)
- `app/actions/stock.ts`
- `app/actions/stock-excel.ts`
- `app/(dashboard)/stocks/page.tsx`
- `app/(dashboard)/stocks/add-stock-dialog.tsx`
- `app/(dashboard)/stocks/edit-stock-dialog.tsx`
- `app/(dashboard)/stocks/stock-table-row.tsx`
- `app/(dashboard)/stocks/stock-list-client.tsx`
- `app/(dashboard)/stocks/stock-filters.tsx`
- `package.json`
- `docs/plan-stock-farmhouse.md` (계획서)
- `docs/report-stock-farmhouse-2026-04-21.md` (결과보고서)

### 재고 검색결과 품종 칩이 ID로 표시되던 버그 `fix` `ux`

재고목록 상단 "검색결과 N건" 영역의 품종 칩이 URL 쿼리의 `varietyId` 값(숫자 ID 콤마 문자열)을 그대로 출력하고 있었음. 여러 품종을 선택해도 한 Badge에 "1,4,5"처럼 묶여서 표시됨.

**수정 내용**:
- `ActiveStockFilters`에 `varieties: { id, name }[]` prop 추가
- `varietyId` 파라미터를 콤마 분리 → ID→이름 매핑 → 품종별 개별 Badge 렌더
- 매핑 실패 시 fallback으로 ID 자체를 표시 (방어)
- `stock-page-wrapper.tsx`에서 기존에 보유한 `varieties` 배열을 그대로 주입

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `app/(dashboard)/stocks/active-filters.tsx`
- `app/(dashboard)/stocks/stock-page-wrapper.tsx`

### 재고관리 필터·엑셀 수정 + 통계 엑셀 다운로드 추가 `fix` `feat`

**배경**: 사용자 리뷰에서 지적된 4건 일괄 처리. ①재고 필터 드롭다운 휠 스크롤 ②품종 필터 전체 해제 버튼 ③재고 엑셀 다중 품종 버그 ④통계 목록 엑셀 다운로드 기능.

**수정 내용**:
- 공용 드롭다운 2종에 `onWheel.stopPropagation` 추가 (PC 휠 동작), `MultiSelect`에 "전체 해제" 버튼 조건부 노출
- `exportStocks` 다중값 버그 수정: `parseInt(params.varietyId)` → `getStocks`와 동일한 콤마 분리 + `in/OR` 처리. `productionYear/varietyId/certType/farmerName` 모두 다중 선택 반영
- `daa` → `data` 오타 교정 (서버 액션 리턴값 + 클라이언트 호출부)
- 엑셀 다운로드 헤더에 업로드 기준 선택 필드 `(선택)` 접미사 부여 (`작목반명/인증구분/인증번호/상태`). `importStocks`에 `pick()` 헬퍼로 양쪽 헤더명 수용 → 재업로드 호환
- 통계 공통 `exportStatsRows` 서버 액션 + `StatsExcelButton` 공통 컴포넌트 신설
- 재고분석/수율분석/출고분석 3개 페이지 탭 바에 엑셀 버튼 배치. 클라이언트가 보유한 탭별 rows를 한글 헤더로 매핑해 서버로 전달, 서버는 xlsx 변환 + 감사 로그만 수행

**제외**: 도정구분별(`millingtype`) 페이지는 차트만 있고 테이블이 없어 사용자 요청 범위 밖으로 판단, 엑셀 버튼 추가하지 않음.

**검증**: `npx tsc --noEmit` 통과. UI 테스트는 배포 후 필요.

**문서**:
- `docs/plan-stock-filter-fixes.md`
- `docs/report-stock-filter-fixes-2026-04-21.md`

**변경 파일** (9개):
- `components/ui/multi-select.tsx`
- `components/statistics/MultiSelectDropdown.tsx`
- `components/statistics/StatsExcelButton.tsx` (신규)
- `app/actions/stock-excel.ts`
- `app/actions/stats-excel.ts` (신규)
- `app/(dashboard)/stocks/stock-excel-buttons.tsx`
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
- `app/(dashboard)/statistics/output/output-stats-client.tsx`

## 2026-04-20

### 어드민 메뉴 접근 권한 수정 `fix` `security`

**배경 & 버그**: 배포 환경에서 `VARIETY_MANAGE` / `FARMER_MANAGE` 권한 보유자가 품종관리(`/admin/varieties`) · 생산자관리(`/admin/farmers`) 메뉴에 진입 불가. 원인은 `proxy.ts`의 블랭킷 `/admin/*` ADMIN-only 가드가 업무 권한 구조("페이지 조회는 누구나, 수정만 권한자")를 깨뜨린 것. 추가로 파일명이 `proxy.ts`라 Next.js 표준 자동 로드 대상에서 벗어남.

**수정 내용**:
- `proxy.ts` 삭제 → `middleware.ts` 신규 생성 (표준 이름)
- 블랭킷 가드를 **경로별 권한 매핑 테이블**로 교체: `/admin/varieties` → `VARIETY_MANAGE`, `/admin/farmers` → `FARMER_MANAGE`, `/admin/users` → `USER_MANAGE`, `/admin/notices` → `NOTICE_MANAGE`, `/admin/logs` · `/admin/backup` → `SYSTEM_MANAGE`, `/admin/settings` → ADMIN 전용. ADMIN은 모든 경로 통과
- `app/actions/admin.ts`의 11개 액션(Variety/Farmer/ProducerGroup CRUD) `requireAdmin()` → `requirePermission('VARIETY_MANAGE' | 'FARMER_MANAGE')` 교체
- `app/actions/excel.ts`의 `importFarmers` 동일 교체
- 미사용 `requireAdmin` import 정리

**검증**: `npx tsc --noEmit` 통과 (에러 없음). 실제 동작 테스트는 배포 후 사용자 계정별 시나리오로 필요.

**후속 제안**: 사이드바 관리자 메뉴를 권한 기반으로 조건부 노출할지 별도 UX 이슈로 검토 필요 (권한 없는 사용자에게 메뉴가 보였다가 클릭하면 홈으로 튕기는 현상 존재).

**문서**:
- `docs/plan-admin-access-fix.md`
- `docs/report-admin-access-fix-2026-04-20.md`

**변경 파일**:
- `middleware.ts` (신규)
- `proxy.ts` (삭제)
- `app/actions/admin.ts`
- `app/actions/excel.ts`

### 사이드바 "관리자 메뉴" 조건부 노출 `ux` `fix`

관리 권한이 없는 사용자(업무 권한만 있거나 로그인만 한 사용자)에게 PC 사이드바·모바일 헤더의 "관리자 메뉴" 섹션이 그대로 보이던 문제 해소. 클릭 시 미들웨어에서 홈으로 튕기는 UX 불일치 제거.

**변경 내용**:
- PC 사이드바의 "관리자 메뉴" 드롭다운 전체를 `hasAnyPermission(user, ['USER_MANAGE', 'NOTICE_MANAGE', 'SYSTEM_MANAGE'])` 조건으로 감쌈 (ADMIN 자동 통과)
- 모바일 헤더의 `{isAdmin && ...}` 블록도 동일 조건으로 교체
- PC 사이드바의 "관리자 설정" 링크는 조건 없이 렌더되던 상태를 `user?.role === 'ADMIN'`으로 제한 (관리 권한자 중 non-ADMIN에게 죽은 메뉴로 보이던 문제)

**검증**: `npx tsc --noEmit` 통과.

**변경 파일**:
- `components/desktop-sidebar.tsx`
- `components/mobile-header.tsx`

### 모바일 헤더에 활동 로그 메뉴 추가 `ux`

SYSTEM_MANAGE 권한자가 모바일에서도 활동 로그 페이지에 접근할 수 있도록 모바일 헤더 설정 드롭다운에 "활동 로그" 항목 추가(`History` 아이콘). 시스템 백업은 모바일 기기에 백업 파일을 저장하는 UX가 부적절하여 PC 전용 유지로 의도적 제외.

**변경 파일**:
- `components/mobile-header.tsx`

## 2026-04-16

### Claude Forge 정리 문서 커밋 `docs`

2026-04-09에 이미 수행된 `~/.claude/` 정리 작업의 계획서와 결과보고서 2개 파일이 untracked 상태로 남아 있던 걸 커밋에 포함. 실제 정리 작업은 완료 상태 유지.

**파일 추가:**
- `docs/plan-forge-cleanup.md`
- `docs/report-forge-cleanup-2026-04-09.md`

## 2026-04-15

### 통계 페이지 필터 기본값 정비 & 재고분석 '(전체)' 라벨 `fix` `ux`

**후속 조치 — 리팩토링 이후 검증 과정에서 발견된 UX 이슈**

**수율분석 (milling):**
- `DEFAULT_PERIOD_VARIETIES` 4개 → 5개 (천지향5세 추가)
- `DEFAULT_VARIETIES` 3개 → 5개 (백옥찰/서농22호/천지향1세/새청무/하이아미, 천지향5세만 제외)
- `handleTabChange` 변경: 탭 전환 시 이전 필터 이월 금지, 각 탭 기본값으로 품종·도정구분·생산자 **강제 리셋** (기간 필터는 유지)
  - 기간별: 품종 5개 + 도정구분 `['백미']`
  - 품종별: 품종 5개 + 도정구분 `['백미']`
  - 도정구분별: 품종 6개 + 도정구분 전체
- 기존 이슈: 도정구분별(6개) → 품종별로 전환 시 `selectedVarieties`가 유지되어 5개 max 제한과 충돌 → 이제 해소

**재고분석 (stock):**
- 공유 `MultiSelectDropdown`에 `emptyLabel` prop 신설
  - 선택 없을 때 `"품종"` → `"품종 (전체)"` 처럼 placeholder 뒤에 옵션 라벨 표시
- stock의 인증/작목반/품종 드롭다운 3개에 `emptyLabel="(전체)"` 적용
- 이유: 빈 필터 = 전체 조회의 동작을 UI에 명시해 혼동 해소
- milling은 기존 동작 유지 (빈 상태의 의미가 다름)
- `handleTabChange` 신설: 탭(생산자/작목반/품종) 전환 시 인증/작목반/품종/생산자 필터 리셋 + 재조회 (연산은 유지). 필터가 이미 비어있으면 fetch 스킵

**변경 파일:**
- `app/(dashboard)/statistics/milling/_parts/constants.ts`
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
- `components/statistics/MultiSelectDropdown.tsx`
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`

**검증:** `tsc --noEmit` 통과

---

### 통계 페이지 정리 & 리팩토링 (800줄 제한 해소) `refactor`

**계획/보고서:**
- `docs/plan-stats-cleanup.md` (신규)
- `docs/report-stats-cleanup-2026-04-15.md` (신규)

**신규 파일:**
- `components/statistics/MultiSelectDropdown.tsx` (121줄) — 제네릭 공유 멀티셀렉트, `maxSelect`/`onClearAll`/`activeClass` prop 지원
- `app/(dashboard)/statistics/stock/_parts/utils.ts` — formatKg, toChartItems, CERT_TYPE_OPTIONS, StockTab
- `app/(dashboard)/statistics/stock/_parts/stock-tables.tsx` (182줄) — FarmerTable, GroupTable, VarietyTable, ChartLegend, 뱃지
- `app/(dashboard)/statistics/stock/_parts/stock-summary-cards.tsx` (73줄)
- `app/(dashboard)/statistics/stock/_parts/stock-filter-sheet.tsx` (199줄) — 모바일 바텀시트
- `app/(dashboard)/statistics/milling/_parts/constants.ts` — 상수 + MainTab 타입
- `app/(dashboard)/statistics/milling/_parts/milling-filter-sheet.tsx` (230줄) — 모바일 바텀시트

**수정 파일:**
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` — **999 → 560줄** (-439)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — **945 → 694줄** (-251)
- `README.md` — Next.js 보일러플레이트 → 프로젝트 소개/스택/셋업/원칙
- `docs/plan-statistics.md` (이전 작업 참고용, 변경 없음)

**주요 결정:**
- 출고 페이지 month/destination 탭은 사용자 의도적 disabled — 건드리지 않음 (메모리 저장)
- MultiSelectDropdown 통일 디자인: 네이티브 체크박스 + activeClass prop 주입 + 컴포넌트 내장 외부 클릭 닫기
- `_parts/` 서브폴더 컨벤션 (`_` 프리픽스로 라우트 제외)
- 상태/핸들러/메인 렌더는 메인에 유지, 재사용성 없는 부속만 분리

**검증:** `tsc --noEmit` 통과, `npm run build` 통과 (38.3s, 19페이지)

---

## 2026-04-14

### 보안 이슈 일괄 수정 (긴급 4건 + 단기 4건) `security`

**계획/보고서:**
- `docs/plan-security-fix.md` (신규)
- `docs/report-security-fix-2026-04-14.md` (신규)

**신규 파일:**
- `lib/auth-guard.ts` — `requireSession`/`requireAdmin`/`requirePermission` 공용 헬퍼
- `lib/file-validation.ts` — 엑셀 업로드 MIME/확장자/크기(10MB) 검증
- `lib/error-sanitize.ts` — Prisma/경로/스택 등 민감 정보 필터

**수정 파일:**
- `app/actions/*.ts` × 16 — 모든 Server Action에 인증 가드 적용 (읽기=session, 쓰기/관리=admin)
- `proxy.ts` — `/admin/*` ADMIN 권한 체크 추가 (Next 16의 middleware.ts)
- `auth.ts` — `debug: true` → `NODE_ENV==='development'` 조건부
- `next.config.ts` — CSP(Report-Only) + X-Frame-Options/HSTS/Referrer-Policy/Permissions-Policy 등 보안 헤더 6종
- `app/actions/excel.ts`, `stock-excel.ts` — import에 파일 검증 + ADMIN 강화
- `app/actions/backup.ts` — 세션만 체크 → ADMIN 강화, 에러 메시지 일반화

**주요 결정:**
- Next.js 16부터 `middleware.ts` → `proxy.ts`로 이름 변경된 것 확인 (분석 보고서 오해 정정)
- admin.ts 읽기 함수(varieties/farmers/groups)는 드롭다운용이라 session만, 쓰기는 admin
- CSP는 Report-Only로 시작 (Next.js inline script 호환 검증 후 enforcing 전환 예정)
- 에러 일반화는 무조건 덮어쓰기가 아니라 `sanitizeErrorMessage`로 민감 패턴만 필터

**빌드 검증:** `npm run build` 통과

**후속 조치 필요:**
- `NEXTAUTH_SECRET` 교체 (사용자 직접, `openssl rand -base64 32`)
- CSP 위반 모니터링 후 enforcing 전환

---

## 2026-04-09

### Claude Forge 자산 정리 (글로벌 ~/.claude) `chore`

**변경 파일 (글로벌, milling-log 코드 영향 없음):**
- `~/.claude/claude-forge/` — 폴더 통째 삭제
- `~/.claude/agents/` — 11개 → 3개 (planner·code-reviewer·security-reviewer만 유지)
- `~/.claude/commands/` — 40개 → 1개 (`/plan`만 유지)
- `~/.claude/skills/` — 폴더 통째 삭제 (16개)
- `~/.claude/hooks/` — 폴더 통째 삭제 (16개 + hooks.json)
- `~/.claude/settings.json` — `hooks` 섹션 비움 (`{}`)
- `~/.claude/CLAUDE.md` — "Claude Forge Rules" → "코딩 원칙", 에이전트 목록 11개 → 3개 정리

**프로젝트 파일 추가:**
- `docs/plan-forge-cleanup.md` (신규)
- `docs/report-forge-cleanup-2026-04-09.md` (신규)

**백업 위치:** `~/.claude/backups/forge-cleanup-2026-04-09/`

**MCP:** stitch 1개만 등록돼 있고 사용 중이라 손 안 댐.

---

## 2026-04-08

### 재고분석 모바일 UI 개선 (바텀시트 팝업·차트·테이블) `feat`

**변경 파일:**
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 탭 바 우측: 모바일 전용 필터 버튼 추가 (`md:hidden`, 활성 필터 수 배지 포함)
  - PC 인라인 필터 바 `hidden md:block` 래퍼로 감싸기
  - 모바일 칩 영역 `md:hidden` 추가 (연산년산 + 활성 필터 칩 항상 표시)
  - 바텀시트 팝업 구현: 연산/인증구분/작목반/품종(체크박스 리스트)/생산자 섹션
  - 작목반·품종 팝업 필터: 버튼 그룹 → 스크롤 체크박스 리스트 (`max-h-[90px]`)
  - 차트: `barSize=14` 고정, 최대 10개 스크롤 영역(`maxHeight: 10×34px`)
  - 작목반별 차트: `truncateLabels` prop으로 4자 후 `…` 처리, 클릭 시 전체 표시
  - 테이블 3개: `text-sm` → `text-xs`, 모든 셀 `whitespace-nowrap`, `minWidth` 지정
  - 테이블 컨테이너 `mb-2` 추가 (하단 메뉴바 여백)
  - 모바일 칩 삭제: `removeChipCertType` / `removeChipGroup` / `removeChipVariety` / `removeChipFarmer` 핸들러 추가 → 즉시 fetch
- `components/statistics/StockChart.tsx`
  - `barSize=14` 고정 추가 (barCategoryGap 변경 시 막대 두께 불변)
  - `truncateLabels` prop 추가: true면 커스텀 TruncatedTick, false면 기본 recharts tick
  - `yAxisWidth`: truncate 시 68px 고정 / 일반 시 이름 길이 기준
  - `margin right` 60 → 48px
- `components/statistics/SummaryCards.tsx`
  - 카드 레이아웃: 라벨 + 값+단위 한 줄 배치 (컴팩트, `text-2xl` → `text-sm`)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` `StockSummaryCards`
  - 동일한 컴팩트 레이아웃 적용

---

## 2026-04-07

### 재고분석 차트·서머리카드·레이아웃 개편 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts`
  - `processRate` → `stockRate` 필드명 변경
  - 계산식 변경: 처리율(consumed+released/total) → 재고율(available/total)
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 서머리카드 4번째: "생산자 수" → "재고율"
  - 카드 레이아웃: 모바일 2×2 / PC 우측 수직(md:w-48, h-[416px])
  - 테이블 "처리율" → "재고율" (전체 탭), 재고율 색상 반전(낮을수록 초록)
  - 인증 뱃지 색상 구분: 유기농(초록), 무농약(파랑), 일반(회색)
  - 차트 데이터 포인트 10 → 20개, "기타" 집계 제거
  - 레이아웃: 차트(좌, flex-1) + 서머리카드(우) flex row
  - 차트 컨테이너 고정 높이 416px + 내부 스크롤
- `components/statistics/StockChart.tsx`
  - Y축 너비 계산: ×13 max 200 → ×10 max 150 (한글 기준 최적화)
- `components/statistics/SummaryCards.tsx`
  - 수율분석 서머리카드 디자인 재고분석 스타일로 통일 (그라디언트→흰 배경+컬러 탑바)

---

### 재고분석 페이지 필터·UI 개선 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts`
  - `StockFilters`에 `varietyIds`, `farmerNames` 추가
  - `getStockVarietyOptions` Server Action 추가
  - `GroupStockRow`, `VarietyStockRow`에 `releasedKg` 필드 추가 및 집계 반영
  - 생산자 수 카드: 미처리 생산자 수 → 검색 조건 내 전체 생산자 수(`farmerMap.size`)
- `app/(dashboard)/statistics/stock/page.tsx`
  - `getStockVarietyOptions` 초기 fetch 추가
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx`
  - 탭 순서 변경: 품종별 → 작목반별 → 생산자별 (기본 탭: 품종별)
  - 품종 멀티셀렉트 드롭다운 필터 추가
  - 생산자 텍스트 검색 필터 추가 (쉼표 구분, trim 처리)
  - 초기화/검색 버튼 추가 (검색 버튼 클릭 시에만 조회)
  - 테이블 헤더 행 `bg-slate-50` 배경으로 데이터 행과 구분
  - 작목반·품종 테이블에 직접출고(kg) 열 추가
  - 차트 x축 가이드라인 추가 (`CartesianGrid`)
  - 최대 차트 표시 개수 15 → 10개
- `components/statistics/StockChart.tsx`
  - `CartesianGrid horizontal={false}` 추가 (x축 수직 가이드라인)
- `app/(dashboard)/milling/stock-list-dialog.tsx`
  - 컬럼 헤더 "농가명" → "생산자명"
- `app/actions/admin.ts`, `app/actions/excel.ts`, `app/actions/milling.ts`
  - UI 표시 용어 "농가" → "생산자" 전면 통일

---

## 2026-04-05

### 재고분석 통계 페이지 PC UI 구축 `feat`

**변경 파일:**
- `app/actions/stock-statistics.ts` (NEW)
  - `getStockStatistics`, `getStockProductionYears`, `getStockGroupOptions` Server Action
  - 농가별/작목반별/품종별 집계, 요약 카드 데이터 (Prisma include + JS Map 패턴)
- `app/(dashboard)/statistics/stock/page.tsx` (NEW)
  - 서버 컴포넌트, Promise.all로 초기 데이터 + 필터 옵션 동시 fetch
- `app/(dashboard)/statistics/stock/stock-stats-client.tsx` (NEW)
  - 필터(연산·작목반), 요약 카드 4개, 탭 3개(농가별/작목반별/품종별)
  - useTransition + Server Action으로 리필터링
- `components/statistics/StockChart.tsx` (NEW)
  - Recharts `BarChart layout="vertical"` 가로 스택 막대 차트
  - 도정완료(초록) / 직접출고(보라) / 미처리(주황) 스택
- `components/desktop-sidebar.tsx`
  - 통계 서브메뉴에 재고분석(`/statistics/stock`) 항목 추가

---

## 2026-04-03

### 수율분석 포장내역 팝업 소계 위치 수정 + 스크롤 잘림 수정 `fix`

**변경 파일:**
- `components/statistics/MillingTable.tsx`
  - 포장내역 팝업 그룹 헤더에 있던 소계를 아이템 목록 하단으로 이동
  - 그룹이 여러 개일 때만 각 그룹 하단에 소계 행 표시
- `app/(dashboard)/layout.tsx`
  - 모바일 하단 padding `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` → `+1rem` 추가
  - 마지막 스크롤 시 nav바에 가리는 문제 해결

---

## 2026-03-31

### 수율분석 페이지 모바일 팝업 필터 UI 완성 `fix`

**커밋:** `60a0b2e` (팝업 레이아웃 최종), `e8449de`, `f9334c0`, `a3128ac` 외 다수

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
  - 모바일 필터를 바텀시트 팝업으로 전환 (PC 인라인 필터는 유지)
  - 팝업 위치: `fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)]` — 네비바 위
  - 팝업 높이: `max-h-[calc(100dvh-52px-3.5rem-env(safe-area-inset-bottom)-16px)]` — 헤더·네비 침범 방지
  - 스크롤 영역: `flex-1 min-h-0 overflow-y-auto` — 콘텐츠 크기에 맞게
  - 팝업 기간 섹션: 달력 아이콘 제거, '25년산' 표기, 날짜 2열 grid 입력
  - 팝업 내 필터 변경 시 fetch 지연 (`showFilter` 체크)
  - 하단 버튼: 초기화 + 검색 우측 정렬
  - 선택 칩: 종류별 이어붙이기 (품종: A* B*, 기간: ...) 한 줄 나열
- `components/statistics/SummaryCards.tsx` — 모바일 2×2 그리드, 레이블·값 한 줄 컴팩트
- `components/statistics/MillingChart.tsx` — 모바일 isMobile 반응형 (YAxis 숨김, 폰트/dot 축소, h-[260px] 명시)
- `components/statistics/MultiSeriesChart.tsx` — 동일한 isMobile 패턴 적용

**주요 수정 사항:**
- `top` + `bottom` 동시 고정 → 패널 강제 확장 버그: `top` 제거 + `max-h` calc로 해결
- 차트 안 보임: `min-h`로는 ResponsiveContainer 동작 안 함 → 부모에 `h-[260px]` 명시로 해결

---

### 수율분석 페이지 모바일 UI 반응형 적용 `feat`

**커밋:** `e88fa05`

**변경 파일:**
- `components/statistics/SummaryCards.tsx` — 모바일 2×2 그리드 (`grid-cols-2 md:flex md:flex-col`)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx`
  - 빠른기간 버튼 행을 `overflow-x-auto` 가로 스크롤로 전환
  - 필터 바를 3행 구조로 재설계 (기간 / 드롭다운 / 생산자+버튼)
  - 차트+카드 레이아웃: 모바일 `flex-col-reverse`(카드 위→차트 아래), PC `md:flex-row`

---

## 2026-03-30

### 모바일 네비게이션 바 전면 재설계 `feat`

**변경 파일:**
- `components/mobile-header.tsx` — `relative` 클래스 제거로 헤더 여백 버그 수정, 그라데이션 라인 색상 slate 계열로 변경
- `components/mobile-nav.tsx` — 전면 재설계
  - 통계 메뉴 서브메뉴 추가 (hover 시 팝업, 수율분석/도정구분별)
  - SVG Goo Filter 적용 (feGaussianBlur + feColorMatrix) — 물방울 liquid 이동 효과
  - Leading/Trailing 두 원으로 액체처럼 늘어나는 blob 애니메이션
  - 낙관적 active 상태 (클릭 즉시 애니메이션, 페이지 로딩과 분리)
  - 비활성: 아이콘 + 텍스트(두 글자) 표시 / 활성: 파란 원 + 흰 아이콘, 텍스트 숨김
  - 최종 디자인: 흰 배경, slate-300 테두리, rounded-full, 파란 blob
- `app/(dashboard)/layout.tsx` — MobileNav variant prop 임시 비교 후 단일 컴포넌트로 복원

**주요 동작:**
- 메뉴 이동 시 파란 원이 liquid 물방울처럼 자연스럽게 이동
- 통계 탭 hover/클릭 시 서브메뉴 팝업 (수율분석, 도정구분별)
- 메뉴 레이블 두 글자 통일 (홈·재고·도정·출고·통계)

---

### 모바일 헤더·네비 그라데이션 라인 적용 + 통계 모바일 UI 계획서 작성 `feat/docs`

**변경 파일:**
- `components/mobile-header.tsx` — border-b 제거, 하단 2px 그라데이션 라인 추가 (`#6366f1→#3b82f6→#06b6d4` 반복), 헤더 하단 인디고 glow shadow
- `components/mobile-nav.tsx` — nav에 `relative` 추가, 상단 2px 그라데이션 라인 추가 (투명→인디고→시안→인디고→투명)
- `docs/plan-stats-mobile.md` — 수율분석 모바일 UI 구현 7단계 계획서 신규 작성
- `docs/plan-statistics.md` — 개발 상태 체크리스트 추가 (완료 5단계 표시)
- `docs/plan-packaging-redesign.md` — 모든 체크리스트 완료 표시
- `public/preview/option-a.html` — 다크 크롬 시안 (헤더 #1e293b)
- `public/preview/option-b.html` — 블루 헤더 시안 (헤더 gradient blue)
- `public/preview/option-c.html` — 레이어드 그레이 시안
- `public/preview/option-stitch.html` — Google Stitch 시안2 HTML
- `public/preview/option-gradient.html` — G1/G2/G3 그라데이션 방식 비교 시안

**주요 동작:**
- 모바일 헤더 하단, 하단 네비 상단에 인디고-블루-시안 그라데이션 라인으로 컨텐츠 영역과 시각적 구분
- G2 방식 채택: 흰 헤더 유지 + 2px 그라데이션 라인 (로고 흰 배경 PNG와 어울림)
- 통계 모바일 UI 계획서 작성 (SummaryCards 그리드, 차트 레이아웃, 필터 반응형, 테이블 스크롤)

---

## 2026-03-26

### 수율분석 통계 개선 (도정구분별 탭 완성 + 생산자 필터 버그 수정) `feat/fix` — `170b7d1`

**커밋 목록:**
- `1da03fb` — fix: fetchCurrent overrides 타입에 groupBy 추가 (빌드 에러)
- `b24de31` — feat: 도정구분별 통계 페이지 신규 추가 (이후 탭으로 통합)
- `ee04a3d` — fix: 사이드바 통계 서브메뉴 → 수율분석 단일 링크로 정리
- `bccceee` — feat: 수율분석 도정구분별 탭 기본값 업데이트
- `d27f765` — fix: 품종별/도정구분별 탭 생산자 필터 미전달 버그 수정
- `4650ad1` — fix: 탭 전환 시 생산자 검색 필터 초기화
- `170b7d1` — fix: 탭 필터 변경 시 테이블·요약카드 미동기 버그 수정

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 도정구분별 탭 기본값(품종 6개·도정구분 전체), 탭 전환 시 생산자 초기화, fetchVariety/fetchMillingType에 farmers 연결 + 테이블 동기화
- `app/actions/statistics.ts` — getMillingStatsByVariety·getMillingStatsByMillingType에 farmers 파라미터 추가
- `components/desktop-sidebar.tsx` — 통계 서브메뉴 → 수율분석 단일 항목
- `components/breadcrumb-display.tsx` — 수율분석 경로명 반영

**주요 동작:**
- 도정구분별 탭: 품종 기본 6개(백옥찰·서농22호·천지향1세·천지향5세·새청무·하이아미), 도정구분 DB 전체 선택
- 생산자 검색 필터가 3개 탭 모두 정상 동작
- 탭 전환 시 생산자 검색어·칩 자동 초기화
- 품종별/도정구분별 탭에서 필터 변경 시 차트 + 테이블 + 요약카드 동시 업데이트

---

### 도정구분별 통계 페이지 신규 추가 `feat` — `b24de31`
**변경 파일:**
- `app/(dashboard)/statistics/millingtype/page.tsx` — 신규 서버 컴포넌트 (6개월 기본, 전체 도정구분 조회)
- `app/(dashboard)/statistics/millingtype/millingtype-stats-client.tsx` — 신규 클라이언트 컴포넌트 (필터 + MultiSeriesChart + SummaryCards)
- `components/desktop-sidebar.tsx` — 통계 메뉴를 서브링크 2개로 분리 (도정실적 분석 / 도정구분별 분석)
- `components/breadcrumb-display.tsx` — millingtype 경로 브레드크럼 추가

**주요 동작:**
- `/statistics/millingtype` 신규 페이지 생성
- 기간 기본: 6개월 / 품종 기본: 백옥찰·서농22호·천지향1세·천지향5세·새청무·하이아미
- 도정구분 전체 선택 (DB distinct 조회 기반, 동적)
- 품종/도정구분 토글 → 즉시 fetch, 드롭다운에 전체선택·전체해제 버튼

---

### 통계 UX 개선 (기간버튼 즉시fetch · 기본기간 6개월 · 품종별 차트 개선) `feat`
**커밋:** (이번)

**변경 파일:**
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 기간 버튼 클릭 시 즉시 fetch, 기본 기간 6개월, 기본 품종 서농22→서농22호 수정, 초기화 기준 6개월
- `app/(dashboard)/statistics/milling/page.tsx` — 서버 초기 fetch 6개월 기준으로 변경
- `components/statistics/MultiSeriesChart.tsx` — X축 월별 레이블 단축(2511), Y축 allowDataOverflow 추가(55~75 정상 표시), 빈값 유령막대(점선 outline), 빈값 있는 시리즈에 ghost bar 추가

**주요 동작:**
- 빠른기간 버튼(연산/1년/6개월 등) 클릭 → 검색 버튼 없이 즉시 fetch
- 기본 기간 6개월로 변경 (연산 기준 → 실데이터 구간 중심)
- 품종별 차트 Y축 수율 55%~75% 정상 범위 표시
- 빈값 구간에 점선 outline ghost bar → 시리즈 구분 가능

---

### 통계 차트 개선 + 도정 투입내역 삭제 버그 수정 `feat/fix`
**커밋:** `7de3dda`

**변경 파일:**
- `components/statistics/MillingChart.tsx` — 막대폭 동적 조절(포인트 수 기반), X축 월별 레이블 단축(`2025-04` → `2504`)
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 기간별 탭 품종 기본값 하이아미·서농22·천지향1세·새청무 적용
- `app/(dashboard)/statistics/milling/page.tsx` — 서버 초기 fetch에 동일 품종 기본값 추가
- `app/actions/milling.ts` — `removeStockFromMilling` 수정: stock 삭제 후 남은 stocks 합산해 `totalInputKg` 업데이트 (목록 투입량 미반영 버그 수정)

**주요 동작:**
- 막대폭: `480 / 포인트수` 기준, 최소 12px ~ 최대 56px 동적 계산
- 월별 X축: `yyyy-MM` → `YYMM` (day/week는 기존 유지)
- 기간별 품종 기본값: 페이지 로드 시 + 초기화 시 동일하게 적용
- 투입내역 삭제 시 `millingBatch.totalInputKg` 자동 재계산 → 목록 정합성 확보

---

## 2026-03-25 (세션2)

### 통계 품종별/도정구분별 차트 구현 + 수율 보간 `feat`
**커밋:** `7de3dda` (2026-03-26 커밋에 포함)

**변경 파일:**
- `app/actions/statistics.ts` — `MultiSeriesChartData` 타입, `getMillingStatsByVariety`, `getMillingStatsByMillingType` 추가. `generateAllBucketKeys()`로 빈 버킷 포함 전체 기간 생성, `hasData` 플래그 반환
- `components/statistics/MultiSeriesChart.tsx` — 신규. 5색 팔레트, 시리즈별 겹침막대+수율 라인, 막대폭 자동조절
- `components/statistics/MillingChart.tsx` — 보간 처리(좌우 평균), 실선/점선 이중 라인, Y축 수율 55-75로 변경
- `app/(dashboard)/statistics/milling/milling-stats-client.tsx` — 검색 바 공통화, 품종별/도정구분별 탭 연결, 기본값(서농22호·천지향1세·하이아미 / 백미·찹쌀·현미), 품종 최대 5개 제한

**주요 동작:**
- 품종별/도정구분별 탭 전환 시 기본값 자동 적용 후 fetch
- 데이터 없는 기간 포인트: 좌우 값 평균으로 보간, 점선(4-4 dash)으로 표시
- 수율 Y축: 55/60/65/70/75 (진폭 확대)
- 품종별 생산량: 동일 배치 내 투입 비율로 안분

---

## 2026-03-25

### 통계 기본 기간 연산(cropYear) 기준으로 변경 `feat`
**커밋:** `2e2270f`

- 통계 페이지 기본 기간을 1개월에서 현재 연산 기준으로 변경
- `page.tsx` 초기 fetch + `milling-stats-client.tsx` quickPeriod 기본값 `cropYear`로

**변경 파일:** `statistics/milling/page.tsx`, `statistics/milling/milling-stats-client.tsx`

---

### 활동로그 도정작업 상태변경 상세내역 추가 `feat`
**커밋:** `8d51266`

- `updateMillingBatchStatus` 호출 시 변경 전 배치 정보 조회 후 `details`에 포함
- 활동로그 UI에서 상세내역 버튼(FileText) 표시 가능해짐
- 기록 항목: 변경전/후 상태, 도정일, 도정구분, 투입량, 비고

**변경 파일:** `app/actions/milling.ts`

---

### 모바일 멀티셀렉트 터치 스크롤 수정 `fix`
**커밋:** `43425b1`

- Popover 내부 스크롤 컨테이너에 `touch-pan-y`, `overscroll-contain`, `onTouchMove stopPropagation` 추가
- iOS 모바일에서 터치 이벤트가 부모로 전파되어 스크롤 안 되던 문제 해결

**변경 파일:** `components/ui/multi-select.tsx`

---

### 통계 도정실적 페이지 기능·UI 개선 `feat`
**커밋:** `94c5f72`

**변경 파일:** `statistics/milling/milling-stats-client.tsx`, `actions/statistics.ts`, `components/statistics/MillingChart.tsx`, `components/statistics/MillingTable.tsx`, `components/statistics/SummaryCards.tsx`

**필터 기능:**
- 기간검색 탭에 생산자 텍스트 검색 추가 (쉼표로 다중 검색, Enter 지원)
- 검색 버튼 클릭 시에만 그래프 반영 (기존 자동 fetch → 수동 검색 방식)
- 검색 조건 칩 표기 — 기간(항상)/품종/도정구분/생산자 전부 칩으로 표시
- 초기화 버튼 추가 (기간 1개월·백미 기본값으로 리셋)

**그래프:**
- 범례 투입량·생산량 아이콘 두께 통일
- 좌측 Y축 단위 kg → t(톤) 변경, 툴팁도 t 단위 표시

**요약 카드:** 각 카드에 색상별 그라데이션 배경 추가

**상세 테이블:**
- 생산자 컬럼 "XXX 외 N명" 요약 표시 (title로 전체 이름 확인 가능)
- 투입목록 팝업 → `MillingStockListDialog` 재사용 (도정관리와 동일 화면)
- 포장내역 팝업 → `AddPackagingDialog` 스타일 동일 적용 (로트 그룹 헤더 구조)
- 로트번호 hover 시 생산자명 tooltip 표시
- 수율 표시 → 도정관리 목록 동일 스타일 (70%↑ 파란 배지, 미만 회색)

---

### 검색필터 멀티셀렉트 + 다중 생산자 검색 `feat`
**커밋:** `226b90a`

**신규:** `components/ui/multi-select.tsx` (Popover + 체크박스 멀티셀렉트 공통 컴포넌트)

**재고:** 년도·인증·품종 멀티셀렉트 전환
**도정:** 품종·도정구분 멀티셀렉트 전환
**생산자관리:** 인증·년도 멀티셀렉트 전환
**공통:** 생산자 텍스트 필드에서 쉼표(,)로 여러 생산자 동시 검색, 모든 텍스트 입력 앞뒤 공백 trim

**버그 수정:**
- `getStocksByGroup` 라인 608 `isNaN` 함수를 Prisma 필터값으로 전달하던 버그 → 그룹 클릭 시 하위목록 미표시 원인
- `getStockGroups` 멀티값 `parseInt('2025,2026')` 파싱 오류 → 검색결과 0건 원인

**변경 파일:** `components/ui/multi-select.tsx`, `stocks/stock-filters.tsx`, `stocks/active-filters.tsx`, `milling/milling-filters.tsx`, `milling/active-milling-filters.tsx`, `admin/farmers/farmer-filters.tsx`, `admin/farmers/page.tsx`, `actions/stock.ts`, `actions/milling.ts`, `actions/admin.ts`

---

### 포장 다이얼로그 단일 생산자 헤더 표시 `feat`
**커밋:** `bdd4c74`

- 단일 생산자 도정 시에도 포장 다이얼로그 상단에 생산자명 + 로트번호(또는 "관행") 표시
- 예상 생산량 계산은 다중 생산자일 때만 유지

---

### 관행 농가 로트번호 처리 개선 `fix`
**커밋:** `fed7f90`

**배경:** 관행(certType=일반) 농가는 인증이 없어 로트번호가 의미 없음.
관행 그룹의 certNo가 `-`(대시)로 저장되어 포장 저장 시 `251118-18---9915` 같은
잘못된 로트번호가 생성되는 버그 발견.

**변경 내용:**
| 파일 | 내용 |
|------|------|
| `app/actions/milling.ts` | 포장 저장 시 관행이면 lotNo = null |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 관행 농가를 farmerNo 기준 개별 그룹핑, "관행" 표시 |
| `app/actions/milling-excel.ts` | 로트번호 컬럼 추가, 관행이면 "관행" |
| `app/actions/statistics.ts` | OutputDetail에 isConventional 추가, group 쿼리 포함 |
| `components/statistics/MillingTable.tsx` | 관행이면 "관행" 표시 |
| `app/(dashboard)/stocks/stock-table-row.tsx` | 관행이면 "관행" 표시 |
| `app/(dashboard)/stocks/stock-list-client.tsx` | 관행이면 "관행" 표시 |

**DB 정리:** 잘못 생성된 MillingOutputPackage.lotNo 7건 → null (id: 277, 278, 279, 370, 375, 376, 377)

---

## 2026-03-24

### 도정실적 통계 페이지 신규 + 대시보드/포장 버그 수정 `feat`
**커밋:** `e2a3e09`

**변경 내용:**
- 도정실적 통계 페이지 신규 (`/statistics/milling`)
  - 요약 카드 4개 (총 투입량/생산량/수율/도정횟수)
  - 기간별 콤보 차트 (투입/생산 OverlappingBar + 수율 라인)
  - 상세 테이블 (생산자 열, 투입량/생산량 클릭 팝업)
- 포장 입력 예상생산량 수율 DB 연동
- 대시보드 최근도정내역: 생산량 클릭 포장내역 팝업, 수율 색상 개선
- 대시보드/포장 버그 수정 (stockId, lotNo, group 필드 누락)

---

## 2026-03-23

### 포장 입력 재설계 — lotNo 기반 생산자별 섹션 분리 `refactor`
**커밋:** `9defc62`

**변경 파일:**
- `app/(dashboard)/milling/add-packaging-dialog.tsx` — `computeLotGroups`로 lotNo 기준 섹션 분리, 자동배분 제거, 섹션별 독립 버튼
- `lib/lot-generation.ts` — `getYieldRate()` 추가 (백미 68% / 현미 70% / 인디카 65% / 분도미 69%)
- `app/actions/milling.ts` — `updatePackagingLogs` fallback 로직 명시적 정리
- 도정유형 명칭 통일: `7분도미` → `칠분도미`, `5분도미` → `오분도미` (소스코드 전체 6개 파일)
- `scripts/migrate-milling-type.ts` — DB 도정유형 명칭 통일 마이그레이션 스크립트

**주요 동작:**
- 다중 생산자 배치 시 lotNo별 섹션으로 분리 표시
- 각 섹션에 독립 규격 버튼 → 버튼 클릭 시 해당 생산자 섹션에만 추가
- 예상 생산량 = 투입량 × 수율(도정유형별)

---

### 모바일 포장내역 팝업 버그 수정 `fix`
**커밋:** `6a96ef0`, `d9908dc`

- `stocks prop` 누락으로 포장내역 팝업이 열리지 않던 버그 수정
- 모바일에서 포장 다이얼로그 저장 버튼이 잘리던 레이아웃 버그 수정

---

### 사이드바 메뉴 개편 및 관리자 설정 페이지 추가 `feat`
**커밋:** `1073aae`

- 품종/생산자 관리를 사이드바 상단 독립 메뉴로 승격
- 관리자 설정(`admin/settings`) 페이지 신규 — 도정유형별 수율 기준값 DB 관리
- `SystemConfig` Prisma 모델 추가, `getYieldRates` / `setYieldRate` Server Action

---

### 도정내역 기본 조회기간 1주→1달, 수율 설정화면 2열 레이아웃 `fix`
**커밋:** `47cf836`
