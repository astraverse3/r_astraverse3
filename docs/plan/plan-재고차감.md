# 제품재고 차감 화면 — 구현 계획

작성일: 2026-08-31
관련: [[project_nonsale_movement]] · 결정 #17·#19·#25 · 백로그 §14
선행 관계: **D2 매트릭스보다 먼저**(현 제품재고가 실재고가 아니라 판매 테스트 불가)

> 파일명이 `plan-비판매차감.md`였으나 협의 결과 **판매 사유도 포함**하게 되어
> 기능 이름을 「재고차감」으로 확정하고 이 문서로 대체한다.

---

## 1. 왜 지금인가 — 규모 실측 (2026-08-31, Neon 실 DB)

| 항목 | 값 |
|---|---|
| 제품재고 행 총계 | **629건** (벼 625 / 잡곡 4) |
| 수량·중량 | **64,479개 · 719.9톤** |
| 가용 > 0 행 | **605건** |
| 가용 = 0 행 | 24건 (전부 재포장 소진분) |
| `PackageMovement` 총 건수 | **24건 — 전부 `REPACK`** |
| 판매·비판매 차감 | **0건** |

가용>0 행의 생성월: 2026-02월 201 · 03월 74 · 04월 64 · 05월 50 · 06월 60 · 07월 65 · 08월 91.
2월분 201행이 아직 살아 있는 게 증거다 — **시스템은 재고가 나간 적이 없다고 믿고 있다.**
이 상태로 D2를 켜면 FIFO 배분이 이미 팔린 재고를 집는다.

## 2. 협의로 확정된 사항 (2026-08-31)

| # | 결정 | 근거 |
|---|---|---|
| N1 | 기능 이름 = **재고차감** (「비판매차감」 폐기) | 사유에 판매가 들어가므로 |
| N2 | 사유 = **판매 / 증정 / 분실 / 파손 / 기타** | 과거 판매분 정리를 `SALE`로 넣기로 함 |
| N3 | **일상 차감과 대량 정리는 같은 흐름 하나** | "다중선택해도 사유가 하나면 같은 프로세스" — 1건은 1건만 고른 경우 |
| N4 | 벼·잡곡 **둘 다** 차감 버튼 | 잡곡도 분실·증정은 생긴다. 패널 한 줄 추가라 비용 없음 |
| N5 | 확인 절차 **항상** | 되돌릴 수 있어도 대량 오조작 비용이 크다 |
| N6 | 되돌리기 진입점 = **제품재고 목록의 「차감된 재고 보기」 스위치** | 탭 신설은 층위가 안 맞음. 재고가 있던 그 자리에서 본다 |
| N7 | **판매 내역 목록은 D2와 함께** | 이번 범위 밖 |

### N7 보충 — 왜 미뤄도 안전한가
`PackageMovement` 한 테이블이 판매·비판매·발주서·재포장을 모두 담는다. 판매 내역 목록은
`type = SALE` 필터 하나면 되고, D2가 붙으면 `orderItemId`가 채워진 발주서 차감분이
**같은 목록에 자동 합류**한다(출처는 `orderItemId` 유무로 「발주서」/「직접」 배지). 지금 만들
차감 데이터는 그때 그대로 쓰인다 — 버려지는 작업이 없다.

## 3. 목표 흐름

```
제품재고 목록 → [차감] 모드 → 행 고르기(1~N) → 사유·발생일·개수 → 확인 → 차감
                              ↑ 재포장 선택 모드 인프라 그대로 재사용

되돌리기: 「차감된 재고 보기」 ON → 차감된 행 ⋮ → 차감 이력 → 되돌리기
```

## 4. 이미 있는 것 / 없는 것

### 있는 것
- `app/actions/package-movement.ts` — `createSale` · `createNonSaleMovement` · `cancelMovement`
  · `listMovements(packageId)` · `createMovementChecked`(가용 검증 + 동시성 사후검증)
