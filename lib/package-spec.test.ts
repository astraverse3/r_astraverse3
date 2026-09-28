import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSpecButtons, specWeightKg } from './package-spec'

// ------------------------------------------------------
// specWeightKg
// ------------------------------------------------------
test('specWeightKg: g·kg을 kg으로', () => {
  assert.equal(specWeightKg('907g'), 0.907)
  assert.equal(specWeightKg('1kg'), 1)
  assert.equal(specWeightKg('420g'), 0.42)
  assert.equal(specWeightKg('20KG'), 20)
})

test('specWeightKg: 공백·콤마는 무시한다', () => {
  assert.equal(specWeightKg('1 kg'), 1)
  assert.equal(specWeightKg('1,000kg'), 1000)
})

test('specWeightKg: 단위 없음·센티널·0은 null', () => {
  assert.equal(specWeightKg('500'), null)
  assert.equal(specWeightKg('톤백'), null)
  assert.equal(specWeightKg('잔량'), null)
  assert.equal(specWeightKg('0kg'), null)
})

// ------------------------------------------------------
// mergeSpecButtons
// ------------------------------------------------------
/** 재포장 목록 모양 — 센티널이 null */
const REPACK = [
  { label: '톤백', weight: null },
  { label: '20kg', weight: 20 },
  { label: '10kg', weight: 10 },
  { label: '1kg', weight: 1 },
  { label: '잔량', weight: null },
]
/** 도정 포장 목록 모양 — 센티널이 0 */
const MILLING = [
  { label: '톤백', weight: 0 },
  { label: '10kg', weight: 10 },
  { label: '1kg', weight: 1 },
  { label: '잔량', weight: 0 },
]
const labels = (xs: { label: string }[]) => xs.map((x) => x.label)

test('mergeSpecButtons: SKU 규격이 없으면 목록 그대로', () => {
  assert.deepEqual(labels(mergeSpecButtons(REPACK, [])), ['톤백', '20kg', '10kg', '1kg', '잔량'])
})

test('mergeSpecButtons: 🔴 907g은 1kg 뒤·잔량 앞 (IPS 백미 — 백로그 §48의 발단)', () => {
  const out = mergeSpecButtons(REPACK, ['907g'])
  assert.deepEqual(labels(out), ['톤백', '20kg', '10kg', '1kg', '907g', '잔량'])
  assert.equal(out.find((b) => b.label === '907g')?.weight, 0.907)
})

test('mergeSpecButtons: 무게 순서 자리에 끼운다 — 15kg은 20kg과 10kg 사이', () => {
  assert.deepEqual(labels(mergeSpecButtons(REPACK, ['800g', '15kg'])), [
    '톤백', '20kg', '15kg', '10kg', '1kg', '800g', '잔량',
  ])
})

test('mergeSpecButtons: 센티널이 0인 목록(도정 포장)도 같다', () => {
  assert.deepEqual(labels(mergeSpecButtons(MILLING, ['907g', '800g'])), ['톤백', '10kg', '1kg', '907g', '800g', '잔량'])
})

test('mergeSpecButtons: 이미 있는 규격·중복·무게 못 읽는 규격은 더하지 않는다', () => {
  assert.deepEqual(labels(mergeSpecButtons(REPACK, ['10kg', '907g', '907g', '500', '톤백'])), [
    '톤백', '20kg', '10kg', '1kg', '907g', '잔량',
  ])
})

test('mergeSpecButtons: 원본 배열을 건드리지 않는다', () => {
  const before = labels(REPACK)
  mergeSpecButtons(REPACK, ['907g'])
  assert.deepEqual(labels(REPACK), before)
})
