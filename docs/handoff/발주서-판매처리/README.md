# Handoff: 발주서 판매처리 화면 (단계6)

> **Claude Design 전달용**. 백엔드(스키마·액션·매칭·차감)는 **이미 전부 구현·테스트 완료**(단계1~5).
> 이 핸드오프는 **화면(UI) 비주얼·레이아웃·컴포넌트**만 요청합니다. 데이터·상호작용 요구사항과
> 연결할 서버 액션 시그니처를 아래에 정확히 명시했으니, 시안은 이 데이터 구조를 그대로 채우면 됩니다.

## Overview

통합 발주서(엑셀)를 업로드 → 품목·규격별로 **제품재고(완제품 포장)** 를 차감해 판매처리하고,
그 내역을 **판매관리(`/sales`) 제품판매 탭**에서 관리하는 기능. 발주서는 2차원 매트릭스(거래처×규격)
양식이고, 시스템은 이를 정규화해 라인(`PurchaseOrderItem`)별로 SKU 매칭 → FIFO 차감한다.

화면이 다룰 핵심 흐름:
1. **업로드** → 자동매칭(품종·SKU) → 묶음/건/라인으로 적재
2. **건 상세**에서 라인별 매칭 확인 → 매칭실패는 수동지정 → 재고 차감확정(FIFO 추천)
3. **개별 판매등록 / 비판매차감**(발주서 무관, 제품재고 행에서 직접)

## 스택 / 디자인 시스템

- **Next.js 16.1.3** (App Router) · **React 19.2.3** · **Tailwind CSS v4** · **shadcn/ui**(Radix) · **lucide-react** · **TypeScript**
- **Primary**: `#2563eb` (Blue-600). Neutral = Tailwind `slate` 스케일. shadcn 시맨틱 토큰 준수.
- 모바일 우선(실사용 화면이 모바일). 카드형. ⚠️ **카드 폰트를 키우지 말 것** — 가독성은 정보 재배치로 해결.
- 기존 `/sales` 골격 참고: [app/(dashboard)/sales/product-sales-section.tsx](../../../app/(dashboard)/sales/product-sales-section.tsx) (현재 묶음 목록 골격이 이미 있음. 이걸 확장)

## 상태 색상 규칙 (전 화면 공통)

| 상태 | 의미 | 색 |
|---|---|---|
| 완료 `COMPLETED` | 전 라인 차감 완료 | `bg-emerald-50 text-emerald-700` |
| 부분 `PARTIAL` | 일부만 차감(재고부족 등) | `bg-amber-50 text-amber-700` |
| 대기 `PENDING` | 차감 0 | `bg-slate-100 text-slate-500` |
| 매칭실패 | 품종/SKU 해석 실패(`productTypeId=null`) | `bg-red-50 text-red-600` |
| 재고부족 | 주문량 > 가용량(`shortage>0`) | amber 배지 + 부족수 표시 |

---

## 화면 목록 (§8.4 — 8개)

### 화면 1. 발주서 묶음 목록 (제품판매 탭 메인)
- **진입**: `/sales` (기본 탭 = 제품판매)
- **데이터**: `listPurchaseUploads()` → `UploadSummaryRow[]`
  ```ts
  { id, fileName, orderDate: string|null, orderCount, uploadedName: string|null,
    createdAt: string, statusCount: { pending, partial, completed }, unmatched }
  ```
- **상호작용**:
  - 우상단 **[엑셀 업로드]** 버튼 → 화면 4(업로드 모달)
  - 묶음 행 클릭 → 화면 2(건 목록)로 드릴다운
  - 묶음 행 메뉴 → 삭제(`deletePurchaseUpload`, 차감된 게 있으면 비활성/경고)
- **빈 상태**: "아직 업로드된 발주서가 없어요" + 업로드 유도
- 각 행: 파일명·업로드일·건수 + 상태 배지(완료/부분/대기 카운트) + 매칭실패 수 배지

### 화면 2. 건 목록 (묶음 드릴다운)
- **데이터**: `listPurchaseOrders(uploadId)` → `OrderRow[]`
  ```ts
  { id, channel: 'DELIVERY'|'EMART', vendor, recipient,
    status: 'PENDING'|'PARTIAL'|'COMPLETED', itemCount, unmatched }
  ```
