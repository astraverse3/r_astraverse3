import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  diffPackaging,
  formatPackagingDiffErrors,
  type ExistingPackagingRow,
  type PackagingLine,
} from './packaging-diff'

// ------------------------------------------------------
// 헬퍼 — 기본은 「20kg × 3, stock 1, 포장지 7, 차감 없음」
// ------------------------------------------------------
const row = (
  id: number,
  over: Partial<ExistingPackagingRow> = {},
): ExistingPackagingRow => ({
  id,
  packageType: '20kg',
  weightPerUnit: 20,
  count: 3,
  totalWeight: 60,
  stockId: 1,
  packagingId: 7,
  movedCount: 0,
  ...over,
})

const line = (over: Partial<PackagingLine> = {}): PackagingLine => ({
  packageType: '20kg',
  weightPerUnit: 20,
  count: 3,
  totalWeight: 60,
  stockId: 1,
  packagingId: 7,
  ...over,
})

/** 기존 행을 그대로 되보내는 입력 — 「아무것도 안 고쳤다」 */
const echo = (r: ExistingPackagingRow): PackagingLine => ({
  id: r.id,
  packageType: r.packageType,
  weightPerUnit: r.weightPerUnit,
  count: r.count,
  totalWeight: r.totalWeight,
  stockId: r.stockId as number,
  packagingId: r.packagingId,
})

const ok = (r: ReturnType<typeof diffPackaging>) => {
  assert.equal(r.ok, true, r.ok ? '' : formatPackagingDiffErrors(r.errors))
  return r as Extract<typeof r, { ok: true }>
}

const fail = (r: ReturnType<typeof diffPackaging>) => {
  assert.equal(r.ok, false, '차단됐어야 한다')
  return r as Extract<typeof r, { ok: false }>
}

// ------------------------------------------------------
// 매칭 (#62)
// ------------------------------------------------------

test('id 없는 줄은 create', () => {
  const r = ok(diffPackaging([], [line()]))
  assert.equal(r.toCreate.length, 1)
  assert.equal(r.toUpdate.length, 0)
  assert.deepEqual(r.toDelete, [])
})

test('id 있고 값이 바뀌면 update', () => {
  const existing = [row(10)]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), count: 5, totalWeight: 100 }]))
  assert.equal(r.toCreate.length, 0)
  assert.equal(r.toUpdate.length, 1)
  assert.equal(r.toUpdate[0].id, 10)
  assert.equal(r.toUpdate[0].line.count, 5)
  assert.deepEqual(r.toDelete, [])
})

test('바뀐 게 없으면 update조차 만들지 않는다 (#65 — createdAt 보존)', () => {
  const existing = [row(10), row(11, { packageType: '10kg', weightPerUnit: 10, totalWeight: 30 })]
  const r = ok(diffPackaging(existing, existing.map(echo)))
  assert.equal(r.toCreate.length, 0)
  assert.equal(r.toUpdate.length, 0)
  assert.deepEqual(r.toDelete, [])
})

test('입력에서 빠진 행은 delete', () => {
  const existing = [row(10), row(11)]
  const r = ok(diffPackaging(existing, [echo(existing[0])]))
  assert.deepEqual(r.toDelete, [11])
})

test('빈 입력이면 전부 delete (포장 기록 모두 삭제 경로)', () => {
  const r = ok(diffPackaging([row(10), row(11)], []))
  assert.deepEqual(r.toDelete, [10, 11])
  assert.equal(r.toCreate.length, 0)
})

test('id가 기존에 없으면 create — 원래 행은 delete로 교체된다', () => {
  const existing = [row(10)]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), id: 999 }]))
  assert.equal(r.toCreate.length, 1)
  assert.equal(r.toCreate[0].id, undefined, 'create에는 남의 id를 실어보내지 않는다')
  assert.deepEqual(r.toDelete, [10])
})

test('자연키가 같아도 id가 없으면 update하지 않는다 (엉뚱한 줄 수정 방지)', () => {
  const existing = [row(10)]
  const r = ok(diffPackaging(existing, [line()])) // 값은 완전히 동일, id만 없음
  assert.equal(r.toCreate.length, 1)
  assert.equal(r.toUpdate.length, 0)
  assert.deepEqual(r.toDelete, [10])
})

test('부동소수 오차는 변경으로 보지 않는다', () => {
  const existing = [row(10, { weightPerUnit: 0.42, totalWeight: 1.26 })]
  const r = ok(
    diffPackaging(existing, [
      { ...echo(existing[0]), weightPerUnit: 0.1 + 0.32, totalWeight: 0.42 * 3 },
    ]),
  )
  assert.equal(r.toUpdate.length, 0)
})