- enum `MovementType` = SALE | GIFT | LOST | DAMAGED | REPACK | OTHER
- 선택 모드 인프라 — `PackageSelection`(체크박스 열 `PKG_GRID_SELECT`) · 하단 sticky 선택 바
  · 모바일 floating pill. 전부 `package-list-client.tsx`, 재포장이 쓰고 있다.
- `lib/package-available.ts` — `availableOf` · `MOVEMENT_COUNT_SELECT` (🔴 손으로 다시 쓰지 않는다)

### 없는 것 (이번에 만듦) — §5

## 5. 단계별 작업

### D1. 서버 — 일괄 차감 액션

`app/actions/package-movement.ts`에 `createBulkMovements` 추가.

```ts
input: {
  items: { packageId: number; count: number }[]
  type: 'SALE' | 'GIFT' | 'LOST' | 'DAMAGED' | 'OTHER'   // REPACK 불가
  customer?: string   // type=SALE일 때만
  note?: string
  occurredAt?: Date
}
```

🔴 **왕복을 행 수와 무관하게 고정한다.** 현 단건 액션을 200번 루프로 부르면 Neon 왕복
250~300ms × 200 ≈ 1분 → 트랜잭션 타임아웃. 배송·상차 적재에서 이미 터뜨린 그 모양이다
(**교훈: 루프 안 INSERT는 20회가 한계**).

1. `findMany`(대상 + `MOVEMENT_COUNT_SELECT`) 1회 → `availableOf`로 메모리 검증
2. `createMany` 1회
3. 사후 `groupBy` 집계 1회 → 초과분 있으면 throw(롤백)
4. `$transaction(..., { timeout: 30_000 })`

- 감사로그 1건 요약 (`재고차감(판매) 87행 · 1,240개`) + `details`에 전체 배열
- 권한 `OPERATION_MANAGE`, revalidate `/packages`·`/sales`
- 기존 단건 액션은 남긴다(다른 경로에서 쓸 수 있음). 화면은 일괄만 쓴다.

### D2. 🔴 `cancelMovement` — 재포장 취소 차단 (기존 결함)

현재 `orderItemId != null`만 거부하고 **`repackId`는 보지 않는다**. 지금은 취소 버튼이
화면에 없어 안 터졌지만, 「차감된 재고 보기」를 켜면 재포장 소진 24행이 노출된다.
거기서 되돌리면 **원본은 복원되고 재포장 결과 행은 그대로 남아 재고가 이중 계상**된다
(`lib/package-guard.ts`의 `REPACK_DELETE_BLOCKED`가 막으려던 것과 같은 사고).

```ts
if (mv.repackId !== null) return { success: false, error: REPACK_CANCEL_BLOCKED }
```

