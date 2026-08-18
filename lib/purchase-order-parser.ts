// 발주서 엑셀(2차원 피벗 매트릭스) 파서 — 순수 모듈('use server' 아님)
//
// 계획서 §2.2 통일 양식(결정 #26) 기준:
//   시트명 = `채널_YYMMDD` (고정 prefix 4종 이마트/택배/서울급식/해남급식, 그 외 = 기업별)
//   1행 품종+도정명 · 2행 포장지 · 3행 중량 · 4행 라벨(A=발주처 B=수령인) · 5행~ 데이터
//   가로축(열) = 제품규격, 세로축(행) = 발주처/수령인, 셀 값 = 주문 수량.
//
// SheetJS의 sheet_to_json은 다줄 헤더·병합셀·피벗을 못 다룬다
// → raw 셀 좌표 접근 + !merges 병합 펼치기로 직접 파싱.
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
  vendor: z.string().min(1), // 발주처 (이마트='이마트'·해남급식='해남급식' 고정)
  recipient: z.string().min(1), // 수령인. 빈칸이면 파서가 vendor를 복사(택배·기업별 #26)
  items: z.array(ParsedItemSchema),
})

// 채널 5종(#26) — 스키마 enum PurchaseChannel과 동일
const ChannelSchema = z.enum([
  'DELIVERY',
  'EMART',
  'MEAL_SEOUL',
  'MEAL_HAENAM',
  'CORPORATE',
])

const ParsedSheetSchema = z.object({
  sheetName: z.string(),
  channel: ChannelSchema,
  orderDate: z.string().nullable(), // 시트명 끝 YYMMDD → 'yyyy-mm-dd'
  orders: z.array(ParsedOrderSchema),
})

const SkippedSheetSchema = z.object({
  sheetName: z.string(),
  reason: z.string(), // 미인식 사유(오타 방지용 경고 — 작성안내 5번)
})

export const ParsedUploadSchema = z.object({
  fileName: z.string(),
  channel: ChannelSchema.nullable(), // 파일 대표 채널. 혼합·없음이면 null
  channels: z.array(ChannelSchema), // 실제 등장한 채널(중복 제거)
  orderDate: z.string().nullable(), // 대표 발주일 = 가장 이른 시트 날짜
  sheets: z.array(ParsedSheetSchema),
  skipped: z.array(SkippedSheetSchema),
})

export type PurchaseChannel = z.infer<typeof ChannelSchema>

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

const FIRST_SPEC_COL = 2 // C열부터 규격(A열=발주처, B열=수령인)

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
// 통일 양식은 행 순서가 고정이지만, 위에 빈 행/제목이 끼어도 견디도록 라벨로 찾는다.
// ------------------------------------------------------
type HeaderLayout = {
  itemNameRow: number // 품종+도정명 행(포장지 행 바로 위)
  packagingRow: number // 포장지 행
  weightRow: number // 중량 행
  dataStartRow: number // 데이터(발주처/수령인) 시작 행
}

