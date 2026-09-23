import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNEL_DECL, groupAxisOf, nameTiersOf } from './purchase-channel'

// C0-c 표기 규칙 — 「행마다 변하는 값이 앞에 굵게」. 실측 카디널리티는 계획서 D2c §C0-c.

test('nameTiersOf: 택배·이마트·해남급식은 수령인 ｜ 발주처', () => {
  for (const ch of ['DELIVERY', 'EMART', 'MEAL_HAENAM'] as const) {
    assert.deepEqual(
      nameTiersOf(CHANNEL_DECL[ch], { vendor: '이마트', recipient: '여주점' }),
      ['여주점', '이마트'],
      ch,
    )
    assert.equal(CHANNEL_DECL[ch].columnLabel, '수령인')
  }
})

test('nameTiersOf: 서울급식만 발주처 ｜ 수령인 — 거기서는 발주처가 변수다', () => {
  assert.deepEqual(
    nameTiersOf(CHANNEL_DECL.MEAL_SEOUL, { vendor: '은평구', recipient: '행복플러스' }),
    ['은평구', '행복플러스'],
  )
  assert.equal(CHANNEL_DECL.MEAL_SEOUL.columnLabel, '발주처')
})

test('nameTiersOf: 기업별은 발주처 한 값만 — 수령인이 있어도 무시', () => {
  assert.deepEqual(
    nameTiersOf(CHANNEL_DECL.CORPORATE, { vendor: '시아스', recipient: '시아스' }),
    ['시아스', null],
  )
  assert.deepEqual(
    nameTiersOf(CHANNEL_DECL.CORPORATE, { vendor: '시아스', recipient: '다른값' }),
    ['시아스', null],
  )
  assert.equal(CHANNEL_DECL.CORPORATE.columnLabel, '거래처')
})

test('nameTiersOf: 동일명이면 한 줄 (택배 실데이터 3건 — 서대문마을생협 등)', () => {
  assert.deepEqual(
    nameTiersOf(CHANNEL_DECL.DELIVERY, { vendor: '서대문마을생협', recipient: '서대문마을생협' }),
    ['서대문마을생협', null],
  )
})

test('nameTiersOf: 수령인이 비면 발주처로 대신 — 빈 굵은 값은 안 만든다', () => {
  assert.deepEqual(nameTiersOf(CHANNEL_DECL.DELIVERY, { vendor: '예은농산', recipient: null }), [
    '예은농산',
    null,
  ])
  assert.deepEqual(nameTiersOf(CHANNEL_DECL.DELIVERY, { vendor: '예은농산', recipient: '' }), [
    '예은농산',
    null,
  ])
})

// --- 건을 여는 방식 (2026-09-22) ------------------------------------------

test('detail: 택배만 목록 안에서 펼치고, 나머지는 건 상세를 연다', () => {
    assert.equal(CHANNEL_DECL.DELIVERY.detail, 'inline')
    for (const ch of ['EMART', 'MEAL_SEOUL', 'MEAL_HAENAM', 'CORPORATE'] as const) {
        assert.equal(CHANNEL_DECL[ch].detail, 'sheet', `${ch}는 건 상세를 연다`)
    }
})

test('🔴 detail: 모든 채널이 값을 갖는다 — 새 채널이 생기면 여기서 걸린다', () => {
    for (const [ch, decl] of Object.entries(CHANNEL_DECL)) {
        assert.ok(decl.detail === 'inline' || decl.detail === 'sheet', `${ch}에 detail이 없다`)
    }
})

test('groupAxisOf: 축은 primary의 반대쪽 — 반복되는 값으로 묶는다', () => {
  assert.equal(groupAxisOf(CHANNEL_DECL.DELIVERY, { vendor: '예은농산', recipient: '김철수' }), '예은농산')
  assert.equal(
    groupAxisOf(CHANNEL_DECL.MEAL_SEOUL, { vendor: '은평구', recipient: '행복플러스' }),
    '행복플러스',
  )
})

test('groupAxisOf: 🔴 동일명이어도 소속을 잃지 않는다 — nameTiersOf tail과 갈리는 지점', () => {
  const row = { vendor: '서대문마을생협', recipient: '서대문마을생협' }
  // 표시는 한 줄로 합치는 게 맞고(위 테스트), 그룹은 제 발주처를 유지해야 한다
  assert.equal(nameTiersOf(CHANNEL_DECL.DELIVERY, row)[1], null)
  assert.equal(groupAxisOf(CHANNEL_DECL.DELIVERY, row), '서대문마을생협')
})

test('groupAxisOf: 기업별은 축이 없다 — 한 값뿐이라 묶을 게 없다', () => {
  assert.equal(groupAxisOf(CHANNEL_DECL.CORPORATE, { vendor: '시아스', recipient: '시아스' }), null)
})

test('groupAxisOf: 빈 값은 null — 빈 이름의 그룹을 만들지 않는다', () => {
  assert.equal(groupAxisOf(CHANNEL_DECL.MEAL_SEOUL, { vendor: '은평구', recipient: '' }), null)
  assert.equal(groupAxisOf(CHANNEL_DECL.MEAL_SEOUL, { vendor: '은평구', recipient: null }), null)
})
