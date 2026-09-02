import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultProductionYears, defaultProductionYear } from './production-year'

/** 그 달 15일 정오 — 월 경계만 보므로 일자는 무관하다 */
const at = (year: number, month: number) => new Date(year, month - 1, 15, 12)

// ------------------------------------------------------
// 검색 (복수)
// ------------------------------------------------------

test('벼: 수확 전(1~9월)은 전년 한 해만', () => {
    for (const m of [1, 3, 6, 9]) {
        assert.deepEqual(defaultProductionYears('RICE', at(2026, m)), ['2025'], `${m}월`)
    }
})

test('벼: 수확기(10~12월)는 올해와 전년을 함께', () => {
    for (const m of [10, 11, 12]) {
        assert.deepEqual(defaultProductionYears('RICE', at(2026, m)), ['2026', '2025'], `${m}월`)
    }
})

test('벼: 해가 바뀌면 다시 전년 한 해로 돌아온다', () => {
    assert.deepEqual(defaultProductionYears('RICE', at(2027, 1)), ['2026'])
})

test('잡곡: 6~12월은 올해와 전년', () => {
    for (const m of [6, 8, 10, 12]) {
        assert.deepEqual(defaultProductionYears('MISC_GRAIN', at(2026, m)), ['2026', '2025'], `${m}월`)
    }
})

test('잡곡: 1~5월은 전년과 재작년 — 그때 올해분은 아직 없다', () => {
    for (const m of [1, 3, 5]) {
        assert.deepEqual(defaultProductionYears('MISC_GRAIN', at(2026, m)), ['2025', '2024'], `${m}월`)
    }
})

test('잡곡은 언제 물어봐도 두 해를 준다', () => {
    for (let m = 1; m <= 12; m++) {
        assert.equal(defaultProductionYears('MISC_GRAIN', at(2026, m)).length, 2, `${m}월`)
    }
})

test('최신 연도가 앞에 온다', () => {
    const [first, second] = defaultProductionYears('MISC_GRAIN', at(2026, 7))
    assert.ok(Number(first) > Number(second))
})

// ------------------------------------------------------
// 등록 폼 (단일)
// ------------------------------------------------------

test('벼 등록: 11월부터 당해년도', () => {
    assert.equal(defaultProductionYear('RICE', at(2026, 10)), 2025)
    assert.equal(defaultProductionYear('RICE', at(2026, 11)), 2026)
    assert.equal(defaultProductionYear('RICE', at(2026, 12)), 2026)
})

test('잡곡 등록: 6월부터 당해년도', () => {
    assert.equal(defaultProductionYear('MISC_GRAIN', at(2026, 5)), 2025)
    assert.equal(defaultProductionYear('MISC_GRAIN', at(2026, 6)), 2026)
})

test('벼 검색은 10월에 올해를 포함하지만, 벼 등록은 아직 전년을 찍는다', () => {
    // 10월엔 수확분이 들어오기 시작만 해 검색 범위는 넓히되, 등록 기본값까지 옮기진 않는다
    assert.ok(defaultProductionYears('RICE', at(2026, 10)).includes('2026'))
    assert.equal(defaultProductionYear('RICE', at(2026, 10)), 2025)
})
