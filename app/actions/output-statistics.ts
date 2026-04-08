'use server'

import { prisma } from '@/lib/prisma'

// ── 타입 ──────────────────────────────────────────────────────────────────

export type OutputFilters = {
  from: Date
  to: Date
  varietyIds?: number[]
}

export type VarietyOption = {
  id: number
  name: string
}

export type OutputSummary = {
  totalProductionKg: number
  totalReleaseKg: number
  totalPackageCount: number
  destinationCount: number
}

export type ByPackageTypeRow = {
  packageType: string
  count: number
  totalWeight: number
  percentage: number
}

export type ByMonthRow = {
  month: string       // 'YYYY-MM'
  productionKg: number
  releaseKg: number
}

export type ByDestinationRow = {
  destination: string
  releaseKg: number
  releaseCount: number
}

export type OutputStatisticsData = {
  summary: OutputSummary
  byPackageType: ByPackageTypeRow[]
  byMonth: ByMonthRow[]
  byDestination: ByDestinationRow[]
}

// ── 유틸 ──────────────────────────────────────────────────────────────────

function toMonthKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// 규격 정렬 순서
const PKG_ORDER = ['20kg', '10kg', '5kg', 'Tonbag']

// ── 품종 목록 ─────────────────────────────────────────────────────────────

export async function getOutputVarietyOptions(
  from: Date,
  to: Date,
): Promise<VarietyOption[]> {
  const varieties = await prisma.variety.findMany({
    where: {
      stocks: {
        some: {
          batch: { date: { gte: from, lte: to } },
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return varieties
}

// ── 메인 조회 ─────────────────────────────────────────────────────────────

export async function getOutputStatistics(
  filters: OutputFilters,
): Promise<OutputStatisticsData> {
  const varietyFilter = filters.varietyIds?.length
    ? { stocks: { some: { varietyId: { in: filters.varietyIds } } } }
    : {}

  // 생산 데이터
  const packages = await prisma.millingOutputPackage.findMany({
    where: {
      batch: {
        date: { gte: filters.from, lte: filters.to },
        ...varietyFilter,
      },
    },
    include: { batch: { select: { date: true } } },
  })

  // 출고 데이터 (출고는 품종 필터 미적용 — 생산 기준 통계)
  const releases = await prisma.stockRelease.findMany({
    where: {
      date: { gte: filters.from, lte: filters.to },
    },
    include: {
      stocks: { select: { weightKg: true } },
    },
  })

  // ── 요약 ──────────────────────────────────────────────────────────────
  const totalProductionKg = packages.reduce((s, p) => s + p.totalWeight, 0)
  const totalPackageCount = packages.reduce((s, p) => s + p.count, 0)
  const totalReleaseKg = releases.reduce(
    (s, r) => s + r.stocks.reduce((ss, st) => ss + st.weightKg, 0),
    0,
  )
  const destinationCount = new Set(releases.map(r => r.destination)).size

  // ── 규격별 집계 ───────────────────────────────────────────────────────
  const pkgMap = new Map<string, { count: number; totalWeight: number }>()
  for (const p of packages) {
    const key = p.packageType
    if (!pkgMap.has(key)) pkgMap.set(key, { count: 0, totalWeight: 0 })
    const row = pkgMap.get(key)!
    row.count += p.count
    row.totalWeight += p.totalWeight
  }
  const byPackageType: ByPackageTypeRow[] = [...pkgMap.entries()]
    .sort((a, b) => {
      // 톤백 최상단, 잔량 최하단, 나머지는 중량 내림차순
      const priority = (key: string) =>
        key === 'Tonbag' ? -1 : key === '잔량' ? 1 : 0
      const pa = priority(a[0])
      const pb = priority(b[0])
      if (pa !== pb) return pa - pb
      return b[1].totalWeight - a[1].totalWeight
    })
    .map(([packageType, { count, totalWeight }]) => ({
      packageType,
      count,
      totalWeight,
      percentage:
        totalProductionKg > 0
          ? Math.round((totalWeight / totalProductionKg) * 1000) / 10
          : 0,
    }))

  // ── 월별 집계 ─────────────────────────────────────────────────────────
  const monthMap = new Map<string, { productionKg: number; releaseKg: number }>()
  const ensureMonth = (key: string) => {
    if (!monthMap.has(key)) monthMap.set(key, { productionKg: 0, releaseKg: 0 })
    return monthMap.get(key)!
  }
  for (const p of packages) {
    ensureMonth(toMonthKey(p.batch.date)).productionKg += p.totalWeight
  }
  for (const r of releases) {
    const kg = r.stocks.reduce((s, st) => s + st.weightKg, 0)
    ensureMonth(toMonthKey(r.date)).releaseKg += kg
  }
  const byMonth: ByMonthRow[] = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, { productionKg, releaseKg }]) => ({ month, productionKg, releaseKg }))

  // ── 출고처별 집계 ─────────────────────────────────────────────────────
  const destMap = new Map<string, { releaseKg: number; releaseCount: number }>()
  for (const r of releases) {
    const kg = r.stocks.reduce((s, st) => s + st.weightKg, 0)
    if (!destMap.has(r.destination)) destMap.set(r.destination, { releaseKg: 0, releaseCount: 0 })
    const row = destMap.get(r.destination)!
    row.releaseKg += kg
    row.releaseCount += 1
  }
  const byDestination: ByDestinationRow[] = [...destMap.entries()]
    .sort((a, b) => b[1].releaseKg - a[1].releaseKg)
    .map(([destination, { releaseKg, releaseCount }]) => ({ destination, releaseKg, releaseCount }))

  return {
    summary: { totalProductionKg, totalReleaseKg, totalPackageCount, destinationCount },
    byPackageType,
    byMonth,
    byDestination,
  }
}