// ------------------------------------------------------
// 차감 거부 (#63)
// ------------------------------------------------------

test('차감된 행은 삭제할 수 없다', () => {
  const r = fail(diffPackaging([row(10, { movedCount: 3 })], []))
  assert.equal(r.errors.length, 1)
  assert.equal(r.errors[0].code, 'DELETE_BLOCKED')
  assert.equal(r.errors[0].rowId, 10)
  assert.match(r.errors[0].message, /20kg × 3 \(3개 중 3개 차감됨\)/)
})

test('일부만 차감돼도 삭제는 막는다', () => {
  const r = fail(diffPackaging([row(10, { movedCount: 1 })], []))
  assert.equal(r.errors[0].code, 'DELETE_BLOCKED')
})

test('차감이 없는 행은 자유롭게 지운다', () => {
  const existing = [row(10, { movedCount: 0 }), row(11, { movedCount: 2 })]
  const r = ok(diffPackaging(existing, [echo(existing[1])]))
  assert.deepEqual(r.toDelete, [10])
})

test('차단된 행이 여러 개면 전부 모아서 알린다', () => {
  const r = fail(
    diffPackaging([row(10, { movedCount: 3 }), row(11, { movedCount: 1 })], []),
  )
  assert.equal(r.errors.length, 2)
  assert.deepEqual(r.errors.map((e) => e.rowId), [10, 11])
})

// ------------------------------------------------------
// 수량 축소 한계 (#63)
// ------------------------------------------------------

test('차감량 밑으로는 줄일 수 없다', () => {
  const existing = [row(10, { count: 3, movedCount: 3 })]
  const r = fail(
    diffPackaging(existing, [{ ...echo(existing[0]), count: 2, totalWeight: 40 }]),
  )
  assert.equal(r.errors[0].code, 'COUNT_BELOW_MOVED')
  assert.match(r.errors[0].message, /이미 3개가 판매·재포장됐습니다/)
})

test('차감량과 같은 수량까지는 줄일 수 있다', () => {
  const existing = [row(10, { count: 5, totalWeight: 100, movedCount: 3 })]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), count: 3, totalWeight: 60 }]))
  assert.equal(r.toUpdate.length, 1)
  assert.equal(r.toUpdate[0].line.count, 3)
})

test('차감된 행도 늘리는 건 자유롭다', () => {
  const existing = [row(10, { count: 3, movedCount: 3 })]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), count: 9, totalWeight: 180 }]))
  assert.equal(r.toUpdate[0].line.count, 9)
})

// ------------------------------------------------------
// 파생 필드 재계산 조건 (#65)
// ------------------------------------------------------

test('stockId가 바뀌면 로트를 다시 계산한다', () => {
  const existing = [row(10, { stockId: 1 })]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), stockId: 2 }]))
  assert.equal(r.toUpdate[0].recalcLot, true)
  assert.equal(r.toUpdate[0].recalcProductType, false)
})

test('packageType이 바뀌면 SKU를 다시 계산한다', () => {
  const existing = [row(10)]
  const r = ok(
    diffPackaging(existing, [
      { ...echo(existing[0]), packageType: '10kg', weightPerUnit: 10, totalWeight: 30 },
    ]),
  )
  assert.equal(r.toUpdate[0].recalcProductType, true)
  assert.equal(r.toUpdate[0].recalcLot, false)
})

test('packagingId가 바뀌면 SKU를 다시 계산한다', () => {
  const existing = [row(10, { packagingId: 7 })]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), packagingId: 8 }]))
  assert.equal(r.toUpdate[0].recalcProductType, true)
})

test('수량만 바뀌면 파생 필드는 건드리지 않는다', () => {
  const existing = [row(10)]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), count: 4, totalWeight: 80 }]))
  assert.equal(r.toUpdate[0].recalcLot, false)
  assert.equal(r.toUpdate[0].recalcProductType, false)
})

test('SKU 미부여(null) 상태가 유지되면 재계산하지 않는다', () => {
  const existing = [row(10, { packageType: '잔량', packagingId: null })]
  const r = ok(diffPackaging(existing, [{ ...echo(existing[0]), count: 4, totalWeight: 80 }]))
  assert.equal(r.toUpdate[0].recalcProductType, false)
})

// ------------------------------------------------------
// 줄 유효성 · 중복
// ------------------------------------------------------

test('규격이 비면 거부', () => {
  const r = fail(diffPackaging([], [line({ packageType: '  ' })]))
  assert.equal(r.errors[0].code, 'INVALID_LINE')
  assert.match(r.errors[0].message, /1번째 줄/)
})

