import { test } from 'node:test'
import assert from 'node:assert/strict'
import { presetRange } from './sales-period'

test('presetRange: 이번 달 · 지난 달 · 최근 N개월 · 올해', () => {
  const today = '2026-10-02'
  assert.deepEqual(presetRange('thisMonth', today), { from: '2026-10-01', to: '2026-10-02' })
  assert.deepEqual(presetRange('lastMonth', today), { from: '2026-09-01', to: '2026-09-30' })
  assert.deepEqual(presetRange('last3m', today), { from: '2026-08-01', to: '2026-10-02' })
  assert.deepEqual(presetRange('last6m', today), { from: '2026-05-01', to: '2026-10-02' })
  assert.deepEqual(presetRange('thisYear', today), { from: '2026-01-01', to: '2026-10-02' })
  assert.deepEqual(presetRange('last12m', today), { from: '2025-11-01', to: '2026-10-02' })
})

test('presetRange: 1월이면 지난 달·최근 3개월이 해를 넘긴다', () => {
  assert.deepEqual(presetRange('lastMonth', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' })
  assert.deepEqual(presetRange('last3m', '2026-01-15'), { from: '2025-11-01', to: '2026-01-15' })
})

test('presetRange: 지난 달 말일 — 윤년 2월', () => {
  assert.deepEqual(presetRange('lastMonth', '2028-03-10'), { from: '2028-02-01', to: '2028-02-29' })
  assert.deepEqual(presetRange('lastMonth', '2026-03-31'), { from: '2026-02-01', to: '2026-02-28' })
})
