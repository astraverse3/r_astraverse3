import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NO_CUSTOMER,
  filterSales,
  pickGroupBy,
  salesBreakdown,
  salesTrend,
  summarizeSales,
  toSaleLine,
  type SaleLine,
  type SaleMovementRow,
} from './sales-stats'

// 🔴 이 파일은 TZ=UTC(실서버)와 TZ=Asia/Seoul(개발 PC) 두 환경에서 같은 결과여야 한다.
//    날짜 입력은 전부 UTC 순간 리터럴이다.

const SAEJEONGMU = { id: 1, name: '새청무', type: 'URUCHI' }
const CHAL = { id: 2, name: '동진찰', type: 'GLUTINOUS' }
const BORI = { id: 3, name: '찰보리', type: 'BARLEY' }

function row(over: Partial<SaleMovementRow> & { pkg?: Partial<SaleMovementRow['package']> }): SaleMovementRow {
  const { pkg, ...rest } = over
  return {
    count: 1,
    occurredAt: new Date('2026-10-01T03:00:00Z'),
    createdAt: new Date('2026-10-01T03:00:00Z'),
    customer: null,
    orderItem: null,
    ...rest,
    package: {
      weightPerUnit: 10,
      packageType: '10kg',
      category: 'RICE',
      stock: { variety: SAEJEONGMU },
      variety: null,
      productType: { id: 7, millingType: '백미', packaging: { name: '자연주의' } },
      ...pkg,
    },
  }
}

function line(over: Partial<SaleLine>): SaleLine {
  return {
    occurredAt: new Date('2026-10-01T03:00:00Z'),
    count: 1,
    kg: 10,
    channel: 'DELIVERY',
    customer: '홍길동',
    orderKey: 'o:1',
    category: 'RICE',
    varietyId: 1,
    variety: '새청무',
    productKey: 'sku:7',
    productLabel: '새청무 백미 10kg · 자연주의',
    ...over,
  }
}

test('toSaleLine: 발주서 줄 — 채널·거래처는 주문에서, 주문 수 키는 주문 id', () => {
  const l = toSaleLine(
    row({ count: 3, orderItem: { order: { id: 42, channel: 'EMART', vendor: '이마트' } } }),
  )
  assert.equal(l.channel, 'EMART')
  assert.equal(l.customer, '이마트')
  assert.equal(l.orderKey, 'o:42')
  assert.equal(l.kg, 30)
  assert.equal(l.productKey, 'sku:7')
  assert.equal(l.productLabel, '새청무 백미 10kg · 자연주의')
})

test('toSaleLine: 직접 판매 — 채널 「직접판매」, 거래처가 비거나 공백이면 「거래처 미입력」', () => {
  const blank = toSaleLine(row({ customer: '   ' }))
  assert.equal(blank.channel, 'DIRECT')
  assert.equal(blank.customer, NO_CUSTOMER)
  assert.equal(toSaleLine(row({ customer: null })).customer, NO_CUSTOMER)
  assert.equal(toSaleLine(row({ customer: ' 해남농협 ' })).customer, '해남농협')
})

test('toSaleLine: 직접 판매 「주문 수」 키 — 같은 차감(같은 createdAt·거래처)은 한 건', () => {
  const at = new Date('2026-10-01T02:39:00Z')
  const a = toSaleLine(row({ createdAt: at, customer: 'A' }))
  const b = toSaleLine(row({ createdAt: at, customer: 'A', pkg: { packageType: '20kg', weightPerUnit: 20 } }))
  const c = toSaleLine(row({ createdAt: new Date('2026-10-01T02:40:00Z'), customer: 'A' }))
  assert.equal(a.orderKey, b.orderKey)
  assert.notEqual(a.orderKey, c.orderKey)
})

test('toSaleLine: 찰벼는 찹쌀로 표시, 잡곡의 도정유형 「기타」는 빼고, 매입은 행의 품종', () => {
  const chal = toSaleLine(row({ pkg: { stock: { variety: CHAL } } }))
  assert.equal(chal.productLabel, '동진찰 찹쌀 10kg · 자연주의')

  const bori = toSaleLine(
    row({
      pkg: {
        category: 'MISC_GRAIN',
        stock: null,
        variety: BORI,
        packageType: '1kg',
        weightPerUnit: 1,
        productType: { id: 9, millingType: '기타', packaging: { name: '매입포장' } },
      },
    }),
  )
  assert.equal(bori.variety, '찰보리')
  assert.equal(bori.varietyId, 3)
  assert.equal(bori.category, 'MISC_GRAIN')
  assert.equal(bori.productLabel, '찰보리 1kg · 매입포장')
})

test('toSaleLine: 포장지 이름이 규격과 같으면(톤백) 한 번만', () => {
  const l = toSaleLine(
    row({ pkg: { packageType: '톤백', weightPerUnit: 1000, productType: { id: 8, millingType: '백미', packaging: { name: '톤백' } } } }),
  )
  assert.equal(l.productLabel, '새청무 백미 톤백')
})

test('toSaleLine: SKU 없는 행(잔량)은 품종·규격으로 묶는다', () => {
  const l = toSaleLine(row({ pkg: { packageType: '잔량', weightPerUnit: 4, productType: null } }))
  assert.equal(l.productKey, 'raw:새청무|잔량')
  assert.equal(l.productLabel, '새청무 잔량')
})

