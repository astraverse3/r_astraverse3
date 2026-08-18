# 계획서 — 발주서 판매처리 단계6 (화면 구현)

_작성: 2026-08-18 · 기준 시안: `docs/handoff/발주서판매처리/` · 도메인 원본: `docs/plan/plan-발주서판매처리.md`_

## 1. 목표

시안(데스크탑 5 STEP + 모바일 6화면)을 `milling-log` 기존 환경(Next.js 16 App Router · React 19 · Tailwind v4 · shadcn/ui)에서 재현해,
발주서 엑셀 업로드 → 매트릭스에서 FIFO 차감 → 검토 게이트 → 확정까지의 흐름을 실사용 가능한 상태로 만든다.

## 2. 진행 순서 (B안 — 사용자 확정)

```
D0 파서 통일양식 대응  →  D1 업로드+묶음목록  →  D2 매트릭스+셀 배분
   →  D3 일괄선택+검토게이트  →  D4 나머지 채널·⋮메뉴
   →  M1 모바일 3모드  →  M2 모바일 시트  →  D5 엑셀 내보내기+로트 시트
```

- **데스크탑 차감 흐름(D0~D4)을 먼저** — 모바일 3모드 판정 경계값(수령처 2/3·규격 6)이 아직 잠정이라, 데스크탑에서 실제 발주서를 돌려 수령처×규격 분포를 실측한 뒤 M1에서 확정한다.
- **D5(엑셀 내보내기·로트 배분 시트)는 맨 뒤** — 백엔드가 통째로 없고 차감 흐름과 독립이라, 데스크탑·모바일 양쪽에서 차감을 먼저 쓸 수 있게 한다.

## 3. 현행 코드 갭 (구현 전 확인 완료)

| # | 갭 | 근거 | 해소 단계 |
|---|---|---|---|
| G1 | **파서가 구 양식·2채널 기준** — 시트명에 `이마트` 포함이면 EMART, 나머지는 전부 DELIVERY. 헤더도 `농가명`/`포장지`/`중량` 4줄 기준 | `lib/purchase-order-parser.ts:209`, `:108` | **D0 (선행 블로커)** |
| G2 | 액션 반환 타입의 `channel`이 `'DELIVERY' \| 'EMART'`로 협소 (스키마 enum은 5종) | `app/actions/purchase-order.ts:371`, `:424` | D0 |
| G3 | **매트릭스용 조회 액션 없음** — 현재는 건 1개 단위 `getPurchaseOrderDetail`뿐. 매트릭스는 묶음 전체(행=수령처 × 열=규격) | `app/actions/purchase-order.ts:431` | D2 |
| G4 | **N+1 심각** — `getPurchaseOrderDetail`이 라인마다 `loadAvailablePackages` 쿼리. 택배 124건 × 14규격 ≈ 1,700라인이면 수천 쿼리 | `:450-465`, `:76` | D2 (배치 조회로 신규 작성) |
| G5 | `UploadSummaryRow`에 **channel 없음** — 시안 묶음목록 1열이 채널 배지, 채널 필터칩도 있음 | `:321` | D1 |
| G6 | `PurchaseOrderUpload`에 **비고(note) 컬럼 없음** — 시안 ⋮ 메뉴에 「비고 수정」 | `prisma/schema.prisma:364` | D1 (마이그레이션) |
| G7 | **dry-run 조회 없음** — 검토 게이트가 요구 | — | D3 |
| G8 | **여러 건 일괄 확정 액션 없음** — `confirmOrder(orderId)` 단건만 | `:616` | D3 |
| G9 | 엑셀 내보내기·로트 배분 시트 백엔드 전무 | — | D5 |

**재사용 가능(신규 불필요)**: `suggestAllocation`(순수함수 → dry-run 그대로 재사용) · `listProductTypes(filter)`(수동지정 SKU 드롭다운) · `confirmOrderItem` / `cancelOrderItemMovements` / `setOrderItemProductType` / `autoMatchOrderItem` / `deletePurchaseUpload`.

## 4. 단계별 작업

### D0. 파서 통일양식 대응 (선행)