- **상호작용**:
  - 건 행 클릭 → 화면 3(건 상세)
  - 헤더 **[일괄 완료처리]** → `confirmOrder(orderId)` (선택 건 전체 FIFO 자동차감)
  - 헤더 **[엑셀 다운로드]** → export(생산자·로트 채운 양식, ⚠️ 백엔드 미구현 → 버튼만 자리, 비활성)
- 채널 배지(택배/이마트), 발주처·수령인, 라인 수, 상태, 매칭실패 표시

### 화면 3. 건 상세 (매칭·차감) — ★핵심 화면
- **데이터**: `getPurchaseOrderDetail(orderId)` → `OrderDetail`
  ```ts
  { id, channel, vendor, recipient, status, lines: DetailLine[] }
  // DetailLine:
  { itemId, rawItemName, packageType, rawPackaging: string|null, orderedQty,
    matched: boolean, productTypeId: number|null,
    variety: string|null, millingType: string|null, packaging: string|null,
    allocatedQty,                       // 이미 확정 차감된 수량
    lineStatus: 'PENDING'|'PARTIAL'|'COMPLETED',
    availableQty,                       // 이 SKU 가용 재고 합
    suggestion: { packageId, count }[], // 남은 수량 FIFO 추천 배분
    shortage }                          // 추천으로도 부족한 수량
  ```