function detectHeaderLayout(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
): HeaderLayout | null {
  let packagingRow = -1
  let weightRow = -1
  let vendorLabelRow = -1 // A열 '발주처' 라벨 행(B열 '수령인')

  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = normalizeCell(getCellRaw(ws, r, 0))
    if (a === '포장지' && packagingRow < 0) packagingRow = r
    else if (a === '중량' && weightRow < 0) weightRow = r
    else if (a === '발주처' && vendorLabelRow < 0) vendorLabelRow = r
  }

  // 세 라벨이 모두 있어야 발주서 시트. 하나라도 없으면 미인식(작성안내 시트 등).
  if (packagingRow < 0 || weightRow < 0 || vendorLabelRow < 0) return null
  const itemNameRow = packagingRow - 1
  if (itemNameRow < range.s.r) return null

  return {
    itemNameRow,
    packagingRow,
    weightRow,
    dataStartRow: vendorLabelRow + 1,
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
    // 수령인 빈칸 = '발주처와 동일'(택배·기업별 #26) → 파서가 복사한다.
    const recipient = normalizeCell(getCellRaw(ws, r, 1)) || vendor
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

// ------------------------------------------------------
// 시트명 해석 — `채널_YYMMDD` (#26)
// ------------------------------------------------------

/** 고정 채널 prefix 4종. 그 외 시트명(거래처명_YYMMDD)은 전부 기업별. */
const FIXED_CHANNEL_PREFIX: Record<string, PurchaseChannel> = {
  이마트: 'EMART',
  택배: 'DELIVERY',
  서울급식: 'MEAL_SEOUL',
  해남급식: 'MEAL_HAENAM',
}

const SHEET_NAME_RE = /^(.+)_(\d{6})$/ // 거래처명에 밑줄이 있어도 끝 6자리 날짜 기준

/** YYMMDD → 'yyyy-mm-dd'. 형식이 맞지 않으면 null. */
function parseYYMMDD(s: string): string | null {
  const yy = Number(s.slice(0, 2))
  const mm = Number(s.slice(2, 4))
  const dd = Number(s.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const iso = `20${String(yy).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== dd) return null // 2/31 등 존재하지 않는 날짜
  return iso
}

export type SheetNameInfo = {
  channel: PurchaseChannel
  orderDate: string | null
  label: string // prefix 부분(기업별은 거래처명)
}

/**
 * 시트명 `채널_YYMMDD`를 해석. 형식이 아니면 null(= 미인식 시트, 작성안내 5번).
 * 고정 prefix 4종 외에는 기업별(CORPORATE)로 분류한다.
 */
export function parseSheetName(sheetName: string): SheetNameInfo | null {
  const m = SHEET_NAME_RE.exec(sheetName.trim())
  if (!m) return null
  const label = m[1].trim()
  if (!label) return null
  return {
    channel: FIXED_CHANNEL_PREFIX[label] ?? 'CORPORATE',
    orderDate: parseYYMMDD(m[2]),
    label,
  }
}

// ------------------------------------------------------
// 시트 1개 파싱
// ------------------------------------------------------
type SheetOutcome =
  | { ok: true; sheet: ParsedSheet }
  | { ok: false; reason: string }

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): SheetOutcome {
  const info = parseSheetName(sheetName)
  if (!info) {
    return { ok: false, reason: '시트명이 `채널_YYMMDD` 형식이 아닙니다.' }
  }
  if (!ws['!ref']) return { ok: false, reason: '빈 시트입니다.' }
  const range = XLSX.utils.decode_range(ws['!ref'])
  const merges = ws['!merges'] ?? []

  const layout = detectHeaderLayout(ws, range)
  if (!layout) {
    return { ok: false, reason: '헤더(포장지·중량·발주처 라벨)를 찾지 못했습니다.' }
  }

  const specs = extractSpecColumns(ws, merges, range, layout)
  const orders = extractOrders(ws, range, layout, specs)

  return {
    ok: true,
    sheet: {
      sheetName,
      channel: info.channel,
      orderDate: info.orderDate,
      orders,
    },
  }
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
  const skipped: { sheetName: string; reason: string }[] = []
  for (const name of wb.SheetNames) {
    const outcome = parseSheet(wb.Sheets[name], name)
    if (outcome.ok) sheets.push(outcome.sheet)
    else skipped.push({ sheetName: name, reason: outcome.reason })
  }

  // 파일 1개 = 채널 1개(실무 확정). 섞이면 대표 채널을 비워 호출측이 거부하게 한다.
  const channels = [...new Set(sheets.map((s) => s.channel))]
  const dates = sheets
    .map((s) => s.orderDate)
    .filter((d): d is string => d !== null)
    .sort()

  // 시스템 경계: 출력 형태 검증
  return ParsedUploadSchema.parse({
    fileName,
    channel: channels.length === 1 ? channels[0] : null,
    channels,
    orderDate: dates[0] ?? null,
    sheets,
    skipped,
  })
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
  channel: PurchaseChannel
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
    const info = parseSheetName(name)
    if (!info) continue
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
    sheets.push({ sheetName: name, channel: info.channel, specs })
  }
  return { fileName, sheets }
}
