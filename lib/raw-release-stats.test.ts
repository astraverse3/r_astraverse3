import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  releaseByDestination,
  releaseMonthly,
  summarizeReleases,
  toReleaseLine,
  type ReleaseLine,
} from './raw-release-stats'

// 🔴 이 파일은 TZ=UTC(실서버)와 TZ=Asia/Seoul(개발 PC) 두 환경에서 같은 결과여야 한다.
//    날짜 입력은 전부 UTC 순간 리터럴이다.

const line = (date: string, destination: string, kg: number): ReleaseLine => ({ date: new Date(date), destination, kg })

test('toReleaseLine: 원물 무게를 더하고 출고처 앞뒤 공백을 뗀다', () => {
  const l = toReleaseLine({
    date: new Date('2026-01-20T00:00:00Z'),
    destination: ' 씨제이브리딩 ',
    stocks: [{ weightKg: 800 }, { weightKg: 1004.5 }],
  })
  assert.equal(l.destination, '씨제이브리딩')
  assert.equal(l.kg, 1804.5)
})

test('summarizeReleases: 출고량 · 건 · 출고처 곳', () => {
  const s = summarizeReleases([
    line('2026-01-20T00:00:00Z', '씨제이브리딩', 48910),
    line('2026-01-20T00:00:00Z', '씨제이브리딩', 18000),
    line('2026-05-26T00:00:00Z', '한듬육묘장', 940),
  ])
  assert.deepEqual(s, { kg: 67850, releases: 3, destinations: 2 })
})

test('summarizeReleases: 비면 0', () => {
  assert.deepEqual(summarizeReleases([]), { kg: 0, releases: 0, destinations: 0 })
})

test('releaseMonthly: 빈 달도 칸을 만든다 · 한 해 안이면 「N월」', () => {
  const buckets = releaseMonthly(
    [line('2026-01-20T00:00:00Z', 'a', 1000), line('2026-03-16T00:00:00Z', 'b', 500), line('2026-03-24T00:00:00Z', 'b', 250)],
    new Date('2026-01-01T00:00:00+09:00'),
    new Date('2026-04-30T00:00:00+09:00'),
  )
  assert.deepEqual(
    buckets.map(b => [b.key, b.label, b.kg]),
    [['2026-01', '1월', 1000], ['2026-02', '2월', 0], ['2026-03', '3월', 750], ['2026-04', '4월', 0]],
  )
  assert.equal(buckets[0].tooltipLabel, '2026년 1월')
})

test('releaseMonthly: 달 경계는 KST — UTC 1/31 15:30은 2월', () => {
  const buckets = releaseMonthly(
    [line('2026-01-31T15:30:00Z', 'a', 100)],
    new Date('2026-01-01T00:00:00+09:00'),
    new Date('2026-02-28T00:00:00+09:00'),
  )
  assert.deepEqual(buckets.map(b => b.kg), [0, 100])
})

test('releaseMonthly: 해를 넘기면 라벨에 연도(「25.12」)', () => {
  const buckets = releaseMonthly([], new Date('2025-12-01T00:00:00+09:00'), new Date('2026-01-31T00:00:00+09:00'))
  assert.deepEqual(buckets.map(b => b.label), ['25.12', '26.01'])
})

test('releaseByDestination: 글자 그대로 묶고 kg 많은 순 · 비중은 전체 대비', () => {
  const rows = releaseByDestination([
    line('2026-01-20T00:00:00Z', '씨제이브리딩', 3000),
    line('2026-03-16T00:00:00Z', '종자사용', 500),
    line('2026-01-20T00:00:00Z', '씨제이브리딩', 1000),
    line('2026-03-24T00:00:00Z', '2026년 종자', 500),
  ])
  assert.deepEqual(
    rows.map(r => [r.label, r.kg, r.releases, r.share]),
    [['씨제이브리딩', 4000, 2, 80], ['2026년 종자', 500, 1, 10], ['종자사용', 500, 1, 10]],
  )
})
