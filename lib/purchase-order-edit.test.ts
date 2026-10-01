import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideQtyChange, decideOrderCancel, MAX_ORDER_QTY } from './purchase-order-edit'

const base = { orderedQty: 5, allocatedQty: 0, newQty: 5, otherItemCount: 2 }

test('decideQtyChange: 같은 값이면 아무것도 안 한다', () => {
  assert.deepEqual(decideQtyChange(base), { kind: 'noop' })
})

test('decideQtyChange: 늘리기·줄이기는 update', () => {
  assert.equal(decideQtyChange({ ...base, newQty: 8 }).kind, 'update')
  assert.equal(decideQtyChange({ ...base, newQty: 2 }).kind, 'update')
})

test('decideQtyChange: 차감된 수까지는 줄일 수 있고, 그보다 적게는 안 된다', () => {
  assert.equal(decideQtyChange({ ...base, allocatedQty: 3, newQty: 3 }).kind, 'update')
  const r = decideQtyChange({ ...base, allocatedQty: 3, newQty: 2 })
  assert.equal(r.kind, 'reject')
  assert.match((r as { reason: string }).reason, /3개 차감/)
})

test('decideQtyChange: 0 = 품목 취소, 마지막 품목이면 건 취소', () => {
  assert.equal(decideQtyChange({ ...base, newQty: 0 }).kind, 'deleteItem')
  assert.equal(decideQtyChange({ ...base, newQty: 0, otherItemCount: 0 }).kind, 'deleteOrder')
})

test('decideQtyChange: 차감이 있으면 0으로 취소할 수 없다', () => {
  const r = decideQtyChange({ ...base, allocatedQty: 1, newQty: 0 })
  assert.equal(r.kind, 'reject')
  assert.match((r as { reason: string }).reason, /취소할 수 없어요/)
})

test('decideQtyChange: 음수·소수·너무 큰 수는 거부', () => {
  for (const newQty of [-1, 1.5, MAX_ORDER_QTY + 1, Number.NaN]) {
    assert.equal(decideQtyChange({ ...base, newQty }).kind, 'reject', String(newQty))
  }
})

test('decideOrderCancel: 차감이 하나라도 있으면 막는다', () => {
  assert.deepEqual(decideOrderCancel(0), { ok: true })
  assert.equal(decideOrderCancel(2).ok, false)
})
