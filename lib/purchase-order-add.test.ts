import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rawItemFor, rawNameCandidates, cleanName } from './purchase-order-add'
import type { MatcherProductType, MatcherVariety } from './purchase-order-matcher'

const varieties: MatcherVariety[] = [
  { id: 1, name: '서농22호', category: 'RICE', aliases: [], type: 'URUCHI' },
  { id: 2, name: '백옥찰', category: 'RICE', aliases: [], type: 'GLUTINOUS' },
  { id: 3, name: '율무(친환경)', category: 'MISC_GRAIN', aliases: [], type: null },
]
const pt = (
  id: number,
  varietyId: number,
  millingType: string,
  packageType: string,
  packagingName: string,
  o: Partial<MatcherProductType> = {},
): MatcherProductType => ({
  id,
  varietyId,
  millingType,
  packageType,
  packagingId: id * 10,
  packagingName,
  isDefault: false,
  active: true,
  ...o,
})
const productTypes = [
  pt(1, 1, '백미', '10kg', '자연주의', { isDefault: true }),
  pt(2, 1, '백미', '10kg', 'PP마대'),
  pt(3, 1, '현미', '5kg', 'PP마대', { isDefault: true }),
  pt(4, 2, '백미', '4kg', '자연주의', { isDefault: true }),
  pt(5, 3, '기타', '1kg', '매입포장', { isDefault: true }),
  pt(6, 1, '백미', '톤백', '톤백'),
  pt(7, 1, '백미', '5kg', '자연주의', { active: false }),
]
const raw = (id: number) => rawItemFor(productTypes.find((p) => p.id === id)!, varieties, productTypes)

test('rawNameCandidates: 잡곡은 품종명만 · 백미는 품종명 먼저 · 그 밖은 「품종 도정」', () => {
  assert.deepEqual(rawNameCandidates('율무(친환경)', '기타'), ['율무(친환경)'])
  assert.deepEqual(rawNameCandidates('서농22호', '백미'), ['서농22호', '서농22호 백미'])
  assert.deepEqual(rawNameCandidates('서농22호', '현미'), ['서농22호 현미', '현미 서농22호'])
})

test('rawItemFor: 매처가 그 SKU를 돌려주는 이름 · 포장지는 SKU 포장지명 그대로', () => {
  assert.deepEqual(raw(1), { rawItemName: '서농22호', packageType: '10kg', rawPackaging: '자연주의' })
  assert.deepEqual(raw(3), { rawItemName: '서농22호 현미', packageType: '5kg', rawPackaging: 'PP마대' })
  assert.deepEqual(raw(5), { rawItemName: '율무(친환경)', packageType: '1kg', rawPackaging: '매입포장' })
})

test('rawItemFor: 기본이 아닌 포장지 SKU도 포장지를 적으니 그 SKU로 붙는다', () => {
  assert.deepEqual(raw(2), { rawItemName: '서농22호', packageType: '10kg', rawPackaging: 'PP마대' })
})

test('rawItemFor: 찰벼 백미는 「찹쌀」이 아니라 품종명으로', () => {
  assert.equal(raw(4)?.rawItemName, '백옥찰')
})

test('rawItemFor: 톤백·비활성은 추가 대상이 아니다', () => {
  assert.equal(raw(6), null)
  assert.equal(raw(7), null)
})

test('rawItemFor: 매처가 다른 SKU를 고르면 null (품종이 안 읽히는 경우)', () => {
  const ghost = pt(9, 99, '백미', '10kg', '자연주의') // 품종 목록에 없는 품종
  assert.equal(rawItemFor(ghost, varieties, [...productTypes, ghost]), null)
})

test('cleanName: 앞뒤·연속 공백 정리', () => {
  assert.equal(cleanName('  김 영희  '), '김 영희')
  assert.equal(cleanName('박\t\n철수'), '박 철수')
})
