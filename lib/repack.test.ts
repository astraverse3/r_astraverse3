import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateRepack,
  sumSourceKg,
  sumResultKg,
  buildLotOptions,
  lossConfirmText,
  formatSpec,
  PACKAGE_TYPE_REMAINDER,
  type RepackSource,
  type RepackResultLine,
} from './repack'

// ------------------------------------------------------
// 헬퍼 — 기본은 동질(하이아미/백미/도정산/벼)
// ------------------------------------------------------
const src = (
  packageId: number,
  weightPerUnit: number,
  available: number,
  takeCount: number,
  over: Partial<RepackSource> = {},
): RepackSource => ({
  packageId,
  varietyId: 1,
  millingType: '백미',
  source: 'MILLED',
  category: 'RICE',
  lotNo: '251119-11-15100914-391',
  packageType: PACKAGE_TYPE_REMAINDER,
  weightPerUnit,
  available,
  takeCount,
  ...over,
})

const res = (
  weightPerUnit: number,
  count: number,
  over: Partial<RepackResultLine> = {},
): RepackResultLine => ({
  packageType: `${weightPerUnit}kg`,
  weightPerUnit,
  count,
  packagingId: 3,
  inheritFromPackageId: 1,
  ...over,
})

// ------------------------------------------------------
// 중량 합
// ------------------------------------------------------
test('sumSourceKg / sumResultKg: 부동소수 오차를 소수 3자리로 정리', () => {
  assert.equal(sumSourceKg([src(1, 0.1, 10, 3)]), 0.3)
  assert.equal(sumResultKg([res(1.1, 3)]), 3.3)
})

// ------------------------------------------------------
// 정상 케이스 — 계획서 §1의 세 가지 행위
// ------------------------------------------------------
test('병합: 잔량 여러 행 → 20kg 4자루 + 잔량 4kg (딱 맞음)', () => {
  const sources = [
    src(1, 5, 1, 1),
    src(2, 17, 1, 1),
    src(3, 25, 1, 1),
    src(4, 1, 1, 1),
    src(5, 2, 1, 1),
    src(6, 8, 1, 1),
    src(7, 3, 1, 1),
    src(8, 10, 1, 1),
    src(9, 10, 1, 1),
    src(10, 3, 1, 1),
  ]
  assert.equal(sumSourceKg(sources), 84)

  const r = validateRepack(sources, [
    res(20, 4),
    res(4, 1, { packageType: PACKAGE_TYPE_REMAINDER, packagingId: null }),
  ])
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.sourceKg, 84)
  assert.equal(r.resultKg, 84)
  assert.equal(r.lossKg, 0)
  assert.equal(r.lossWarning, false)
})

test('분할: 톤백 1,004kg 1자루 → 1,000kg + 4kg', () => {
  const sources = [src(1, 1004, 4, 1, { packageType: '톤백' })]
  const r = validateRepack(sources, [
    res(1000, 1, { packageType: '톤백' }),
    res(4, 1, { packageType: PACKAGE_TYPE_REMAINDER, packagingId: null }),
  ])
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.sourceKg, 1004)
  assert.equal(r.lossKg, 0)
})

test('규격변경: 잔량 4kg 1행 → 1kg 4개', () => {
  const r = validateRepack([src(1, 4, 1, 1)], [res(1, 4)])
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.lossKg, 0)
})

// ------------------------------------------------------
// 손실 (§3.5) — 실물이라 오차는 존재한다. 차단하지 않고 경고만
// ------------------------------------------------------
test('손실 허용: 결과가 소스보다 적으면 lossKg로 기록', () => {
  const r = validateRepack([src(1, 100, 1, 1)], [res(20, 4)])
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.lossKg, 20)
  assert.equal(r.lossWarning, true) // 20kg > 100kg의 1%
})

test('손실 경고: 1% 이하면 경고 없음', () => {
  const r = validateRepack([src(1, 1000, 1, 1)], [res(999, 1)])
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.lossKg, 1)
  assert.equal(r.lossWarning, false) // 1kg == 1000kg의 1% → 초과 아님
})

