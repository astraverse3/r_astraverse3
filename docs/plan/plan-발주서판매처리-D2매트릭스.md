# 계획서 — 발주서 판매처리 D2 (매트릭스 + 셀 배분)

- 작성일: 2026-08-26
- 상위 계획: `docs/plan/plan-발주서판매처리-단계6.md` §D2 · `docs/plan/plan-발주서판매처리-양식통일.md` §7(미결)
- 시안: `docs/handoff/발주서판매처리/건처리-택배-매트릭스-데스크탑.html`
- 선행 상태: D0·D1a~D1c 완료, 배송·상차 S1~S4 완료 (`128e1e5`, 전부 푸시)

---

## 1. 작업 목표

묶음(시트 1장)을 **발주서 원본 그대로의 2D 피벗**으로 펼쳐서, 셀 하나가 곧 「이 수령처에 이 규격 몇 개」가 되게 한다.
셀을 눌러 FIFO로 재고를 배분·차감하고, 매칭 실패·톤백처럼 자동으로 안 되는 것만 사람이 지정한다.

**행 = 수령처 · 열 = 제품규격 · 셀 = 주문수량(색 = 차감상태)**

D2 범위는 **셀 단위 차감까지**다. 행 일괄선택·검토 게이트는 D3, 엑셀 내보내기는 D5.

---

## 2. 선행 미결 해소 — 결정 #43로 이관 완료

D2 착수 전 결정해야 했던 🔴 「재고 분할 차감」(`plan-발주서판매처리-양식통일.md` §7)은
**분할과 병합이 같은 기능**임이 드러나 독립 작업으로 분리했다.

