import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getYieldLevel, getYieldTarget, YIELD_WARN_GAP, matchesYieldFilter } from './milling-yield'

// 관리자 설정값을 흉내 낸다 (백미 68 · 현미 70)
const RATES = { '백미': 68, '현미': 70 }

// ------------------------------------------------------
// 등급 경계 — 기준값 이상 / 기준-5p 이상 / 그 미만
// ------------------------------------------------------

test('기준값 정확히 = good (경계 포함)', () => {
    assert.equal(getYieldLevel(68, '백미', RATES), 'good')
    assert.equal(getYieldLevel(70, '현미', RATES), 'good')
})

test('기준값 초과 = good', () => {
    assert.equal(getYieldLevel(72.5, '백미', RATES), 'good')
})

test('기준값 바로 아래 = warn', () => {
    assert.equal(getYieldLevel(67.9, '백미', RATES), 'warn')
    assert.equal(getYieldLevel(69.9, '현미', RATES), 'warn')
})

test('경고 하한 정확히(기준-5p) = warn (경계 포함)', () => {
    assert.equal(getYieldLevel(63, '백미', RATES), 'warn')
    assert.equal(getYieldLevel(65, '현미', RATES), 'warn')
})

test('경고 하한 미만 = bad', () => {
    assert.equal(getYieldLevel(62.9, '백미', RATES), 'bad')
    assert.equal(getYieldLevel(64.9, '현미', RATES), 'bad')
})

test('같은 수율도 도정구분이 다르면 등급이 갈린다', () => {
    // 68%는 백미 기준(68)엔 도달했지만 현미 기준(70)엔 미달
    assert.equal(getYieldLevel(68, '백미', RATES), 'good')
    assert.equal(getYieldLevel(68, '현미', RATES), 'warn')
})

test('WARN_GAP 상수와 판정이 일치한다', () => {
    const target = RATES['백미']
    assert.equal(getYieldLevel(target - YIELD_WARN_GAP, '백미', RATES), 'warn')
    assert.equal(getYieldLevel(target - YIELD_WARN_GAP - 0.1, '백미', RATES), 'bad')
})

// ------------------------------------------------------
// 폴백 — 설정에 없는 도정구분
// ------------------------------------------------------

test('설정에 없는 도정구분은 기본 상수로 폴백', () => {
    // 오분도미 기본값 69 → 69 이상 good, 64 이상 warn
    assert.equal(getYieldLevel(69, '오분도미', RATES), 'good')
    assert.equal(getYieldLevel(64, '오분도미', RATES), 'warn')
    assert.equal(getYieldLevel(63.9, '오분도미', RATES), 'bad')
})

test('기본 상수에도 없는 도정구분은 68로 폴백', () => {
    assert.equal(getYieldLevel(68, '없는구분', {}), 'good')
    assert.equal(getYieldLevel(63, '없는구분', {}), 'warn')
    assert.equal(getYieldLevel(62.9, '없는구분', {}), 'bad')
})

test('빈 설정값이어도 기본 상수 기준으로 판정한다', () => {
    // Provider가 아직 값을 못 내려준 상황 — 하드코딩 시절과 같은 결과여야 한다
    assert.equal(getYieldLevel(68, '백미', {}), 'good')
    assert.equal(getYieldLevel(70, '현미', {}), 'good')
})

test('수율 0(포장 전)은 bad로 떨어진다 — 호출부에서 0을 걸러야 한다', () => {
    assert.equal(getYieldLevel(0, '백미', RATES), 'bad')
})

// ------------------------------------------------------
// 기존 필터가 등급 추가로 깨지지 않았는지 (회귀)
// ------------------------------------------------------

test('matchesYieldFilter는 그대로 동작한다', () => {
    const batch = { isClosed: true, totalInputKg: 100, outputs: [{ totalWeight: 68 }] }
    assert.equal(matchesYieldFilter(batch, 'ALL'), true)
    assert.equal(matchesYieldFilter(batch, 'upto_70'), true)
    assert.equal(matchesYieldFilter(batch, 'upto_60'), false)
    assert.equal(matchesYieldFilter({ ...batch, isClosed: false }, 'upto_70'), false)
})