test('filterSales: 빈 조건은 전체, 조건끼리는 AND, 품종 조건이 있으면 품종 미상은 빠진다', () => {
  const lines = [
    line({ channel: 'DELIVERY', category: 'RICE', varietyId: 1 }),
    line({ channel: 'DIRECT', category: 'RICE', varietyId: 2 }),
    line({ channel: 'EMART', category: 'MISC_GRAIN', varietyId: 3 }),
    line({ channel: 'EMART', category: 'RICE', varietyId: null }),
  ]
  assert.equal(filterSales(lines, {}).length, 4)
  assert.equal(filterSales(lines, { channels: [] }).length, 4)
  assert.equal(filterSales(lines, { categories: ['RICE'] }).length, 3)
  assert.equal(filterSales(lines, { channels: ['EMART'], categories: ['RICE'] }).length, 1)
  assert.deepEqual(filterSales(lines, { varietyIds: [1, 3] }).map(l => l.varietyId), [1, 3])
})

test('summarizeSales: 주문은 키로 중복 제거, 거래처는 채널까지 키, kg는 소수 첫째 자리', () => {
  const s = summarizeSales([
    line({ orderKey: 'o:1', kg: 0.907 * 3, count: 3 }),
    line({ orderKey: 'o:1', kg: 10, count: 1 }),
    line({ orderKey: 'o:2', kg: 10, count: 1, channel: 'CORPORATE', customer: '홍길동' }),
  ])
  assert.equal(s.kg, 22.7)
  assert.equal(s.count, 5)
  assert.equal(s.orders, 2)
  assert.equal(s.customers, 2) // 택배 홍길동 · 기업별 홍길동
})

test('summarizeSales: 빈 목록', () => {
  assert.deepEqual(summarizeSales([]), { kg: 0, count: 0, orders: 0, customers: 0 })
})

test('pickGroupBy: 31일까지 일별, 186일까지 주별, 그 뒤 월별 — 양 끝 포함', () => {
  assert.equal(pickGroupBy('2026-10-01', '2026-10-01'), 'day')
  assert.equal(pickGroupBy('2026-10-01', '2026-10-31'), 'day')
  assert.equal(pickGroupBy('2026-10-01', '2026-11-01'), 'week')
  assert.equal(pickGroupBy('2026-01-01', '2026-07-05'), 'week') // 186일
  assert.equal(pickGroupBy('2026-01-01', '2026-07-06'), 'month') // 187일
})

test('salesTrend: 빈 날도 칸이 있고, KST 자정 직후 판매는 그날 칸에', () => {
  const from = new Date('2026-09-29T15:00:00Z') // KST 9/30 00:00
  const to = new Date('2026-10-02T14:59:00Z') // KST 10/2 23:59
  const t = salesTrend(
    [
      line({ occurredAt: new Date('2026-09-30T15:00:00Z'), kg: 10, channel: 'DELIVERY' }), // KST 10/1 00:00
      line({ occurredAt: new Date('2026-10-01T03:00:00Z'), kg: 5.5, channel: 'DIRECT' }),
      line({ occurredAt: new Date('2026-10-01T14:59:00Z'), kg: 1, channel: 'DELIVERY' }), // KST 10/1 23:59
    ],
    from,
    to,
    'day',
  )
  assert.deepEqual(t.map(b => b.key), ['09/30', '10/01', '10/02'])
  assert.equal(t[0].total, 0)
  assert.equal(t[1].total, 16.5)
  assert.equal(t[1].byChannel.DELIVERY, 11)
  assert.equal(t[1].byChannel.DIRECT, 5.5)
  assert.equal(t[1].byChannel.EMART, 0)
})

test('salesBreakdown: kg 많은 순 · 비중 % · 주문 수', () => {
  const rows = salesBreakdown(
    [
      line({ channel: 'DELIVERY', kg: 30, count: 3, orderKey: 'o:1' }),
      line({ channel: 'DELIVERY', kg: 10, count: 1, orderKey: 'o:2' }),
      line({ channel: 'EMART', kg: 60, count: 6, orderKey: 'o:3' }),
    ],
    'channel',
  )
  assert.deepEqual(
    rows.map(r => [r.label, r.kg, r.count, r.orders, r.share]),
    [
      ['이마트', 60, 6, 1, 60],
      ['택배', 40, 4, 2, 40],
    ],
  )
})

test('salesBreakdown: 거래처는 같은 이름이라도 채널이 다르면 다른 줄, 채널을 보조 표기로', () => {
  const rows = salesBreakdown(
    [
      line({ channel: 'DELIVERY', customer: '홍길동', kg: 10 }),
      line({ channel: 'CORPORATE', customer: '홍길동', kg: 20 }),
    ],
    'customer',
  )
  assert.deepEqual(rows.map(r => [r.label, r.sub, r.channel, r.kg]), [
    ['홍길동', '기업별', 'CORPORATE', 20],
    ['홍길동', '택배', 'DELIVERY', 10],
  ])
})

test('salesBreakdown: 품종·제품 줄은 채널이 섞여 channel=null', () => {
  const rows = salesBreakdown(
    [line({ channel: 'DELIVERY', varietyId: 1 }), line({ channel: 'EMART', varietyId: 1 })],
    'variety',
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].channel, null)
  assert.equal(rows[0].orders, 1) // 같은 orderKey('o:1')
})

test('salesBreakdown: 빈 목록이면 빈 배열(0으로 나누지 않는다)', () => {
  assert.deepEqual(salesBreakdown([], 'product'), [])
})