test('결과가 소스를 초과하면 차단', () => {
  const r = validateRepack([src(1, 10, 1, 1)], [res(20, 1)])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.errors[0].code, 'RESULT_EXCEEDS_SOURCE')
})

// ------------------------------------------------------
// 소스 동질성 (§3.2) — 로트만 달라도 된다
// ------------------------------------------------------
test('로트가 달라도 통과한다 (실무: 다른 로트 잔량을 합쳐 하나로 지정)', () => {
  const sources = [
    src(1, 5, 1, 1, { lotNo: 'LOT-A' }),
    src(2, 5, 1, 1, { lotNo: 'LOT-B' }),
  ]
  const r = validateRepack(sources, [res(10, 1)])
  assert.equal(r.ok, true)
})

test('품종이 다르면 차단', () => {
  const r = validateRepack(
    [src(1, 5, 1, 1), src(2, 5, 1, 1, { varietyId: 2 })],
    [res(10, 1)],
  )
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'MIXED_VARIETY'))
})

test('도정유형이 다르면 차단 (백미 + 현미)', () => {
  const r = validateRepack(
    [src(1, 5, 1, 1), src(2, 5, 1, 1, { millingType: '현미' })],
    [res(10, 1)],
  )
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'MIXED_MILLING_TYPE'))
})

test('도정산과 매입을 섞으면 차단', () => {
  const r = validateRepack(
    [src(1, 5, 1, 1), src(2, 5, 1, 1, { source: 'PURCHASED' })],
    [res(10, 1)],
  )
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'MIXED_SOURCE'))
})

test('벼와 잡곡을 섞으면 차단', () => {
  const r = validateRepack(
    [src(1, 5, 1, 1), src(2, 5, 1, 1, { category: 'MISC_GRAIN' })],
    [res(10, 1)],
  )
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'MIXED_CATEGORY'))
})

// ------------------------------------------------------
// 소진 개수
// ------------------------------------------------------
test('가용을 초과해 소진하면 차단', () => {
  const r = validateRepack([src(1, 10, 2, 3)], [res(10, 1)])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'EXCEEDS_AVAILABLE'))
})

test('소진 개수가 0 이하거나 정수가 아니면 차단', () => {
  for (const bad of [0, -1, 1.5]) {
    const r = validateRepack([src(1, 10, 5, bad)], [res(10, 1)])
    assert.equal(r.ok, false, `takeCount=${bad}`)
    if (r.ok) continue
    assert.ok(r.errors.some((e) => e.code === 'INVALID_TAKE_COUNT'))
  }
})

// ------------------------------------------------------
// 결과 줄
// ------------------------------------------------------
test('소스에 없는 행을 승계 대상으로 지정하면 차단', () => {
  const r = validateRepack([src(1, 10, 1, 1)], [res(10, 1, { inheritFromPackageId: 999 })])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'UNKNOWN_INHERIT_SOURCE'))
})

test('잔량에 포장지를 지정하면 차단 (SKU 미부여 규칙)', () => {
  const r = validateRepack(
    [src(1, 10, 1, 1)],
    [res(10, 1, { packageType: PACKAGE_TYPE_REMAINDER, packagingId: 3 })],
  )
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'REMAINDER_WITH_PACKAGING'))
})

test('개수·중량이 0 이하면 차단', () => {
  const r = validateRepack([src(1, 10, 1, 1)], [res(0, 1), res(10, 0)])
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.ok(r.errors.some((e) => e.code === 'INVALID_RESULT_LINE'))
})

test('소스나 결과가 비면 차단', () => {
  const a = validateRepack([], [res(10, 1)])
  assert.equal(a.ok, false)
  if (!a.ok) assert.equal(a.errors[0].code, 'NO_SOURCE')

  const b = validateRepack([src(1, 10, 1, 1)], [])
  assert.equal(b.ok, false)
  if (!b.ok) assert.equal(b.errors[0].code, 'NO_RESULT')
})

