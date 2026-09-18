/**
 * D4-5 시험 차감 정리 — 묶음 #16(해남급식)의 SALE movement 하드삭제.
 * cancelCell 3단계를 그대로 옮긴다: 하드삭제 → recalcOrderStatus → 감사로그.
 * 🔴 movement만 지우면 PurchaseOrder.status가 라인 집계 파생값이라 「완료」로 굳는다.
 *   npx tsx scripts/_tmp-cancel-d45.ts           # dry-run
 *   npx tsx scripts/_tmp-cancel-d45.ts --apply   # 실행
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'
import { recalcOrderStatus } from '../lib/purchase-order-db'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const UPLOAD_ID = 16

async function main() {
  console.log(APPLY ? '=== 실행 (--apply) ===\n' : '=== DRY-RUN ===\n')

  const mvs = await prisma.packageMovement.findMany({
    where: { type: 'SALE', orderItem: { order: { uploadId: UPLOAD_ID } } },
    include: {
      package: { select: { id: true, lotNo: true, count: true } },
      orderItem: { select: { id: true, orderId: true, rawItemName: true, packageType: true, orderedQty: true } },
    },
    orderBy: { id: 'asc' },
  })
  console.log(`대상 movement ${mvs.length}건 (묶음 #${UPLOAD_ID})`)
  for (const m of mvs) {
    console.log(`  mv=${m.id} count=${m.count} pkg=${m.package.id}(lot=${m.package.lotNo}) ← item=${m.orderItem!.id} ${m.orderItem!.rawItemName.replace(/\n/g, ' ')} ${m.orderItem!.packageType} 주문 ${m.orderItem!.orderedQty}`)
  }
  const orderIds = [...new Set(mvs.map(m => m.orderItem!.orderId))]
  const before = await prisma.purchaseOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, status: true } })
  console.log(`\n영향 발주 ${orderIds.length}건: ${before.map(o => `${o.id}=${o.status}`).join(' ')}`)

  const others = await prisma.packageMovement.count({ where: { type: 'SALE', NOT: { orderItem: { order: { uploadId: UPLOAD_ID } } } } })
  console.log(`다른 묶음의 SALE movement: ${others}건 (건드리지 않는다)`)

  if (!APPLY) { console.log('\n--apply 없이 끝낸다.'); return }

  const backup = `./.d45-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(backup, JSON.stringify({ takenAt: new Date().toISOString(), movements: mvs }, null, 2), 'utf8')
  console.log(`\n백업: ${backup}`)

  const removed = await prisma.$transaction(async (tx) => {
    const del = await tx.packageMovement.deleteMany({ where: { id: { in: mvs.map(m => m.id) } } })
    for (const oid of orderIds) await recalcOrderStatus(tx, oid)
    return del.count
  })
  await prisma.auditLog.create({
    data: {
      action: 'DELETE',
      entity: 'PackageMovement',
      description: `D4-5 시험 차감 정리 — 묶음 #${UPLOAD_ID} SALE movement ${removed}건 하드삭제, 발주 ${orderIds.length}건 status 재계산, 재고복원`,
      details: JSON.stringify(mvs),
    },
  })
  console.log(`✅ ${removed}건 삭제 · status 재계산 ${orderIds.length}건 · 감사로그 1건`)

  const after = await prisma.purchaseOrder.groupBy({ by: ['status'], _count: true })
  console.log(`사후 status: ${after.map(s => `${s.status}=${s._count}`).join(' ')}`)
  const left = await prisma.packageMovement.count({ where: { type: 'SALE', orderItem: { order: { uploadId: UPLOAD_ID } } } })
  console.log(`사후 #${UPLOAD_ID} movement: ${left}건`)
}
main().finally(() => prisma.$disconnect())
