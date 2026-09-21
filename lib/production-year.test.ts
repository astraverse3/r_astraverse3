import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    defaultProductionYears,
    defaultProductionYear,
    productionYearOptions,
    productionYearFilterOptions,
    productionYearOptionsWith,
} from './production-year'

/** 그 달 15일 정오 — 월 경계만 보므로 일자는 무관하다 */
const at = (year: number, month: number) => new Date(year, month - 1, 15, 12)

// ------------------------------------------------------
// 검색 (복수)
// ------------------------------------------------------

test('벼: 수확 전(1~8월)은 전년 한 해만', () => {
    for (const m of [1, 3, 6, 8]) {
        assert.deepEqual(defaultProductionYears('RICE', at(2026, m)), ['2025'], `${m}월`)
    }
})

test('벼: 수확기(9~12월)는 올해와 전년을 함께', () => {
    for (const m of [9, 10, 11, 12]) {
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

test('벼 등록: 9월부터 당해년도', () => {
    assert.equal(defaultProductionYear('RICE', at(2026, 8)), 2025)
    assert.equal(defaultProductionYear('RICE', at(2026, 9)), 2026)
    assert.equal(defaultProductionYear('RICE', at(2026, 11)), 2026)
    assert.equal(defaultProductionYear('RICE', at(2026, 12)), 2026)
})

test('잡곡 등록: 6월부터 당해년도', () => {
    assert.equal(defaultProductionYear('MISC_GRAIN', at(2026, 5)), 2025)
    assert.equal(defaultProductionYear('MISC_GRAIN', at(2026, 6)), 2026)
})

// 구 테스트 `벼 검색은 10월에 올해를 포함하지만, 벼 등록은 아직 전년을 찍는다`는 삭제했다.
// 2026-09-21에 두 경계를 9월로 맞추면서 **주장 자체가 폐기**됐다(값 수정으로 살릴 수 없다).
test('벼: 검색이 올해를 보기 시작하는 달과 등록이 올해를 찍는 달이 같다', () => {
    for (let m = 1; m <= 12; m++) {
        const searchHasThisYear = defaultProductionYears('RICE', at(2026, m)).includes('2026')
        const formPicksThisYear = defaultProductionYear('RICE', at(2026, m)) === 2026
        assert.equal(searchHasThisYear, formPicksThisYear, `${m}월`)
    }
})

test('벼: 26년산 첫 입고(2026-09-15)가 기본 검색에 걸린다', () => {
    // 이 회귀가 실제 사고였다 — DB에 26년산이 있는데 기본 필터가 ['2025']라 목록에서 안 보였다
    assert.ok(defaultProductionYears('RICE', new Date(2026, 8, 15, 12)).includes('2026'))
})

// ------------------------------------------------------
// 연도 선택 목록
// ------------------------------------------------------

test('연도 목록: 올해부터 과거 3년, 최신이 앞', () => {
    assert.deepEqual(productionYearOptions(at(2026, 9)), [2026, 2025, 2024, 2023])
})

test('연도 목록: 달과 무관하다 — 수확 경계가 아니라 고를 수 있는 범위다', () => {
    for (let m = 1; m <= 12; m++) {
        assert.deepEqual(productionYearOptions(at(2026, m)), [2026, 2025, 2024, 2023], `${m}월`)
    }
})

test('🔴 연도 목록: 해가 바뀌면 저절로 따라온다 (5곳 하드코딩을 없앤 이유)', () => {
    assert.deepEqual(productionYearOptions(at(2027, 1)), [2027, 2026, 2025, 2024])
    assert.deepEqual(productionYearOptions(at(2030, 6)), [2030, 2029, 2028, 2027])
})

test('연도 목록: 기본값은 언제나 목록 안에 있다', () => {
    for (let m = 1; m <= 12; m++) {
        const options = productionYearOptions(at(2026, m))
        assert.ok(options.includes(defaultProductionYear('RICE', at(2026, m))), `벼 ${m}월`)
        assert.ok(options.includes(defaultProductionYear('MISC_GRAIN', at(2026, m))), `잡곡 ${m}월`)
    }
})

test('필터 목록: MultiSelect가 쓰는 {label, value} 형태', () => {
    assert.deepEqual(productionYearFilterOptions(at(2026, 9))[0], { label: '2026년', value: '2026' })
    assert.equal(productionYearFilterOptions(at(2026, 9)).length, 4)
})

test('🔴 목록 밖 연도는 끼워 넣는다 — 안 그러면 옛 재고 수정 시 연도가 날아간다', () => {
    assert.deepEqual(productionYearOptionsWith(2020, at(2026, 9)), [2026, 2025, 2024, 2023, 2020])
})

test('목록 안 연도는 중복으로 들어가지 않는다', () => {
    assert.deepEqual(productionYearOptionsWith(2025, at(2026, 9)), [2026, 2025, 2024, 2023])
})
