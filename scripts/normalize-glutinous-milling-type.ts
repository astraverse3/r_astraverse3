// 찰벼 도정유형 정규화: millingType='찹쌀' → '백미' (멱등, 감사로그)
//
// 계획서 docs/plan/plan-찰벼도정유형정리.md 단계 1.
// 방향 A: millingType=순수 도정 정도. '찹쌀'(=찰벼의 백미)은 폐기하고 '백미'로 통일.
//   곡종(찰/메)은 Variety.type=GLUTINOUS에서 파생해 표시만 찹쌀/찰현미로.
//
// 안전장치:
//   - millingType='찹쌀'인 batch만 대상(멱등 — 재실행해도 추가 변경 없음)
//   - 투입 stock이 전부 GLUTINOUS(찰벼)인 batch만 변경. 비찰벼 혼합 batch는 스킵+경고(수동 검토)
//   - 기본 DRY-RUN. 실제 변경은 `--apply` 플래그.
//
// 실행: npx tsx scripts/normalize-glutinous-milling-type.ts          (점검만)
//       npx tsx scripts/normalize-glutinous-milling-type.ts --apply  (실제 변경)

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const APPLY = process.argv.includes('--apply')
  console.log(`=== 찰벼 도정유형 정규화 (찹쌀→백미) ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`)

  const batches = await prisma.millingBatch.findMany({
    where: { millingType: '찹쌀' },
    include: {
      stocks: { include: { variety: { select: { name: true, type: true } } } },
    },
  })
  console.log(`millingType='찹쌀' batch: ${batches.length}건`)

  const toFix: typeof batches = []
  const skipped: { id: number; reason: string }[] = []

  for (const b of batches) {
    if (b.stocks.length === 0) {
      skipped.push({ id: b.id, reason: '투입 stock 없음 (수동 검토)' })
      continue
    }
    const types = [...new Set(b.stocks.map((s) => s.variety.type))]
    const names = [...new Set(b.stocks.map((s) => s.variety.name))]
    if (types.every((t) => t === 'GLUTINOUS')) {
      toFix.push(b)
    } else {
      skipped.push({ id: b.id, reason: `비찰벼 혼합: ${names.join(', ')} (${types.join(', ')})` })
    }
  }

  console.log(`\n정규화 대상(전부 찰벼): ${toFix.length}건`)
  for (const b of toFix) {
    const names = [...new Set(b.stocks.map((s) => s.variety.name))].join(', ')
    console.log(`  batch#${b.id} [${names}] 포장 ${b.stocks.length}개 투입`)
  }
  if (skipped.length > 0) {
    console.log(`\n⚠️ 스킵 ${skipped.length}건:`)
    for (const s of skipped) console.log(`  batch#${s.id}: ${s.reason}`)
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] 실제 변경하려면 --apply 플래그를 붙여 다시 실행하세요.')
    return
  }

  let done = 0
  for (const b of toFix) {
    await prisma.$transaction([
      prisma.millingBatch.update({ where: { id: b.id }, data: { millingType: '백미' } }),
      prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'MillingBatch',
          entityId: String(b.id),
          description: `찰벼 도정유형 정규화: 찹쌀→백미 (batch#${b.id})`,
          userName: 'system(script)',
          details: { before: { millingType: '찹쌀' }, after: { millingType: '백미' } },
        },
      }),
    ])
    done++
  }
  console.log(`\n✅ ${done}건 정규화 완료`)

  const remain = await prisma.millingBatch.count({ where: { millingType: '찹쌀' } })
  console.log(`잔존 millingType='찹쌀' batch: ${remain}건 (0 기대)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
