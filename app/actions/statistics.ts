'use server'

import { prisma } from '@/lib/prisma'
import { format, startOfWeek } from 'date-fns'

export type GroupBy = 'day' | 'week' | 'month'

export type StatsSummary = {
  totalInputKg: number
  totalOutputKg: number
  avgYieldRate: number
  millingCount: number
}

export type ChartDataPoint = {
  label: string
  tooltipLabel: string
  inputKg: number
  outputKg: number
  yieldRate: number
  hasData: boolean      // false = 해당 기간 데이터 없음 (차트에서 보간 대상)
}

export type StockDetail = {
  id: number
  bagNo: number
  farmerName: string
  varietyName: string
  varietyType: string
  certType: string
  weightKg: number
}

export type OutputDetail = {
  packageType: string
  weightPerUnit: number
  count: number
  totalWeight: number
  lotNo: string | null
  isConventional: boolean
  farmerName: string | null
  varietyName: string | null
}

export type TableRow = {
  id: number
  date: string
  millingType: string
  inputKg: number
  outputKg: number
  yieldRate: number
  varieties: string
  farmers: string
  remarks: string | null
  stockDetails: StockDetail[]
  outputDetails: OutputDetail[]
}

export type MillingStatisticsData = {
  summary: StatsSummary
  chartData: ChartDataPoint[]
  tableData: TableRow[]
  targetYieldRate: number
  groupBy: GroupBy
}

export type MillingStatsParams = {
  from: Date
  to: Date
  groupBy: GroupBy
  varieties?: string[]
  millingTypes?: string[]
  farmers?: string[]
  cropYear?: number       // 설정 시 날짜 필터 대체
}

export type QuickPeriod = '1w' | '1m' | '3m' | '6m' | '1y' | 'cropYear' | 'custom'

// 멀티시리즈 차트 (품종별 / 도정구분별)
export type MultiSeriesPoint = {
  label: string
  tooltipLabel: string
  [key: string]: number | string | boolean
  // `${name}_input`, `${name}_output`, `${name}_yield`, `${name}_hasData`
}

export type MultiSeriesChartData = {
  periods: MultiSeriesPoint[]
  seriesNames: string[]
  groupBy: GroupBy
}

// ── 내부 헬퍼 ───────────────────────────────────────────

// groupBy별 X축 레이블 생성
function getBucketKey(date: Date, groupBy: GroupBy): string {
  if (groupBy === 'day') return format(date, 'MM/dd')
  if (groupBy === 'week') {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    return format(weekStart, 'MM/dd')
  }
  return format(date, 'yyyy-MM')
}

// 툴팁용 레이블 (주별은 범위 표시)
function getTooltipLabel(bucketKey: string, groupBy: GroupBy): string {
  if (groupBy !== 'week') return bucketKey
  const [m, d] = bucketKey.split('/').map(Number)
  const year = new Date().getFullYear()
  const weekStart = new Date(year, m - 1, d)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return `${format(weekStart, 'MM/dd')} ~ ${format(weekEnd, 'MM/dd')}`
}

