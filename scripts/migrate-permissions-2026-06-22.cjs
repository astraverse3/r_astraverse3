// 권한 단순화 1회성 마이그레이션 (2026-06-22)
// 비즈니스 5키 → 2키 + USER/SYSTEM 폐기(ADMIN 흡수). 합집합이라 권한 상실 0.
// 사용법: dry-run = `node scripts/migrate-permissions-2026-06-22.cjs`
//        적용   = `node scripts/migrate-permissions-2026-06-22.cjs --apply`
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const SUPPLY_SRC = ['STOCK_MANAGE', 'VARIETY_MANAGE', 'FARMER_MANAGE']
const OPERATION_SRC = ['MILLING_MANAGE', 'SALES_MANAGE']
const DROP = ['STOCK_MANAGE', 'VARIETY_MANAGE', 'FARMER_MANAGE', 'MILLING_MANAGE', 'SALES_MANAGE', 'USER_MANAGE', 'SYSTEM_MANAGE']

function migrate(perms) {
  const set = new Set()
  if (perms.some(x => SUPPLY_SRC.includes(x))) set.add('SUPPLY_MANAGE')
  if (perms.some(x => OPERATION_SRC.includes(x))) set.add('OPERATION_MANAGE')
  for (const x of perms) if (!DROP.includes(x)) set.add(x) // NOTICE_MANAGE 등 유지
  return [...set].sort()
}

const APPLY = process.argv.includes('--apply')
;(async () => {
  const users = await p.user.findMany({ select: { id: true, name: true, role: true, permissions: true }, orderBy: { createdAt: 'asc' } })
  console.log(APPLY ? '=== APPLY (실제 DB 변경) ===' : '=== DRY-RUN (미적용, 미리보기) ===')
  let changedCount = 0
  for (const u of users) {
    const before = (u.permissions || []).slice().sort()
    const after = migrate(before)
    const changed = JSON.stringify(before) !== JSON.stringify(after)
    if (changed) changedCount++
    console.log(`${changed ? '*' : ' '} ${u.name || '(이름없음)'} [${u.role}]`)
    console.log(`    before: ${before.join(', ') || '(없음)'}`)
    console.log(`    after : ${after.join(', ') || '(없음)'}`)
    if (APPLY && changed) {
      await p.user.update({ where: { id: u.id }, data: { permissions: after } })
    }
  }
  console.log(`\n변경 대상: ${changedCount}명 / 전체 ${users.length}명`)
  console.log(APPLY ? '✅ 적용 완료' : 'ℹ️ 미적용 — 실제 반영하려면 --apply')
  await p.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
