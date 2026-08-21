// 배송업체 마스터 초기값 (결정 #36) — 실행: npx tsx scripts/seed-shipping-vendors.ts
// 이후 추가·수정은 관리화면에서 한다. 수출건처럼 목록에 없는 업체도 거기서 먼저 등록해 쓴다.
// 이미 있는 이름은 건드리지 않는다(관리화면에서 순서를 바꿔놨을 수 있어 sortOrder도 덮지 않는다).
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VENDORS = [
    '경동화물',
    '대신화물',
    '전국화물',
    '해남원형화물',
    '롯데택배',
    '직접배송',
    '방문수령',
]

async function main() {
    for (const [i, name] of VENDORS.entries()) {
        const vendor = await prisma.shippingVendor.upsert({
            where: { name },
            update: {},
            create: { name, sortOrder: (i + 1) * 10 },
        })
        console.log(`  ${vendor.sortOrder.toString().padStart(3)} ${vendor.name}`)
    }
    const total = await prisma.shippingVendor.count()
    console.log(`배송업체 ${total}건`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
