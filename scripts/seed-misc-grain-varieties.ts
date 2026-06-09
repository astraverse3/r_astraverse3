// 잡곡 품종 일회성 시드 (멱등 — findFirst → 없으면 create)
//
// 계획서 `docs/plan/plan-잡곡재고관리.md` §품종 시드 정책:
//   - 🚨 기존 RICE 품종 데이터는 절대 수정/삭제 금지
//   - 잡곡 품종은 `lib/lot-generation.ts` 매핑 기준 신규 레코드만 추가
//   - 시드 스크립트: `findFirst({ where: { name } })` 후 없을 때만 `create`
//
// 명칭 선택:
//   - 계획서의 슬래시 표기(백태/콩, 팥/적두, 서목태/쥐눈이)는 양쪽 다 lot-generation에서
//     동일 productCode로 매칭됨. 보수적으로 **앞 키워드**를 정식 name으로 채택.
//   - 25년산 엑셀에서 다른 명칭이 등장하면 작업 단계 #11(import)에서 alias 처리.
//
// type 필드:
//   - lot-generation의 잡곡 영역은 varietyName으로만 분기 → varietyType 무관
//   - dashboard 통계는 category='RICE' 필터로 자동 제외 → 잡곡 type 값 무영향
//   - 단순화 위해 모두 'MISC_GRAIN' 통일

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MISC_GRAIN_VARIETIES = [
  { name: '보리', type: 'MISC_GRAIN' },
  { name: '검정보리', type: 'MISC_GRAIN' },
  { name: '통밀', type: 'MISC_GRAIN' },
  { name: '수수', type: 'MISC_GRAIN' },
  { name: '기장', type: 'MISC_GRAIN' },
  { name: '차조', type: 'MISC_GRAIN' },
  { name: '백태', type: 'MISC_GRAIN' },     // 별칭: 콩
  { name: '귀리', type: 'MISC_GRAIN' },
  { name: '참깨', type: 'MISC_GRAIN' },
  { name: '아마란스', type: 'MISC_GRAIN' },
  { name: '율무', type: 'MISC_GRAIN' },
  { name: '녹두', type: 'MISC_GRAIN' },
  { name: '팥', type: 'MISC_GRAIN' },        // 별칭: 적두
  { name: '서목태', type: 'MISC_GRAIN' },    // 별칭: 쥐눈이
  { name: '서리태', type: 'MISC_GRAIN' },
] as const

async function main() {
  console.log('잡곡 품종 시드 시작...\n')

  let created = 0
  let skipped = 0
  const skippedNames: string[] = []

  for (const v of MISC_GRAIN_VARIETIES) {
    const existing = await prisma.variety.findFirst({ where: { name: v.name } })
    if (existing) {
      // 기존 RICE 품종과 이름 충돌이 있어도 절대 수정하지 않음
      skipped++
      skippedNames.push(`${v.name}(category=${existing.category})`)
      continue
    }
    await prisma.variety.create({
      data: {
        name: v.name,
        type: v.type,
        category: 'MISC_GRAIN',
      },
    })
    created++
    console.log(`  + ${v.name}`)
  }

  console.log(`\n결과: 신규 ${created}건, 스킵 ${skipped}건`)
  if (skippedNames.length > 0) {
    console.log(`스킵된 항목: ${skippedNames.join(', ')}`)
  }

  // 최종 분포 확인
  const byCategory = await prisma.variety.groupBy({
    by: ['category'],
    _count: { _all: true },
  })
  console.log('\n전체 Variety 분포:')
  for (const row of byCategory) {
    console.log(`  ${row.category}: ${row._count._all}건`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
