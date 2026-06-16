// 제품유형(ProductType/Packaging/Variety.aliases) 시드 — 멱등(upsert)
//
// 계획서 docs/plan/plan-제품유형마스터.md 단계 4-1.
// 소스: docs/resources/규격별포장지종류.xlsx (사용자 제공 품종×도정×규격별 포장지 매핑)
//   - forward-fill(품종/도정 빈칸은 위 값 유지)
//   - 보정: '20kg'→'PP마대'(삼광 오타), '수출?'→'가바수출용'
//   - 기본(isDefault): 단일 포장지 조합은 그것이 기본. 복수 조합은 DEFAULT_OVERRIDE.
//   - 잔량은 표에 없음(백필 제외 결정). 톤백은 포장지='톤백'.
//
// 실행: npx tsx scripts/seed-product-type.ts          (DRY-RUN: 파싱·검증만)
//       npx tsx scripts/seed-product-type.ts --apply  (실제 시드)

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'

const prisma = new PrismaClient()

// 포장지명 보정 규칙 (2026-06-16 사용자 확정)
const PKG_FIX: Record<string, string> = {
  '20kg': 'PP마대', // 삼광 백미 20kg 오타 보정
  '수출?': '가바수출용',
}

// 복수 포장지 조합의 기본 지정 (2026-06-16 사용자 확정)
const DEFAULT_OVERRIDE: Record<string, string> = {
  '서농22호/백미/4kg': '자연주의',
  '서농22호/백미/1kg': '자연주의',
  '서농22호/현미/1kg': '자연주의',
  '하이아미/백미/5kg': '땅끝에서보냅니다',
  '하이아미/백미/4kg': '자연주의',
}

const MISC_SENTINEL_PKG = '매입포장' // active=false sentinel (잡곡 매입용)

// 품종 별칭 (발주서 품목명↔행정품종명, 상위 §6.1.1)
const ALIASES: Record<string, string[]> = {
  '서농22호': ['가바'],
  '흑미': ['가바흑미'],
  '발아현미': ['가바발아현미'],
  '천지향1세': ['천지향'],
  '백옥찰': ['찹쌀'],
}

const norm = (v: unknown) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim()

type Sku = { variety: string; milling: string; pkgType: string; pkg: string }

function parseXlsx(): Sku[] {
  const wb = XLSX.readFile(path.join(process.cwd(), 'docs/resources/규격별포장지종류.xlsx'))
  const ws = wb.Sheets['Sheet1']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  let variety = '', milling = ''
  const skus: Sku[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const v = norm(r[0]), m = norm(r[1]), pt = norm(r[2])
    let pk = norm(r[3])
    if (v) variety = v
    if (m) milling = m
    if (!pt && !pk) continue
    pk = PKG_FIX[pk] ?? pk
    skus.push({ variety, milling, pkgType: pt, pkg: pk })
  }
  return skus
}

async function main() {
  const APPLY = process.argv.includes('--apply')
  console.log(`=== 제품유형 시드 ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`)

  const skus = parseXlsx()

  // 조합별 그룹화
  const byCombo = new Map<string, Sku[]>()
  for (const s of skus) {
    const k = `${s.variety}/${s.milling}/${s.pkgType}`
    if (!byCombo.has(k)) byCombo.set(k, [])
    byCombo.get(k)!.push(s)
  }

  const pkgNames = [...new Set(skus.map((s) => s.pkg))].sort((a, b) => a.localeCompare(b, 'ko'))
  console.log(`SKU 행 ${skus.length} / 조합 ${byCombo.size} / 포장지 ${pkgNames.length}종`)
  console.log(`포장지: ${pkgNames.join(', ')} (+ ${MISC_SENTINEL_PKG})\n`)

  // 품종 검증
  const allVarietyNames = [...new Set([...skus.map((s) => s.variety), ...Object.keys(ALIASES)])]
  const varieties = await prisma.variety.findMany({
    where: { name: { in: allVarietyNames } },
    select: { id: true, name: true },
  })
  const vMap = new Map(varieties.map((v) => [v.name, v.id]))
  const missingV = allVarietyNames.filter((n) => !vMap.has(n))
  if (missingV.length) {
    console.log(`⚠️ DB에 없는 품종(시드 스킵됨): ${missingV.join(', ')}`)
  }

  if (!APPLY) {
    console.log('\n[DRY-RUN] 검증만 완료. 실제 시드는 --apply')
    return
  }

  // 1. Packaging 시드
  const pkgIdMap = new Map<string, number>()
  for (const name of [...pkgNames, MISC_SENTINEL_PKG]) {
    const active = name !== MISC_SENTINEL_PKG
    const p = await prisma.packaging.upsert({
      where: { name },
      update: {},
      create: { name, active },
      select: { id: true },
    })
    pkgIdMap.set(name, p.id)
  }
  console.log(`✅ Packaging ${pkgIdMap.size}종 upsert`)

  // 2. ProductType 시드
  let created = 0, skippedNoVariety = 0
  for (const [combo, group] of byCombo) {
    const [vName, mType, pType] = combo.split('/')
    const vId = vMap.get(vName)
    if (!vId) {
      skippedNoVariety += group.length
      continue
    }
    const defPkg = DEFAULT_OVERRIDE[combo] ?? group[0].pkg
    for (const s of group) {
      const pkgId = pkgIdMap.get(s.pkg)!
      await prisma.productType.upsert({
        where: {
          varietyId_millingType_packageType_packagingId: {
            varietyId: vId, millingType: mType, packageType: pType, packagingId: pkgId,
          },
        },
        update: { isDefault: s.pkg === defPkg, active: true },
        create: {
          varietyId: vId, millingType: mType, packageType: pType, packagingId: pkgId,
          isDefault: s.pkg === defPkg, active: true,
        },
      })
      created++
    }
  }
  console.log(`✅ ProductType ${created}개 upsert (품종없음 스킵 ${skippedNoVariety})`)

  // 3. Variety.aliases
  let aliasDone = 0
  for (const [name, al] of Object.entries(ALIASES)) {
    const id = vMap.get(name)
    if (!id) continue
    await prisma.variety.update({ where: { id }, data: { aliases: al } })
    aliasDone++
  }
  console.log(`✅ Variety.aliases ${aliasDone}종 설정`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
