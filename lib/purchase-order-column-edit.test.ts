import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packagingOptions, packageTypeOptions, isEditableSpec } from './purchase-order-column-edit'
import type { MatcherProductType } from './purchase-order-matcher'

let nextId = 1
const sku = (
  packageType: string,
  packagingName: string,
  o: Partial<MatcherProductType> = {},
): MatcherProductType => ({
  id: nextId++,
  varietyId: 1,
  millingType: '백미',
  packageType,
  packagingId: { 자연주의: 10, PP마대: 20, 아이담쌀: 30, 톤백: 40 }[packagingName] ?? 99,
  packagingName,
  isDefault: false,
  active: true,
  ...o,
})

// 서농22호 백미: 자연주의 10·5·1kg · PP마대 10·5kg · 아이담쌀 10kg · 톤백
const 자10 = sku('10kg', '자연주의')
const 자5 = sku('5kg', '자연주의')
const 자1 = sku('1kg', '자연주의')
const PP10 = sku('10kg', 'PP마대')
const PP5 = sku('5kg', 'PP마대')
const 아10 = sku('10kg', '아이담쌀')
const 톤 = sku('톤백', '톤백')
const 현미10 = sku('10kg', 'PP마대', { millingType: '현미' })
const 다른품종 = sku('10kg', 'PP마대', { varietyId: 2 })
const 비활성 = sku('1kg', 'PP마대', { active: false })
const ALL = [자10, 자5, 자1, PP10, PP5, 아10, 톤, 현미10, 다른품종, 비활성]

test('packagingOptions: 묶음의 모든 규격이 있는 포장지만 열린다', () => {
  // 자연주의 묶음에 10kg·5kg 열이 있다
  const opts = packagingOptions([자10, 자5], ALL)
  assert.deepEqual(
    opts.map((o) => [o.value, o.current, o.disabled, o.reason]),
    [
      ['자연주의', true, true, null], // 지금 값은 맨 앞, 고를 수 없다
      ['PP마대', false, false, null],
      ['아이담쌀', false, true, '5kg 없음'],
    ],
  )
})

test('packagingOptions: 비활성 SKU는 없는 것으로 본다 (PP마대 1kg)', () => {
  const opts = packagingOptions([자10, 자1], ALL)
  const pp = opts.find((o) => o.value === 'PP마대')!
  assert.equal(pp.disabled, true)
  assert.equal(pp.reason, '1kg 없음')
})

test('packagingOptions: 톤백 포장지·다른 도정·다른 품종은 후보가 아니다', () => {
  const values = packagingOptions([자10], ALL).map((o) => o.value)
  assert.ok(!values.includes('톤백'))
  assert.equal(values.length, 3) // 자연주의 · PP마대 · 아이담쌀 (현미 PP마대·품종2 PP마대가 섞이지 않는다)
})

test('packagingOptions: 규격 비교는 대소문자 무시 (원본 10KG)', () => {
  const upper = sku('10KG', '자연주의')
  const pp = packagingOptions([upper], ALL).find((o) => o.value === 'PP마대')!
  assert.equal(pp.disabled, false)
})

test('packageTypeOptions: 같은 포장지의 규격만, 무거운 것부터, 지금 값은 막는다', () => {
  const opts = packageTypeOptions(자5, ALL)
  assert.deepEqual(
    opts.map((o) => [o.value, o.current, o.disabled]),
    [
      ['10kg', false, false],
      ['5kg', true, true],
      ['1kg', false, false],
    ],
  )
})

test('packageTypeOptions: 비활성·다른 포장지 규격은 안 나온다', () => {
  assert.deepEqual(
    packageTypeOptions(PP10, ALL).map((o) => o.value),
    ['10kg', '5kg'], // PP마대 1kg은 비활성
  )
})

test('isEditableSpec: 톤백·잔량 열은 수정 대상이 아니다', () => {
  assert.equal(isEditableSpec('톤백'), false)
  assert.equal(isEditableSpec('잔량'), false)
  assert.equal(isEditableSpec('10kg'), true)
})
