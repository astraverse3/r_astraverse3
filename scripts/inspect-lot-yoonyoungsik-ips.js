/**
 * inspect-lot-yoonyoungsik-ips.js
 *
 * Step 0: 사전 조사 (read-only)
 *
 * 매칭 조건: category=RICE, variety.name='IPS' (type='INDICA'),
 *           farmer.name='윤영식', group.certType='유기농'
 *
 * 출력:
 * 1. 매칭 Stock 건수 + 가장 빠른 incomingDate (목표 기준일)
 * 2. lotNo / incomingDate 별 그룹 카운트 (현재 몇 개로 분기돼 있는지)
 * 3. Stock 명세 (id, bagNo, incomingDate, lotNo, batchId, isClosed, outputs.length)
 * 4. 연결된 MillingOutputPackage 카운트 (마감/진행 분리)
 *
 * 데이터 변경 없음.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const where = {
    category: 'RICE',
    variety: { name: 'IPS', type: 'INDICA' },
    farmer: {
      name: '윤영식',
      group: { certType: '유기농' },
    },
  }

  // 1. Stock 조회
  const stocks = await prisma.stock.findMany({
    where,
    include: {
      variety: true,
      farmer: { include: { group: true } },
      batch: { select: { id: true, isClosed: true, millingType: true, date: true } },
      outputPackages: { select: { id: true, lotNo: true, productCode: true, packageType: true } },
    },
    orderBy: { incomingDate: 'asc' },
  })

  console.log('='.repeat(80))
  console.log(`매칭 Stock: ${stocks.length}건`)
  console.log('='.repeat(80))

  if (stocks.length === 0) {
    console.log('매칭 결과 없음. where 조건 확인 필요.')
    return
  }

  // 2. 기준일 산출
  const earliest = stocks[0].incomingDate
  const farmer = stocks[0].farmer
  const variety = stocks[0].variety
  const group = farmer.group

  console.log(`\n[기준 정보]`)
  console.log(`  농가: ${farmer.name} (farmerNo=${farmer.farmerNo}, group.code=${group?.code})`)
  console.log(`  품종: ${variety.name} (type=${variety.type})`)
  console.log(`  인증: ${group?.certType} (certNo=${group?.certNo})`)
  console.log(`  가장 빠른 incomingDate: ${earliest.toISOString().slice(0, 10)}`)

  // 3. 현재 lotNo / incomingDate 그룹 분포
  const lotGroups = new Map()
  for (const s of stocks) {
    const key = `${(s.incomingDate.toISOString().slice(0, 10))} | ${s.lotNo || '(null)'}`
    lotGroups.set(key, (lotGroups.get(key) || 0) + 1)
  }
  console.log(`\n[현재 incomingDate / lotNo 분포]`)
  for (const [key, count] of [...lotGroups.entries()].sort()) {
    console.log(`  ${key} → ${count}건`)
  }

  // 4. Stock 명세 (간단히)
  let closedCount = 0
  let openCount = 0
  let noBatchCount = 0
  let totalPackages = 0
  let closedPackages = 0
  let openPackages = 0

  for (const s of stocks) {
    if (!s.batchId) {
      noBatchCount++
    } else if (s.batch?.isClosed) {
      closedCount++
      closedPackages += s.outputPackages.length
    } else {
      openCount++
      openPackages += s.outputPackages.length
    }
    totalPackages += s.outputPackages.length
  }

  console.log(`\n[배치 연결 상태]`)
  console.log(`  도정 미연결 Stock: ${noBatchCount}건`)
  console.log(`  도정 진행중 Stock: ${openCount}건 (연결 패키지 ${openPackages}건)`)
  console.log(`  도정 마감됨 Stock: ${closedCount}건 (연결 패키지 ${closedPackages}건)`)
  console.log(`  총 연결 패키지: ${totalPackages}건`)

  // 5. 변경 예정 요약
  console.log(`\n[변경 예정 요약]`)
  console.log(`  Stock 92건 → incomingDate: ${earliest.toISOString().slice(0, 10)}`)
  console.log(`  Stock 92건 → lotNo: 첫 6자리만 ${earliest.toISOString().slice(2, 10).replace(/-/g, '')} 로 통일 (productCode/certNo/personalNo 유지)`)
  console.log(`  MillingOutputPackage ${totalPackages}건 → lotNo 동일 규칙으로 갱신`)

  // 6. 상위 10건 샘플 + 하위 5건 샘플
  console.log(`\n[Stock 명세 — 처음 10건]`)
  console.log('id'.padEnd(6), 'bagNo'.padEnd(7), 'incomingDate'.padEnd(13), 'lotNo'.padEnd(40), 'batch')
  for (const s of stocks.slice(0, 10)) {
    const batchStr = s.batchId ? `${s.batchId}${s.batch?.isClosed ? '(마감)' : '(진행)'}` : '-'
    console.log(
      String(s.id).padEnd(6),
      String(s.bagNo).padEnd(7),
      s.incomingDate.toISOString().slice(0, 10).padEnd(13),
      String(s.lotNo || '(null)').padEnd(40),
      batchStr,
    )
  }
  if (stocks.length > 15) {
    console.log('  ...')
    console.log(`\n[Stock 명세 — 마지막 5건]`)
    for (const s of stocks.slice(-5)) {
      const batchStr = s.batchId ? `${s.batchId}${s.batch?.isClosed ? '(마감)' : '(진행)'}` : '-'
      console.log(
        String(s.id).padEnd(6),
        String(s.bagNo).padEnd(7),
        s.incomingDate.toISOString().slice(0, 10).padEnd(13),
        String(s.lotNo || '(null)').padEnd(40),
        batchStr,
      )
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
