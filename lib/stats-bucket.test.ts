import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketKeyOf, bucketsBetween, kstPeriodWhere } from './stats-bucket'

// 🔴 이 파일은 TZ=UTC(실서버)와 TZ=Asia/Seoul(개발 PC) 두 환경에서 같은 결과여야 한다.
//    기대값의 입력은 전부 UTC 순간 리터럴이다 — 로컬 자정으로 쓰면 어느 TZ에서나 통과해 버린다.

test('bucketKeyOf: UTC 자정 저장분(도정일)은 그날', () => {
  const d = new Date('2026-09-28T00:00:00Z') // 월요일
  assert.equal(bucketKeyOf(d, 'day'), '09/28')
  assert.equal(bucketKeyOf(d, 'week'), '09/28')
  assert.equal(bucketKeyOf(d, 'month'), '2026-09')
})

test('bucketKeyOf: KST 자정 저장분(UTC 전날 15:00)도 그날 — 서버 로컬 시간으로 읽으면 하루 밀리던 자리', () => {
  const d = new Date('2026-09-30T15:00:00Z') // KST 10월 1일 00:00
  assert.equal(bucketKeyOf(d, 'day'), '10/01')
  assert.equal(bucketKeyOf(d, 'month'), '2026-10')
})

test('bucketKeyOf: 주 키는 그 주 월요일 — 일요일은 앞 주', () => {
  assert.equal(bucketKeyOf(new Date('2026-10-04T00:00:00Z'), 'week'), '09/28') // 일요일
  assert.equal(bucketKeyOf(new Date('2026-10-05T00:00:00Z'), 'week'), '10/05') // 월요일
})

test('bucketsBetween: 일 — 양 끝 포함, 빈 날도 칸이 있다', () => {
  const b = bucketsBetween(new Date('2026-09-28T00:00:00Z'), new Date('2026-10-01T00:00:00Z'), 'day')
  assert.deepEqual(b.map(x => x.key), ['09/28', '09/29', '09/30', '10/01'])
})

test('bucketsBetween: 주 — 시작 주 월요일부터, 툴팁은 월~일', () => {
  const b = bucketsBetween(new Date('2026-09-30T00:00:00Z'), new Date('2026-10-12T00:00:00Z'), 'week')
  assert.deepEqual(b, [
    { key: '09/28', tooltipLabel: '09/28 ~ 10/04' },
    { key: '10/05', tooltipLabel: '10/05 ~ 10/11' },
    { key: '10/12', tooltipLabel: '10/12 ~ 10/18' },
  ])
})

test('bucketsBetween: 주 툴팁이 윤년 2월을 안다 — 옛 코드는 「올해」 연도로 계산했다', () => {
  const b = bucketsBetween(new Date('2024-02-26T00:00:00Z'), new Date('2024-02-26T00:00:00Z'), 'week')
  assert.deepEqual(b, [{ key: '02/26', tooltipLabel: '02/26 ~ 03/03' }])
})

test('bucketsBetween: 월 — 해를 넘어간다', () => {
  const b = bucketsBetween(new Date('2025-11-15T00:00:00Z'), new Date('2026-02-01T00:00:00Z'), 'month')
  assert.deepEqual(b.map(x => x.key), ['2025-11', '2025-12', '2026-01', '2026-02'])
})

test('kstPeriodWhere: 화면이 보낸 날짜(UTC 자정) → KST 하루 경계', () => {
  // 클라이언트는 'yyyy-MM-dd'를 new Date()로 보낸다 = UTC 자정
  const w = kstPeriodWhere(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-29T00:00:00Z'))
  assert.equal(w.gte.toISOString(), '2026-08-31T15:00:00.000Z') // KST 9/1 00:00
  assert.equal(w.lt.toISOString(), '2026-09-29T15:00:00.000Z')  // KST 9/30 00:00
})

test('kstPeriodWhere: 마지막 날(UTC 자정 저장)은 들고 다음 날(KST 자정 저장)은 뺀다 — 옛 setHours는 UTC 서버에서 다음 날 KST 08:59까지 잡았다', () => {
  const w = kstPeriodWhere(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-29T00:00:00Z'))
  const lastDayBatch = new Date('2026-09-29T00:00:00Z')
  const kstMidnightNextDay = new Date('2026-09-29T15:00:00Z')
  assert.ok(lastDayBatch >= w.gte && lastDayBatch < w.lt)
  assert.ok(!(kstMidnightNextDay < w.lt))
})