- **라인별 상호작용**:
  - **매칭 성공 라인**: 매칭품종/도정/포장지·주문량·차감현황(`allocatedQty/orderedQty`)·가용재고 표시
    - **[차감 확정]** → `confirmOrderItem(itemId, allocations)` — `allocations`는 `suggestion`을 기본값으로, 사용자가 로트(packageId)·수량 조정 가능
    - **[차감 취소]**(차감된 라인) → `cancelOrderItemMovements(itemId)`
    - 재고부족 라인 = `shortage>0` → amber 배지 "부족 N"
  - **매칭 실패 라인**(`matched=false`) = **빨강 강조** + 원본 품목명(`rawItemName`)·규격·포장지 표시
    - **[수동 지정]** → SKU 드롭다운 선택 → `setOrderItemProductType(itemId, productTypeId, { learnAlias })`
      - `learnAlias` 체크박스: "이 품목명을 이 품종 별칭으로 학습"(다음 업로드부터 자동매칭, #22)
    - **[재매칭]** → `autoMatchOrderItem(itemId)` (마스터 보완 후 재시도)
- 헤더: 발주처·수령인·채널·전체 상태 + **[건 전체 차감확정]**(`confirmOrder`)

### 화면 4. 발주서 업로드 (모달)
- **상호작용**: 파일 선택(.xlsx/.xls) → `uploadPurchaseOrder(formData)`
- **반환 분기**:
  ```ts
  // 성공
  { success: true, uploadId, summary: { orderCount, itemCount, matched, failed } }
  // 중복 경고(#16) — 강제진행 모달
  { success: false, duplicate: true, conflicts: { vendor, recipient }[], message }
  //   → "그대로 진행" 시 uploadPurchaseOrder(formData, { force: true }) 재호출
  // 실패
  { success: false, error }
  ```
- 업로드 후 **적재 요약 토스트**: "N건 / M라인 적재, 매칭 성공 X · 실패 Y"
- 매칭실패가 있으면 → 건 상세에서 수동지정 유도 안내

### 화면 5. 개별 판매등록 (모달)
- **진입**: 제품판매 탭 또는 **제품재고 목록(`/packages`) 행** → 판매등록
- **데이터 입력**: 제품재고(packageId, 행에서 이미 정해짐)·수량·거래처·발생일·메모
- **액션**: `createSale({ packageId, count, customer?, occurredAt?, note? })`
- ⚠️ **금액(단가/매출액) 입력 없음**(결정 #25 — 수량 차감만). 가용 초과 시 에러 토스트.

### 화면 6. 비판매 차감 (모달)
- **진입**: 제품재고 목록(`/packages`) 행 → 비판매차감
- **입력**: 제품재고·수량·**사유**(GIFT 증정 / LOST 분실 / DAMAGED 파손 / OTHER 기타)·메모·발생일
- **액션**: `createNonSaleMovement({ packageId, count, type, note?, occurredAt? })`
- ⚠️ 원물(stock) 복원 안 함(#19). 판매등록 화면과 **분리**(결정 #20).

### 화면 7. 제품재고 목록 행 트리거 (`/packages` 각 행)
- 각 행에 **가용재고**(`available = count - 차감합`, 이미 `getPackages`가 동봉) 표시
- 행 메뉴(드롭다운): **판매등록**(화면5) / **비판매차감**(화면6) / **차감이력 보기**
- 차감이력: `listMovements(packageId)` → `MovementRow[]`
  ```ts
  { id, count, type, customer: string|null, note: string|null,
    occurredAt: string, createdName: string|null, fromOrder: boolean }
  ```
  - `fromOrder=true`(발주서 경로)는 여기서 취소 불가 → 발주서 상세에서. 개별건만 **[취소]**(`cancelMovement(id)`)

### 화면 8. 모바일 (전 화면)
- 동일 데이터, 카드형 레이아웃. 건 상세는 라인 카드 스택.
- ⚠️ 카드 폰트 키우지 말 것 — 줄 넘침이 더 큰 문제. 정보 재배치로 해결.

---

## 연결할 서버 액션 (이미 구현 완료 — 시그니처 고정)

| 액션 | 파일 | 권한 |
|---|---|---|
| `uploadPurchaseOrder(formData, {force?})` | `app/actions/purchase-order.ts` | OPERATION_MANAGE |
| `listPurchaseUploads()` / `listPurchaseOrders(uploadId)` / `getPurchaseOrderDetail(orderId)` | 〃 | 공개 |
| `autoMatchOrderItem(itemId)` / `setOrderItemProductType(itemId, productTypeId, {learnAlias?})` | 〃 | OPERATION_MANAGE |
| `confirmOrderItem(itemId, allocations)` / `confirmOrder(orderId)` | 〃 | OPERATION_MANAGE |
| `cancelOrderItemMovements(itemId)` | 〃 | OPERATION_MANAGE |
| `deletePurchaseUpload(uploadId)` / `deletePurchaseOrder(orderId)` | 〃 | OPERATION_MANAGE |
| `createSale(...)` / `createNonSaleMovement(...)` / `cancelMovement(id)` / `listMovements(packageId)` | `app/actions/package-movement.ts` | OPERATION_MANAGE (list 공개) |

> ⚠️ **수동지정 SKU 드롭다운용 조회 액션은 아직 없음** — 구현 단계에서 `product-type.ts`에 활성 SKU 목록 조회를 추가해야 함(품종 선택 → 규격/포장지 SKU 후보). 시안에서는 "품종 → 규격 → 포장지" 단계 선택 UI로 가정.

## 권한 / 가시성

- 모든 **write 버튼**(업로드·차감·확정·취소·삭제·판매등록·비판매차감) = `OPERATION_MANAGE` 클라이언트 가드(`hasPermission`)로 노출 제어. 권한 없으면 조회만.
- 조회(목록·상세·이력)는 모든 로그인 사용자 공개.

## Design Tokens

| 토큰 | 값 |
|---|---|
| Primary | `#2563eb` (`bg-primary`) |
| 텍스트 | `text-slate-900` / `text-slate-500`(약) / `text-slate-400`(더 약) |
| 보더 | `border-slate-200` |
| 완료/부분/대기/실패 | emerald-50·700 / amber-50·700 / slate-100·500 / red-50·600 |
| 카드 | `bg-white border border-slate-200 rounded-xl` |

## 우선순위 (시안 제작 순서 제안)

1. **화면 3(건 상세)** — 가장 복잡·핵심(매칭/차감/수동지정/FIFO). 여기가 잘 나오면 나머지는 파생.
2. 화면 1·2(묶음→건 목록) — 골격 이미 있음, 확장.
3. 화면 4(업로드 모달 + 중복경고).
4. 화면 5·6·7(개별판매/비판매차감/제품재고 행 트리거).
5. 화면 8(전체 모바일 카드).

## 참고 — 발주서 양식 / 도메인

- 발주서 엑셀 = 2차원 매트릭스(가로=규격[품목명/포장지/중량 4줄 헤더], 세로=발주처/수령인), 시트=택배·이마트.
- 품목명 정규화 예: `유기농 가바백미`→ 서농22호·백미 / `유기농 천지향`→ 천지향1세 / `유기농 가바흑미`→ 흑미(잡곡).
- 매칭 = (품종+도정+규격+포장지) → `ProductType`(SKU) 1:1. 실패 시 수동지정.
- 계획서: [docs/plan/plan-발주서판매처리.md](../../plan/plan-발주서판매처리.md) §8.4(화면 요구사항 원본).
