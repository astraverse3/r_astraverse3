// 발주서 시트 엑셀 내보내기 — 순수 함수 (계획서 `docs/plan/plan-발주서-D5-엑셀내보내기.md`)
//
// 용도는 **내부 증빙**이다. 업로드한 통일양식 모양을 DB에서 다시 세우고, 옛 공장 발주서의
// 「농가명」 줄 자리에 생산자·로트번호를 채운다(도메인 계획서 목표 #4).
//
// 🔴 **원본 「그대로」가 아니다.** 원본 파일은 저장하지 않고, 파서가 주문 0인 열·행과 제목의
//    자유 텍스트를 버린다. 여기서 되살리는 건 DB에 남은 것뿐이다 — 파일 하단에 그렇게 적는다.
//
// 🔴 **열·머리글·칸은 매트릭스 화면 그대로다**(사용자 결정 2026-09-28, `docs/plan/plan-발주서-엑셀-화면열.md`).
//    D5 처음엔 원본 열(업로드 때 옮겨 둔 `rawItemName`·`rawPackaging`)로 세웠지만, 원본 포장지가
//    대부분 빈칸이라 실제로 나간 포장지가 안 보였다. 이제 열 = `matrix.columns`(SKU 열),
//    1행 = `matrix.titles`, 포장지 줄 = `matrix.groups`, 칸 = `row.cells`. 원본 품목명은 매칭실패 열에만 남는다.
//
// 🔴 **상태 판정은 여기서 새로 하지 않는다.** 칸 상태는 매트릭스 셀 상태 그대로 —
//    판정이 두 벌이면 화면과 파일이 갈린다.
//
// 색은 칠하지 않는다(사용자 결정 2026-09-28 — 발주 난 건 거의 다 나가 색칠할 일이 드물다).
// 드문 미완료 칸과 로트가 섞인 칸에만 셀 메모를 단다.

import * as XLSX from 'xlsx'
import {
  buildMatrix,
  type BuildMatrixInput,
  type Matrix,
  type MatrixCell,
  type MatrixColumn,
  type CellStatus,
} from './purchase-order-matrix'

// ------------------------------------------------------
// 입력
// ------------------------------------------------------

/** 품목 하나가 실제로 뺀 제품재고 한 줄(movement) */
export type ExportAllocation = {
  itemId: number
  packageId: number
  count: number
  /** 등록 생산자(`stock.farmer.name`). 매입 잡곡은 null */
  farmerName: string | null
  /** `package.lotNo ?? stock.lotNo`. 매입 잡곡은 항상 null */
  lotNo: string | null
  purchaseVendor: string | null
}

export type ExportSheetInput = {
  /** 매트릭스와 같은 입력 — 열·머리글·칸을 전부 `buildMatrix`에서 빌린다. 🔴 `skus`가 비면 전부 매칭실패로 보인다 */
  matrix: BuildMatrixInput
  allocations: ExportAllocation[]
  /** 1행 A열 제목 */
  title: string
  /** 표 아래에 붙일 줄(내보낸 시각 등) */
  footerLines: string[]
  /** 상태 라벨 — 화면(`STATUS_META`)과 같은 말을 쓰도록 호출부가 넘긴다 */
  statusLabel: (status: CellStatus) => string
}

// ------------------------------------------------------
// 출력
// ------------------------------------------------------

export type ExportMemo = { row: number; col: number; text: string }

export type ExportSheet = {
  rows: (string | number | null)[][]
  merges: XLSX.Range[]
  memos: ExportMemo[]
  colWidths: number[]
  /** 완료가 아닌 칸 수 */
  incompleteCount: number
}

// ------------------------------------------------------
// 생산자 · 로트
// ------------------------------------------------------

export type LotEntry = {
  /** 로트번호, 매입 잡곡은 packageId — 🔴 null끼리 한 덩어리로 뭉치지 않게 */
  key: string
  farmerLabel: string
  lotLabel: string
  count: number
}

