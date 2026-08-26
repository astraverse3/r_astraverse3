# 계획서 — 재고 재포장 (분할 · 병합)

- 작성일: 2026-08-26
- 배경: `docs/plan/plan-발주서판매처리-양식통일.md` §7 미결(재고 분할 차감)을 파다가, **분할과 병합이 같은 기능**임이 드러나 독립 작업으로 분리
- 순서: **이 작업 → D2 매트릭스** (2026-08-26 사용자 확정)
- 연관: `docs/plan/plan-발주서판매처리-D2매트릭스.md` §2 (결정 #42는 이 문서의 결정 #43으로 흡수)

---

## 1. 작업 목표

**제품 재고를 다른 규격으로 다시 나눈다.** 지금 시스템에는 이 행위가 아예 없다.

```
분할  톤백 1,004kg ×1   →  1,000kg ×1 + 4kg ×1        (1 → 2)
규격변경  잔량 4kg ×1     →  1kg ×4                     (1 → 1)
병합  잔량 10행 84kg     →  20kg ×4 + 잔량 4kg          (10 → 2)
```

셋 다 **「소스 행 N개를 소진하고 결과 행 M개를 만든다 · 중량 보존」** 하나의 행위다.
따로 만들면 모델이 갈라지므로 **하나의 액션**으로 짓는다.

---

## 2. 실측 근거 (2026-08-26 Neon 실DB)

### 2.1 잔량이 7톤 쌓여 있다

| 항목 | 값 |
|---|---|
| 잔량 96행 중 **가용** | **96행 (100%)** — 도입 이래 한 톨도 소진되지 않음 |
| 쌓인 총량 | **7,006kg** |
| 중량 분포 | 1~10kg **68행** · 10~100kg 23행 · 100kg+ 4행(200 · 871 · 4,865kg) |
| lotNo 보유 | 94 / 96 |
| 생성 연도 | 전부 2026 |

`app/actions/milling.ts:15`는 잔량을 「자체 판매 안 함(**재포장 소진**) → SKU 미부여」로 정의하고 있다.
정의는 처음부터 맞았고, **그 재포장 수단이 없어서** 7톤이 소진되지 못한 채 쌓인 것이다.

100kg+ 4행(특히 4,865kg)은 사실상 벌크이므로, 재포장이 생기면 톤백·20kg로 정리 대상이다.

### 2.2 병합 대상이 이미 널려 있다

```
같은 로트에 규격 2종 이상 공존: 86 / 115 로트

251119-11-15100914-391 (하이아미):
  잔량 5 + 17 + 25 + 1 + 2 + 8 + 3 + 10 + 10 + 3kg = 84kg 가 10개 행으로 흩어짐
  → 같은 로트이므로 20kg × 4자루 + 잔량 4kg 로 정리 가능
```

### 2.3 분할이 필요한 건 톤백뿐

톤백 199행 / 자루중량 **124종** / 100~1,282kg / 100kg 배수는 **29행뿐**.
「1,000kg 주문에 1,004kg 자루」는 예외가 아니라 기본값이다.
반면 일반 규격(1·3·4·5·8·10·20kg)은 낱개 단위라 `PackageMovement.count` 정수로 이미 전부 표현된다.

---

## 3. 결정 #43 — 재포장 모델

### 3.1 소스 소진은 `PackageMovement`로, 결과 생성은 새 행으로, `Repack`이 둘을 묶는다

```prisma
enum MovementType {
  SALE
  GIFT
  LOST
  DAMAGED
  REPACK   // ★신규 — 재포장으로 소진(판매 아님)
  OTHER
}

// 재포장 1회 = 소스 소진(movements) + 결과 생성(results)
model Repack {
  id          Int      @id @default(autoincrement())
  occurredAt  DateTime @default(now())  // 실제 작업일(사용자 입력 가능)
  note        String?
  lossKg      Float    @default(0)      // 소스 합 - 결과 합 (0 이상)
  createdById String?
  createdName String?
  sources     PackageMovement[]         // type=REPACK
  results     MillingOutputPackage[]
  createdAt   DateTime @default(now())
}

model PackageMovement {
  // ... 기존
  repackId Int?     // type=REPACK일 때만
  repack   Repack?  @relation(fields: [repackId], references: [id])
}

model MillingOutputPackage {
  // ... 기존
  repackId Int?     // 재포장으로 생겨난 행
  repack   Repack?  @relation(fields: [repackId], references: [id])
}
```

**핵심 이점 — 가용재고 공식을 한 글자도 바꾸지 않는다.**

`available = count - SUM(movements.count)` 는 이미 아래에 박혀 있다.

| 위치 | 용도 |
|---|---|
| `app/actions/packages.ts:189-190` | 제품재고 목록 |
| `app/actions/purchase-order.ts:66-72` | FIFO 가용 패키지 조회 |
| `app/actions/purchase-order.ts:140-141` | 차감 시 재고 초과 차단 |
| `app/actions/purchase-order.ts:331-336` | SKU별 가용 합계 |

소스 소진을 movement로 표현하면 이 네 곳이 **자동으로** 재포장을 반영한다.
`PackageMovement`에 중량(kg) 필드를 더하는 대안은 가용재고를 「개수」와 「kg」 두 갈래로 쪼개
비판매 차감·통계까지 재작성하게 만든다. **택하지 않는다.**

### 3.2 소스 선택 제약

**같아야 하는 것**: `varietyId`(품종) · `millingType`(도정유형) · `source`(MILLED/PURCHASED) · `category`(RICE/MISC_GRAIN)

- 품종·도정유형이 다르면 물리적으로 섞을 수 없다(백미와 현미, 하이아미와 CJ6)
- 도정산(MILLED)과 잡곡매입(PURCHASED)도 섞지 않는다 — 출처 필드 구조 자체가 다르다

**달라도 되는 것**: `lotNo`

> 「원칙은 동일 로트끼리만 묶어야 하지만, 실제로는 도정할 때도 같은 품종이면 섞이게 되는 게 사실이야.
> (…) 실제로는 로트 다른 잔량도 합해서 하나의 로트를 지정하여 판매될 수도 있어.」 — 2026-08-26 사용자

### 3.3 결과 행의 로트는 사람이 지정한다

결과 줄마다 로트를 고른다. 후보 = **소스로 선택된 행들의 lotNo 목록**.
소스가 단일 로트면 자동 선택되고 드롭다운이 뜨지 않는다.

이건 새 개념이 아니다. 도정 포장 입력이 이미 같은 결로 동작한다 —
`app/(dashboard)/milling/add-packaging-dialog.tsx:62` `computeLotGroups`가 배치의 stock을 로트로 그룹핑하고,
사람이 섹션별로 포장 개수를 넣는다. **비율 자동배분은 없다**(2026-03-23 `9defc62`에서 제거).
재포장도 동일하게 **사람이 지정**한다.

### 3.4 결과 행의 필드 승계

| 필드 | 값 |
|---|---|
| `lotNo` | 지정값 (§3.3) |
| `batchId` · `stockId` · `varietyId` · `purchaseVendor` · `incomingDate` · `productCode` | **지정한 로트의 소스 행**에서 승계 |
| `source` · `category` | 소스와 동일(제약상 전부 같음) |
| `packageType` · `weightPerUnit` · `count` | 입력값 |
| `totalWeight` | `weightPerUnit × count` |
| `productTypeId` | `findOrCreateProductType`(`lib/product-type.ts`) — **잔량은 null 유지** |
| `repackId` | 이번 Repack |

### 3.5 중량 보존

```
SUM(소스 소진 kg)  ≥  SUM(결과 kg)
차이 = Repack.lossKg
```

- 결과가 소스를 **초과하면 차단**(없는 쌀을 만들 수 없다)
- 부족분은 손실로 기록. 다만 재포장은 옮겨 담는 작업이라 손실이 크면 입력 실수일 가능성이 높으므로,
  **손실이 소스 합의 1%를 넘으면 확인을 한 번 받는다**(차단은 아님)

### 3.6 되돌리기 — `cancelRepack(repackId)`

**결과 행 전부에 차감(movement)이 하나도 없을 때만** 허용한다.

- 결과 행 하드 삭제 + 소스의 REPACK movement 삭제 → 소스 가용이 원래대로 복원
- 결과가 이미 팔렸으면 되돌릴 수 없다(에러 메시지로 안내)
- 재고를 직접 쪼개는 작업이라 실수 가능성이 높아 **1차 범위에 포함**한다

### 3.7 권한

`OPERATION_MANAGE` — 포장 작업이므로 도정·포장(`milling.ts`)과 같은 키.

---

## 4. 구현 단계

### R1. 스키마 + 순수 검증 lib + 액션

- **스키마**: `MovementType.REPACK` 추가 · `Repack` 모델 신규 · `PackageMovement.repackId` · `MillingOutputPackage.repackId`
  - 마이그레이션 생성 후 **Neon 실DB 적용**
  - enum 값 추가는 비파괴(append)
- **신규 `lib/repack.ts`** (DB 접근 없음 → 단위테스트 대상)
  - `validateRepack(sources, results)` — 소스 동질성(§3.2) · 가용 초과 · 중량 보존(§3.5) 검증
  - `computeLoss(sources, results)` · 로트 후보 산출
- **신규 `app/actions/repack.ts`**
  - `getRepackCandidates(varietyId, ...)` — 재포장 가능한 재고 행 목록(가용>0, 동질성 그룹 정보 포함)
  - `createRepack(input)` — 트랜잭션 1회: ① Repack 생성 ② REPACK movement `createMany` ③ 결과 행 `createManyAndReturn`
    - **⚠️ 루프 안 INSERT 금지** — 배송·상차 D1b 교훈(Neon 왕복 250~300ms × N > 기본 5초 타임아웃).
      왕복 3회로 묶고 `timeout: 30000` 지정
    - `findOrCreateProductType`는 결과 줄의 **고유 SKU 조합 수**만큼만 호출(중복 제거 후)
  - `cancelRepack(repackId)` — §3.6
  - 전부 `OPERATION_MANAGE` + `recordAuditLog`
- **검증**: `npm test`(신규 `lib/repack.test.ts`) + `npx tsc --noEmit` + `npx eslint`

### R2. 제품재고 화면 — 재포장 다이얼로그

- **소스 선택**: `/packages` 목록 행에 체크박스 추가 → 하단 「재포장」 바
  - 첫 행을 고르면 **동질성(§3.2)이 다른 행은 자동 비활성** — 왜 못 고르는지 툴팁으로 설명
  - 대안(B안): 목록은 그대로 두고 다이얼로그 안에서 품종 선택 후 고르기 → 목록 UI를 덜 건드리지만
    「보면서 고르기」가 안 된다. **A안(목록 체크박스) 추천**
- **다이얼로그**: 소스 요약(총 kg·로트별 내역) → 결과 줄 입력(규격 템플릿 버튼 + 개수 + 포장지 + 로트)
  - 규격 템플릿은 포장 다이얼로그와 동일(`PACKAGE_TEMPLATES` 재사용): 톤백 · 20 · 10 · 8 · 5 · 4 · 3 · 1kg · 잔량
  - **실시간 잔여 표시**: `소스 합 − 결과 합 = 남은 kg`. 0이 되면 딱 맞음, 음수면 저장 차단
  - 모바일: 기존 포장 다이얼로그 반응형 패턴 따름(`614f2dd` 참조)
- **파일**: 신규 `repack-dialog.tsx` · `repack-result-row.tsx`(줄 단위) — 800줄 제한 대비 처음부터 분리
- **검증**: 사용자 브라우저에서 실제 잔량 병합 1건 → `/packages` 수치 확인

### R3. 재포장 이력 표시

- 결과 행에 「재포장」 배지 + 원본 로트/일시 표시(`repackId` 조인)
- 되돌리기 진입점(§3.6) — 결과 행 ⋮ 메뉴
- 규모가 작으면 R2에 합쳐서 끝낸다

---

## 5. D2와의 관계

이 작업이 끝나면 D2 계획서 §2(결정 #42)는 **「D2d 톤백 셀 팝오버에 `createRepack` 진입점을 붙인다」** 한 줄로 줄어든다.
톤백 분할은 재포장의 1→2 케이스이므로 별도 액션(`splitPackage`)을 만들지 않는다.
D2 계획서는 이 계획 승인 후 §2를 이 문서 참조로 교체한다.

---

## 6. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| 높 | **재고 데이터를 직접 만들고 없앤다.** 잘못 쓰면 재고가 틀어진다 | 트랜잭션 1회 + 가용 검증 + 중량 보존 차단 + `cancelRepack`(§3.6) + 감사로그 |
| 중 | 트랜잭션 타임아웃 — 결과 줄이 많으면 INSERT가 늘어난다 | `createMany`/`createManyAndReturn`으로 왕복 3회 고정 + `timeout: 30000` (D1b 교훈) |
| 중 | 목록 체크박스 도입이 `package-row.tsx`(208줄)·`mobile-package-card.tsx`(195줄)·`package-list-client.tsx`를 동시에 건드린다 | 선택 상태는 `package-list-client.tsx` 한 곳에 두고 하위는 prop만 받는다 |
| 중 | 로트가 다른 소스를 합칠 때 결과 로트가 사람 손에 달린다 | 소스가 2로트 이상이면 결과 줄마다 로트 선택을 **필수**로. 기본 선택 없음(무심코 넘어가지 않게) |
| 낮 | 잔량의 `productTypeId`는 null이라 SKU 기반 조회에 안 잡힌다 | 재포장 후보 조회는 SKU가 아니라 `varietyId + millingType`으로 판정(§3.2) |

---

## 7. 검증

- 순수 로직(동질성·중량 보존·손실 계산)은 `lib/repack.test.ts` 단위테스트, `npm test`
- `npx tsc --noEmit`, `npx eslint` (변경 파일)
- **`next build` 금지** — 사용자 dev 서버 상시 기동 중
- 실물 검증 시나리오(사용자 브라우저):
  1. **병합** — 로트 `251119-11-15100914-391` 잔량 10행(84kg) → 20kg ×4 + 잔량 4kg
  2. **규격변경** — 잔량 4kg ×1 → 1kg ×4
  3. **분할** — 톤백 #1277(1,004kg ×4) → 1자루를 1,000 + 4로
  4. **되돌리기** — 위 1건을 `cancelRepack` → 원래 10행 복원 확인
  - 각 단계 후 `/packages` 총 kg가 보존되는지 확인
- 완료 시 `docs/report/report-재고재포장-{날짜}.md` + `docs/worklog.md` 갱신
