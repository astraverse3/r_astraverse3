// 발주서 시트 엑셀 내보내기 — 순수 함수 (계획서 `docs/plan/plan-발주서-D5-엑셀내보내기.md`)
//
// 용도는 **내부 증빙**이다. 업로드한 통일양식 모양을 DB에서 다시 세우고, 옛 공장 발주서의
// 「농가명」 줄 자리에 생산자·로트번호를 채운다(도메인 계획서 목표 #4).
//
// 🔴 **원본 「그대로」가 아니다.** 원본 파일은 저장하지 않고, 파서가 주문 0인 열·행과 제목의
//    자유 텍스트를 버린다. 여기서 되살리는 건 DB에 남은 것뿐이다 — 파일 하단에 그렇게 적는다.
//
// 🔴 **열은 원본 열이다(SKU 열 아님).** 매트릭스 화면은 SKU로 묶지만(`columnKeyOf`), 증빙은
//    원본 발주서와 대조하는 게 목적이다. 재매칭으로 SKU가 바뀌어도 열이 흔들리지 않는다.
//
// 🔴 **상태 판정은 여기서 새로 하지 않는다.** 매칭실패·재고부족(톤백은 kg 기준)은
//    `buildMatrix`의 셀 상태를 그대로 빌린다 — 판정이 두 벌이면 화면과 파일이 갈린다.
//
// 색은 칠하지 않는다(사용자 결정 2026-09-28 — 발주 난 건 거의 다 나가 색칠할 일이 드물다).
// 드문 미완료 칸과 로트가 섞인 칸에만 셀 메모를 단다.

