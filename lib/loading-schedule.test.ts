import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    compareLoading,
    describeLoading,
    todayIsoKst,
    type LoadingInfo,
} from './loading-schedule'

const TODAY = '2026-08-26'

const info = (over: Partial<LoadingInfo> = {}): LoadingInfo => ({
    loadingDate: null,
    loadingTimeSlot: 'UNKNOWN',
    loadingTime: null,
    vendorName: null,
    ...over,
})

// ------------------------------------------------------
// 표시 라벨
// ------------------------------------------------------

test('describeLoading: 상차일이 없으면 배차 미정', () => {
    const d = describeLoading(info({ vendorName: '경동화물' }), TODAY)
    assert.equal(d.tone, 'unset')
    assert.equal(d.label, '배차 미정')
    // 업체만 정해둔 경우도 있어 업체명은 남긴다
    assert.equal(d.vendorName, '경동화물')
})

test('describeLoading: 오늘 + 시각 확정', () => {
    const d = describeLoading(
        info({ loadingDate: TODAY, loadingTimeSlot: 'EXACT', loadingTime: '14:00', vendorName: '경동화물' }),
        TODAY,
    )
    assert.equal(d.tone, 'today')
    assert.equal(d.label, '오늘 14:00')
    assert.equal(d.vendorName, '경동화물')
})

test('describeLoading: 오늘인데 시각 미정이면 날짜만', () => {
    const d = describeLoading(info({ loadingDate: TODAY }), TODAY)
    assert.equal(d.tone, 'today')
    assert.equal(d.label, '오늘')
})

test('describeLoading: 내일 + 오전', () => {
    const d = describeLoading(info({ loadingDate: '2026-08-27', loadingTimeSlot: 'AM' }), TODAY)
    assert.equal(d.tone, 'upcoming')
    assert.equal(d.label, '내일 오전')
})

test('describeLoading: 모레 이후는 M/D로', () => {
    const d = describeLoading(info({ loadingDate: '2026-09-03', loadingTimeSlot: 'PM' }), TODAY)
    assert.equal(d.tone, 'upcoming')
    assert.equal(d.label, '9/3 오후')
})

test('describeLoading: 상차일이 지났으면 완료 — 별도 플래그 없이 날짜로만 판정', () => {
    const d = describeLoading(
        info({ loadingDate: '2026-08-18', loadingTimeSlot: 'EXACT', loadingTime: '09:00', vendorName: '대신화물' }),
        TODAY,
    )
    assert.equal(d.tone, 'done')
    assert.equal(d.label, '8/18 상차 완료')
    // 완료된 줄이 도드라지지 않도록 업체명은 붙이지 않는다
    assert.equal(d.vendorName, null)
})

// ------------------------------------------------------
// 임박순 정렬
// ------------------------------------------------------

test('compareLoading: 오늘이 내일보다 위', () => {
    const today = info({ loadingDate: TODAY })
    const tomorrow = info({ loadingDate: '2026-08-27' })
    assert.ok(compareLoading(today, tomorrow, TODAY) < 0)
})

test('compareLoading: 배차 미정은 예정된 상차보다 아래', () => {
    const scheduled = info({ loadingDate: '2026-12-31' })
    assert.ok(compareLoading(scheduled, info(), TODAY) < 0)
})

test('compareLoading: 지난 상차는 배차 미정보다도 아래', () => {
    const past = info({ loadingDate: '2026-08-18' })
    assert.ok(compareLoading(info(), past, TODAY) < 0)
})

test('compareLoading: 지난 상차끼리는 최근 것이 위', () => {
    const older = info({ loadingDate: '2026-08-10' })
    const recent = info({ loadingDate: '2026-08-18' })
    assert.ok(compareLoading(recent, older, TODAY) < 0)
})

test('compareLoading: 같은 날짜면 시각이 이른 쪽이 위', () => {
    const morning = info({ loadingDate: TODAY, loadingTimeSlot: 'AM' })
    const afternoon = info({ loadingDate: TODAY, loadingTimeSlot: 'PM' })
    assert.ok(compareLoading(morning, afternoon, TODAY) < 0)
})

test('compareLoading: 같은 날짜면 시각 미정이 맨 뒤', () => {
    const exact = info({ loadingDate: TODAY, loadingTimeSlot: 'EXACT', loadingTime: '17:30' })
    const unknown = info({ loadingDate: TODAY })
    assert.ok(compareLoading(exact, unknown, TODAY) < 0)
})

test('compareLoading: 오전(09:00 근사)이 14:00 확정보다 위', () => {
    const am = info({ loadingDate: TODAY, loadingTimeSlot: 'AM' })
    const exact = info({ loadingDate: TODAY, loadingTimeSlot: 'EXACT', loadingTime: '14:00' })
    assert.ok(compareLoading(am, exact, TODAY) < 0)
})

test('compareLoading: 상차 정보가 둘 다 비면 동순위 — 호출부가 업로드 최신순으로 잇는다', () => {
    assert.equal(compareLoading(info(), info(), TODAY), 0)
})

// ------------------------------------------------------
// KST 오늘
// ------------------------------------------------------

test('todayIsoKst: UTC 밤 늦은 시각이면 한국은 이미 다음 날', () => {
    // 2026-08-25 16:00 UTC = 2026-08-26 01:00 KST
    assert.equal(todayIsoKst(new Date('2026-08-25T16:00:00Z')), '2026-08-26')
})

test('todayIsoKst: UTC 이른 아침은 같은 날', () => {
    assert.equal(todayIsoKst(new Date('2026-08-26T00:30:00Z')), '2026-08-26')
})
