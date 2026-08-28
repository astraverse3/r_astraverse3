# 계획서 — 잡곡 제품재고 수정·삭제에 차감 보호

- 작성일: 2026-08-28
- 배경: 벼 쪽 포장 수정을 diff로 막고 나서(`d18487e`) **같은 문이 잡곡에 열려 있는 것**이 드러났다
- 선행: 포장수정 diff (#62~#65) 완료
- 다음: **D2 매트릭스**

---

## 1. 문제 — 벼는 막았는데 잡곡은 열려 있다

제품재고에서 **벼는 수정·삭제 UI가 아예 없다.** 도정관리 포장 다이얼로그로만 고치고,
그 경로는 방금 diff로 막았다(차감된 행은 삭제 거부 + 차감량 밑 축소 거부).

**잡곡은 `/packages` 잡곡 탭에서 아무 때나 수정·삭제할 수 있다.**

| 액션 | 재포장 결과(`repackId`) | 차감(`movements`) |
|---|---|---|
| `deleteMiscPackage` | ✅ 막음 (#59) | ❌ 검사 없음 — **DB의 FK가 대신 막음** |
| `deleteMiscPurchase` | ✅ 막음 (#59) | ❌ 검사 없음 — **DB의 FK가 대신 막음** |
| `updateMiscPackage` | ❌ 없음 | 🔴 **아무도 안 막음** |
| `updateMiscPurchase` | 🔴 **없음** | 🔴 **아무도 안 막음** |
| `deleteMiscStock`(원물) | — | ✅ 포장된 재고면 거부 |

### 1.1 삭제 — DB가 대신 막지만 이유를 못 말한다

`PackageMovement.package`의 `onDelete`가 Prisma 기본값 `Restrict`라 차감된 행은 지워지지 않는다.
**막히기는 한다.** 그런데 사용자에게는 이렇게 뜬다:

```
포장 삭제에 실패했습니다.
```

**포장수정 diff 이전의 벼와 똑같은 상황이다.** 왜 막혔는지, 뭘 하면 풀리는지 알 수 없다.

### 1.2 🔴 수정 — 아무도 안 막는다. 이게 더 위험하다

UPDATE는 참조 무결성과 무관해서 FK가 개입하지 않는다.

> 10개 중 3개를 팔았는데 수정으로 `count`를 2로 줄이면 → **가용재고 = 2 − 3 = −1**

그리고 [packages.ts:208](../../app/actions/packages.ts#L208)이 `available <= 0`이면 목록에서 제외한다:

```ts
const used = r.movements.reduce((s, m) => s + m.count, 0)
const available = r.count - used
if (available <= 0) return []      // 목록에서 사라진다
```

**깨진 행이 화면에서 사라진다.** 재고는 증발하고 movement만 남는다.
에러 하나 없이 조용히 틀어지는 게 가장 나쁘다.

`updateMiscPurchase`는 한술 더 뜬다 — `repackId`도 안 보고, **`varietyId`·`packageType`까지 바꾼다.**
이미 팔린 물건의 품종이 바뀌는 셈이다.

### 1.3 지금 당장 터진 것은 없다 (2026-08-28 Neon 실측)

```
잡곡 제품재고 행 1개, 그중 차감된 행 0개
지금 화면에서 건드릴 수 있는 차감된 잡곡 행: 0개
(참고) 벼 제품재고 중 부분 차감된 행: 0개 — 화면에 수정/삭제 기능 없음
```

R3에서 「잡곡 재고는 1행뿐」이라며 넘겼던 상태 그대로다.

🔴 **터질 시점은 명확하다 — D2가 가동되면 SALE 차감이 잡곡에도 쌓인다.**
벼를 막아놓고 잡곡을 열어두면 같은 사고를 다른 문으로 다시 겪는다.
**데이터가 아직 안 쌓인 지금이 가장 싸다** — 마이그레이션도, 복구도 필요 없다.

---

## 2. 결정

### 결정 #66 — 차감 규칙은 한 곳에서만 정한다

지금 규칙이 `lib/packaging-diff.ts` 안에 배열 diff 전용으로 들어가 있다. 잡곡 액션은 **단건**이라
그대로 못 쓴다. 각자 구현하면 **반드시 어긋난다** — `batch-outputs.ts`(#61) 때 이미 겪었다.
지점마다 손으로 붙였다가 두 번 놓쳤다.

**`lib/package-guard.ts` 신규** — 단건 검사 + 문구의 단일 원천.

```ts
export type GuardedPackage = {
  id: number
  packageType: string
  count: number
  movedCount: number        // SUM(movements.count)
  repackId: number | null
}

/** 「20kg × 3 (3개 중 3개 차감됨)」 */
export function describeDeduction(pkg: GuardedPackage): string

/** 삭제 가능 여부 — 차감·재포장 결과 */
export function guardDelete(pkg: GuardedPackage): GuardResult

/** 수량 축소 가능 여부 — count >= movedCount */
export function guardCountChange(pkg: GuardedPackage, nextCount: number): GuardResult
```

`lib/packaging-diff.ts`는 **이 함수들을 써서** 판정한다. 문구가 한 곳에서만 정해진다.
⚠️ 리팩터 후 기존 테스트 33개가 **그대로** 통과해야 한다 — 동작은 하나도 안 바뀐다.

### 결정 #67 — 삭제는 FK가 아니라 규칙으로 막는다

`deleteMiscPackage`·`deleteMiscPurchase`가 삭제 **전에** movement를 세어 이유를 낸다.
벼와 같은 문구다:

```
이미 판매·재포장된 포장은 지울 수 없어요.
  · 서리태 5kg × 10 (10개 중 3개 차감됨)
포장을 되돌리려면 판매를 취소하거나 재포장을 정리해 주세요.
```

FK는 **최후의 방어선으로 남긴다** — 규칙이 새면 DB가 막는다. 순서만 바뀐다.

### 결정 #68 — 수정은 차감량 밑으로 줄이지 못한다

`updateMiscPackage`·`updateMiscPurchase`에 `count >= movedCount` 검사.
벼(#63)와 같은 규칙·같은 문구다.

```
서리태 5kg × 10 → 2개로 줄일 수 없어요. 이미 3개가 판매·재포장됐습니다.
```

**늘리는 것은 자유다.** 차감이 없는 행도 지금처럼 자유롭게 고친다.

### 결정 #69 — 재포장 결과는 수정도 막는다

지금은 삭제만 막고 수정은 열려 있다(비일관).
재포장 결과의 중량·개수를 고치면 **원본에서 소진한 양과 안 맞는다** — 중량 보존이 깨진다.

- `updateMiscPurchase`: `repackId !== null`이면 거부 (검사 자체가 없다)
- `updateMiscPackage`: 같은 검사 추가 (`source === 'MILLED'`인 재포장 결과가 통과한다)

### 결정 #70 — 차감된 뒤에는 품종·규격을 바꾸지 못한다 (**A안 확정**)

`updateMiscPurchase`는 `varietyId`·`packageType`을 바꿀 수 있다.
차감된 뒤에 바꾸면 **이미 나간 물건의 정체가 바뀐다.**

**차감이 있으면 품종·규격 변경만 거부한다.** 수량 증가·매입처·매입일 정정은 계속 허용한다 —
오타 하나 못 고치게 만들 이유는 없다.

```
이미 판매·재포장된 포장은 품종·규격을 바꿀 수 없어요.
  · 서리태 5kg × 10 (10개 중 3개 차감됨)
```

#### 벼와의 불일치 — 백로그로 넘긴다

계획 초안에 「벼도 규격 변경을 허용하니 같은 구멍」이라고 적었는데 **절반만 맞았다.**
서버(`packaging-diff.ts`)는 허용하지만 **화면에 그 입력이 없다** — 규격은 버튼으로 새 행을 만들 때만
정해지고, 기존 행의 규격을 바꾸는 함수 자체가 없다.

🔴 **대신 진짜 구멍은 다른 곳이었다.** 차감된 벼 16개 배치는 **전부 `잔량` 줄**인데,
잔량·톤백은 [단중 입력칸이 열려 있다](../../app/\(dashboard\)/milling/add-packaging-dialog.tsx#L637):

| 필드 | 벼 UI 경로 | 서버 |
|---|---|---|
| `packageType` | **없음** | 허용 |
| `weightPerUnit` | **톤백·잔량만 있음** 🔴 | 허용 |
| `packagingId` | 있음 🔴 | 허용 |
| `count` | 있음 | ✅ 축소 거부 |

재포장이 3kg를 소진해 간 잔량 행의 중량을 10kg으로 바꿀 수 있다 — **중량 보존이 깨진다.**
포장지를 바꾸면 이미 팔린 물건의 SKU가 바뀐다.

**이 작업 범위 밖으로 둔다.** 백로그 §19에 기록했다.

### 결정 #71 — 화면에는 배지를 달지 않는다

서버가 이유를 말하는 것으로 충분하다. 목록에 「판매됨」 배지를 붙이는 안은
**R3 #57에서 이미 기각된 방향**이다(정보 밀도만 올리고 실익이 적다). 같은 판단을 유지한다.

---

## 3. 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/package-guard.ts` | **신규** — 단건 차감·재포장 검사 + 문구 단일 원천 (#66) |
| `lib/package-guard.test.ts` | **신규** — 단위테스트 |
| `lib/packaging-diff.ts` | guard 함수를 쓰도록 정리 — **동작 변화 없음** (#66) |
| `app/actions/packages.ts` | 잡곡 4개 액션에 검사 추가 (#67·#68·#69·#70) |

`deleteMiscStock`(원물재고)은 이미 `outputPackages > 0`을 막고 있어 손대지 않는다.

### 3.1 곁다리로 보이는 것 — 가용재고 계산이 4곳에 흩어져 있다

```
app/actions/milling.ts:517      movedCount: r.movements.reduce(...)
app/actions/packages.ts:208     const used = r.movements.reduce(...)
app/actions/purchase-order.ts:66 const used = p.movements.reduce(...)
app/actions/repack.ts:74        pkg.count - pkg.movements.reduce(...)
```

`batch-outputs.ts`와 같은 냄새다. **이번엔 손대지 않는다** — guard가 `movedCount`를 인자로 받으므로
계산 자체는 호출부에 남는다. 별도 작업으로 제안한다.

---

## 4. 단계

1. **`lib/package-guard.ts` + 테스트** — 규칙과 문구부터 고정
2. **`packaging-diff.ts` 정리** — guard를 쓰도록. **기존 테스트 33개가 그대로 통과해야 한다**
3. **잡곡 액션 4개 적용** — 각 액션이 `movements`를 조회해 guard에 넘긴다
   - ⚠️ 트랜잭션 안에서 조회 → 검사 → 쓰기. 조회를 밖에 두면 그 사이 차감이 끼어들 수 있다
4. **검증**

---

## 5. 리스크

| 수준 | 내용 | 대응 |
|---|---|---|
| 중 | `packaging-diff.ts` 리팩터가 방금 검증한 벼 동작을 깨뜨림 | 테스트 33개를 **하나도 안 고치고** 통과시킨다. 못 지키면 리팩터를 접고 guard만 새로 쓴다 |
| 중 | 잡곡 수정·삭제는 **실사용 중**이다 | 차감 없는 행의 동작은 **그대로**여야 한다. 실DB 1행으로 브라우저 확인 |
| 낮 | #70을 A로 정하면 벼와 규칙이 달라짐 | 계획서에 불일치를 명시하고, 벼 조이기는 별도 작업으로 |
| 낮 | 검사 추가로 왕복 증가 | movement는 기존 조회에 `select` 한 줄 추가라 왕복이 늘지 않는다 |

---

## 6. 검증

- `lib/package-guard.test.ts` — 삭제 차단·축소 한계·재포장 결과·경계값(`count == movedCount`)
- **`lib/packaging-diff.test.ts` 33개를 수정 없이 통과** (#66 리팩터가 동작을 안 바꿨다는 증거)
- `npm test` · `npx tsc --noEmit` · `npx eslint`
- **`next build` 금지**
- **실DB**(읽기 전용 스크립트) — 잡곡 행의 차감 노출 현황 재확인
- **브라우저** — 잡곡 재고 1행으로:
  1. 차감 없는 잡곡 포장 수정 → 저장되는지 (기존 동작 유지)
  2. 차감 없는 잡곡 포장 삭제 → 지워지는지
  3. 차감 상황은 **재포장으로 만들 수 있다** — 잡곡을 재포장하면 원본에 REPACK movement가 붙는다.
     그 원본을 수정·삭제해 보고 이유가 뜨는지 확인
- 완료 시 `docs/report/report-잡곡차감보호-{날짜}.md` + `docs/worklog.md`

---

## 7. 협의 결과 (2026-08-28 확정)

1. **#70 = A안** — 차감이 있으면 품종·규격만 거부, 수량 증가·매입처·날짜 정정은 허용
2. **벼의 차감 행 단중·포장지 구멍** → 이 작업 뒤에 처리. **백로그 §19**
3. **가용재고 계산 4중복** → 별도 작업. **백로그 §20**
