// 제품유형 백필 — 기존 MillingOutputPackage에 productTypeId 주입 (멱등)
//
// 계획서 docs/plan/plan-제품유형마스터.md 단계 4-3.
//   - 멱등: productTypeId=null인 것만 대상
//   - '잔량' packageType은 스킵(백필 제외, productTypeId=null 유지)
//   - 품종·도정 도출:
//       MILLED 벼:          stock.varietyId + batch.millingType
//       MILLED 잡곡(batch=null): stock.varietyId + '기타'
//       PURCHASED 매입:      varietyId + '기타' + 포장지='매입포장'(find-or-create)
//   - MILLED는 (품종+도정+규격)의 기본 ProductType(isDefault·active)으로 주입
//
// 실행: npx tsx scripts/backfill-product-type.ts          (DRY-RUN)
//       npx tsx scripts/backfill-product-type.ts --apply  (실제 백필)

import { PrismaClient } from '@prisma/client'
import { findOrCreateProductType } from '../lib/product-type'

const prisma = new PrismaClient()
const MISC_SENTINEL_MILLING = '기타'
const MISC_SENTINEL_PKG = '매입포장'

async function main() {
  const APPLY = process.argv.includes('--apply')
  console.log(`=== 제품유형 백필 ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`)

  const packages = await prisma.millingOutputPackage.findMany({
    where: { productTypeId: null },
    select: {
      id: true,
      source: true,
      packageType: true,
      batchId: true,
      batch: { select: { millingType: true } },
      stock: { select: { variety: { select: { id: true, name: true } } } },
      variety: { select: { id: true, name: true } },
    },
  })
  console.log(`productTypeId=null 패키지: ${packages.length}건`)

  // 매입 sentinel 포장지 id (PURCHASED 백필용)
  const miscPkg = await prisma.packaging.findUnique({ where: { name: MISC_SENTINEL_PKG }, select: { id: true } })

  let filled = 0
  let skipLeftover = 0
  let skipNoVariety = 0
  const skipNoDefault: string[] = []

  for (const p of packages) {
    if (p.packageType === '잔량') {
      skipLeftover++
      continue
    }

    const variety = p.source === 'PURCHASED' ? p.variety : p.stock?.variety
    if (!variety) {
      skipNoVariety++
      continue
    }
    const millingType =
      p.source === 'PURCHASED'
        ? MISC_SENTINEL_MILLING
        : p.batchId && p.batch?.millingType
          ? p.batch.millingType
          : MISC_SENTINEL_MILLING

    let productTypeId: number | null = null

    if (p.source === 'PURCHASED') {
      // 매입: 매입포장 sentinel로 find-or-create (현재 매입 제품재고 0건이나 미래 대비)
      if (!miscPkg) {
        skipNoDefault.push(`매입포장 sentinel 없음 (pkg#${p.id})`)
        continue
      }
      if (APPLY) {
        productTypeId = await findOrCreateProductType(prisma, {
          varietyId: variety.id, millingType, packageType: p.packageType, packagingId: miscPkg.id,
        })
      } else {
        productTypeId = -1 // dry-run placeholder
      }
    } else {
      // MILLED: 기본 ProductType
      const pt = await prisma.productType.findFirst({
        where: { varietyId: variety.id, millingType, packageType: p.packageType, isDefault: true, active: true },
        select: { id: true },
      })
      if (!pt) {
        skipNoDefault.push(`${variety.name}/${millingType}/${p.packageType} (pkg#${p.id})`)
        continue
      }
      productTypeId = pt.id
    }

    if (APPLY && productTypeId && productTypeId > 0) {
      await prisma.millingOutputPackage.update({ where: { id: p.id }, data: { productTypeId } })
    }
    filled++
  }

  console.log(`\n=== 결과 ===`)
  console.log(`백필${APPLY ? '됨' : ' 대상'}: ${filled}건`)
  console.log(`'잔량' 제외: ${skipLeftover}건`)
  if (skipNoVariety) console.log(`품종 해석 불가 스킵: ${skipNoVariety}건`)
  if (skipNoDefault.length) {
    console.log(`⚠️ 기본 ProductType 없어 스킵: ${skipNoDefault.length}건`)
    for (const s of skipNoDefault.slice(0, 20)) console.log(`   - ${s}`)
  }

  if (APPLY) {
    const remain = await prisma.millingOutputPackage.count({ where: { productTypeId: null, NOT: { packageType: '잔량' } } })
    console.log(`\n잔존 null(잔량 제외): ${remain}건 (0 기대)`)
  } else {
    console.log('\n[DRY-RUN] 실제 백필은 --apply')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