/** 차감 줄들을 로트별로 모은다. 많이 나간 순, 같으면 먼저 나온 순 */
export function summarizeLots(allocs: ExportAllocation[]): LotEntry[] {
  const byKey = new Map<string, LotEntry>()
  for (const a of allocs) {
    const key = a.lotNo ?? `pkg:${a.packageId}`
    const found = byKey.get(key)
    if (found) {
      found.count += a.count
      continue
    }
    byKey.set(key, {
      key,
      farmerLabel: a.farmerName ?? `매입·${a.purchaseVendor ?? ''}`,
      lotLabel: a.lotNo ?? '매입',
      count: a.count,
    })
  }
  return [...byKey.values()].sort((x, y) => y.count - x.count)
}

/** 머리글 한 칸 — 하나면 그대로, 여럿이면 `대표 외 N`. 대표 = 많이 나간 쪽 */
export function headerLabelOf(entries: LotEntry[], pick: (e: LotEntry) => string): string {
  const labels = [...new Set(entries.map(pick))]
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels[0]} 외 ${labels.length - 1}`
}

function lotMemoLines(entries: LotEntry[]): string[] {
  return entries.map((e) => `${e.farmerLabel} · ${e.lotLabel} · ${e.count}개`)
}

// ------------------------------------------------------
// 시트 조립
// ------------------------------------------------------

/**
 * 머리글 줄 라벨(1행은 제목 칸이라 뺐다). 위 3줄(품목·포장지·규격)이 화면 머리글과 같은 순서 —
 * 사용자 결정 A안 2026-09-28. 옛 공장 발주서의 「농가명」 자리(품목 바로 밑)는 버렸다.
 */
const HEADER_LABELS = ['포장지', '규격', '농가명', '로트번호', '소계'] as const

/** 규격 줄 — 화면 3행과 같은 규칙. 톤백은 자루중량(`1,000kg`), 그 밖엔 SKU 규격 */
function specLabelOf(col: MatrixColumn): string {
  return col.bulk ? `${(col.unitWeightKg ?? 0).toLocaleString('en-US')}kg` : col.packageType
}

type Context = {
  input: ExportSheetInput
  matrix: Matrix
  nameCols: number
  allocsByItem: Map<number, ExportAllocation[]>
}

function buildContext(input: ExportSheetInput): Context {
  const { orders } = input.matrix
  const allocsByItem = new Map<number, ExportAllocation[]>()
  for (const a of input.allocations) {
    const list = allocsByItem.get(a.itemId)
    if (list) list.push(a)
    else allocsByItem.set(a.itemId, [a])
  }
  return {
    input,
    // 매트릭스는 한 번만 세운다 — 열·머리글·칸 상태를 전부 여기서 빌린다
    matrix: buildMatrix(input.matrix),
    // 모든 건의 수령인이 발주처와 같으면 = 수령인 칸이 없는 양식(시아스형 #32) → 이름 칸 하나
    nameCols: orders.length > 0 && orders.every((o) => o.recipient === o.vendor) ? 1 : 2,
    allocsByItem,
  }
}

function allocsOf(ctx: Context, itemIds: number[]): ExportAllocation[] {
  return itemIds.flatMap((id) => ctx.allocsByItem.get(id) ?? [])
}

/** 머리글 6줄(품목·포장지·규격·농가명·로트번호·소계)과 열별 로트 요약 */
function buildHeader(ctx: Context): { rows: (string | number | null)[][]; lotsByCol: LotEntry[][] } {
  const { matrix } = ctx
  const pad = (first: string) => (ctx.nameCols === 2 ? [first, null] : [first])
  const groupByKey = new Map(matrix.groups.map((g) => [g.key, g]))
  const groupOf = (c: MatrixColumn) => groupByKey.get(c.groupKey)!
  const lotsByCol = matrix.columns.map((col) =>
    summarizeLots(allocsOf(ctx, matrix.rows.flatMap((r) => r.cells[col.key]?.itemIds ?? []))),
  )

  const rows: (string | number | null)[][] = [
    // 병합 칸이라도 값은 칸마다 적는다 — 병합을 풀거나 거르기 할 때 빈칸이 안 되게
    [...pad(ctx.input.title), ...matrix.columns.map((c) => groupOf(c).title)],
    [...pad(HEADER_LABELS[0]), ...matrix.columns.map((c) => groupOf(c).packagingName)],
    [...pad(HEADER_LABELS[1]), ...matrix.columns.map(specLabelOf)],
    [...pad(HEADER_LABELS[2]), ...lotsByCol.map((l) => headerLabelOf(l, (e) => e.farmerLabel))],
    [...pad(HEADER_LABELS[3]), ...lotsByCol.map((l) => headerLabelOf(l, (e) => e.lotLabel))],
    [...pad(HEADER_LABELS[4]), ...matrix.columns.map((c) => c.orderedQty)],
  ]
  if (ctx.nameCols === 2) rows.push(['(발주처)', '(수령인)', ...matrix.columns.map(() => null)])
  return { rows, lotsByCol }
}

/** 칸 메모 — 미완료면 상태 한 줄, 로트가 섞인 열이면 이 칸의 로트 내역 */
function memoOf(ctx: Context, cell: MatrixCell, columnMixed: boolean): string | null {
  const lines: string[] = []
  if (cell.status !== 'COMPLETED') {
    lines.push(`${ctx.input.statusLabel(cell.status)} — 차감 ${cell.allocatedQty} / 주문 ${cell.orderedQty}`)
  }
  if (columnMixed) {
    const lots = summarizeLots(allocsOf(ctx, cell.itemIds))
    if (lots.length > 0) lines.push(...lotMemoLines(lots))
  }
  return lines.length > 0 ? lines.join('\n') : null
}

/** 데이터 줄 — 셀 값은 주문 수량(숫자). 빈 칸 = 주문 없음 */
function buildBody(
  ctx: Context,
  startRow: number,
  lotsByCol: LotEntry[][],
): { rows: (string | number | null)[][]; memos: ExportMemo[]; incompleteCount: number } {
  const rows: (string | number | null)[][] = []
  const memos: ExportMemo[] = []
  let incompleteCount = 0

  // 행은 `buildMatrix`가 입력 건 순서 그대로 낸다(정렬은 화면의 `sortMatrixRows` 몫)
  ctx.matrix.rows.forEach((row, i) => {
    const names = ctx.nameCols === 2 ? [row.vendor, row.recipient] : [row.vendor]
    const values = ctx.matrix.columns.map((col, c) => {
      const cell = row.cells[col.key]
      if (!cell) return null
      if (cell.status !== 'COMPLETED') incompleteCount++
      const text = memoOf(ctx, cell, lotsByCol[c].length > 1)
      if (text) memos.push({ row: startRow + i, col: ctx.nameCols + c, text })
      return cell.orderedQty
    })
    rows.push([...names, ...values])
  })
  return { rows, memos, incompleteCount }
}

/** 한 줄의 가로 병합 — 칸 폭(열 수) 목록을 차례로 이어 붙이며 2칸 이상인 것만 */
function rowMerges(r: number, firstCol: number, spans: number[]): XLSX.Range[] {
  const merges: XLSX.Range[] = []
  let c = firstCol
  for (const n of spans) {
    if (n > 1) merges.push({ s: { r, c }, e: { r, c: c + n - 1 } })
    c += n
  }
  return merges
}

/** 병합 — 머리글 라벨 칸(A:B) · 1행 제목(`matrix.titles`) · 포장지 줄(`matrix.groups`) */
function buildMerges(ctx: Context): XLSX.Range[] {
  const merges: XLSX.Range[] = []
  if (ctx.nameCols === 2) {
    for (let r = 0; r <= HEADER_LABELS.length; r++) merges.push({ s: { r, c: 0 }, e: { r, c: 1 } })
  }
  merges.push(...rowMerges(0, ctx.nameCols, ctx.matrix.titles.map((t) => t.colSpan)))
  merges.push(...rowMerges(1, ctx.nameCols, ctx.matrix.groups.map((g) => g.columnKeys.length)))
  return merges
}

/** 엑셀 폭 단위(`wch` ≈ 숫자 한 자)로 본 글자 폭 — 한글은 두 자 몫이다 */
function textWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (/[ᄀ-ᇿ㄰-㆏가-힣]/.test(ch) ? 2 : 1), 0)
}

/**
 * 열 폭 — 포장지·농가명 줄 글자 폭에 맞춘다. 무료판 `xlsx`는 줄바꿈 스타일을 못 써서 폭으로 푼다.
 * 🔴 **로트번호 줄은 폭 계산에서 뺀다**(사용자 결정 2026-09-28 — 「잘리더라도 폭을 줄인 채로」).
 *    23자(`251119-11-15103885-4113`)에 맞추면 열마다 넓어져 표 전체가 옆으로 길어진다.
 *    엑셀은 `…` 표시가 없어 옆 칸이 차 있으면 잘리고, 칸을 누르면 수식 입력줄에 전체가 보인다.
 */
function columnWidths(headerRows: (string | number | null)[][], nameCols: number): number[] {
  const [, packagingRow, , farmerRow] = headerRows
  return farmerRow.slice(nameCols).map((_, i) => {
    const c = nameCols + i
    const widest = Math.max(...[packagingRow, farmerRow].map((row) => textWidth(String(row[c] ?? ''))))
    return Math.min(28, Math.max(10, widest + 2))
  })
}

export function buildExportSheet(input: ExportSheetInput): ExportSheet {
  const ctx = buildContext(input)
  const header = buildHeader(ctx)
  const body = buildBody(ctx, header.rows.length, header.lotsByCol)

  const footer: (string | number | null)[][] = [[]]
  if (body.incompleteCount > 0) {
    footer.push([`미완료 ${body.incompleteCount}칸 — 칸 메모에 차감/주문 수량이 있습니다.`])
  }
  footer.push(...input.footerLines.map((l) => [l]))

  return {
    rows: [...header.rows, ...body.rows, ...footer],
    merges: buildMerges(ctx),
    memos: body.memos,
    colWidths: [...Array(ctx.nameCols).fill(16), ...columnWidths(header.rows, ctx.nameCols)],
    incompleteCount: body.incompleteCount,
  }
}

/** 조립한 시트를 xlsx 워크시트로. 메모는 숨김(마우스를 올리면 뜬다) */
export function toWorksheet(sheet: ExportSheet): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
  ws['!merges'] = sheet.merges
  ws['!cols'] = sheet.colWidths.map((wch) => ({ wch }))
  for (const m of sheet.memos) {
    const addr = XLSX.utils.encode_cell({ r: m.row, c: m.col })
    const cell = ws[addr] as XLSX.CellObject | undefined
    if (!cell) continue
    const comments = [{ a: 'MillingLog', t: m.text }] as XLSX.Comments
    comments.hidden = true
    cell.c = comments
  }
  return ws
}

// ------------------------------------------------------
// 표기
// ------------------------------------------------------

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const
const KST_MS = 9 * 60 * 60 * 1000

/** `26/08/18 (화)` — 원본 제목 칸 모양. KST로 읽는다(백로그 §39 — UTC로 자르면 하루 밀린다) */
export function formatTitleDate(date: Date): string {
  const k = new Date(date.getTime() + KST_MS)
  const yy = String(k.getUTCFullYear() % 100).padStart(2, '0')
  const mm = String(k.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(k.getUTCDate()).padStart(2, '0')
  return `${yy}/${mm}/${dd} (${WEEKDAYS[k.getUTCDay()]})`
}

/** `2026-09-28 14:03` (KST) */
export function formatKstDateTime(date: Date): string {
  const iso = new Date(date.getTime() + KST_MS).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
}

/** 엑셀 시트명 — 31자 제한 · `[]:*?/\` 금지 */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, '_').trim()
  return (cleaned || 'Sheet1').slice(0, 31)
}
