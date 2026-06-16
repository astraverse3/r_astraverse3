// 제품유형(ProductType) 백필 사전 점검 (읽기 전용)
//
// 계획서 docs/plan/plan-제품유형마스터.md 단계 4-2:
//   productTypeId=null 재고의 (품종+도정+규격) 조합을 전수 집계하고,
//   각 조합에 기본 ProductType(active)이 있는지 검사 → 누락 조합 리포트.
//   ⚠️ 누락 0건이어야 단계 4-3(백필) 진행 가능.
//
// millingType 도출(계획서 §5 단계4):
//   - MILLED + batch 있음(벼)        → batch.millingType
//   - MILLED + batch 없음(잡곡 도정산) → '기타'
//   - PURCHASED(잡곡 매입)            → '기타'
// 품종:
//   - MILLED    → stock.variety
//   - PURCHASED → package.variety

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MISC_SENTINEL_MILLING = '기타'

type ComboKey = string // `${varietyId}␟${millingType}␟${packageType}`

function comboKey(varietyId: number, millingType: string, packageType: string): ComboKey {
  return `${varietyId}␟${millingType}␟${packageType}`
}

async function main() {
  console.log('=== 제품유형 백필 사전 점검 ===\n')

  // 0. 현재 마스터 현황
  const [pkgCount, ptCount, varieties] = await Promise.all([
    prisma.packaging.count(),
    prisma.productType.count(),
    prisma.variety.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, type: true, aliases: true },
    }),
  ])
  console.log(`Packaging: ${pkgCount}종 / ProductType: ${ptCount}개 / Variety: ${varieties.length}개\n`)

  // 1. 전체 제품재고 조회 (백필 대상)
  const packages = await prisma.millingOutputPackage.findMany({
    select: {
      id: true,
      source: true,
      category: true,
      packageType: true,
      productTypeId: true,
      batchId: true,
      batch: { select: { millingType: true } },
      stock: { select: { variety: { select: { id: true, name: true } } } },
      variety: { select: { id: true, name: true } },
    },
  })
  console.log(`MillingOutputPackage 총 ${packages.length}건 (productTypeId=null ${packages.filter(p => p.productTypeId === null).length}건)\n`)

  // 2. 조합 집계
  type ComboInfo = {
    varietyId: number
    varietyName: string
    millingType: string
    packageType: string
    source: string
    count: number
  }
  const combos = new Map<ComboKey, ComboInfo>()
  const unresolved: number[] = [] // 품종/규격 해석 불가 패키지 id
  let leftoverCount = 0 // '잔량' = 백필 제외(productTypeId=null 유지, 2026-06-16 결정)

  for (const p of packages) {
    // '잔량'은 SKU 백필 제외 — 자체 판매 안 함(재포장 소진)
    if (p.packageType === '잔량') {
      leftoverCount++
      continue
    }
    // 품종 도출
    const variety = p.source === 'PURCHASED' ? p.variety : p.stock?.variety
    if (!variety) {
      unresolved.push(p.id)
      continue
    }
    // millingType 도출
    let millingType: string
    if (p.source === 'PURCHASED') millingType = MISC_SENTINEL_MILLING
    else if (p.batchId && p.batch?.millingType) millingType = p.batch.millingType
    else millingType = MISC_SENTINEL_MILLING

    const packageType = p.packageType
    const key = comboKey(variety.id, millingType, packageType)
    const existing = combos.get(key)
    if (existing) existing.count++
    else
      combos.set(key, {
        varietyId: variety.id,
        varietyName: variety.name,
        millingType,
        packageType,
        source: p.source,
        count: 1,
      })
  }

  // 3. 각 조합의 기본 ProductType 존재 여부
  const missing: ComboInfo[] = []
  for (const combo of combos.values()) {
    const defaultPt = await prisma.productType.findFirst({
      where: {
        varietyId: combo.varietyId,
        millingType: combo.millingType,
        packageType: combo.packageType,
        active: true,
      },
    })
    if (!defaultPt) missing.push(combo)
  }

  // 4. 리포트
  console.log(`=== 백필 대상 조합 ${combos.size}종 ===`)
  const sorted = [...combos.values()].sort(
    (a, b) =>
      a.varietyName.localeCompare(b.varietyName, 'ko') ||
      a.millingType.localeCompare(b.millingType, 'ko') ||
      a.packageType.localeCompare(b.packageType, 'ko'),
  )
  for (const c of sorted) {
    const flag = missing.includes(c) ? '❌누락' : '✅있음'
    console.log(`  ${flag}  ${c.varietyName} / ${c.millingType} / ${c.packageType}  (${c.source}, ${c.count}건)`)
  }

  console.log(`\n=== 요약 ===`)
  console.log(`기본 ProductType 누락 조합: ${missing.length}종 / 전체 ${combos.size}종`)
  console.log(`'잔량' 백필 제외 패키지: ${leftoverCount}건 (productTypeId=null 유지)`)
  if (unresolved.length > 0) {
    console.log(`⚠️ 품종/규격 해석 불가 패키지: ${unresolved.length}건 (id: ${unresolved.slice(0, 20).join(', ')}${unresolved.length > 20 ? ' …' : ''})`)
  }
  if (missing.length === 0) {
    console.log('✅ 누락 0건 — 백필 진행 가능')
  } else {
    console.log('❌ 누락 조합 존재 — 시드 보강 후 재점검 필요 (백필 금지)')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
