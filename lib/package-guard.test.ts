import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  guardDelete,
  guardCountChange,
  guardIdentityChange,
  deleteBlockedMessage,
  identityBlockedMessage,
  describeDeduction,
  REPACK_DELETE_BLOCKED,
  REPACK_UPDATE_BLOCKED,
  guardUpdate,
  type GuardedPackage,
} from './package-guard'

const pkg = (over: Partial<GuardedPackage> = {}): GuardedPackage => ({
  id: 1,
  packageType: '5kg',
  count: 10,
  movedCount: 0,
  repackId: null,
  ...over,
})

// ------------------------------------------------------
// 삭제 (#67)
// ------------------------------------------------------

test('차감이 없으면 지울 수 있다', () => {
  assert.deepEqual(guardDelete(pkg()), { ok: true })
})

test('일부만 차감돼도 삭제는 막는다', () => {
  const r = guardDelete(pkg({ movedCount: 1 }))
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /5kg × 10 \(10개 중 1개 차감됨\)/)
})

test('재포장 결과는 차감이 없어도 이 경로로 못 지운다 (#59)', () => {
  const r = guardDelete(pkg({ repackId: 3 }))
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, REPACK_DELETE_BLOCKED)
})

test('재포장 결과 검사가 차감 검사보다 먼저 — 더 정확한 안내를 낸다', () => {
  const r = guardDelete(pkg({ repackId: 3, movedCount: 2 }))
  assert.equal((r as { reason: string }).reason, REPACK_DELETE_BLOCKED)
})

test('repackId가 undefined여도(선택 필드) 통과한다', () => {
  assert.deepEqual(guardDelete({ id: 1, packageType: '5kg', count: 10, movedCount: 0 }), { ok: true })
})

// ------------------------------------------------------
// 재포장 결과 수정 (#69)
// ------------------------------------------------------

test('재포장 결과는 수정도 막는다 (지금까지 삭제만 막혔다)', () => {
  const r = guardUpdate(pkg({ repackId: 3 }))
  assert.equal(r.ok, false)
  assert.equal((r as { reason: string }).reason, REPACK_UPDATE_BLOCKED)
})

test('재포장 결과가 아니면 수정은 자유다', () => {
  assert.deepEqual(guardUpdate(pkg({ movedCount: 5 })), { ok: true })
})

test('삭제와 수정은 다른 문구를 낸다 (되돌리는 방법이 다르다)', () => {
  assert.notEqual(REPACK_DELETE_BLOCKED, REPACK_UPDATE_BLOCKED)
})

// ------------------------------------------------------
// 수량 축소 (#68)
// ------------------------------------------------------

test('차감량 밑으로는 줄일 수 없다', () => {
  const r = guardCountChange(pkg({ count: 10, movedCount: 3 }), 2)
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /5kg × 10 → 2개로 줄일 수 없어요/)
  assert.match((r as { reason: string }).reason, /이미 3개가 판매·재포장됐습니다/)
})

test('차감량과 같은 수량까지는 줄일 수 있다 (경계)', () => {
  assert.deepEqual(guardCountChange(pkg({ count: 10, movedCount: 3 }), 3), { ok: true })
})

test('늘리는 것은 자유다', () => {
  assert.deepEqual(guardCountChange(pkg({ count: 10, movedCount: 10 }), 20), { ok: true })
})

test('차감이 없으면 어디까지든 줄일 수 있다', () => {
  assert.deepEqual(guardCountChange(pkg({ count: 10, movedCount: 0 }), 1), { ok: true })
})

// ------------------------------------------------------
// 품종·규격 변경 (#70 A안)
// ------------------------------------------------------

test('차감이 없으면 품종·규격을 바꿀 수 있다', () => {
  const r = guardIdentityChange(pkg({ movedCount: 0 }), { packageType: '10kg', varietyId: 9 }, { varietyId: 1 })
  assert.deepEqual(r, { ok: true })
})

test('차감이 있으면 규격 변경을 막는다', () => {
  const r = guardIdentityChange(pkg({ movedCount: 3 }), { packageType: '10kg' }, { varietyId: 1 })
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /10개 중 3개 차감됨/)
})

test('차감이 있으면 품종 변경을 막는다', () => {
  const r = guardIdentityChange(pkg({ movedCount: 3 }), { varietyId: 9 }, { varietyId: 1 })
  assert.equal(r.ok, false)
})

test('차감이 있어도 같은 값으로 다시 보내는 건 변경이 아니다', () => {
  const r = guardIdentityChange(
    pkg({ movedCount: 3, packageType: '5kg' }),
    { packageType: '5kg', varietyId: 1 },
    { varietyId: 1 },
  )
  assert.deepEqual(r, { ok: true })
})

test('차감이 있어도 매입처·날짜·수량만 고치는 건 통과한다 (A안 — 정정 여지)', () => {
  // 품종·규격 키를 아예 넘기지 않는 경우
  const r = guardIdentityChange(pkg({ movedCount: 3 }), {}, { varietyId: 1 })
  assert.deepEqual(r, { ok: true })
})

test('현재 품종이 null이면(도정산) 품종 변경으로 보지 않는다', () => {
  const r = guardIdentityChange(pkg({ movedCount: 3 }), { varietyId: 9 }, { varietyId: null })
  assert.deepEqual(r, { ok: true })
})

// ------------------------------------------------------
// 메시지 (#67 — FK 에러가 아니라 이유가 적힌 안내)
// ------------------------------------------------------

test('삭제 차단 메시지는 헤더·목록·해결안내를 갖춘다', () => {
  const text = deleteBlockedMessage(pkg({ packageType: '5kg', count: 10, movedCount: 3 }))
  assert.equal(
    text,
    '이미 판매·재포장된 포장은 지울 수 없어요.\n' +
      '  · 5kg × 10 (10개 중 3개 차감됨)\n' +
      '포장을 되돌리려면 판매를 취소하거나 재포장을 정리해 주세요.',
  )
})

test('품종·규격 차단 메시지는 해결안내를 붙이지 않는다 (되돌릴 일이 아니다)', () => {
  const text = identityBlockedMessage(pkg({ movedCount: 3 }))
  assert.match(text, /^이미 판매·재포장된 포장은 품종·규격을 바꿀 수 없어요\./)
  assert.ok(!text.includes('판매를 취소하거나'))
})

test('describeDeduction은 규격·전체·차감을 함께 낸다', () => {
  assert.equal(
    describeDeduction(pkg({ packageType: '잔량', count: 1, movedCount: 1 })),
    '잔량 × 1 (1개 중 1개 차감됨)',
  )
})
