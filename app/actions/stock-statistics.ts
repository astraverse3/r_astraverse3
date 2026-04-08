'use server'

import { prisma } from '@/lib/prisma'

// ── 타입 ──────────────────────────────────────────────────────────────────

export type StockSummary = {
  totalKg: number
  consumedKg: number
  availableKg: number
  releasedKg: number
  farmerCount: number
}

export type FarmerStockRow = {
  farmerId: number
  farmerName: string
  groupName: string
  totalKg: number
  consumedKg: number
  releasedKg: number
  availableKg: number
  stockRate: number
}

export type GroupStockRow = {
  groupId: number
  groupName: string
  certType: string
  farmerCount: number
  totalKg: number
  consumedKg: number
  releasedKg: number
  availableKg: number
  stockRate: number
}

export type VarietyStockRow = {
  varietyId: number
  varietyName: string
  totalKg: number
  consumedKg: number
  releasedKg: number
  availableKg: number
  stockRate: number
}

export type StockStatisticsData = {
  summary: StockSummary
  byFarmer: FarmerStockRow[]
  byGroup: GroupStockRow[]
  byVariety: VarietyStockRow[]
}

export type StockFilters = {
  productionYear: number
  certTypes?: string[]
  groupIds?: number[]
  varietyIds?: number[]
  farmerNames?: string[]
}

export type GroupOption = {
  id: number
  name: string
}

export type VarietyOption = {
  id: number
  name: string
}


// ── 연산(productionYear) 목록 ─────────────────────────────────────────────

export async function getStockProductionYears(): Promise<number[]> {
  const rows = await prisma.stock.findMany({
    select: { productionYear: true },
    distinct: ['productionYear'],
    orderBy: { productionYear: 'desc' },
  })
  return rows.map(r => r.productionYear)
}

// ── 작목반 목록 ───────────────────────────────────────────────────────────

