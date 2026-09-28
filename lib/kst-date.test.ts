import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatKstKo, kstDayRange, kstYearRange, todayKst, toKstDate, toKstMonth } from './kst-date'

// 🔴 이 파일은 TZ=UTC(실서버)와 TZ=Asia/Seoul(개발 PC) 두 환경에서 같은 결과여야 한다.

test('toKstDate: UTC 자정 저장분은 같은 날 (KST 09:00)', () => {
  assert.equal(toKstDate(new Date('2026-09-08T00:00:00Z')), '2026-09-08')
})

test('toKstDate: KST 자정 저장분(UTC 전날 15:00)도 같은 날 — §39 결함 지점', () => {
  assert.equal(toKstDate(new Date('2026-09-07T15:00:00Z')), '2026-09-08')
})

test('toKstDate: KST 08:59는 아직 그날, 23:59도 그날', () => {
  assert.equal(toKstDate(new Date('2026-09-07T23:59:00Z')), '2026-09-08')
  assert.equal(toKstDate(new Date('2026-09-08T14:59:59Z')), '2026-09-08')
  assert.equal(toKstDate(new Date('2026-09-08T15:00:00Z')), '2026-09-09')
})

test('toKstDate: 월말·연말·윤년을 넘는다', () => {
  assert.equal(toKstDate(new Date('2026-09-30T15:00:00Z')), '2026-10-01')
  assert.equal(toKstDate(new Date('2026-12-31T15:00:00Z')), '2027-01-01')
  assert.equal(toKstDate(new Date('2028-02-28T15:00:00Z')), '2028-02-29')
})

test('toKstDate: yyyy-mm-dd 문자열은 그 날짜 그대로', () => {
  assert.equal(toKstDate('2026-09-08'), '2026-09-08')
})

test('todayKst: UTC 밤 늦은 시각이면 한국은 이미 다음 날', () => {
  assert.equal(todayKst(new Date('2026-08-25T16:00:00Z')), '2026-08-26')
})

test('toKstMonth: 월 첫날 KST 새벽은 새 달', () => {
  assert.equal(toKstMonth(new Date('2026-09-30T20:00:00Z')), '2026-10')
})

test('kstDayRange: KST 하루 = [UTC 전날 15:00, UTC 당일 15:00)', () => {
  const r = kstDayRange('2026-09-08')
  assert.ok(r)
  assert.equal(r.gte.toISOString(), '2026-09-07T15:00:00.000Z')
  assert.equal(r.lt.toISOString(), '2026-09-08T15:00:00.000Z')
})

test('kstDayRange: UTC 자정·KST 자정 저장분이 모두 범위 안', () => {
  const r = kstDayRange('2026-09-08')!
  for (const iso of ['2026-09-08T00:00:00Z', '2026-09-07T15:00:00Z', '2026-09-08T05:30:00Z']) {
    const t = new Date(iso).getTime()
    assert.ok(t >= r.gte.getTime() && t < r.lt.getTime(), iso)
  }
})

test('kstDayRange: 연말은 다음 해 첫날로 넘어간다', () => {
  assert.equal(kstDayRange('2026-12-31')!.lt.toISOString(), '2026-12-31T15:00:00.000Z')
})

test('kstDayRange: 형식 오류·없는 날짜는 null', () => {
  assert.equal(kstDayRange(undefined), null)
  assert.equal(kstDayRange(''), null)
  assert.equal(kstDayRange('2026-9-8'), null)
  assert.equal(kstDayRange('2026-02-31'), null)
  assert.equal(kstDayRange('2027-02-29'), null)
  assert.ok(kstDayRange('2028-02-29'))
})

test('kstYearRange: KST 1월 1일 00:00부터 다음 해 1월 1일 00:00 미만', () => {
  const r = kstYearRange(2026)
  assert.equal(r.gte.toISOString(), '2025-12-31T15:00:00.000Z')
  assert.equal(r.lt.toISOString(), '2026-12-31T15:00:00.000Z')
})

test('formatKstKo: 프로세스 시간대와 무관하게 KST 날짜', () => {
  assert.equal(formatKstKo(new Date('2026-09-07T15:00:00Z')), '2026. 9. 8.')
})

test('formatKstKo: 시각 포함은 KST 시각', () => {
  assert.equal(formatKstKo(new Date('2026-09-08T06:00:00Z'), true), '2026. 9. 8. 오후 3:00:00')
})