// ------------------------------------------------------
// 로트 후보 (§3.3)
// ------------------------------------------------------
test('buildLotOptions: 같은 로트는 하나로 묶고 kg를 합산', () => {
  const opts = buildLotOptions([
    src(1, 5, 1, 1, { lotNo: 'LOT-A' }),
    src(2, 17, 1, 1, { lotNo: 'LOT-A' }),
    src(3, 10, 1, 1, { lotNo: 'LOT-B' }),
  ])
  assert.equal(opts.length, 2)
  assert.deepEqual(opts[0], { packageId: 1, lotNo: 'LOT-A', kg: 22 }) // 대표 = 첫 행
  assert.deepEqual(opts[1], { packageId: 3, lotNo: 'LOT-B', kg: 10 })
})

test('buildLotOptions: lotNo가 없는 매입 잡곡은 행마다 별개 후보', () => {
  const opts = buildLotOptions([
    src(1, 5, 1, 1, { lotNo: null, source: 'PURCHASED', category: 'MISC_GRAIN' }),
    src(2, 8, 1, 1, { lotNo: null, source: 'PURCHASED', category: 'MISC_GRAIN' }),
  ])
  assert.equal(opts.length, 2)
  assert.deepEqual(
    opts.map((o) => o.packageId),
    [1, 2],
  )
})

// ------------------------------------------------------
// 손실 최종 확인 문구 (plan-재포장-손실-최종확인)
// ------------------------------------------------------
const lc = (packageType: string, weightPerUnit: number, takeCount: number, varietyName = '서농22호') => ({
  varietyName,
  packageType,
  weightPerUnit,
  takeCount,
})

test('lossConfirmText: 재포장 #26 — 한 줄 · 정수 개수분', () => {
  const text = lossConfirmText([lc('4kg', 4, 132)], 528, 228)
  assert.equal(
    text,
    '서농22호 4kg 132개(528kg)를 쓰는데 228kg만 만들어요.\n' +
      '남는 300kg(4kg 75개분)은 손실로 사라져요.\n\n' +
      '재포장은 되돌릴 수 없어요. 실제로 없어진 경우에만 기록하세요.',
  )
})

test('lossConfirmText: 나눠떨어지지 않으면 「약」 · 소수 첫째 자리', () => {
  const text = lossConfirmText([lc('20kg', 20, 10)], 200, 150)
  assert.match(text, /남는 50kg\(20kg 약 2\.5개분\)은/)
})

test('lossConfirmText: 여러 줄이면 품종·개수 대신 총량 · 같은 규격이면 개수분 유지', () => {
  const text = lossConfirmText([lc('10kg', 10, 5), lc('10kg', 10, 3)], 80, 50)
  assert.match(text, /^쓸 양 80kg 중 50kg만 만들어요\.\n/)
  assert.match(text, /남는 30kg\(10kg 3개분\)은/)
})

test('lossConfirmText: 규격이 섞이면 개수분을 쓰지 않는다', () => {
  const text = lossConfirmText([lc('10kg', 10, 5), lc('20kg', 20, 2)], 90, 60)
  assert.match(text, /남는 30kg은 손실로/)
})

test('lossConfirmText: 톤백·잔량은 개수분을 쓰지 않는다', () => {
  assert.match(lossConfirmText([lc('톤백', 1000, 1)], 1000, 800), /남는 200kg은 손실로/)
  assert.match(lossConfirmText([lc(PACKAGE_TYPE_REMAINDER, 7, 1)], 7, 4), /남는 3kg은 손실로/)
})

test('formatSpec: 라벨에 무게가 있으면 겹쳐 쓰지 않는다', () => {
  assert.equal(formatSpec('5kg', 5), '5kg')
  assert.equal(formatSpec('톤백', 1000), '톤백 · 1,000kg')
  assert.equal(formatSpec('5kg', 4.8), '5kg · 4.8kg')
})
