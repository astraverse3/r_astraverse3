import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 칠분도미/오분도미로 통일
const REPLACEMENTS: Record<string, string> = {
  '7분도미': '칠분도미',
  '7분도':   '칠분도미',
  '칠분도':  '칠분도미',
  '5분도미': '오분도미',
  '5분도':   '오분도미',
  '오분도':  '오분도미',
}

async function main() {
  console.log('도정유형 명칭 통일 마이그레이션 시작...')

  // 현재 상태 조회
  const batches = await prisma.millingBatch.findMany({
    select: { id: true, millingType: true }
  })

  const toUpdate = batches.filter(b => REPLACEMENTS[b.millingType])

  if (toUpdate.length === 0) {
    console.log('변경할 레코드가 없습니다.')
    return
  }

  console.log(`변경 대상: ${toUpdate.length}건`)
  toUpdate.forEach(b => {
    console.log(`  ID ${b.id}: "${b.millingType}" → "${REPLACEMENTS[b.millingType]}"`)
  })

  let updatedCount = 0
  let failedCount = 0

  for (const batch of toUpdate) {
    try {
      await prisma.millingBatch.update({
        where: { id: batch.id },
        data: { millingType: REPLACEMENTS[batch.millingType] }
      })
      updatedCount++
    } catch (err) {
      console.error(`  실패 ID ${batch.id}:`, err)
      failedCount++
    }
  }

  console.log(`완료. 성공: ${updatedCount}건, 실패: ${failedCount}건`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