→ **`docs/plan/plan-재고재포장.md` (결정 #43)** · R1(스키마·검증·액션) 완료

D2에 남는 몫은 하나뿐이다. **D2d 톤백 셀 팝오버에서 `createRepack`을 호출한다.**
톤백 분할은 재포장의 1→2 케이스이므로 별도 액션(`splitPackage`)을 만들지 않는다.

요점만 옮겨두면:

| | |
|---|---|
| 분할이 필요한 규격 | **톤백뿐**. 일반 규격은 낱개라 `PackageMovement.count` 정수로 이미 표현됨 |
| 톤백 실태 | 199행 / 자루중량 **124종** / 100kg 배수 **29행** — 「1,000kg 주문에 1,004kg 자루」가 기본값 |
| 차감 모델 | **변경 없음.** 소스 소진을 `MovementType.REPACK` movement로 표현해 가용재고 공식을 그대로 둔다 |
| 톤백 팝오버 | 자동 FIFO 없이 재고 행 목록(자루중량·요구중량 근접순) + 「요구 1,000 / 실제 1,004」 차이 표시 (#34) |

---

## 3. 현행 코드 갭 (단계6 §3에서 이월)

| # | 갭 | 근거 | 해소 |
|---|---|---|---|
| G3 | 매트릭스용 조회 액션 없음 (건 1개 단위 `getPurchaseOrderDetail`뿐) | `app/actions/purchase-order.ts:431` | D2a |
| G4 | **N+1 심각** — 라인마다 `loadAvailablePackages` 쿼리 | `:450-465`, `:76` | D2a (배치 조회 신규 작성) |

**재사용(신규 불필요)**: `suggestAllocation` · `listProductTypes` · `confirmOrderItem` · `cancelOrderItemMovements`
· `setOrderItemProductType` · `autoMatchOrderItem`

---

## 4. 구현 단계

### D2a. 순수 피벗 lib + 배치 조회 액션

- **신규 `lib/purchase-order-matrix.ts`** (DB 접근 없음 → 단위테스트 대상)
  - 행=수령처 × 열=규격 피벗, 규격별 소계·kg 환산
  - 정렬 3종: 수령처 가나다 / 최신 / 작업필요 우선
  - 셀 상태 파생: `미차감 · 부분 · 완료 · 매칭실패 · 재고부족`
  - 발주처≠수령인일 때만 `A → B` 표기 규칙
- **신규 `app/actions/purchase-order-matrix.ts`** — `getUploadMatrix(uploadId)`
  - `purchase-order.ts`가 이미 625줄이라 **파일을 분리**한다 (D1b에서 `purchase-order-upload.ts`를 뗀 것과 같은 이유)
  - 배치 조회 **1~3회**: ① 묶음의 order+item+movement ② 등장 SKU의 가용재고 일괄 집계 ③ SKU 메타
  - **라인 루프 안에서 쿼리 금지** (G4)
  - 권한: `OPERATION_MANAGE`
- 검증: `npm test` 통과 + 실묶음 조회 쿼리 수 로그 확인

### D2b. 매트릭스 화면 (읽기 전용)

- **신규 라우트** `app/(dashboard)/sales/purchase/[uploadId]/page.tsx` (서버) + `matrix-client.tsx`
- 수령처 좌측 고정 · 규격 헤더 상단 고정 · 가로 스크롤 · 소계 kg 우측 고정
- 규격별 소계 / 가용재고 띠 (부족=주황)
- 정렬 토글 3종 · 상단에 묶음 요약(채널 배지·발주일·상차 정보)
- `upload-table.tsx` 행 → 이 화면 링크 연결
- 시안 HTML은 **디자인 참조**. Tailwind 임의값 → shadcn 시맨틱 토큰으로 치환
- 검증: 실묶음 2건(현재 69건·89라인) 렌더 — 사용자 브라우저 확인

### D2c. 셀 FIFO 배분 팝오버 (차감·취소)

- 셀 클릭 → 팝오버: `suggestAllocation` 추천 배분이 기본값, 로트·수량 조정 가능
- 확정 → `confirmOrderItem` / 차감된 셀 재클릭 → `cancelOrderItemMovements`
- 이름(행 머리글) 클릭 → 해당 수령처 전체 주문 상세 패널
- 검증: 차감 → `/packages` 가용재고 감소 → 취소 → 복원 왕복 확인

### D2d. 톤백 수동 지정 + 자루 쪼개기 (결정 #34·#43)

- 톤백 셀은 **자동 FIFO를 거치지 않는다.** 재고 행 목록을 자루중량과 함께, **요구 중량 근접 순**으로 보여준다
- 각 행에 「요구 1,000kg / 실제 1,004kg (+4)」 차이 표시 — 사람이 통째로 낼지 쪼갤지 판단
- 「자루 쪼개기」 → 분할 중량 입력 → **`createRepack` 재사용**(`app/actions/repack.ts`) → 쪼갠 행에서 차감
  - 신규 액션·신규 스키마 **없음**. 재포장 R1이 이미 제공한다
- 검증: #1277(1,004kg×4) → 1,000+4 분할 → 차감 → `/packages`에서 3자루+1,000+4 확인

### D2e. 매칭실패 셀 수동지정

- 매칭실패 셀 → 수동지정 팝오버(품종 → 규격 → 포장지, `listProductTypes` 재사용)
- `setOrderItemProductType`(별칭 학습 체크박스 #22) / `autoMatchOrderItem` 재매칭
- 검증: 실업로드에서 실패한 품목명으로 지정 → 별칭 저장 후 재업로드 시 자동 매칭 확인

---

## 5. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| 높 | **성능(G4)** — 택배 묶음 1,700라인 매트릭스. 배치로 못 짜면 화면이 안 뜬다 | D2a에서 쿼리 수를 실측하고 로그로 확인. 라인 루프 쿼리 금지 |
| 중 | `matrix-client.tsx` 800줄 초과 위험 (셀 팝오버·톤백·수동지정이 전부 붙음) | 처음부터 팝오버 3종을 별도 파일로: `cell-allocation-popover.tsx` / `tonbag-popover.tsx` / `manual-match-popover.tsx` |
| 중 | 분할이 재고 데이터를 직접 쪼갠다 | 재포장 R1이 이미 가용 검증·트랜잭션·`cancelRepack` 되돌리기를 갖췄다 (결정 #43) |
| 중 | 현재 적재 라인이 89건뿐이라 대량 렌더를 못 본다 | D2b 완료 후 택배 실파일을 추가 업로드해 실측 |
| 낮 | 동시성 — 화면 띄운 사이 다른 사용자가 같은 재고 차감 | 셀 단위 차감은 `confirmOrderItem`이 이미 가용 초과를 차단. 일괄 재계산은 D3 |

---

## 6. 검증

- 순수 로직(피벗·정렬·셀 상태 파생)은 `lib/purchase-order-matrix.test.ts`에 단위테스트, `npm test`
- `npx tsc --noEmit`, `npx eslint` (변경 파일)
- **`next build` 금지** — 사용자 dev 서버 상시 기동 중
- 화면·차감 왕복은 사용자가 브라우저에서 확인 (`/packages` 가용재고 수치가 최종 근거)
- 단계별 완료 시 `docs/report/report-*.md` + `docs/worklog.md` 갱신
