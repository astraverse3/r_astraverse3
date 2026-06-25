// 발주서 엑셀(2차원 피벗 매트릭스) 파서 — 순수 모듈('use server' 아님)
//
// 계획서 §8.2.2: SheetJS의 sheet_to_json은 4줄 헤더·병합셀·피벗을 못 다룸
// → raw 셀 좌표 접근 + !merges 병합 펼치기로 직접 파싱.
//
// 가로축(열) = 제품규격(품목명/포장지/중량 헤더), 세로축(행) = 발주처/수령인.
// 셀 값 = 주문 수량. 시트명에 '이마트' 포함 여부로 channel 판별.
//
// 파서는 DB·매칭을 하지 않는다. 순수 DTO(ParsedUpload)만 반환하고
// 출력 형태를 Zod로 검증(시스템 경계). 적재·매칭은 Server Action(§8.3)의 책임.

import * as XLSX from 'xlsx'
import { z } from 'zod'

// ------------------------------------------------------
// 출력 DTO + Zod 스키마 (시스템 경계 검증)
// ------------------------------------------------------
const ParsedItemSchema = z.object({
  rawItemName: z.string().min(1), // 원본 품목명 '유기농 가바백미' (CRLF 정규화됨)
  packageType: z.string().min(1), // 규격(중량) '10kg'
  rawPackaging: z.string().nullable(), // 포장지 원본('자연주의'). 빈칸이면 null → 기본 포장지(#21)
  orderedQty: z.number().int().positive(), // 주문 수량(셀 값, 양수만)
})

const ParsedOrderSchema = z.object({
  vendor: z.string().min(1), // 발주처 (이마트 시트는 '이마트' 고정)
  recipient: z.string(), // 수령인 (이마트 시트는 지점). 택배 일부는 빈 값 허용
  items: z.array(ParsedItemSchema),
})

const ParsedSheetSchema = z.object({
  sheetName: z.string(),
  channel: z.enum(['DELIVERY', 'EMART']),
  orders: z.array(ParsedOrderSchema),
})

export const ParsedUploadSchema = z.object({
  fileName: z.string(),
  sheets: z.array(ParsedSheetSchema),
})

export type ParsedItem = z.infer<typeof ParsedItemSchema>
export type ParsedOrder = z.infer<typeof ParsedOrderSchema>
export type ParsedSheet = z.infer<typeof ParsedSheetSchema>
export type ParsedUpload = z.infer<typeof ParsedUploadSchema>

// 규격 열 1개 = 한 제품(품목명+포장지+중량) (내부용)
type SpecColumn = {
  col: number
  rawItemName: string
  rawPackaging: string | null
  packageType: string
}

const FIRST_SPEC_COL = 2 // C열부터 규격(A=발주처, B=수령인 / 이마트 A='이마트' 고정)

// ------------------------------------------------------
// 셀 접근 헬퍼
// ------------------------------------------------------

/** CRLF·다중공백을 단일 공백으로 정리하고 trim (§2.1 — 줄바꿈 CRLF). */
export function normalizeCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function getCellRaw(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  const cell = ws[XLSX.utils.encode_cell({ r, c })]
  return cell ? cell.v : undefined
}

/** (r,c)가 어떤 병합 범위 안이면 그 범위의 시작 좌표를 반환. */
function findMergeOrigin(
  merges: XLSX.Range[],
  r: number,
  c: number,
): { r: number; c: number } | null {
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) return m.s
  }
  return null
}

/** 직접 값이 없으면 병합 시작셀 값으로 대체(병합셀 펼치기). */
function getCellMerged(
  ws: XLSX.WorkSheet,
  merges: XLSX.Range[],
  r: number,
  c: number,
): unknown {
  const direct = getCellRaw(ws, r, c)
  if (direct !== undefined && direct !== '') return direct
  const origin = findMergeOrigin(merges, r, c)
  if (origin) return getCellRaw(ws, origin.r, origin.c)
  return undefined
}

// ------------------------------------------------------
// 헤더 행 위치 자동 탐지 (A열 라벨 기반 — 행 인덱스 하드코딩 회피 §2.1)
// ------------------------------------------------------
type HeaderLayout = {
  itemNameRow: number // 품목명 행(농가명 행 바로 위)
  packagingRow: number // 포장지 행
  weightRow: number // 중량 행
  dataStartRow: number // 데이터(발주처/수령인) 시작 행
}

function detectHeaderLayout(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
): HeaderLayout | null {
  let farmerRow = -1
  let packagingRow = -1
  let weightRow = -1
  let subtotalRow = -1
  let vendorHeaderRow = -1 // 택배의 '(발주처)' 헤더 행(이마트엔 없음)

  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = normalizeCell(getCellRaw(ws, r, 0))
    if (a === '농가명') farmerRow = r
    else if (a === '포장지') packagingRow = r
    else if (a === '중량') weightRow = r
    else if (a.includes('소계')) subtotalRow = r
    else if (a.includes('발주처') || normalizeCell(getCellRaw(ws, r, 1)).includes('수령인'))
      vendorHeaderRow = r
  }

  if (farmerRow < 0 || packagingRow < 0 || weightRow < 0) return null

  // 데이터 시작: 택배는 '(발주처)' 헤더 다음 행, 이마트는 소계행 다음 행부터 바로 데이터.
  const afterHeaders = vendorHeaderRow >= 0 ? vendorHeaderRow + 1 : subtotalRow + 1
  return {
    itemNameRow: farmerRow - 1,
    packagingRow,
    weightRow,
    dataStartRow: afterHeaders,
  }
}