import * as XLSX from 'xlsx'
import { computeLineStatus } from './purchase-order-allocation'
import {
  buildMatrix,
  columnKeyOf,
  type BuildMatrixInput,
  type Matrix,
  type CellStatus,
  type MatrixItemInput,
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
  /** 매트릭스와 같은 입력 — 열 순서·상태 판정을 빌리려고 통째로 받는다. 🔴 `skus`가 비면 열이 화면과 다르게 묶인다 */
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

/** 원본 열 한 칸 = 품목명 · 포장지 · 규격 · 자루중량 한 조합 */
export type ExportColumn = {
  key: string
  rawItemName: string
  rawPackaging: string | null
  packageType: string
  unitWeightKg: number | null
}

// ------------------------------------------------------
// 원본 열 순서 복원
// ------------------------------------------------------

export function rawColumnKeyOf(
  item: Pick<MatrixItemInput, 'rawItemName' | 'rawPackaging' | 'packageType' | 'unitWeightKg'>,
): string {
  return `${item.rawItemName}|${item.rawPackaging ?? ''}|${item.packageType}|${item.unitWeightKg ?? ''}`
}

/**
 * 열 순서 = **매트릭스 화면 순서**(사용자 결정 2026-09-28 — 「순서 자체보다 규칙이 있으면 된다」).
 *
 * 🔴 원본 열 순서는 DB만으로 못 되살린다. 한 건 안에서는 품목이 원본 열 순서대로 저장되지만,
 *    택배처럼 수령인마다 1~2품목만 주문하면 열끼리 앞뒤를 알려줄 단서가 거의 없고, 주문 0인
 *    칸은 저장조차 안 된다(2026-09-28 실측: 위상정렬로도 택배 25열이 원본과 달랐다).
 *
 * 원본 열은 자기가 속한 매트릭스 열(SKU — `columnKeyOf`) 자리에 선다. 매트릭스는 품종·도정·포장지
 * 그룹으로 묶으니 같은 품목의 규격들이 이웃한다. 한 SKU 열에 원본 열이 둘이면(표기만 다른 경우)
 * 처음 나온 순. `items`는 id 오름차순이어야 한다.
 */
export function orderRawColumns(items: MatrixItemInput[], matrixColumnKeys: string[]): ExportColumn[] {
  const position = new Map(matrixColumnKeys.map((k, i) => [k, i]))
  const cols = new Map<string, { col: ExportColumn; pos: number }>()
  for (const item of items) {
    const key = rawColumnKeyOf(item)
    if (cols.has(key)) continue
    cols.set(key, {
      col: {
        key,
        rawItemName: item.rawItemName,
        rawPackaging: item.rawPackaging,
        packageType: item.packageType,
        unitWeightKg: item.unitWeightKg,
      },
      pos: position.get(columnKeyOf(item)) ?? Number.MAX_SAFE_INTEGER,
    })
  }
  // Array.prototype.sort는 안정 정렬 — 같은 자리면 처음 나온 순이 유지된다
  return [...cols.values()].sort((a, b) => a.pos - b.pos).map((c) => c.col)
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
// 칸 상태
// ------------------------------------------------------

type CellAgg = { ordered: number; allocated: number; itemIds: number[] }

const cellKeyOf = (orderId: number, colKey: string) => `${orderId}#${colKey}`

/** (건, 원본 열)마다 주문·차감을 모은다 — 같은 칸에 품목이 둘일 수 있다 */
function aggregateCells(items: MatrixItemInput[]): Map<string, CellAgg> {
  const cells = new Map<string, CellAgg>()
  for (const item of items) {
    const k = cellKeyOf(item.orderId, rawColumnKeyOf(item))
    const c = cells.get(k) ?? { ordered: 0, allocated: 0, itemIds: [] }
    c.ordered += item.orderedQty
    c.allocated += item.allocatedQty
    c.itemIds.push(item.id)
    cells.set(k, c)
  }
  return cells
}

/** 품목 id → 매트릭스 셀 상태. 매칭실패·재고부족 판정을 빌려오는 통로 */
function matrixStatusByItem(matrix: Matrix): Map<number, CellStatus> {
  const out = new Map<number, CellStatus>()
  for (const row of matrix.rows) {
    for (const cell of Object.values(row.cells)) {
      for (const id of cell.itemIds) out.set(id, cell.status)
    }
  }
  return out
}

/**
 * 원본 칸 상태. 다 나갔으면 완료, 아니면 매트릭스가 매칭실패·재고부족이라 한 것을 따르고,
 * 그 밖엔 이 칸 자신의 부분·대기.
 * (원본 두 열이 한 SKU 칸으로 합쳐지면 매트릭스 상태는 합친 값이라 부분·대기는 여기서 다시 낸다)
 */
export function exportCellStatus(agg: CellAgg, matrixStatus: CellStatus | undefined): CellStatus {
  if (agg.allocated >= agg.ordered) return 'COMPLETED'
  if (matrixStatus === 'UNMATCHED' || matrixStatus === 'SHORTAGE') return matrixStatus
  return computeLineStatus(agg.ordered, agg.allocated)
}

// ------------------------------------------------------
// 시트 조립
// ------------------------------------------------------

const HEADER_LABELS = ['농가명', '로트번호', '포장지', '중량', '소계'] as const

/** 중량 줄 — 톤백은 규격이 '톤백'이라 자루중량을 적는다(원본도 `1,000kg`) */
function weightLabelOf(col: ExportColumn): string {
  if (col.unitWeightKg === null) return col.packageType
  return `${col.unitWeightKg.toLocaleString('en-US')}kg`
}

type Context = {
  input: ExportSheetInput
  columns: ExportColumn[]
  nameCols: number
  cells: Map<string, CellAgg>
  matrixStatus: Map<number, CellStatus>
  allocsByItem: Map<number, ExportAllocation[]>
}

function buildContext(input: ExportSheetInput): Context {
  const { orders, items } = input.matrix
  const allocsByItem = new Map<number, ExportAllocation[]>()
  for (const a of input.allocations) {
    const list = allocsByItem.get(a.itemId)
    if (list) list.push(a)
    else allocsByItem.set(a.itemId, [a])
  }
  // 매트릭스는 한 번만 세운다 — 열 순서와 칸 상태를 둘 다 여기서 빌린다
  const matrix = buildMatrix(input.matrix)
  return {
    input,
    columns: orderRawColumns(items, matrix.columns.map((c) => c.key)),
    // 모든 건의 수령인이 발주처와 같으면 = 수령인 칸이 없는 양식(시아스형 #32) → 이름 칸 하나
    nameCols: orders.length > 0 && orders.every((o) => o.recipient === o.vendor) ? 1 : 2,
    cells: aggregateCells(items),
    matrixStatus: matrixStatusByItem(matrix),
    allocsByItem,
  }
}

function allocsOf(ctx: Context, itemIds: number[]): ExportAllocation[] {
  return itemIds.flatMap((id) => ctx.allocsByItem.get(id) ?? [])
}

/** 머리글 6줄(제목·농가명·로트번호·포장지·중량·소계)과 열별 로트 요약 */
function buildHeader(ctx: Context): { rows: (string | number | null)[][]; lotsByCol: LotEntry[][] } {
  const pad = (first: string) => (ctx.nameCols === 2 ? [first, null] : [first])
  const colItems = ctx.columns.map((col) =>
    ctx.input.matrix.items.filter((i) => rawColumnKeyOf(i) === col.key),
  )
  const lotsByCol = colItems.map((its) => summarizeLots(allocsOf(ctx, its.map((i) => i.id))))

  const rows: (string | number | null)[][] = [
    [...pad(ctx.input.title), ...ctx.columns.map((c) => c.rawItemName)],
    [...pad(HEADER_LABELS[0]), ...lotsByCol.map((l) => headerLabelOf(l, (e) => e.farmerLabel))],
    [...pad(HEADER_LABELS[1]), ...lotsByCol.map((l) => headerLabelOf(l, (e) => e.lotLabel))],
    [...pad(HEADER_LABELS[2]), ...ctx.columns.map((c) => c.rawPackaging ?? '')],
    [...pad(HEADER_LABELS[3]), ...ctx.columns.map(weightLabelOf)],
    [...pad(HEADER_LABELS[4]), ...colItems.map((its) => its.reduce((s, i) => s + i.orderedQty, 0))],
  ]
  if (ctx.nameCols === 2) rows.push(['(발주처)', '(수령인)', ...ctx.columns.map(() => null)])
  return { rows, lotsByCol }
}

/** 칸 메모 — 미완료면 상태 한 줄, 로트가 섞인 열이면 이 칸의 로트 내역 */
function memoOf(ctx: Context, agg: CellAgg, status: CellStatus, columnMixed: boolean): string | null {
  const lines: string[] = []
  if (status !== 'COMPLETED') {
    lines.push(`${ctx.input.statusLabel(status)} — 차감 ${agg.allocated} / 주문 ${agg.ordered}`)
  }
  if (columnMixed) {
    const lots = summarizeLots(allocsOf(ctx, agg.itemIds))
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

  ctx.input.matrix.orders.forEach((order, i) => {
    const names = ctx.nameCols === 2 ? [order.vendor, order.recipient] : [order.vendor]
    const values = ctx.columns.map((col, c) => {
      const agg = ctx.cells.get(cellKeyOf(order.id, col.key))
      if (!agg) return null
      const status = exportCellStatus(agg, ctx.matrixStatus.get(agg.itemIds[0]))
      if (status !== 'COMPLETED') incompleteCount++
      const text = memoOf(ctx, agg, status, lotsByCol[c].length > 1)
      if (text) memos.push({ row: startRow + i, col: ctx.nameCols + c, text })
      return agg.ordered
    })
    rows.push([...names, ...values])
  })
  return { rows, memos, incompleteCount }
}

/** 병합 — 머리글 라벨 칸(A:B)과 같은 품목명이 이어진 1행 */
function buildMerges(ctx: Context): XLSX.Range[] {
  const merges: XLSX.Range[] = []
  if (ctx.nameCols === 2) {
    for (let r = 0; r <= HEADER_LABELS.length; r++) merges.push({ s: { r, c: 0 }, e: { r, c: 1 } })
  }
  let start = 0
  for (let c = 1; c <= ctx.columns.length; c++) {
    const same = c < ctx.columns.length && ctx.columns[c].rawItemName === ctx.columns[start].rawItemName
    if (same) continue
    if (c - 1 > start) {
      merges.push({ s: { r: 0, c: ctx.nameCols + start }, e: { r: 0, c: ctx.nameCols + c - 1 } })
    }
    start = c
  }
  return merges
}

/**
 * 열 폭 — 농가명·로트번호 줄 글자 수에 맞춘다. 로트번호가 23자(`251119-11-15103885-4113`)라
 * 고정 폭이면 잘려 보인다. 무료판 `xlsx`는 줄바꿈 스타일을 못 써서 폭으로 푼다.
 */
function columnWidths(headerRows: (string | number | null)[][], nameCols: number): number[] {
  const [, farmerRow, lotRow] = headerRows
  return farmerRow.slice(nameCols).map((farmer, i) => {
    const longest = Math.max(String(farmer ?? '').length, String(lotRow[nameCols + i] ?? '').length)
    return Math.min(28, Math.max(10, longest + 2))
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
