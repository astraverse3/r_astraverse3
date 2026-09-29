// 도정 통계의 X축 버킷(일·주·월) — 'use server' 아님(테스트 가능). 백로그 §39 잔여.
//
// 🔴 전에는 date-fns `format`·`startOfWeek`·`setHours`로 짰다 — 전부 **프로세스 시간대**를 따른다.
//    개발 PC(KST)와 Vercel(UTC)에서 결과가 다를 수 있었고, 도정일이 전부 UTC 자정이라 우연히 맞았을 뿐이다.
//    여기선 날짜를 먼저 KST 'yyyy-mm-dd'로 읽고(`lib/kst-date.ts`), 그다음은 **달력 계산만** 한다.

import type { GroupBy } from '@/app/actions/statistics'
import { kstDayRange, toKstDate } from './kst-date'

const DAY_MS = 24 * 60 * 60 * 1000

export type Bucket = { key: string; tooltipLabel: string }

// 'yyyy-mm-dd' ↔ UTC 자정 ms — 시간대가 끼지 않는 순수 달력 값이라 toISOString으로 되돌려도 안전하다
function ymdToMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function msToYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
function addDays(ymd: string, days: number): string {
  return msToYmd(ymdToMs(ymd) + days * DAY_MS)
}

/** 그 날이 속한 주의 월요일 */
function mondayOf(ymd: string): string {
  const sinceMonday = (new Date(ymdToMs(ymd)).getUTCDay() + 6) % 7
  return addDays(ymd, -sinceMonday)
}

function mmdd(ymd: string): string {
  return `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}`
}

/** 날짜 → 버킷 키. 일 `MM/dd` · 주 `MM/dd`(월요일) · 월 `yyyy-MM` — 모두 KST 기준 */
export function bucketKeyOf(date: Date, groupBy: GroupBy): string {
  const ymd = toKstDate(date)
  if (groupBy === 'day') return mmdd(ymd)
  if (groupBy === 'week') return mmdd(mondayOf(ymd))
  return ymd.slice(0, 7)
}

/**
 * 기간 안의 버킷 전부(빈 칸 포함). 주별 툴팁은 여기서 만든다 —
 * 키(`MM/dd`)엔 연도가 없어서 키만 보고 계산하면 윤년 2월 주가 하루 틀린다(옛 코드는 「올해」로 가정했다).
 */
export function bucketsBetween(from: Date, to: Date, groupBy: GroupBy): Bucket[] {
  const start = toKstDate(from)
  const end = toKstDate(to)
  const buckets: Bucket[] = []

  if (groupBy === 'month') {
    let [y, m] = start.slice(0, 7).split('-').map(Number)
    const [ey, em] = end.slice(0, 7).split('-').map(Number)
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      buckets.push({ key, tooltipLabel: key })
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
    return buckets
  }

  const step = groupBy === 'week' ? 7 : 1
  // 'yyyy-mm-dd'는 문자열 비교가 곧 날짜 비교다
  for (let cur = groupBy === 'week' ? mondayOf(start) : start; cur <= end; cur = addDays(cur, step)) {
    const key = mmdd(cur)
    buckets.push({ key, tooltipLabel: groupBy === 'week' ? `${key} ~ ${mmdd(addDays(cur, 6))}` : key })
  }
  return buckets
}

/** 조회 기간 → Prisma where. from이 속한 KST 날 00:00 ~ to가 속한 KST 날 다음 날 00:00 */
export function kstPeriodWhere(from: Date, to: Date): { gte: Date; lt: Date } {
  // toKstDate가 만든 문자열이라 형식이 늘 맞다 → null이 나오지 않는다
  return { gte: kstDayRange(toKstDate(from))!.gte, lt: kstDayRange(toKstDate(to))!.lt }
}