// 기간 내 전체 버킷 키 목록 생성 (빈 포인트 포함을 위해)
function generateAllBucketKeys(from: Date, to: Date, groupBy: GroupBy): string[] {
  const keys: string[] = []

  if (groupBy === 'day') {
    const cur = new Date(from)
    cur.setHours(0, 0, 0, 0)
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    while (cur <= end) {
      keys.push(format(cur, 'MM/dd'))
      cur.setDate(cur.getDate() + 1)
    }
  } else if (groupBy === 'week') {
    const cur = startOfWeek(new Date(from), { weekStartsOn: 1 })
    const end = new Date(to)
    while (cur <= end) {
      keys.push(format(cur, 'MM/dd'))
      cur.setDate(cur.getDate() + 7)
    }
  } else {
    const cur = new Date(from.getFullYear(), from.getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1)
    while (cur <= end) {
      keys.push(format(cur, 'yyyy-MM'))
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  return keys
}

// ── 메인 통계 조회 ──────────────────────────────────────

export async function getMillingStatistics(
  params: MillingStatsParams
): Promise<MillingStatisticsData> {
  const { from, to, groupBy, varieties, millingTypes, farmers, cropYear } = params

  const toEndOfDay = new Date(to)
  toEndOfDay.setHours(23, 59, 59, 999)

  const targetConfig = await prisma.systemConfig.findUnique({
    where: { key: 'yield_rate_target' },
  })
  const targetYieldRate = targetConfig ? parseFloat(targetConfig.value) : 68

  const where: any = { isClosed: true }

  if (cropYear) {
    where.stocks = { some: { productionYear: cropYear } }
  } else {
    where.date = { gte: from, lte: toEndOfDay }
  }

  if (millingTypes && millingTypes.length > 0) {
    where.millingType = { in: millingTypes }
  }

  if (varieties && varieties.length > 0) {
    where.stocks = {
      ...(where.stocks ?? {}),
      some: {
        ...(where.stocks?.some ?? {}),
        variety: { name: { in: varieties } },
      },
    }
  }

  if (farmers && farmers.length > 0) {
    where.stocks = {
      ...(where.stocks ?? {}),
      some: {
        ...(where.stocks?.some ?? {}),
        farmer: { name: { in: farmers } },
      },
    }
  }

  const batches = await prisma.millingBatch.findMany({
    where,
    include: {
      outputs: true,
      stocks: { include: { variety: true, farmer: { include: { group: true } } } },
    },
    orderBy: { date: 'asc' },
  })

  // 요약 카드
  const totalInputKg  = batches.reduce((sum, b) => sum + b.totalInputKg, 0)
  const totalOutputKg = batches.reduce((sum, b) => sum + b.outputs.reduce((s, o) => s + o.totalWeight, 0), 0)
  const avgYieldRate  = totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : 0

  const summary: StatsSummary = { totalInputKg, totalOutputKg, avgYieldRate, millingCount: batches.length }

  // 차트 데이터 — 실제 데이터 집계
  const bucketMap = new Map<string, { inputKg: number; outputKg: number }>()
  for (const batch of batches) {
    const key     = getBucketKey(new Date(batch.date), groupBy)
    const outputKg = batch.outputs.reduce((s, o) => s + o.totalWeight, 0)
    const prev    = bucketMap.get(key) ?? { inputKg: 0, outputKg: 0 }
    bucketMap.set(key, {
      inputKg:  prev.inputKg  + batch.totalInputKg,
      outputKg: prev.outputKg + outputKg,
    })
  }

  // cropYear 모드에서 날짜 범위 계산
  let bucketFrom = from
  let bucketTo   = to
  if (cropYear && batches.length > 0) {
    const dates = batches.map(b => new Date(b.date))
    bucketFrom = new Date(Math.min(...dates.map(d => d.getTime())))
    bucketTo   = new Date(Math.max(...dates.map(d => d.getTime())))
  }

  // 전체 버킷 키(빈 포인트 포함)로 chartData 생성
  const allKeys = cropYear && batches.length === 0
    ? []
    : generateAllBucketKeys(bucketFrom, bucketTo, groupBy)

  const chartData: ChartDataPoint[] = allKeys.map(label => {
    const d = bucketMap.get(label)
    if (!d) {
      return { label, tooltipLabel: getTooltipLabel(label, groupBy), inputKg: 0, outputKg: 0, yieldRate: 0, hasData: false }
    }
    return {
      label,
      tooltipLabel: getTooltipLabel(label, groupBy),
      inputKg:   Math.round(d.inputKg  * 10) / 10,
      outputKg:  Math.round(d.outputKg * 10) / 10,
      yieldRate: d.inputKg > 0 ? Math.round((d.outputKg / d.inputKg) * 1000) / 10 : 0,
      hasData: true,
    }
  })

  // 테이블 데이터
  const tableData: TableRow[] = batches.map(batch => {
    const outputKg  = batch.outputs.reduce((s, o) => s + o.totalWeight, 0)
    const yieldRate = batch.totalInputKg > 0 ? Math.round((outputKg / batch.totalInputKg) * 1000) / 10 : 0
    const varietyNames = [...new Set(batch.stocks.map(s => s.variety.name))].join(', ')
    const farmerNames  = [...new Set(batch.stocks.map(s => s.farmer.name))].join(', ')
    const stockDetails: StockDetail[] = batch.stocks.map(s => ({
      id: s.id, bagNo: s.bagNo, farmerName: s.farmer.name,
      varietyName: s.variety.name, varietyType: s.variety.type,
      certType: s.farmer.group?.certType ?? '-', weightKg: s.weightKg,
    }))
    const stockMap = new Map(batch.stocks.map(s => [s.id, s]))
    const outputDetails: OutputDetail[] = batch.outputs.map(o => {
      const stock = o.stockId ? stockMap.get(o.stockId) : batch.stocks[0]
      return {
        packageType: o.packageType, weightPerUnit: o.weightPerUnit,
        count: o.count, totalWeight: o.totalWeight, lotNo: o.lotNo,
        isConventional: stock?.farmer?.group?.certType === '일반',
        farmerName: stock?.farmer?.name ?? null, varietyName: stock?.variety?.name ?? null,
      }
    })
    return {
      id: batch.id, date: format(new Date(batch.date), 'yyyy-MM-dd'),
      millingType: batch.millingType, inputKg: batch.totalInputKg,
      outputKg: Math.round(outputKg * 10) / 10, yieldRate,
      varieties: varietyNames || '-', farmers: farmerNames || '-',
      remarks: batch.remarks ?? null, stockDetails, outputDetails,
    }
  })

  return { summary, chartData, tableData, targetYieldRate, groupBy }
}

// ── 품종별 통계 집계 ────────────────────────────────────

export async function getMillingStatsByVariety(params: {
  from: Date
  to: Date
  groupBy: GroupBy
  varieties: string[]
  millingTypes?: string[]
  farmers?: string[]
  cropYear?: number
}): Promise<MultiSeriesChartData> {
  const { from, to, groupBy, varieties, millingTypes, farmers, cropYear } = params

  const toEndOfDay = new Date(to)
  toEndOfDay.setHours(23, 59, 59, 999)

  const where: any = { isClosed: true }

  if (cropYear) {
    where.stocks = { some: { productionYear: cropYear } }
  } else {
    where.date = { gte: from, lte: toEndOfDay }
  }

  if (millingTypes && millingTypes.length > 0) {
    where.millingType = { in: millingTypes }
  }

  where.stocks = {
    ...(where.stocks ?? {}),
    some: {
      ...(where.stocks?.some ?? {}),
      variety: { name: { in: varieties } },
    },
  }

  if (farmers && farmers.length > 0) {
    where.stocks = {
      ...(where.stocks ?? {}),
      some: {
        ...(where.stocks?.some ?? {}),
        farmer: { name: { in: farmers } },
      },
    }
  }

  const batches = await prisma.millingBatch.findMany({
    where,
    include: { outputs: true, stocks: { include: { variety: true } } },
    orderBy: { date: 'asc' },
  })

  // 버킷 × 품종별 집계
  const bucketMap = new Map<string, Map<string, { inputKg: number; outputKg: number }>>()

  for (const batch of batches) {
    const key = getBucketKey(new Date(batch.date), groupBy)
    if (!bucketMap.has(key)) bucketMap.set(key, new Map())
    const seriesMap = bucketMap.get(key)!

    const totalOutputKg = batch.outputs.reduce((s, o) => s + o.totalWeight, 0)

    const varietyInputMap = new Map<string, number>()
    for (const stock of batch.stocks) {
      const vName = stock.variety.name
      if (varieties.includes(vName)) {
        varietyInputMap.set(vName, (varietyInputMap.get(vName) ?? 0) + stock.weightKg)
      }
    }

    for (const [vName, inputKg] of varietyInputMap) {
      const ratio    = batch.totalInputKg > 0 ? inputKg / batch.totalInputKg : 0
      const outputKg = totalOutputKg * ratio
      const prev     = seriesMap.get(vName) ?? { inputKg: 0, outputKg: 0 }
      seriesMap.set(vName, { inputKg: prev.inputKg + inputKg, outputKg: prev.outputKg + outputKg })
    }
  }

  let bucketFrom = from
  let bucketTo   = to
  if (cropYear && batches.length > 0) {
    const dates = batches.map(b => new Date(b.date))
    bucketFrom = new Date(Math.min(...dates.map(d => d.getTime())))
    bucketTo   = new Date(Math.max(...dates.map(d => d.getTime())))
  }

  const allKeys = cropYear && batches.length === 0
    ? []
    : generateAllBucketKeys(bucketFrom, bucketTo, groupBy)

  const periods: MultiSeriesPoint[] = allKeys.map(label => {
    const seriesMap = bucketMap.get(label)
    const point: MultiSeriesPoint = { label, tooltipLabel: getTooltipLabel(label, groupBy) }
    for (const vName of varieties) {
      const d = seriesMap?.get(vName)
      if (d && d.inputKg > 0) {
        point[`${vName}_input`]   = Math.round(d.inputKg  * 10) / 10
        point[`${vName}_output`]  = Math.round(d.outputKg * 10) / 10
        point[`${vName}_yield`]   = Math.round((d.outputKg / d.inputKg) * 1000) / 10
        point[`${vName}_hasData`] = true
      } else {
        point[`${vName}_input`]   = 0
        point[`${vName}_output`]  = 0
        point[`${vName}_yield`]   = 0
        point[`${vName}_hasData`] = false
      }
    }
    return point
  })

  return { periods, seriesNames: varieties, groupBy }
}

// ── 도정구분별 통계 집계 ────────────────────────────────

export async function getMillingStatsByMillingType(params: {
  from: Date
  to: Date
  groupBy: GroupBy
  millingTypes: string[]
  varieties?: string[]
  farmers?: string[]
  cropYear?: number
}): Promise<MultiSeriesChartData> {
  const { from, to, groupBy, millingTypes, varieties, farmers, cropYear } = params

  const toEndOfDay = new Date(to)
  toEndOfDay.setHours(23, 59, 59, 999)

  const where: any = {
    isClosed: true,
    millingType: { in: millingTypes },
  }

  if (cropYear) {
    where.stocks = { some: { productionYear: cropYear } }
  } else {
    where.date = { gte: from, lte: toEndOfDay }
  }

  if (varieties && varieties.length > 0) {
    where.stocks = {
      ...(where.stocks ?? {}),
      some: {
        ...(where.stocks?.some ?? {}),
        variety: { name: { in: varieties } },
      },
    }
  }

  if (farmers && farmers.length > 0) {
    where.stocks = {
      ...(where.stocks ?? {}),
      some: {
        ...(where.stocks?.some ?? {}),
        farmer: { name: { in: farmers } },
      },
    }
  }

  const batches = await prisma.millingBatch.findMany({
    where,
    include: { outputs: true },
    orderBy: { date: 'asc' },
  })

  const bucketMap = new Map<string, Map<string, { inputKg: number; outputKg: number }>>()

  for (const batch of batches) {
    const key = getBucketKey(new Date(batch.date), groupBy)
    if (!bucketMap.has(key)) bucketMap.set(key, new Map())
    const seriesMap = bucketMap.get(key)!

    const outputKg = batch.outputs.reduce((s, o) => s + o.totalWeight, 0)
    const prev     = seriesMap.get(batch.millingType) ?? { inputKg: 0, outputKg: 0 }
    seriesMap.set(batch.millingType, {
      inputKg:  prev.inputKg  + batch.totalInputKg,
      outputKg: prev.outputKg + outputKg,
    })
  }

  let bucketFrom = from
  let bucketTo   = to
  if (cropYear && batches.length > 0) {
    const dates = batches.map(b => new Date(b.date))
    bucketFrom = new Date(Math.min(...dates.map(d => d.getTime())))
    bucketTo   = new Date(Math.max(...dates.map(d => d.getTime())))
  }

  const allKeys = cropYear && batches.length === 0
    ? []
    : generateAllBucketKeys(bucketFrom, bucketTo, groupBy)

  const periods: MultiSeriesPoint[] = allKeys.map(label => {
    const seriesMap = bucketMap.get(label)
    const point: MultiSeriesPoint = { label, tooltipLabel: getTooltipLabel(label, groupBy) }
    for (const mType of millingTypes) {
      const d = seriesMap?.get(mType)
      if (d && d.inputKg > 0) {
        point[`${mType}_input`]   = Math.round(d.inputKg  * 10) / 10
        point[`${mType}_output`]  = Math.round(d.outputKg * 10) / 10
        point[`${mType}_yield`]   = Math.round((d.outputKg / d.inputKg) * 1000) / 10
        point[`${mType}_hasData`] = true
      } else {
        point[`${mType}_input`]   = 0
        point[`${mType}_output`]  = 0
        point[`${mType}_yield`]   = 0
        point[`${mType}_hasData`] = false
      }
    }
    return point
  })

  return { periods, seriesNames: millingTypes, groupBy }
}

// ── 필터 옵션 ───────────────────────────────────────────

export async function getVarietyOptions(): Promise<string[]> {
  const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } })
  return varieties.map(v => v.name)
}

export async function getMillingTypeOptions(): Promise<string[]> {
  const batches = await prisma.millingBatch.findMany({
    distinct: ['millingType'],
    select: { millingType: true },
    orderBy: { millingType: 'asc' },
  })
  return batches.map(b => b.millingType)
}
