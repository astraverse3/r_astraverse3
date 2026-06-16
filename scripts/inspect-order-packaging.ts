// 발주서.xlsx에서 (품목명 × 중량 × 포장지) 조합과 포장지 종류 추출 (읽기 전용)
// 단계 4 시드 설계용 — 실제 발주서의 포장지 마스터 후보·기본 포장지 힌트 파악.
// §2.1 구조: 0-base row0=품목명(병합), row2=포장지, row3=중량, 규격열=C열(col2)~

import * as XLSX from 'xlsx'
import path from 'path'

function norm(v: unknown): string {
  return String(v ?? '').replace(/[\r\n]+/g, ' ').trim()
}

function main() {
  const file = path.join(process.cwd(), 'docs/resources/발주서.xlsx')
  const wb = XLSX.readFile(file)

  const allPackagings = new Set<string>()

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])

    // A열 라벨로 헤더 행 탐지
    let rowItem = 0, rowPkg = -1, rowWeight = -1
    for (let r = range.s.r; r <= range.e.r; r++) {
      const a = norm(ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v)
      if (a === '포장지') rowPkg = r
      else if (a === '중량') rowWeight = r
    }
    if (rowPkg < 0 || rowWeight < 0) {
      console.log(`[${sheetName}] 포장지/중량 헤더 행 탐지 실패 (스킵)`)
      continue
    }

    // 병합 정보 (품목명 펼치기용)
    const merges = ws['!merges'] ?? []
    const itemAt = (c: number): string => {
      // 직접 셀
      let v = norm(ws[XLSX.utils.encode_cell({ r: rowItem, c })]?.v)
      if (v) return v
      // 병합 범위에 속하면 시작셀 값
      for (const m of merges) {
        if (rowItem >= m.s.r && rowItem <= m.e.r && c >= m.s.c && c <= m.e.c) {
          return norm(ws[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })]?.v)
        }
      }
      return ''
    }

    console.log(`\n=== [${sheetName}] 규격열 C(col2)~${XLSX.utils.encode_col(range.e.c)} ===`)
    for (let c = 2; c <= range.e.c; c++) {
      const item = itemAt(c)
      const pkg = norm(ws[XLSX.utils.encode_cell({ r: rowPkg, c })]?.v)
      const weight = norm(ws[XLSX.utils.encode_cell({ r: rowWeight, c })]?.v)
      if (!item && !weight) continue // 빈 열
      if (pkg) allPackagings.add(pkg)
      console.log(`  ${XLSX.utils.encode_col(c)}: 품목='${item}' | 중량='${weight}' | 포장지='${pkg || '(빈칸=기본)'}'`)
    }
  }

  console.log(`\n=== 발주서 등장 포장지 종류 (${allPackagings.size}종) ===`)
  console.log([...allPackagings].sort((a, b) => a.localeCompare(b, 'ko')).map(p => `'${p}'`).join(', '))
}

main()
