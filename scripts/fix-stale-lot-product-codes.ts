/**
 * 저장된 원물 로트의 **품목코드**를 지금 규칙(`getProductCode`)에 맞춘다 (사용자 결정 2026-09-29).
 *
 * 배경:
 *   로트는 등록할 때 한 번 계산해 저장한다. 그 뒤 품종 곡종이 바뀌거나 코드 규칙이 추가돼도
 *   이미 저장된 로트는 다시 계산하지 않는다. 2026-09-29 전수 대조(로트 있는 원물 1,850건)에서 13건:
 *     - 발아현미 1   `00` → `131`  (원물 4/30 등록, 131 규칙은 6/18 `c7c8da1`) — 사용자 제보
 *     - 다온누리큰눈 2 `12` → `11`  (원물 2/6 등록, 품종 곡종이 2/20 메벼로 바뀜) — 도정 전.
 *       이대로 도정하면 제품 로트는 `11`로 나와 원물과 갈라진다
 *     - 서농24호 10 `11` → `15`  (6/18 흑미로 정리할 때 기존 원물은 안 고침) — 전량 원물 출고
 *
 * 하는 일 (트랜잭션 하나):
 *   ① 원물 로트의 품목코드만 교체 — 앞 6자리(날짜)·뒷자리(인증번호·개인번호)는 그대로
 *   ② 잡곡 제품재고 중 원물 로트를 그대로 복사한 행도 같이 (잡곡 포장은 stock.lotNo를 복사한다)
 *      벼 제품 로트는 포장 때 도정구분으로 따로 계산되므로 여기서 안 건드린다 — 대상 원물에 벼 제품이 있으면 멈춘다
 *   ③ 감사로그 (userName='script')
 *
 * 🔴 날짜나 뒷자리까지 다른 행은 **건드리지 않고 보고만** 한다(원인이 다르다).
 * 🔴 대상 수가 EXPECTED와 다르면 멈춘다 — 조사 뒤 데이터가 바뀌었으면 다시 봐야 한다.
 *
 * 사용법:
 *   npx tsx scripts/fix-stale-lot-product-codes.ts           # 검증 + 백업만 (dry-run)
 *   npx tsx scripts/fix-stale-lot-product-codes.ts --apply   # 실제 반영
 *
 * ⚠️ 실행 뒤 화면은 캐시가 남아 있을 수 있다 — 브라우저에서 새로고침해야 보인다.
 * ⚠️ 이미 나간 실물 라벨의 로트와는 달라질 수 있다(5/20 윤영식 건과 같은 성격 — 사용자: 실제 문제 없음).
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { generateLotNo } from '../lib/lot-generation'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const EXPECTED_STOCKS = 13
const BACKUP = `backups/fix-stale-lot-product-codes-${new Date().toISOString().slice(0, 10)}.json`

type Fix = { id: number; category: string; variety: string; farmer: string; from: string; to: string }

async function main() {
  const stocks = await prisma.stock.findMany({
    where: { lotNo: { not: null } },
    select: {
      id: true, category: true, lotNo: true, incomingDate: true,
      variety: { select: { name: true, type: true } },
      farmer: { select: { name: true, farmerNo: true, group: { select: { certNo: true, code: true, certType: true } } } },
    },
    orderBy: { id: 'asc' },
  })

  const fixes: Fix[] = []
  const skipped: string[] = []
  for (const s of stocks) {
    const g = s.farmer.group
    if (!g || g.certType === '일반') continue
    const expect = generateLotNo({
      incomingDate: s.incomingDate, varietyType: s.variety.type, varietyName: s.variety.name,
      millingType: '백미', // 등록 때와 같은 기준 (stock.ts·misc-stock.ts)
      certNo: g.certNo, farmerGroupCode: g.code, farmerNo: s.farmer.farmerNo || '',
    })
    if (expect === s.lotNo) continue
    const [d1, , ...t1] = s.lotNo!.split('-')
    const [d2, , ...t2] = expect.split('-')
    if (d1 !== d2 || t1.join('-') !== t2.join('-')) {
      skipped.push(`#${s.id} ${s.lotNo} ≠ ${expect} (날짜·뒷자리까지 다름 — 안 건드림)`)
      continue
    }
    fixes.push({ id: s.id, category: s.category, variety: s.variety.name, farmer: s.farmer.name, from: s.lotNo!, to: expect })
  }

  console.log(`로트 있는 원물 ${stocks.length}건 · 품목코드만 다른 것 ${fixes.length}건`)
  for (const f of fixes) console.log(`  #${f.id} ${f.category} ${f.variety} ${f.farmer}  ${f.from} → ${f.to}`)
  if (skipped.length) console.log('건너뜀:\n  ' + skipped.join('\n  '))

  if (fixes.length !== EXPECTED_STOCKS) {
    throw new Error(`대상이 ${EXPECTED_STOCKS}건이어야 하는데 ${fixes.length}건 — 조사 뒤 데이터가 바뀌었다. 멈춘다.`)
  }

  const packages = await prisma.millingOutputPackage.findMany({
    where: { stockId: { in: fixes.map(f => f.id) } },
    select: { id: true, stockId: true, lotNo: true, count: true },
  })
  const riceIds = new Set(fixes.filter(f => f.category === 'RICE').map(f => f.id))
  const ricePkgs = packages.filter(p => p.stockId != null && riceIds.has(p.stockId))
  if (ricePkgs.length) {
    throw new Error(`벼 대상 원물에 제품재고 ${ricePkgs.length}건 — 벼 제품 로트는 도정구분으로 따로 계산된다. 이 스크립트 범위 밖이라 멈춘다.`)
  }
  const fromOf = new Map(fixes.map(f => [f.id, f]))
  const pkgFixes = packages
    .filter(p => p.stockId != null && p.lotNo === fromOf.get(p.stockId)!.from)
    .map(p => ({ id: p.id, stockId: p.stockId!, count: p.count, from: p.lotNo!, to: fromOf.get(p.stockId!)!.to }))
  const pkgOther = packages.filter(p => !pkgFixes.some(x => x.id === p.id))
  console.log(`\n잡곡 제품재고(원물 로트 복사본) ${pkgFixes.length}건`)
  for (const p of pkgFixes) console.log(`  pkg#${p.id} (원물 #${p.stockId}, ${p.count}개)  ${p.from} → ${p.to}`)
  if (pkgOther.length) console.log(`  (로트가 원물과 달라 안 건드리는 제품 ${pkgOther.length}건: ${pkgOther.map(p => `#${p.id} ${p.lotNo}`).join(', ')})`)

  mkdirSync(dirname(BACKUP), { recursive: true })
  writeFileSync(BACKUP, JSON.stringify({ at: new Date().toISOString(), stocks: fixes, packages: pkgFixes }, null, 2))
  console.log(`\n백업: ${BACKUP}`)

  if (!APPLY) {
    console.log('\n※ dry-run입니다. 실제로 반영하려면 --apply 를 붙여 주세요.')
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const f of fixes) {
      // 조사 시점의 값일 때만 바꾼다 — 그사이 누가 고쳤으면 0건이 되어 아래에서 멈춘다
      const r = await tx.stock.updateMany({ where: { id: f.id, lotNo: f.from }, data: { lotNo: f.to } })
      if (r.count !== 1) throw new Error(`원물 #${f.id} 갱신 ${r.count}건 — 값이 바뀌었다. 전체 취소.`)
    }
    for (const p of pkgFixes) {
      const r = await tx.millingOutputPackage.updateMany({ where: { id: p.id, lotNo: p.from }, data: { lotNo: p.to } })
      if (r.count !== 1) throw new Error(`제품 #${p.id} 갱신 ${r.count}건 — 값이 바뀌었다. 전체 취소.`)
    }
    await tx.auditLog.createMany({
      data: [
        ...fixes.map(f => ({
          userName: 'script', action: 'UPDATE', entity: 'Stock', entityId: String(f.id),
          description: `로트 품목코드 정정: ${f.variety} ${f.farmer} ${f.from} → ${f.to} (지금 규칙에 맞춤, 사용자 결정)`,
          details: { from: f.from, to: f.to, reason: 'stale-product-code' },
        })),
        ...pkgFixes.map(p => ({
          userName: 'script', action: 'UPDATE', entity: 'MillingOutputPackage', entityId: String(p.id),
          description: `제품 로트 품목코드 정정: ${p.from} → ${p.to} (원물 #${p.stockId} 로트 복사본)`,
          details: { from: p.from, to: p.to, stockId: p.stockId, reason: 'stale-product-code' },
        })),
      ],
    })
  })
  console.log(`\n✅ 반영: 원물 ${fixes.length}건 · 제품 ${pkgFixes.length}건 · 감사로그 ${fixes.length + pkgFixes.length}건`)
}

main()
  .catch(e => { console.error('❌', e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
