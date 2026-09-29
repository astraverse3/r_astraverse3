import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveQuickPeriod } from './statistics-utils'
import { toKstDate } from './kst-date'

// 🔴 TZ=UTC(통계 첫 화면을 만드는 서버)와 TZ=Asia/Seoul(브라우저) 둘 다에서 같아야 한다. 입력은 UTC 순간 리터럴.

test('resolveQuickPeriod: 끝 날짜 = 오늘(KST) — KST 23:30이면 아직 그날', () => {
    const r = resolveQuickPeriod('1w', undefined, new Date('2026-09-30T14:30:00Z'))
    assert.equal(toKstDate(r.to), '2026-09-30')
    assert.equal(toKstDate(r.from), '2026-09-23')
})

test('resolveQuickPeriod: KST 자정을 넘기면 다음 날 — UTC 서버에서도', () => {
    const r = resolveQuickPeriod('1w', undefined, new Date('2026-09-30T15:30:00Z'))
    assert.equal(toKstDate(r.to), '2026-10-01')
})

test('resolveQuickPeriod: 월말 오후에 다음 달로 넘어가지 않는다 — 옛 setHours가 UTC 서버에서 만들던 빈 칸', () => {
    const r = resolveQuickPeriod('6m', undefined, new Date('2026-09-30T05:00:00Z')) // KST 9/30 14:00
    assert.equal(toKstDate(r.to).slice(0, 7), '2026-09')
})
