import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  movedCountOf,
  availableOf,
  availableKgOf,
  toGuarded,
  MOVEMENT_COUNT_SELECT,
} from './package-available'

const mv = (...counts: number[]) => counts.map((count) => ({ count }))

// ------------------------------------------------------
// movedCountOf
// ------------------------------------------------------

test('차감이 없으면 0', () => {
  assert.equal(movedCountOf({ movements: [] }), 0)
})

test('여러 movement를 더한다', () => {
  assert.equal(movedCountOf({ movements: mv(1, 2, 3) }), 6)
})

// ------------------------------------------------------
// availableOf
// ------------------------------------------------------

test('가용 = count - 차감합', () => {
  assert.equal(availableOf({ count: 10, movements: mv(3) }), 7)
})

test('전부 차감되면 0', () => {
  assert.equal(availableOf({ count: 10, movements: mv(4, 6) }), 0)
})

test('차감이 count를 넘으면 음수를 그대로 낸다 — 0으로 덮지 않는다', () => {
  // 데이터가 깨졌다는 신호다. 감추면 목록 필터(available <= 0)에서 조용히 사라진다.
  assert.equal(availableOf({ count: 5, movements: mv(8) }), -3)
})

// ------------------------------------------------------
// toGuarded — packages.ts 로컬 헬퍼에서 승격 (#78)
// ------------------------------------------------------

test('조회 행을 guard 모양으로 옮긴다', () => {
  assert.deepEqual(
    toGuarded({ id: 7, packageType: '5kg', count: 10, repackId: null, movements: mv(2, 1) }),
    {
      id: 7,
      packageType: '5kg',
      count: 10,
      movedCount: 3,
      repackId: null,
      weightPerUnit: undefined,
      packagingId: undefined,
    },
  )
})

test('단중·포장지는 넣은 것만 실린다 (#74)', () => {
  const g = toGuarded({
    id: 1,
    packageType: '톤백',
    count: 1,
    movements: [],
    weightPerUnit: 1004,
    packagingId: 3,
  })
  assert.equal(g.weightPerUnit, 1004)
  assert.equal(g.packagingId, 3)
})

test('안 넣은 축은 undefined — guard가 그 축을 검사하지 않는다', () => {
  const g = toGuarded({ id: 1, packageType: '1kg', count: 5, movements: [] })
  assert.equal(g.weightPerUnit, undefined)
  assert.equal(g.packagingId, undefined)
  assert.equal(g.repackId, undefined)
})

// ------------------------------------------------------
// select 조각
// ------------------------------------------------------

test('select 조각이 계산 함수가 읽는 모양과 일치한다', () => {
  assert.deepEqual(MOVEMENT_COUNT_SELECT, { movements: { select: { count: true } } })
})

// ------------------------------------------------------
// availableKgOf — 목록·엑셀이 보여 주는 「남은 중량」
// ------------------------------------------------------

const pkg = (count: number, weightPerUnit: number, totalWeight: number, ...moved: number[]) => ({
  count,
  weightPerUnit,
  totalWeight,
  movements: mv(...moved),
})

test('차감이 없으면 totalWeight 그대로 — 곱셈 오차를 들이지 않는다', () => {
  assert.equal(availableKgOf(pkg(115, 10, 1150)), 1150)
})

test('일부 차감이면 가용 × 단중 (새청무 10kg 115개 중 52개 차감 → 630kg)', () => {
  assert.equal(availableKgOf(pkg(115, 10, 1150, 52)), 630)
})

test('소수 단중은 3자리로 반올림한다', () => {
  // 0.907 × 7 = 6.348999… 같은 부동소수 꼬리가 화면에 안 나오게
  assert.equal(availableKgOf(pkg(10, 0.907, 9.07, 3)), 6.349)
})

test('전부 차감·초과 차감이면 0 — 중량은 음수로 보이지 않는다', () => {
  assert.equal(availableKgOf(pkg(5, 10, 50, 5)), 0)
  assert.equal(availableKgOf(pkg(5, 10, 50, 7)), 0)
})

test('잔량 줄(개수 1)은 차감 전엔 totalWeight, 차감되면 0', () => {
  assert.equal(availableKgOf(pkg(1, 3.4, 3.4)), 3.4)
  assert.equal(availableKgOf(pkg(1, 3.4, 3.4, 1)), 0)
})