// ------------------------------------------------------
// 규격 열 펼치기 (품목명 병합 전파 + 포장지 빈칸→null)
// ------------------------------------------------------
function extractSpecColumns(
  ws: XLSX.WorkSheet,
  merges: XLSX.Range[],
  range: XLSX.Range,
  layout: HeaderLayout,
): SpecColumn[] {
  const specs: SpecColumn[] = []
  for (let c = FIRST_SPEC_COL; c <= range.e.c; c++) {
    const rawItemName = normalizeCell(
      getCellMerged(ws, merges, layout.itemNameRow, c),
    )
    const packageType = normalizeCell(getCellRaw(ws, layout.weightRow, c))
    // 품목명·중량 둘 다 있어야 유효 규격 열(소계 전용 열 등 제외).
    if (!rawItemName || !packageType) continue
    const pkg = normalizeCell(getCellMerged(ws, merges, layout.packagingRow, c))
    specs.push({
      col: c,
      rawItemName,
      rawPackaging: pkg || null,
      packageType,
    })
  }
  return specs
}

// ------------------------------------------------------
// 데이터 행 순회 → PurchaseOrder DTO
// ------------------------------------------------------
function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function extractOrders(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
  layout: HeaderLayout,
  specs: SpecColumn[],
): ParsedOrder[] {
  const orders: ParsedOrder[] = []
  for (let r = layout.dataStartRow; r <= range.e.r; r++) {
    const vendor = normalizeCell(getCellRaw(ws, r, 0))
    const recipient = normalizeCell(getCellRaw(ws, r, 1))
    if (!vendor) continue // 발주처 없는 빈 행 skip

    const items: ParsedItem[] = []
    for (const spec of specs) {
      const qty = toNumber(getCellRaw(ws, r, spec.col))
      if (qty > 0) {
        items.push({
          rawItemName: spec.rawItemName,
          packageType: spec.packageType,
          rawPackaging: spec.rawPackaging,
          orderedQty: qty,
        })
      }
    }
    if (items.length > 0) orders.push({ vendor, recipient, items })
  }
  return orders
}

function channelOf(sheetName: string): ParsedSheet['channel'] {
  return sheetName.includes('이마트') ? 'EMART' : 'DELIVERY'
}

// ------------------------------------------------------
// 시트 1개 파싱
// ------------------------------------------------------
function parseSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
): ParsedSheet | null {
  if (!ws['!ref']) return null
  const range = XLSX.utils.decode_range(ws['!ref'])
  const merges = ws['!merges'] ?? []

  const layout = detectHeaderLayout(ws, range)
  if (!layout) return null // 헤더 라벨 못 찾음 → 발주서 시트 아님(skip)

  const specs = extractSpecColumns(ws, merges, range, layout)
  const orders = extractOrders(ws, range, layout, specs)

  return { sheetName, channel: channelOf(sheetName), orders }
}

// ------------------------------------------------------
// 엔트리 — 워크북(buffer) → ParsedUpload
// ------------------------------------------------------

/**
 * 발주서 엑셀 buffer를 파싱해 ParsedUpload DTO를 반환.
 * 파일 검증(크기·확장자)은 호출측(Server Action)이 validateExcelUpload로 먼저 수행.
 * buffer는 Node Buffer / ArrayBuffer 모두 허용(브라우저 File.arrayBuffer 대응).
 */
export function parsePurchaseOrder(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  fileName: string,
): ParsedUpload {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheets: ParsedSheet[] = []
  for (const name of wb.SheetNames) {
    const parsed = parseSheet(wb.Sheets[name], name)
    if (parsed) sheets.push(parsed)
  }
  // 시스템 경계: 출력 형태 검증
  return ParsedUploadSchema.parse({ fileName, sheets })
}

// ------------------------------------------------------
// 규격 카탈로그 — 헤더(품목명·규격·포장지)만으로 규격 종류 추출
// (주문 데이터 없는 빈 템플릿에서도 동작. 업로드 매칭 미리보기·테스트용)
// ------------------------------------------------------
export type SpecCatalogEntry = {
  rawItemName: string
  packageType: string
  rawPackaging: string | null
}
export type SpecCatalogSheet = {
  sheetName: string
  channel: ParsedSheet['channel']
  specs: SpecCatalogEntry[]
}
export type SpecCatalog = {
  fileName: string
  sheets: SpecCatalogSheet[]
}

export function parseSpecCatalog(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  fileName: string,
): SpecCatalog {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheets: SpecCatalogSheet[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])
    const merges = ws['!merges'] ?? []
    const layout = detectHeaderLayout(ws, range)
    if (!layout) continue
    const specs = extractSpecColumns(ws, merges, range, layout).map(
      ({ rawItemName, packageType, rawPackaging }) => ({
        rawItemName,
        packageType,
        rawPackaging,
      }),
    )
    sheets.push({ sheetName: name, channel: channelOf(name), specs })
  }
  return { fileName, sheets }
}