문구는 `lib/package-guard.ts`에 상수로 둔다 — 규칙·문구의 단일 원천이 거기다.
역방향 재포장이 정식 경로라는 안내를 포함(결정 #57).

### D3. 조회 — 차감된 재고 + 이력

- `getPackages`에 `includeDeducted?: boolean` 추가.
  켜면 `available <= 0` 행도 포함하고, 행에 차감 요약을 실어 보낸다
  (`deductedAt` 최근일 · `deductedTypes`). 끄면 지금과 완전히 동일.
- 그룹 합계가 차감분까지 더해 튀지 않도록 **차감 행은 합계에서 제외**하거나 별도 표기.
- 개별 이력은 기존 `listMovements(packageId)` 그대로 사용.

### D4. 선택 모드 2종화

`package-list-client.tsx` · `package-row.tsx` · `rice-package-panel.tsx` · `misc-package-panel.tsx`

- `selectMode: boolean` → `'repack' | 'deduct' | null`
- 동질성 제약(`identityKey` — 품종·도정유형·출처)은 **재포장 전용**.
  차감은 아무 행이나 함께 고를 수 있다 → `isDisabled`를 모드별 분기
- 하단 선택 바 문구·버튼 분기 (재포장 "최대 N kg / 재포장하기" ↔ 차감 "N건 · M개 / 차감하기")
- `deduct-toggle-button.tsx` 신설 — `repack-toggle-button.tsx`를 본뜨되 **새 어휘 안 만든다**.
  두 버튼은 배타(하나 켜면 다른 쪽 disabled) — 기존 `disabled={selectMode}` 패턴 그대로

### D5. 차감 다이얼로그 (신규)

`app/(dashboard)/packages/deduct-dialog.tsx`

- 사유 5종. **판매를 고르면 거래처 입력칸 노출**(`customer`)
- 발생일 — 기본 오늘. **과거 판매분 정리라 소급이 핵심**
- 사유 메모(`note`) — 기타는 사실상 필수 안내
- 선택 행 목록: 품종 · 규격 · 로트 · 가용 · **차감개수(기본=전량)**
  - 200행까지 가능 → 스크롤 영역 + 「전량으로 초기화」
  - 0으로 두면 제외
- **확인 단계 항상**(N5) — 요약 「N행 · M개 · 사유」

### D6. 「차감된 재고 보기」 + 이력 다이얼로그 (신규)

- 필터 줄(`active-package-filters.tsx` 옆)에 스위치. URL 파라미터로 유지
- 차감된 행: 흐린 회색 + 「차감됨」 배지, 체크박스 비활성
- 행 ⋮ → 「차감 이력」 → `listMovements` 목록 + 되돌리기(`cancelMovement`)
  - 재포장·발주서 건은 되돌리기 자리에 사유 문구 표시(D2에서 서버도 거부)

### D7. 검증
- `npm test` · `npx tsc --noEmit` · `npm run lint`
- 🔴 `next build` 금지([[dev_verification_no_build]]) — 화면은 사용자 브라우저에서

## 6. 변경 파일

| 구분 | 파일 |
|---|---|
| 수정 | `app/actions/package-movement.ts` (D1 일괄 액션, D2 repack 차단) |
| 수정 | `lib/package-guard.ts` (D2 문구 상수) |
| 수정 | `app/actions/packages.ts` (D3 `includeDeducted`) |
| 수정 | `app/(dashboard)/packages/package-list-client.tsx` (D4) |
| 수정 | `app/(dashboard)/packages/package-row.tsx` (D4 분기 + D6 차감 행 표시) |
| 수정 | `app/(dashboard)/packages/mobile-package-card.tsx` (D4·D6 모바일) |
| 수정 | `app/(dashboard)/packages/rice-package-panel.tsx` · `misc-package-panel.tsx` (D4 버튼) |
| 수정 | `app/(dashboard)/packages/page.tsx` (D6 파라미터) |
| 신규 | `deduct-toggle-button.tsx` · `deduct-dialog.tsx` · `movement-history-dialog.tsx` |

## 7. 시안(Claude Design) 요청 범위

목록·체크박스·선택 바는 재포장 것을 그대로 쓰므로 새로 그리지 않는다. 필요한 것 **2개**:

1. **차감 다이얼로그** (D5) — 사유 선택 + 판매 시 거래처 + 행별 개수 목록
2. **차감 이력 다이얼로그 + 차감된 행 표시** (D6)

🔴 시안이 낡은 코드 스냅샷 기준으로 나온 사고가 두 번 있었다([[design_tool_claude_design]]).
→ **현재 코드 기준 스펙 문서를 `docs/handoff/재고차감/`에 먼저 뽑고** 그걸 물려서 시안을 받는다.

## 8. 남은 확인사항

- 대량 정리 실행 시 **발생일을 행마다 다르게** 줘야 하는가?
  (2월 재고와 8월 재고를 같은 날짜로 차감하면 이력이 뭉갠다)
  → 일단 묶음당 1개 날짜. 필요하면 여러 번 나눠 실행.
