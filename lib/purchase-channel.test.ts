import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHANNEL_DECL, nameTiersOf } from './purchase-channel'

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
