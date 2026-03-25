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
  label: string         // X축 표시용
  tooltipLabel: string  // 툴팁 표시용 (주별이면 "03/10 ~ 03/16")
  inputKg: number
  outputKg: number
  yieldRate: number
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
  // bucketKey = "MM/dd" (주 시작일) → "MM/dd ~ MM/dd+6"
  const [m, d] = bucketKey.split('/').map(Number)
  const year = new Date().getFullYear()
  const weekStart = new Date(year, m - 1, d)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return `${format(weekStart, 'MM/dd')} ~ ${format(weekEnd, 'MM/dd')}`
}

export async function getMillingStatistics(
  params: MillingStatsParams
): Promise<MillingStatisticsData> {
  const { from, to, groupBy, varieties, millingTypes, farmers, cropYear } = params

  const toEndOfDay = new Date(to)
  toEndOfDay.setHours(23, 59, 59, 999)

  // 기준 수율
  const targetConfig = await prisma.systemConfig.findUnique({
    where: { key: 'yield_rate_target' },
  })
  const targetYieldRate = targetConfig ? parseFloat(targetConfig.value) : 68

  // Prisma where 조건 조립
  const where: any = { isClosed: true }

  if (cropYear) {
    // 연산 필터: 해당 연산 벼가 투입된 배치
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
  const totalInputKg = batches.reduce((sum, b) => sum + b.totalInputKg, 0)
  const totalOutputKg = batches.reduce(
    (sum, b) => sum + b.outputs.reduce((s, o) => s + o.totalWeight, 0),
    0
  )
  const avgYieldRate = totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : 0

  const summary: StatsSummary = {
    totalInputKg,
    totalOutputKg,
    avgYieldRate,
    millingCount: batches.length,
  }

  // 차트 데이터 — groupBy 기준 집계
  const bucketMap = new Map<string, { inputKg: number; outputKg: number }>()
  for (const batch of batches) {
    const key = getBucketKey(new Date(batch.date), groupBy)
    const outputKg = batch.outputs.reduce((s, o) => s + o.totalWeight, 0)
    const prev = bucketMap.get(key) ?? { inputKg: 0, outputKg: 0 }
    bucketMap.set(key, {
      inputKg: prev.inputKg + batch.totalInputKg,
      outputKg: prev.outputKg + outputKg,
    })
  }

  const chartData: ChartDataPoint[] = Array.from(bucketMap.entries()).map(([label, d]) => ({
    label,
    tooltipLabel: getTooltipLabel(label, groupBy),
    inputKg: Math.round(d.inputKg * 10) / 10,
    outputKg: Math.round(d.outputKg * 10) / 10,
    yieldRate: d.inputKg > 0 ? Math.round((d.outputKg / d.inputKg) * 1000) / 10 : 0,
  }))

  // 테이블 데이터
  const tableData: TableRow[] = batches.map(batch => {
    const outputKg = batch.outputs.reduce((s, o) => s + o.totalWeight, 0)
    const yieldRate =
      batch.totalInputKg > 0
        ? Math.round((outputKg / batch.totalInputKg) * 1000) / 10
        : 0
    const varietyNames = [...new Set(batch.stocks.map(s => s.variety.name))].join(', ')
    const farmerNames = [...new Set(batch.stocks.map(s => s.farmer.name))].join(', ')
    const stockDetails: StockDetail[] = batch.stocks.map(s => ({
      id: s.id,
      bagNo: s.bagNo,
      farmerName: s.farmer.name,
      varietyName: s.variety.name,
      varietyType: s.variety.type,
      certType: s.farmer.group?.certType ?? '-',
      weightKg: s.weightKg,
    }))
    const stockMap = new Map(batch.stocks.map(s => [s.id, s]))
    const outputDetails: OutputDetail[] = batch.outputs.map(o => {
      const stock = o.stockId ? stockMap.get(o.stockId) : batch.stocks[0]
      const isConventional = stock?.farmer?.group?.certType === '일반'
      return {
        packageType: o.packageType,
        weightPerUnit: o.weightPerUnit,
        count: o.count,
        totalWeight: o.totalWeight,
        lotNo: o.lotNo,
        isConventional,
        farmerName: stock?.farmer?.name ?? null,
        varietyName: stock?.variety?.name ?? null,
      }
    })
    return {
      id: batch.id,
      date: format(new Date(batch.date), 'yyyy-MM-dd'),
      millingType: batch.millingType,
      inputKg: batch.totalInputKg,
      outputKg: Math.round(outputKg * 10) / 10,
      yieldRate,
      varieties: varietyNames || '-',
      farmers: farmerNames || '-',
      remarks: batch.remarks ?? null,
      stockDetails,
      outputDetails,
    }
  })

  return { summary, chartData, tableData, targetYieldRate, groupBy }
}

// 필터 옵션용 — 품종 목록
export async function getVarietyOptions(): Promise<string[]> {
  const varieties = await prisma.variety.findMany({ orderBy: { name: 'asc' } })
  return varieties.map(v => v.name)
}

// 필터 옵션용 — 도정구분 목록
export async function getMillingTypeOptions(): Promise<string[]> {
  const batches = await prisma.millingBatch.findMany({
    distinct: ['millingType'],
    select: { millingType: true },
    orderBy: { millingType: 'asc' },
  })
  return batches.map(b => b.millingType)
}
