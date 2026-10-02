// 판매분석 「원물출고」 탭 집계 — 'use server' 아님(테스트 가능). 계획서 docs/plan/plan-판매분석-3단계.md
//
// 벼 원물(Stock)을 그대로 내보낸 기록(StockRelease)이다. 제품 판매(kg)와 따로 센다. 화면 단위는 톤이지만
// 집계는 kg로 하고 화면에서 바꾼다(반올림을 한 번만 하려고).
// 🔴 목적(purpose)으로 판매/판매 아님을 가르지 않는다 — 비고 칸이라 16건에 표기가 10가지였다
//    (원물판매·원물출고·판매·2026년 종자…). 사용자 2026-10-02 「현재까지는 그것까지 관리 안 할래」.
// 날짜는 KST 달로 묶는다(lib/stats-bucket.ts).

import { bucketKeyOf, bucketsBetween } from './stats-bucket'

export type ReleaseRow = { date: Date; destination: string; stocks: { weightKg: number }[] }

export type ReleaseLine = { date: Date; destination: string; kg: number }

export function toReleaseLine(r: ReleaseRow): ReleaseLine {
  return {
    date: r.date,
    destination: r.destination.trim(),
    kg: r.stocks.reduce((s, st) => s + st.weightKg, 0),
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10

export type ReleaseSummary = { kg: number; releases: number; destinations: number }

export function summarizeReleases(lines: ReleaseLine[]): ReleaseSummary {
  return {
    kg: round1(lines.reduce((s, l) => s + l.kg, 0)),
    releases: lines.length,
    destinations: new Set(lines.map(l => l.destination)).size,
  }
}

export type ReleaseMonthBucket = { key: string; label: string; tooltipLabel: string; kg: number }

/**
 * 기간 안의 달 전부(빈 달 포함) × kg. from·to는 그 KST 날 안의 아무 순간.
 * 라벨은 기간이 한 해 안이면 「1월」, 해를 넘으면 「25.11」 — 「1월」만으로는 어느 해인지 모른다.
 */
export function releaseMonthly(lines: ReleaseLine[], from: Date, to: Date): ReleaseMonthBucket[] {
  const buckets = bucketsBetween(from, to, 'month')
  const oneYear = buckets.length > 0 && buckets[0].key.slice(0, 4) === buckets[buckets.length - 1].key.slice(0, 4)
  const kgByKey = new Map<string, number>()
  for (const l of lines) {
    const key = bucketKeyOf(l.date, 'month')
    kgByKey.set(key, (kgByKey.get(key) ?? 0) + l.kg)
  }
  return buckets.map(({ key }) => {
    const [y, m] = key.split('-')
    return {
      key,
      label: oneYear ? `${Number(m)}월` : `${y.slice(2)}.${m}`,
      tooltipLabel: `${y}년 ${Number(m)}월`,
      kg: round1(kgByKey.get(key) ?? 0),
    }
  })
}

export type ReleaseDestinationRow = { key: string; label: string; kg: number; releases: number; share: number }

/** 출고처별 — 글자 그대로 묶는다(앞뒤 공백만 뗀다). kg 많은 순 */
export function releaseByDestination(lines: ReleaseLine[]): ReleaseDestinationRow[] {
  const total = lines.reduce((s, l) => s + l.kg, 0)
  const map = new Map<string, { kg: number; releases: number }>()
  for (const l of lines) {
    const r = map.get(l.destination) ?? { kg: 0, releases: 0 }
    map.set(l.destination, { kg: r.kg + l.kg, releases: r.releases + 1 })
  }
  return [...map.entries()]
    .map(([label, r]) => ({
      key: label,
      label,
      kg: round1(r.kg),
      releases: r.releases,
      share: total > 0 ? round1((r.kg / total) * 100) : 0,
    }))
    .sort((a, b) => b.kg - a.kg || a.label.localeCompare(b.label, 'ko'))
}
