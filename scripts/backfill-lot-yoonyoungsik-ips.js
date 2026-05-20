/**
 * backfill-lot-yoonyoungsik-ips.js
 *
 * 일회성 데이터 정정: 윤영식·IPS·유기농 92건의 lotNo / incomingDate 통일
 *
 * 매칭: category=RICE, variety.name='IPS' (type='INDICA'),
 *      farmer.name='윤영식', group.certType='유기농'
 *
 * 변경:
 *   - Stock 92건: incomingDate → 가장 빠른 날짜로 통일, lotNo 첫 6자리도 통일
 *   - MillingOutputPackage(연결된 것): lotNo 첫 6자리만 통일 (productCode 보존)
 *
 * 기본은 dry-run. 실제 적용은 --commit 플래그.
 *
 * 사용:
 *   node scripts/backfill-lot-yoonyoungsik-ips.js          # dry-run
 *   node scripts/backfill-lot-yoonyoungsik-ips.js --commit # 실제 적용
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const COMMIT = process.argv.includes('--commit')

const WHERE = {
  category: 'RICE',
  variety: { name: 'IPS', type: 'INDICA' },
  farmer: {
    name: '윤영식',
    group: { certType: '유기농' },
  },
}

// lotNo 첫 6자리(YYMMDD)를 새 날짜로 치환. productCode/certNo/personalNo 보존.
// 입력 lot 형식: YYMMDD-productCode-certNo-personalNo
function replaceLotDate(oldLot, newDate) {
  if (!oldLot) return null
  const parts = oldLot.split('-')
  if (parts.length < 4) {
    throw new Error(`Unexpected lot format: ${oldLot}`)
  }
  const yymmdd = newDate.toISOString().slice(2, 10).replace(/-/g, '')
  parts[0] = yymmdd
  return parts.join('-')
}

async function main() {
  console.log('='.repeat(80))
  console.log(`MODE: ${COMMIT ? '🔴 COMMIT (실제 적용)' : '🟢 DRY-RUN (변경 없음)'}`)
  console.log('='.repeat(80))

  // 1. 조회
  const stocks = await prisma.stock.findMany({
    where: WHERE,
    include: {
      outputPackages: { select: { id: true, lotNo: true, productCode: true, batchId: true } },
    },
    orderBy: { incomingDate: 'asc' },
  })

  if (stocks.length === 0) {
    console.log('매칭 결과 없음. 중단.')
    return
  }

  console.log(`\n[조회] Stock ${stocks.length}건`)

  // 2. 기준일 산출
  const targetDate = stocks[0].incomingDate
  const targetYymmdd = targetDate.toISOString().slice(2, 10).replace(/-/g, '')
  console.log(`[기준일] ${targetDate.toISOString().slice(0, 10)} (YYMMDD=${targetYymmdd})`)

  // 3. 변경 plan 계산
  const stockUpdates = []
  const packageUpdates = []
  let stockSkipCount = 0
  let packageSkipCount = 0

  for (const s of stocks) {
    const newLot = replaceLotDate(s.lotNo, targetDate)
    const dateChanged = s.incomingDate.getTime() !== targetDate.getTime()
    const lotChanged = s.lotNo !== newLot

    if (dateChanged || lotChanged) {
      stockUpdates.push({
        id: s.id,
        bagNo: s.bagNo,
        oldDate: s.incomingDate.toISOString().slice(0, 10),
        newDate: targetDate.toISOString().slice(0, 10),
        oldLot: s.lotNo,
        newLot,
      })
    } else {
      stockSkipCount++
    }

    for (const pkg of s.outputPackages) {
      const newPkgLot = replaceLotDate(pkg.lotNo, targetDate)
      if (pkg.lotNo !== newPkgLot) {
        packageUpdates.push({
          id: pkg.id,
          stockId: s.id,
          batchId: pkg.batchId,
          productCode: pkg.productCode,
          oldLot: pkg.lotNo,
          newLot: newPkgLot,
        })
      } else {
        packageSkipCount++
      }
    }
  }

  // 4. Diff 출력
  console.log(`\n[변경 예정]`)
  console.log(`  Stock: ${stockUpdates.length}건 변경 / ${stockSkipCount}건 이미 일치`)
  console.log(`  MillingOutputPackage: ${packageUpdates.length}건 변경 / ${packageSkipCount}건 이미 일치`)

  // 5. lot 분포 변화
  const oldLotDist = new Map()
  for (const u of stockUpdates) {
    oldLotDist.set(u.oldLot, (oldLotDist.get(u.oldLot) || 0) + 1)
  }
  console.log(`\n[Stock lot 분포 변화]`)
  for (const [lot, count] of [...oldLotDist.entries()].sort()) {
    const newLot = replaceLotDate(lot, targetDate)
    console.log(`  ${lot} (${count}건)  →  ${newLot}`)
  }

  // 6. 패키지 변경 명세
  if (packageUpdates.length > 0) {
    console.log(`\n[Package lot 변경 명세 — ${packageUpdates.length}건]`)
    console.log('  pkgId | stockId | batchId | pCode | oldLot → newLot')
    for (const u of packageUpdates) {
      console.log(`  ${u.id} | ${u.stockId} | ${u.batchId} | ${u.productCode} | ${u.oldLot} → ${u.newLot}`)
    }
  }

  // 7. Stock 변경 명세 (처음/마지막 5건만)
  if (stockUpdates.length > 0) {
    console.log(`\n[Stock 변경 명세 — 처음 5건]`)
    console.log('  id | bagNo | oldDate → newDate | oldLot → newLot')
    for (const u of stockUpdates.slice(0, 5)) {
      console.log(`  ${u.id} | ${u.bagNo} | ${u.oldDate} → ${u.newDate} | ${u.oldLot} → ${u.newLot}`)
    }
    if (stockUpdates.length > 10) {
      console.log('  ...')
      console.log(`\n[Stock 변경 명세 — 마지막 5건]`)
      for (const u of stockUpdates.slice(-5)) {
        console.log(`  ${u.id} | ${u.bagNo} | ${u.oldDate} → ${u.newDate} | ${u.oldLot} → ${u.newLot}`)
      }
    }
  }

  // 8. 실제 적용
  if (!COMMIT) {
    console.log(`\n[DRY-RUN] 변경 없음. 실제 적용은 --commit 플래그 추가.`)
    return
  }

  console.log(`\n[COMMIT] 트랜잭션 실행 중...`)
  await prisma.$transaction(async (tx) => {
    for (const u of stockUpdates) {
      await tx.stock.update({
        where: { id: u.id },
        data: { lotNo: u.newLot, incomingDate: targetDate },
      })
    }
    for (const u of packageUpdates) {
      await tx.millingOutputPackage.update({
        where: { id: u.id },
        data: { lotNo: u.newLot },
      })
    }
    await tx.auditLog.create({
      data: {
        userId: null,
        userName: 'system (script)',
        userEmail: null,
        action: 'UPDATE',
        entity: 'Stock',
        entityId: null,
        description: `lot 통일 마이그레이션 — 윤영식 유기농 IPS ${stockUpdates.length}건 (기준일 ${targetDate.toISOString().slice(0, 10)}), 연결 패키지 ${packageUpdates.length}건`,
        details: {
          script: 'backfill-lot-yoonyoungsik-ips.js',
          targetDate: targetDate.toISOString(),
          stockUpdatedCount: stockUpdates.length,
          packageUpdatedCount: packageUpdates.length,
          stockIds: stockUpdates.map(u => u.id),
          packageIds: packageUpdates.map(u => u.id),
        },
      },
    })
  }, { timeout: 60000 })

  console.log(`\n[완료] Stock ${stockUpdates.length}건 + Package ${packageUpdates.length}건 갱신, auditLog 1건 기록.`)
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