시안·스키마는 통일양식(결정 #26)인데 파서만 구 양식이라, 이걸 먼저 안 고치면 D1 이후 전부 실데이터 검증이 막힌다.

- `lib/purchase-order-parser.ts`
  - `channelOf()` — 시트명 `채널_YYMMDD` prefix로 5채널 판별(택배/이마트/서울급식/해남급식/기업별, fallback=CORPORATE)
  - `detectHeaderLayout()` — 3줄 헤더(품종+도정 / 포장지 / 중량) 대응. A열 라벨 탐지 방식은 유지(행 하드코딩 회피)
  - zod 스키마 `channel` enum 5종으로 확장
  - 채널별 vendor/recipient 규칙(빈칸→vendor 복사 등)은 기존 로직 확인 후 보강
- `lib/purchase-order-parser.test.ts` — 실파일 `docs/resources/발주서-통일양식-템플릿.xlsx`로 채널별 케이스 교체
- `app/actions/purchase-order.ts` — `OrderRow.channel` / `OrderDetail.channel` 타입 5종으로 확장 (G2)
- **검증**: `npm test` (tsx --test) 통과 + 5채널 시트 파싱 결과 수치 확인

#### D0 진행 중 추가로 드러난 것 (2026-08-18)

- **G10. DB enum이 2종에 머물러 있었다** — `prisma/schema.prisma`는 5종으로 수정돼 있었지만(미커밋), 실제 마이그레이션 `20260622000000`의 SQL은 `ENUM ('DELIVERY', 'EMART')`. → 신규 마이그레이션 `20260818000000_purchase_channel_5types` 추가(값 3종 append, 비파괴). **Neon 실DB 적용 필요.**
- **G11. 매처 테스트가 구 양식 파일에 의존** — `발주서.xlsx`(구 양식)에서 품목명을 뽑아 18종을 대조하고 있었다. 새 파서는 구 양식을 파싱하지 않으므로 파일 의존을 끊고 기대표 키를 순회하도록 변경(검증 내용 동일).
- **G12. 통일양식 품목명은 23종** (구 18종과 상당수 불일치 — 렌틸콩·율무·혼합곡·칼슘기장·새청무 등 신규). 매칭 성공 여부는 **D1 실업로드에서 확인**하고, 실패 품목은 별칭 학습(#22)·SKU 마스터 보완으로 해소한다.
- `orderDate`를 시트명 `YYMMDD`에서 파싱해 `PurchaseOrderUpload`·`PurchaseOrder`에 저장(기존에는 항상 null이라 중복감지 키가 약했다).
- 미인식 시트는 `skipped[]`로 반환해 업로드 모달에서 경고(통일양식 작성안내 5번).

### D1. 엑셀 업로드 + 묶음 목록 (데스크탑)

시안: `엑셀업로드-데스크탑.html`, `묶음목록-데스크탑.html`

- 스키마: `PurchaseOrderUpload.note String?` 추가 + 마이그레이션 (G6, Neon 실DB 적용)
- 액션:
  - `listPurchaseUploads()` 반환에 `channel` 추가 (G5)
  - `updateUploadNote(uploadId, note)` 신규 — OPERATION_MANAGE
- 화면: `app/(dashboard)/sales/product-sales-section.tsx` 를 테이블로 교체
  - 신규 `upload-table.tsx`(채널·파일명·업로드일시·건수·진행·매칭실패) / `upload-dialog.tsx`(드롭존 → 파싱 요약 → 중복경고 force 분기) / `upload-row-menu.tsx`(⋮ 엑셀 다운로드[비활성] / 비고 수정 / 삭제[차감 있으면 비활성])
  - 채널 필터칩
- **검증**: 실제 발주서 5채널 업로드 → 묶음 행·요약 수치 일치 확인

### D2. 매트릭스 + 셀 FIFO 배분 (핵심)

시안: `건처리-택배-매트릭스-데스크탑.html`

- 신규 순수 lib `lib/purchase-order-matrix.ts` — 행=수령처 × 열=규격 피벗, 규격별 소계·kg, 정렬(가나다/최신/작업필요), 셀 상태 파생. **DB 접근 없음 → 단위테스트 대상**
- 신규 액션 `getUploadMatrix(uploadId)` (G3·G4) — 묶음의 전 order·item·가용재고를 **배치 조회 1~3회**로 수집(SKU별 가용재고를 한 번에 집계 후 메모리 배분). 라인 루프 안에서 쿼리 금지
- 신규 라우트 `app/(dashboard)/sales/purchase/[uploadId]/page.tsx` + 클라이언트 컴포넌트
  - 매트릭스(수령처 좌측 고정 · 규격 헤더 상단 고정 · 가로 스크롤)
  - 셀 클릭 → FIFO 배분 팝오버(추천값 기본, 로트·수량 조정) → `confirmOrderItem` / 차감된 셀 → `cancelOrderItemMovements`
  - 매칭실패 셀 → 수동지정(품종→규격→포장지, `listProductTypes` 재사용) → `setOrderItemProductType`(별칭 학습 체크박스) / `autoMatchOrderItem`
  - 이름 클릭 → 수령처 전체 주문 상세 패널
- **검증**: 택배 실파일로 셀 차감 → `/packages` 가용재고 감소 확인, 취소 시 복원 확인. 1,700라인 렌더·쿼리 수 확인

### D3. 행 일괄선택 + 검토 게이트

시안: `검토게이트-일괄차감.html` (컴팩트 v2, 760px)

- 신규 액션:
  - `previewConfirmOrders(orderIds)` — dry-run. `suggestAllocation`을 **커밋 없이** 돌려 차감예정 수량·정상/부분/제외 라인 수·이슈 목록(매칭실패·재고부족 2종) 반환
  - `confirmOrders(orderIds, expected)` — 확정 시 서버에서 **재계산**, 검토 결과와 다르면 확정 중단하고 재검토 응답(조용한 부분차감 금지)
- 화면: 행 체크 → 하단 일괄 차감 바 → 검토 게이트 모달(① 차감예정 kg ② 스택 바 ③ 차단 배너 + 이슈 목록) → 확정 결과
- 단일 셀 차감은 게이트 예외(시안 결정 3)
- **검증**: 매칭실패·재고부족 섞인 묶음으로 게이트 표시값 = 실제 차감 결과 일치 확인

### D4. 나머지 채널 + 마무리

- 이마트·서울급식·해남급식·기업별 시안 대조 — 같은 매트릭스 컴포넌트에 데이터만 교체
- 발주처≠수령인일 때만 `A → B` 표기 규칙
- ⋮ 메뉴·비고 수정 시트 마감
- **검증**: 5채널 전부 업로드→차감 1회씩 통과. 이 시점의 실제 수령처×규격 분포를 기록 → M1 경계값 확정 근거

### M1. 모바일 3모드 매트릭스

시안: `건처리-매트릭스-모바일.html`, `모바일-채널별케이스점검.html`

- `lib/purchase-order-matrix.ts`에 모드 판정 함수 추가(카드 / 전치 / 표준) + 단위테스트. **경계값은 D4 실측으로 확정**
- 렌더 3종 + 셀 탭 → FIFO 바텀시트, 열/행 머리글 탭 → 일괄 차감
- 카드 폰트 키우지 말 것 — 정보 재배치로 해결

### M2. 모바일 업로드·결과 시트

시안: `엑셀업로드-모바일.html`, `묶음목록-모바일.html`, `차감확정-결과-모바일.html`

### D5. 엑셀 내보내기 + 로트 배분 시트

시안: `엑셀내보내기-데스크탑.html` / `-모바일.html`, `로트배분시트-출력포맷.html`

- 신규 액션 `exportPurchaseOrderExcel(uploadId, opts)` — 원본 양식 복원 + 차감 결과 셀 색 + 로트 배분 시트 옵션. 기존 `lib/*-excel.ts` 패턴 재사용
- **외부매입 잡곡은 `lotNo`가 항상 null** → 그룹 키는 `packageId`, 표시만 「매입 · {purchaseVendor}」

## 5. 신규/수정 서버 액션 요약

| 액션 | 단계 | 비고 |
|---|---|---|
| `updateUploadNote(uploadId, note)` | D1 | 신규 · OPERATION_MANAGE |
| `listPurchaseUploads()` → `channel` 추가 | D1 | 수정 |
| `getUploadMatrix(uploadId)` | D2 | 신규 · **배치 조회 필수** |
| `previewConfirmOrders(orderIds)` | D3 | 신규 · dry-run |
| `confirmOrders(orderIds, expected)` | D3 | 신규 · 재계산 불일치 차단 |
| `exportPurchaseOrderExcel(uploadId, opts)` | D5 | 신규 |

## 6. 리스크 / 확인 필요

1. **성능(G4)** — 택배 묶음 1,700라인 매트릭스. `getUploadMatrix`를 배치로 못 짜면 화면이 못 뜬다. D2에서 쿼리 수를 실측한다.
2. **동시성** — 검토 화면을 띄운 사이 다른 사용자가 같은 재고를 차감 가능. D3에서 확정 시 재계산·중단으로 처리.
3. **마이그레이션(G6)** — `note` 컬럼 추가는 Neon 실DB에 적용된다. 배포 시 `prisma migrate deploy`가 자동 반영.
4. **~~확인 필요~~ → 확정(2026-08-18)**: **파일 1개 = 채널 1개.** 실무에서 채널이 섞인 파일은 쓰지 않는다. 따라서 묶음 = 단일 채널 배지로 확정하고, 파서는 파일 내 시트들의 채널이 갈리면 **업로드를 거부**한다(조용한 혼합 적재 금지).
5. 시안 HTML은 **디자인 참조**이며 그대로 이식하지 않는다. Tailwind 임의값 → shadcn 시맨틱 토큰으로 치환.

## 7. 검증 원칙

- 순수 로직(파서·매처·배분·매트릭스 피벗·모드 판정)은 `lib/*.test.ts`에 단위테스트, `npm test`로 확인
- 화면은 실제 발주서 파일로 업로드→차감→취소 왕복 후 `/packages` 가용재고 수치로 확인
- 각 단계 완료 시 결과보고서(`docs/report-*.md`) + `docs/worklog.md` 갱신