export async function getStockGroupOptions(productionYear: number, certTypes?: string[]): Promise<GroupOption[]> {
  // 해당 연산에 재고가 있는 생산자의 작목반만 반환
  const farmerIds = await prisma.stock.findMany({
    where: { productionYear },
    select: { farmerId: true },
    distinct: ['farmerId'],
  })
  const ids = farmerIds.map(r => r.farmerId)

  const groups = await prisma.producerGroup.findMany({
    where: {
      farmers: { some: { id: { in: ids } } },
      ...(certTypes?.length ? { certType: { in: certTypes } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return groups
}

// ── 품종 목록 ─────────────────────────────────────────────────────────────

export async function getStockVarietyOptions(
  productionYear: number,
  groupIds?: number[],
  certTypes?: string[],
): Promise<VarietyOption[]> {
  const where: Record<string, unknown> = { productionYear }
  const farmerFilter: Record<string, unknown> = {}
  if (groupIds?.length) farmerFilter.groupId = { in: groupIds }
  if (certTypes?.length) farmerFilter.group = { certType: { in: certTypes } }
  if (Object.keys(farmerFilter).length > 0) where.farmer = farmerFilter

  const rows = await prisma.stock.findMany({
    where,
    select: { variety: { select: { id: true, name: true } } },
    distinct: ['varietyId'],
  })
  return rows
    .map(r => ({ id: r.variety.id, name: r.variety.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

// ── 메인 조회 ─────────────────────────────────────────────────────────────

export async function getStockStatistics(
  filters: StockFilters,
): Promise<StockStatisticsData> {
  const where: Record<string, unknown> = {
    productionYear: filters.productionYear,
  }
  const farmerFilter: Record<string, unknown> = {}
  if (filters.groupIds?.length) farmerFilter.groupId = { in: filters.groupIds }
  if (filters.farmerNames?.length) farmerFilter.name = { in: filters.farmerNames }
  if (filters.certTypes?.length) farmerFilter.group = { certType: { in: filters.certTypes } }
  if (Object.keys(farmerFilter).length > 0) where.farmer = farmerFilter

  if (filters.varietyIds?.length) {
    where.varietyId = { in: filters.varietyIds }
  }

  const stocks = await prisma.stock.findMany({
    where,
    include: {
      farmer: { include: { group: true } },
      variety: true,
    },
  })

  const summary: StockSummary = {
    totalKg: 0,
    consumedKg: 0,
    availableKg: 0,
    releasedKg: 0,
    farmerCount: 0,
  }
  type FarmerAcc = FarmerStockRow
  type GroupAcc = Omit<GroupStockRow, 'farmerCount'> & { farmerIds: Set<number> }

  const farmerMap = new Map<number, FarmerAcc>()
  const groupMap  = new Map<number, GroupAcc>()
  const varietyMap = new Map<number, VarietyStockRow>()

  for (const stock of stocks) {
    const kg = stock.weightKg

    summary.totalKg += kg
    if (stock.status === 'CONSUMED')  { summary.consumedKg  += kg }
    if (stock.status === 'AVAILABLE') { summary.availableKg += kg }
    if (stock.status === 'RELEASED')  { summary.releasedKg  += kg }

    // 생산자별 집계
    if (!farmerMap.has(stock.farmerId)) {
      farmerMap.set(stock.farmerId, {
        farmerId: stock.farmerId,
        farmerName: stock.farmer.name,
        groupName: stock.farmer.group?.name ?? '-',
        totalKg: 0, consumedKg: 0, releasedKg: 0, availableKg: 0, stockRate: 0,
      })
    }
    const fr = farmerMap.get(stock.farmerId)!
    fr.totalKg += kg
    if (stock.status === 'CONSUMED')  fr.consumedKg  += kg
    if (stock.status === 'AVAILABLE') fr.availableKg += kg
    if (stock.status === 'RELEASED')  fr.releasedKg  += kg

    // 작목반별 집계
    const gid = stock.farmer.groupId
    if (gid != null) {
      if (!groupMap.has(gid)) {
        groupMap.set(gid, {
          groupId: gid,
          groupName: stock.farmer.group!.name,
          certType: stock.farmer.group!.certType,
          farmerIds: new Set(),
          totalKg: 0, consumedKg: 0, releasedKg: 0, availableKg: 0, stockRate: 0,
        })
      }
      const gr = groupMap.get(gid)!
      gr.farmerIds.add(stock.farmerId)
      gr.totalKg += kg
      if (stock.status === 'CONSUMED')  gr.consumedKg  += kg
      if (stock.status === 'RELEASED')  gr.releasedKg  += kg
      if (stock.status === 'AVAILABLE') gr.availableKg += kg
    }

    // 품종별 집계
    if (!varietyMap.has(stock.varietyId)) {
      varietyMap.set(stock.varietyId, {
        varietyId: stock.varietyId,
        varietyName: stock.variety.name,
        totalKg: 0, consumedKg: 0, releasedKg: 0, availableKg: 0, stockRate: 0,
      })
    }
    const vr = varietyMap.get(stock.varietyId)!
    vr.totalKg += kg
    if (stock.status === 'CONSUMED')  vr.consumedKg  += kg
    if (stock.status === 'RELEASED')  vr.releasedKg  += kg
    if (stock.status === 'AVAILABLE') vr.availableKg += kg
  }

  summary.farmerCount = farmerMap.size

  const calcStockRate = (total: number, available: number) =>
    total > 0 ? Math.round((available / total) * 1000) / 10 : 0

  const byFarmer = [...farmerMap.values()]
    .sort((a, b) => b.totalKg - a.totalKg)
    .map(r => ({ ...r, stockRate: calcStockRate(r.totalKg, r.availableKg) }))

  const byGroup = [...groupMap.values()]
    .sort((a, b) => b.totalKg - a.totalKg)
    .map(({ farmerIds, ...r }) => ({
      ...r,
      farmerCount: farmerIds.size,
      stockRate: calcStockRate(r.totalKg, r.availableKg),
    }))

  const byVariety = [...varietyMap.values()]
    .sort((a, b) => b.totalKg - a.totalKg)
    .map(r => ({
      ...r,
      stockRate: calcStockRate(r.totalKg, r.availableKg),
    }))

  return { summary, byFarmer, byGroup, byVariety }
}