// ------------------------------------------------------
// 품종 축 — 인디카는 도정구분이 아니라 Variety.type이다
// ------------------------------------------------------

test('인디카 백미는 인디카 기준(61)으로 판정된다', () => {
    // millingType은 '백미'지만 품종이 INDICA면 61이 기준
    assert.equal(getYieldLevel(61, '백미', RATES, 'INDICA'), 'good')
    assert.equal(getYieldLevel(60.9, '백미', RATES, 'INDICA'), 'warn')
    assert.equal(getYieldLevel(56, '백미', RATES, 'INDICA'), 'warn')
    assert.equal(getYieldLevel(55.9, '백미', RATES, 'INDICA'), 'bad')
})

test('같은 백미라도 품종에 따라 등급이 갈린다 — 이번 작업의 핵심', () => {
    // 실적 기준: 인디카 백미 61.3% · 메벼 백미 67.2%
    // 품종 축이 없으면 인디카 61%가 백미 기준(68)에 걸려 bad로 찍혔다
    assert.equal(getYieldLevel(61.3, '백미', RATES, 'INDICA'), 'good')
    assert.equal(getYieldLevel(61.3, '백미', RATES, 'URUCHI'), 'bad')
    assert.equal(getYieldLevel(61.3, '백미', RATES), 'bad')
})

test('인디카 현미는 인디카 현미 기준(65)을 쓴다', () => {
    assert.equal(getYieldLevel(65, '현미', RATES, 'INDICA'), 'good')
    assert.equal(getYieldLevel(64.9, '현미', RATES, 'INDICA'), 'warn')
})

test('품종 축에 없는 도정구분은 도정구분 기준으로 떨어진다', () => {
    // 인디카는 백미·현미만 관리한다 — 오분도미는 일반 기준(69)
    assert.equal(getYieldLevel(69, '오분도미', RATES, 'INDICA'), 'good')
    assert.equal(getYieldLevel(64, '오분도미', RATES, 'INDICA'), 'warn')
})

test('찰벼·메벼는 품종 축이 없어 도정구분 기준을 그대로 쓴다', () => {
    // 찰벼 백미 실적 67.5% ≈ 메벼 67.2% — 별도 기준을 두지 않았다
    for (const t of ['GLUTINOUS', 'URUCHI', 'MISC_GRAIN']) {
        assert.equal(getYieldLevel(68, '백미', RATES, t), 'good', t)
        assert.equal(getYieldLevel(67.9, '백미', RATES, t), 'warn', t)
    }
})

test('varietyType이 없거나 null이면 도정구분 기준 (기존 동작 유지)', () => {
    assert.equal(getYieldLevel(68, '백미', RATES), 'good')
    assert.equal(getYieldLevel(68, '백미', RATES, null), 'good')
    assert.equal(getYieldLevel(68, '백미', RATES, undefined), 'good')
})

test('관리자가 저장한 인디카 값이 기본값을 덮는다', () => {
    const custom = { ...RATES, 'INDICA_백미': 64 }
    assert.equal(getYieldLevel(64, '백미', custom, 'INDICA'), 'good')
    assert.equal(getYieldLevel(63, '백미', custom, 'INDICA'), 'warn')
    // 기본값 61 기준이었다면 63은 good이었을 것
    assert.equal(getYieldLevel(63, '백미', RATES, 'INDICA'), 'good')
})

// ------------------------------------------------------
// getYieldTarget — 폴백 순서
// ------------------------------------------------------

test('getYieldTarget 폴백: 품종축 설정 → 품종축 기본 → 도정구분 설정 → 도정구분 기본 → 68', () => {
    assert.equal(getYieldTarget('백미', { ...RATES, 'INDICA_백미': 64 }, 'INDICA'), 64)
    assert.equal(getYieldTarget('백미', RATES, 'INDICA'), 61)
    assert.equal(getYieldTarget('백미', RATES, 'URUCHI'), 68)
    assert.equal(getYieldTarget('오분도미', {}, 'INDICA'), 69)
    assert.equal(getYieldTarget('없는구분', {}, 'INDICA'), 68)
})
