import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickRecommendedVendor } from './shipping-recommend'

// 계획서 `docs/plan/plan-배송상차정보.md` §6의 예시 3줄이 그대로 케이스다.

test('pickRecommendedVendor: 예외 1건은 다수에 묻힌다', () => {
  // 경동 · 경동 · 대신 → 경동
  assert.equal(pickRecommendedVendor([1, 1, 2]), 1)
})

test('pickRecommendedVendor: 업체를 바꾸면 두 건 만에 따라온다', () => {
  // 대신 · 대신 · 경동 → 대신
  assert.equal(pickRecommendedVendor([2, 2, 1]), 2)
})

test('pickRecommendedVendor: 고정 패턴이 없으면 추천하지 않는다', () => {
  // 경동 · 대신 · 전국 → 빈칸
  assert.equal(pickRecommendedVendor([1, 2, 3]), null)
})

test('pickRecommendedVendor: 이력이 없으면 빈칸 (도입 직후)', () => {
  assert.equal(pickRecommendedVendor([]), null)
})

test('pickRecommendedVendor: 1건뿐이어도 그 업체가 유일한 최빈값', () => {
  assert.equal(pickRecommendedVendor([7]), 7)
})

test('pickRecommendedVendor: 2건 동률이면 빈칸', () => {
  assert.equal(pickRecommendedVendor([1, 2]), null)
})

test('pickRecommendedVendor: 동률이 뒤에서 깨지면 그 업체를 추천', () => {
  // 앞의 1·2가 동률이었다가 마지막 2로 갈린다 — 순회 중 tied 플래그가 남지 않아야 한다
  assert.equal(pickRecommendedVendor([1, 2, 2]), 2)
})

test('pickRecommendedVendor: 최빈값이 동률이면 1위가 여럿이라 빈칸', () => {
  // 1이 2번, 2가 2번 → 유일하지 않다
  assert.equal(pickRecommendedVendor([1, 2, 1, 2]), null)
})
