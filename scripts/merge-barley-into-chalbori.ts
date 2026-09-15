/**
 * 보리 · 찰보리 품종 통합 — **찰보리로 통일**한다 (사용자 결정 2026-09-15).
 *
 * 배경:
 *   시드에 있던 「보리」(id 31)는 재고·제품유형·제품재고가 **하나도 없는 빈 품종**이다.
 *   실제 물건은 그 다음 날 손으로 만든 「찰보리」(id 46)로 들어왔다(감사로그 2026-04-30 08:08 등록,
 *   17분 뒤 도정위탁 2,900kg 입고). 사용자 확인 결과 둘은 **같은 품종**이다.
 *
 *   그런데 매처는 이름 정확일치를 먼저 본다 → 발주서의 「유기농 보리」가 빈 보리 품종에 붙고,
 *   거기 SKU가 없어 매칭실패로 남는다. 빈 품종 하나가 매칭을 가로채고 있었다.
 *
 * 방향을 「찰보리로 통일」로 잡은 이유:
 *   찰보리 쪽에만 데이터가 있어 **옮길 행이 0개**다. 반대 방향(보리로 통일)은 Stock 1 + SKU 2를
 *   옮겨야 하고 표시명도 전부 바뀐다. 매칭 결과는 두 방향이 같으므로 싼 쪽을 고른다.
 *
 * 하는 일 (트랜잭션 하나):
 *   ① 찰보리(46) `aliases`에 '보리' 추가 → 발주서 「유기농 보리」가 찰보리로 매칭된다
 *   ② 빈 보리(31) 삭제
 *   ③ 감사로그 2건 기록 (스크립트 실행이므로 userName='script')
 *
 * 로트번호는 **바뀌지 않는다**. `getProductCode`가 이름에 '보리'가 들어가면 '21'을 주고
 * '검정'일 때만 '215'로 가른다 — 보리와 찰보리가 원래 같은 코드였다. 기존 로트
 * `250630-21-15101553-31`도 그대로 유효하다.
 *
 * 사용법:
 *   npx tsx scripts/merge-barley-into-chalbori.ts           # 검증 + 백업만 (dry-run)
 *   npx tsx scripts/merge-barley-into-chalbori.ts --apply   # 실제 반영
 *
 * ⚠️ 실행 뒤 화면은 캐시가 남아 있을 수 있다 — 브라우저에서 새로고침해야 반영이 보인다.
 * ⚠️ 발주서의 기존 매칭실패 라인은 자동으로 붙지 않는다. 매트릭스에서 **「재매칭」**을 눌러야 한다.
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const prisma = new PrismaClient()

const KEEP_ID = 46 // 찰보리 (남긴다)
const DROP_ID = 31 // 보리 (지운다 — 비어 있어야 한다)
const NEW_ALIAS = '보리'

const APPLY = process.argv.includes('--apply')
const BACKUP = `backups/merge-barley-${new Date().toISOString().slice(0, 10)}.json`

async function main() {
  const keep = await prisma.variety.findUnique({ where: { id: KEEP_ID } })
  const drop = await prisma.variety.findUnique({ where: { id: DROP_ID } })
  if (!keep || !drop) throw new Error('품종을 찾을 수 없습니다. 이미 정리된 것 같습니다.')
  if (keep.name !== '찰보리' || drop.name !== '보리') {
    throw new Error(`이름이 예상과 다릅니다: keep=${keep.name} drop=${drop.name}`)
  }

  // ── 안전 확인: 지울 품종이 정말 비어 있는가 (참조 3종 전부) ────────────
  const [stocks, pkgs, pts] = await Promise.all([
    prisma.stock.count({ where: { varietyId: DROP_ID } }),
    prisma.millingOutputPackage.count({ where: { varietyId: DROP_ID } }),
    prisma.productType.count({ where: { varietyId: DROP_ID } }),
  ])
  console.log(`\n[지울 품종] ${drop.name}(id=${drop.id})`)
  console.log(`  Stock ${stocks} · 제품재고 ${pkgs} · 제품유형 ${pts}`)
  if (stocks + pkgs + pts > 0) {
    throw new Error('🔴 비어 있지 않습니다. 데이터를 옮기는 계획이 따로 필요합니다 — 중단합니다.')
  }

  // 남길 품종 현황
  const [kStocks, kPkgs, kPts] = await Promise.all([
    prisma.stock.count({ where: { varietyId: KEEP_ID } }),
    prisma.millingOutputPackage.count({ where: { varietyId: KEEP_ID } }),
    prisma.productType.count({ where: { varietyId: KEEP_ID } }),
  ])
  console.log(`\n[남길 품종] ${keep.name}(id=${keep.id}) aliases=${JSON.stringify(keep.aliases)}`)
  console.log(`  Stock ${kStocks} · 제품재고 ${kPkgs} · 제품유형 ${kPts}`)

  // 별칭 충돌 확인 — 다른 품종이 '보리'를 이름이나 별칭으로 쓰고 있으면 안 된다
  const all = await prisma.variety.findMany({ select: { id: true, name: true, aliases: true } })
  const clash = all.filter(
    (v) =>
      v.id !== KEEP_ID &&
      v.id !== DROP_ID &&
      (v.name === NEW_ALIAS || v.aliases.includes(NEW_ALIAS)),
  )
  if (clash.length > 0) {
    throw new Error(`🔴 '${NEW_ALIAS}'를 이미 쓰는 품종이 있습니다: ${JSON.stringify(clash)}`)
  }
  // 참고 — 이름에 '보리'가 들어가는 다른 품종(검정보리)은 정확일치가 아니라 무관하다
  console.log(
    `\n  이름에 '보리'가 든 다른 품종(무관, 참고):`,
    all.filter((v) => v.name.includes('보리') && v.id !== KEEP_ID && v.id !== DROP_ID).map((v) => v.name),
  )

  // 영향 받는 발주서 라인
  const items = await prisma.purchaseOrderItem.findMany({
    where: { rawItemName: { contains: '보리' }, productTypeId: null },
    select: { id: true, rawItemName: true, packageType: true, orderedQty: true, order: { select: { uploadId: true } } },
  })
  console.log(`\n[재매칭하면 붙을 후보] 매칭실패이면서 이름에 '보리'가 든 라인 ${items.length}건`)
  for (const it of items) {
    console.log(`  #${it.id} ${it.rawItemName.replace(/\n/g, ' ')} | ${it.packageType} | ${it.orderedQty}개 | 묶음 ${it.order.uploadId}`)
  }

  // ── 백업 ──────────────────────────────────────────────────────────────
  mkdirSync(dirname(BACKUP), { recursive: true })
  writeFileSync(
    BACKUP,
    JSON.stringify({ at: new Date().toISOString(), keep, drop, affectedItems: items }, null, 2),
    'utf-8',
  )
  console.log(`\n백업: ${BACKUP}`)

  if (!APPLY) {
    console.log('\n※ dry-run입니다. 실제로 반영하려면 --apply 를 붙여 주세요.')
    return
  }

  // ── 반영 ──────────────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    if (!keep.aliases.includes(NEW_ALIAS)) {
      await tx.variety.update({ where: { id: KEEP_ID }, data: { aliases: { push: NEW_ALIAS } } })
    }
    await tx.variety.delete({ where: { id: DROP_ID } })
    await tx.auditLog.createMany({
      data: [
        {
          userName: 'script',
          action: 'UPDATE',
          entity: 'Variety',
          entityId: String(KEEP_ID),
          description: `품종 별칭 추가: 찰보리 ← '${NEW_ALIAS}' (보리·찰보리 통합, 사용자 결정)`,
        },
        {
          userName: 'script',
          action: 'DELETE',
          entity: 'Variety',
          entityId: String(DROP_ID),
          description: `품종 삭제: 보리 (재고·제품유형·제품재고 0인 빈 품종. 찰보리로 통합)`,
        },
      ],
    })
  })

  const after = await prisma.variety.findUnique({ where: { id: KEEP_ID }, select: { name: true, aliases: true } })
  console.log(`\n✅ 반영 완료 — ${after?.name} aliases=${JSON.stringify(after?.aliases)}`)
  console.log('   보리 품종 존재:', (await prisma.variety.findUnique({ where: { id: DROP_ID } })) !== null)
  console.log('\n다음: 발주서 매트릭스에서 **「재매칭」** 을 눌러야 위 라인들이 붙습니다.')
}

main()
  .catch((e) => {
    console.error('\n❌', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