test('단위 중량 0 이하 거부', () => {
  const r = fail(diffPackaging([], [line({ weightPerUnit: 0 })]))
  assert.equal(r.errors[0].code, 'INVALID_LINE')
})

test('개수가 0이거나 소수면 거부', () => {
  assert.equal(fail(diffPackaging([], [line({ count: 0 })])).errors[0].code, 'INVALID_LINE')
  assert.equal(fail(diffPackaging([], [line({ count: 1.5 })])).errors[0].code, 'INVALID_LINE')
})

test('같은 id가 두 번 들어오면 거부', () => {
  const existing = [row(10)]
  const r = fail(diffPackaging(existing, [echo(existing[0]), echo(existing[0])]))
  assert.equal(r.errors[0].code, 'DUPLICATE_ID')
  assert.equal(r.errors[0].rowId, 10)
})

// ------------------------------------------------------
// 유효성은 「쓰는 줄」에만 — 기존 데이터를 인질로 잡지 않는다
// (실DB 배치 #73의 「잔량 0kg × 5」로 드러난 회귀)
// ------------------------------------------------------

test('값이 잘못된 기존 줄도 안 건드리면 통과한다', () => {
  const existing = [row(10, { packageType: '잔량', weightPerUnit: 0, totalWeight: 0, count: 5 })]
  const r = ok(diffPackaging(existing, [echo(existing[0])]))
  assert.equal(r.toUpdate.length, 0)
})

test('값이 잘못된 기존 줄이 있어도 같은 배치의 다른 줄은 고칠 수 있다', () => {
  const existing = [
    row(10, { packageType: '잔량', weightPerUnit: 0, totalWeight: 0, count: 5 }),
    row(11),
  ]
  const r = ok(
    diffPackaging(existing, [
      echo(existing[0]),
      { ...echo(existing[1]), count: 4, totalWeight: 80 },
    ]),
  )
  assert.equal(r.toUpdate.length, 1)
  assert.equal(r.toUpdate[0].id, 11)
})

test('그 줄을 실제로 고치려 하면 그때 막는다', () => {
  const existing = [row(10, { packageType: '잔량', weightPerUnit: 0, totalWeight: 0, count: 5 })]
  const r = fail(diffPackaging(existing, [{ ...echo(existing[0]), count: 6 }]))
  assert.equal(r.errors[0].code, 'INVALID_LINE')
  assert.match(r.errors[0].message, /단위 중량을 입력해 주세요/)
})

test('값이 잘못된 줄도 삭제는 막지 않는다 (정리 경로)', () => {
  const existing = [row(10, { packageType: '잔량', weightPerUnit: 0, totalWeight: 0, count: 5 })]
  const r = ok(diffPackaging(existing, []))
  assert.deepEqual(r.toDelete, [10])
})

test('차감 규칙이 유효성보다 먼저 걸린다 (더 정확한 이유를 낸다)', () => {
  const existing = [row(10, { count: 3, movedCount: 3 })]
  const r = fail(diffPackaging(existing, [{ ...echo(existing[0]), count: 0 }]))
  assert.equal(r.errors[0].code, 'COUNT_BELOW_MOVED')
  assert.ok(r.errors.every((e) => e.code !== 'INVALID_LINE'))
})

// ------------------------------------------------------
// 메시지 조립 (#63 — FK 에러가 아니라 이유가 적힌 안내)
// ------------------------------------------------------

test('삭제 차단 메시지는 헤더·목록·해결안내를 갖춘다', () => {
  const r = fail(diffPackaging([row(10, { movedCount: 3 })], []))
  const text = formatPackagingDiffErrors(r.errors)
  assert.match(text, /^이미 판매·재포장된 포장은 지울 수 없어요\./)
  assert.match(text, /\n {2}· 20kg × 3 \(3개 중 3개 차감됨\)/)
  assert.match(text, /판매를 취소하거나 재포장을 정리해 주세요\.$/)
})

test('종류가 다른 에러는 문단으로 나눠 낸다', () => {
  const existing = [row(10, { movedCount: 3 }), row(11, { count: 3, movedCount: 3 })]
  const r = fail(
    diffPackaging(existing, [{ ...echo(existing[1]), count: 1, totalWeight: 20 }]),
  )
  const text = formatPackagingDiffErrors(r.errors)
  assert.match(text, /지울 수 없어요/)
  assert.match(text, /1개로 줄일 수 없어요/)
  assert.ok(text.includes('\n\n'), '문단 구분')
})
