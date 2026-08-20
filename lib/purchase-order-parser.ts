// 발주서 엑셀(2차원 피벗 매트릭스) 파서 — 순수 모듈('use server' 아님)
//
// 계획서 `plan-발주서판매처리-양식통일.md` 결정 #27~#34 기준:
//   1행 날짜/제목(A) + 품종·도정명(C~) · 2행 포장지 · 3행 중량 · 4행 소계 ·
//   5행 라벨 `(발주처)`|`(수령인)` · 6행~ 데이터
//   가로축(열) = 제품규격, 세로축(행) = 발주처/수령인, 셀 값 = 주문 수량.
//
// 묶음 단위 = 「시트」(#30). 시트 인식 판정은 헤더 구조(포장지·중량 라벨)로만 하고,
// 채널·발주일은 시트명·제목에서 「추측」만 한다(#31) — 확정은 화면에서 사람이 한다.
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
  rawItemName: z.string().min(1), // 원본 품목명 '유기농 가바백미' (CRLF·빈괄호 정규화됨)
  packageType: z.string().min(1), // 규격(중량) '10kg'. 톤백류는 '톤백'으로 치환(#34)
  rawPackaging: z.string().nullable(), // 포장지 원본('자연주의'). 빈칸이면 null → 기본 포장지(#21)
  orderedQty: z.number().int().positive(), // 주문 수량(양수만 — 음수는 경고 후 제외 #28)
  unitWeightKg: z.number().positive().nullable(), // 톤백류 요구 자루중량(#34). 일반 규격은 null
})

const ParsedOrderSchema = z.object({
  vendor: z.string().min(1), // 발주처 (이마트='이마트'·해남급식='해남급식' 고정)
  recipient: z.string().min(1), // 수령인. 빈칸·라벨행 없음이면 파서가 vendor를 복사(#26·#32)
  items: z.array(ParsedItemSchema),
})

// 채널 5종 — 스키마 enum PurchaseChannel과 동일
const ChannelSchema = z.enum([
  'DELIVERY',
  'EMART',
  'MEAL_SEOUL',
  'MEAL_HAENAM',
  'CORPORATE',
])

const ParsedSheetSchema = z.object({
  sheetName: z.string(),
  suggestedChannel: ChannelSchema.nullable(), // 시트명 prefix 추측. 못 뽑으면 화면에서 지정(#31)
  suggestedOrderDate: z.string().nullable(), // 'yyyy-mm-dd'. 시트명 → 제목 순으로 추측(#31)
  orders: z.array(ParsedOrderSchema),
  warnings: z.array(z.string()), // 음수·소계 불일치·단위 누락 등 (조용한 누락 금지 #28)
})

const SkippedSheetSchema = z.object({
  sheetName: z.string(),
  reason: z.string(), // 미인식 사유(학교별 시트 등 — 발주서 양식 아님)
})

export const ParsedUploadSchema = z.object({
  fileName: z.string(),
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
  colLabel: string // 'C' — 경고 메시지용
  rawItemName: string
  rawPackaging: string | null
  packageType: string
  unitWeightKg: number | null // 톤백류만(#34)
}

const TONBAG = '톤백' // 포장지가 톤백이면 규격을 '톤백'으로 치환하고 중량은 분리(#34)

// ------------------------------------------------------
// 문자열 정규화
// ------------------------------------------------------

/** CRLF·다중공백을 단일 공백으로 정리하고 trim (§2.1 — 줄바꿈 CRLF). */
export function normalizeCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** A열 라벨 비교용 — 괄호·공백 제거. `(발주처)` = `발주처` (#27). */
export function normalizeLabel(v: unknown): string {
  return normalizeCell(v).replace(/[()（）\s]/g, '')
}

/**
 * 품목명 셀 정규화 — 농가명 기입란 잔재인 빈 괄호를 제거한다(#27).
 * `유기농⏎백미⏎천지향5세⏎(     )` → `유기농 백미 천지향5세`
 * (매처의 `normalizeItemName`은 품종 토큰 추출이라 역할이 다르다.)
 */
export function stripEmptyParens(v: unknown): string {
  return normalizeCell(v)
    .replace(/[(（]\s*[)）]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 공백 무시 비교용(포장지 `자연⏎주의` = `자연주의`). */
function stripSpaces(s: string): string {
  return s.replace(/\s/g, '')
}

/**
 * 규격(중량) 정규화 — 공백·콤마 제거(#33).
 * `1 kg`→`1kg` · `1,000kg`→`1000kg` · `420g`→`420g`
 * 단위(kg/g)가 붙어 있으면 kg 환산값도 함께 돌려준다(단위 없으면 weightKg=null → 경고).
 */
export function normalizeSpec(raw: unknown): { spec: string; weightKg: number | null } {
  const spec = normalizeCell(raw).replace(/[\s,]/g, '')
  const m = /^([\d.]+)(kg|g)$/i.exec(spec)
  if (!m) return { spec, weightKg: null }
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return { spec, weightKg: null }
  return { spec, weightKg: m[2].toLowerCase() === 'kg' ? n : n / 1000 }
}

// ------------------------------------------------------
// 셀 접근 헬퍼
// ------------------------------------------------------
function getCellRaw(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  const cell = ws[XLSX.utils.encode_cell({ r, c })]
  return cell ? cell.v : undefined
}

/**
 * 표시 텍스트(`cell.w`) 우선 읽기 — 단위가 셀 서식에 든 경우 대응(#33).
 * 서울급식 중량 셀은 값 `1` + 서식 `0\ "kg"` → w=`1 kg`.
 */
function getCellText(ws: XLSX.WorkSheet, r: number, c: number): string {
  const cell = ws[XLSX.utils.encode_cell({ r, c })]
  if (!cell) return ''
  const w = cell.w !== undefined ? normalizeCell(cell.w) : ''
  return w || normalizeCell(cell.v)
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

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

// ------------------------------------------------------
// 헤더 행 위치 자동 탐지 (A열 라벨 기반 — 행 인덱스 하드코딩 회피 §2.1)
// 필수 = 포장지·중량. 소계·발주처는 optional(#32 시아스형은 라벨 행이 없다).
// ------------------------------------------------------
type HeaderLayout = {
  itemNameRow: number // 품종+도정명 행(포장지 행 바로 위)
  packagingRow: number
  weightRow: number
  subtotalRow: number | null // 소계 행(#29 검증용). 구 템플릿엔 없다
  hasVendorLabel: boolean // false면 수령인=발주처 복사(#32)
  dataStartRow: number
}

function detectHeaderLayout(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
): HeaderLayout | null {
  let packagingRow = -1
  let weightRow = -1
  let subtotalRow = -1
  let vendorLabelRow = -1

  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = normalizeLabel(getCellRaw(ws, r, 0))
    if (!a) continue
    if (a === '포장지' && packagingRow < 0) packagingRow = r
    else if (a === '중량' && weightRow < 0) weightRow = r
    else if (a.includes('소계') && subtotalRow < 0) subtotalRow = r // '품목별소계'·'택배소계'도 인정(#27)
    else if (a === '발주처' && vendorLabelRow < 0) vendorLabelRow = r
  }

  // 포장지·중량이 있어야 발주서 시트. 학교별 시트 등은 여기서 걸러진다(#31).
  if (packagingRow < 0 || weightRow < 0) return null
  const itemNameRow = packagingRow - 1
  if (itemNameRow < range.s.r) return null

  // 라벨 행 있으면 그 다음 → 없으면 소계 다음 → 소계도 없으면 중량 다음(#32)
  const dataStartRow =
    vendorLabelRow >= 0
      ? vendorLabelRow + 1
      : subtotalRow >= 0
        ? subtotalRow + 1
        : weightRow + 1

  return {
    itemNameRow,
    packagingRow,
    weightRow,
    subtotalRow: subtotalRow >= 0 ? subtotalRow : null,
    hasVendorLabel: vendorLabelRow >= 0,
    dataStartRow,
  }
}

// ------------------------------------------------------
// 규격 열 펼치기 (#32 규격 열 = 중량 행에 직접 값이 있는 열)
// 다른 채널의 B열은 `중량` 라벨의 A:B 병합에 속해 직접 값이 없으므로 자동 제외되고,
// 라벨 행이 없는 시아스형은 B열부터 규격으로 잡힌다.
// ------------------------------------------------------
function extractSpecColumns(
  ws: XLSX.WorkSheet,
  merges: XLSX.Range[],
  range: XLSX.Range,
  layout: HeaderLayout,
  warnings: string[],
): SpecColumn[] {
  const specs: SpecColumn[] = []
  for (let c = Math.max(1, range.s.c); c <= range.e.c; c++) {
    const rawWeight = getCellText(ws, layout.weightRow, c) // 직접 값만(병합 펼치기 금지 #29)
    if (!rawWeight) continue
    const rawItemName = stripEmptyParens(
      getCellMerged(ws, merges, layout.itemNameRow, c),
    )
    if (!rawItemName) continue

    const colLabel = XLSX.utils.encode_col(c)
    const pkg = normalizeCell(getCellMerged(ws, merges, layout.packagingRow, c))
    const { spec, weightKg } = normalizeSpec(rawWeight)
    if (!spec) continue
    if (weightKg === null) {
      warnings.push(
        `${colLabel}열 규격 "${spec}"에 단위(kg·g)가 없습니다 — 제품 매칭에 실패할 수 있습니다.`,
      )
    }

    // 톤백류: 규격은 '톤백'으로 치환하고 발주 중량은 unitWeightKg로 분리(#34)
    const isTonbag = stripSpaces(pkg) === TONBAG
    specs.push({
      col: c,
      colLabel,
      rawItemName,
      rawPackaging: pkg || null,
      packageType: isTonbag ? TONBAG : spec,
      unitWeightKg: isTonbag ? weightKg : null,
    })
  }
  return specs
}

// ------------------------------------------------------
// 데이터 행 순회 → ParsedOrder
// ------------------------------------------------------

/** 발주처 자리에 오면 데이터가 아닌 라벨(소계·합계 행). */
function isSummaryLabel(label: string): boolean {
  return label.includes('소계') || label.includes('합계')
}

/**
 * A·B가 비었는데 규격 열에 텍스트가 있으면 = 아래는 별도 표(이마트 시트의 박스 환산표).
 * 여기서 데이터 블록을 끝낸다. 완전 빈 행은 종료 신호가 아니다
 * (택배 시트는 빈 행 2줄 뒤에도 실제 발주가 이어진다).
 */
function isForeignBlockHeader(
  ws: XLSX.WorkSheet,
  r: number,
  specs: SpecColumn[],
): boolean {
  return specs.some((s) => {
    const v = getCellRaw(ws, r, s.col)
    return typeof v === 'string' && normalizeCell(v) !== ''
  })
}

/**
 * 데이터 행을 훑어 주문 목록과 「열별 수량 합계」를 함께 만든다.
 * 합계를 열 단위로 세는 이유: 같은 품목명+규격이 여러 열에 나뉜 시트가 있어
 * (택배 하이아미 5kg = I·K열, 시아스 톤백 = B·C열) 품목 기준으로 세면 소계 대조가 깨진다.
 */
function extractOrders(
  ws: XLSX.WorkSheet,
  range: XLSX.Range,
  layout: HeaderLayout,
  specs: SpecColumn[],
  warnings: string[],
): { orders: ParsedOrder[]; sumsByCol: Map<number, number> } {
  const orders: ParsedOrder[] = []
  const sumsByCol = new Map<number, number>(specs.map((s) => [s.col, 0]))
  for (let r = layout.dataStartRow; r <= range.e.r; r++) {
    const vendor = normalizeCell(getCellRaw(ws, r, 0))
    if (!vendor) {
      const recipientOnly = normalizeCell(getCellRaw(ws, r, 1))
      if (!recipientOnly && isForeignBlockHeader(ws, r, specs)) {
        warnings.push(
          `${r + 1}행 아래는 발주 데이터가 아닌 별도 표로 보여 읽지 않았습니다.`,
        )
        break
      }
      continue // 발주처 없는 빈 행 skip
    }
    if (isSummaryLabel(normalizeLabel(vendor))) continue // 표 하단 소계·합계 행

    // 수령인 빈칸·라벨 행 없음 = '발주처와 동일'(#26·#32) → 파서가 복사한다.
    const recipient = layout.hasVendorLabel
      ? normalizeCell(getCellRaw(ws, r, 1)) || vendor
      : vendor

    const items: ParsedItem[] = []
    for (const spec of specs) {
      const qty = toNumber(getCellRaw(ws, r, spec.col))
      if (qty < 0) {
        // 음수 조정 행 금지(#28) — 버리되 조용히 넘어가지 않는다.
        warnings.push(
          `${vendor}/${recipient} — ${spec.rawItemName} ${spec.packageType} 수량 ${qty}(음수)를 무시했습니다. 조정 사유는 비고에 적어주세요.`,
        )
        continue
      }
      if (qty > 0) {
        items.push({
          rawItemName: spec.rawItemName,
          packageType: spec.packageType,
          rawPackaging: spec.rawPackaging,
          orderedQty: qty,
          unitWeightKg: spec.unitWeightKg,
        })
        sumsByCol.set(spec.col, (sumsByCol.get(spec.col) ?? 0) + qty)
      }
    }
    if (items.length > 0) orders.push({ vendor, recipient, items })
  }
  return { orders, sumsByCol }
}

// ------------------------------------------------------
// 소계 검증 (#29) — 순수함수
// ------------------------------------------------------
export type SubtotalRow = { label: string; subtotal: number | null; sum: number }

/**
 * 열별 `Σ(데이터 행 수량)`과 소계 셀을 대조해 다르면 경고 문자열을 만든다(차단 아님).
 * 수식 오류·행 누락·음수 조정 행을 업로드 시점에 드러내는 안전망.
 */
export function verifySubtotals(rows: SubtotalRow[]): string[] {
  return rows
    .filter((r) => r.subtotal !== null && r.subtotal !== r.sum)
    .map(
      (r) => `소계 불일치 — ${r.label}: 시트 소계 ${r.subtotal} ≠ 데이터 합계 ${r.sum}`,
    )
}

function buildSubtotalRows(
  ws: XLSX.WorkSheet,
  layout: HeaderLayout,
  specs: SpecColumn[],
  sumsByCol: Map<number, number>,
): SubtotalRow[] {
  const subtotalRow = layout.subtotalRow
  if (subtotalRow === null) return []
  return specs.map((spec) => {
    // 소계 셀은 4~5행 세로 병합인 시트가 있다 → 병합 시작 행(=소계 행)의 직접 값을 읽는다(#29).
    const cell = getCellRaw(ws, subtotalRow, spec.col)
    return {
      label: `${spec.colLabel}열 ${spec.rawItemName} ${spec.packageType}`,
      subtotal: cell === undefined || cell === '' ? null : toNumber(cell),
      sum: sumsByCol.get(spec.col) ?? 0,
    }
  })
}

// ------------------------------------------------------
// 채널·발주일 추측 (#31) — 확정이 아니라 화면 자동 채움 힌트
// ------------------------------------------------------

/** 고정 채널 prefix 4종. 그 외 `거래처명_YYMMDD` 시트는 기업별로 본다. */
const FIXED_CHANNEL_PREFIX: Record<string, PurchaseChannel> = {
  이마트: 'EMART',
  택배: 'DELIVERY',
  서울급식: 'MEAL_SEOUL',
  해남급식: 'MEAL_HAENAM',
}

const SHEET_NAME_RE = /^(.+)_(\d{6})$/ // 거래처명에 밑줄이 있어도 끝 6자리 날짜 기준

function toISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== day) return null // 2/31 등 존재하지 않는 날짜
  return iso
}

/** YYMMDD → 'yyyy-mm-dd'. 형식이 맞지 않으면 null. */
function parseYYMMDD(s: string): string | null {
  return toISO(
    2000 + Number(s.slice(0, 2)),
    Number(s.slice(2, 4)),
    Number(s.slice(4, 6)),
  )
}

/**
 * 시트명에서 채널을 추측. 고정 prefix 4종이면 확정에 가깝고,
 * `거래처명_YYMMDD` 형식이면 기업별, 둘 다 아니면 null(화면에서 지정 #31).
 */
export function suggestChannel(sheetName: string): PurchaseChannel | null {
  const trimmed = sheetName.trim()
  const m = SHEET_NAME_RE.exec(trimmed)
  const label = (m ? m[1] : trimmed).trim()
  if (!label) return null
  for (const [prefix, channel] of Object.entries(FIXED_CHANNEL_PREFIX)) {
    if (label === prefix || label.startsWith(prefix)) return channel
  }
  return m ? 'CORPORATE' : null
}

/** 1행 A열 제목에서 날짜를 뽑는다. `26/08/19(수)` → 완전, `8/11(화)` → 연도 미상. */
export function parseTitleDate(title: string): {
  iso: string | null
  month: number | null
  day: number | null
} {
  const t = normalizeCell(title)
  const full = /(\d{2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{1,2})/.exec(t)
  if (full) {
    const month = Number(full[2])
    const day = Number(full[3])
    return { iso: toISO(2000 + Number(full[1]), month, day), month, day }
  }
  const short = /(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(?:\D|$)/.exec(t)
  if (short) return { iso: null, month: Number(short[1]), day: Number(short[2]) }
  return { iso: null, month: null, day: null }
}

/**
 * 발주일 추측 — 시트명 `_YYMMDD` → 시트명 `MM.DD`(연도는 제목) → 1행 제목 순(#31).
 * 시트명 날짜와 제목 날짜가 어긋나면 경고를 남긴다(`서울급식_060818` 오타 사례).
 */
export function suggestOrderDate(
  sheetName: string,
  title: string,
): { date: string | null; warning: string | null } {
  const t = parseTitleDate(title)
  const m = SHEET_NAME_RE.exec(sheetName.trim())
  const fromName = m ? parseYYMMDD(m[2]) : null

  if (fromName) {
    if (t.iso && t.iso !== fromName) {
      return {
        date: fromName,
        warning: `시트명 날짜(${fromName})와 제목 날짜(${t.iso})가 다릅니다 — 시트명 오타를 확인해주세요.`,
      }
    }
    // 제목에 연도가 없으면(`8/11(화)`) 월·일만 대조한다.
    if (
      !t.iso &&
      t.month !== null &&
      t.day !== null &&
      (Number(fromName.slice(5, 7)) !== t.month ||
        Number(fromName.slice(8, 10)) !== t.day)
    ) {
      return {
        date: fromName,
        warning: `시트명 날짜(${fromName})와 제목 날짜(${t.month}/${t.day})가 다릅니다 — 확인해주세요.`,
      }
    }
    return { date: fromName, warning: null }
  }

  // `공장동08.21`처럼 MM.DD만 있는 시트명 — 연도는 제목에서 빌려온다.
  const md = /(\d{1,2})\s*\.\s*(\d{1,2})\s*$/.exec(sheetName.trim())
  if (md && t.iso) {
    const iso = toISO(Number(t.iso.slice(0, 4)), Number(md[1]), Number(md[2]))
    if (iso) return { date: iso, warning: null }
  }
  if (t.iso) return { date: t.iso, warning: null }
  return { date: null, warning: null }
}

// ------------------------------------------------------
// 시트 1개 파싱
// ------------------------------------------------------
type SheetOutcome =
  | { ok: true; sheet: ParsedSheet }
  | { ok: false; reason: string }

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): SheetOutcome {
  if (!ws['!ref']) return { ok: false, reason: '빈 시트입니다.' }
  const range = XLSX.utils.decode_range(ws['!ref'])
  const merges = ws['!merges'] ?? []

  const layout = detectHeaderLayout(ws, range)
  if (!layout) {
    return {
      ok: false,
      reason: '발주서 양식이 아닙니다(A열 `포장지`·`중량` 라벨을 찾지 못했습니다).',
    }
  }

  const warnings: string[] = []
  const specs = extractSpecColumns(ws, merges, range, layout, warnings)
  if (specs.length === 0) {
    return { ok: false, reason: '규격(품목명+중량) 열을 찾지 못했습니다.' }
  }
  const { orders, sumsByCol } = extractOrders(ws, range, layout, specs, warnings)
  warnings.push(
    ...verifySubtotals(buildSubtotalRows(ws, layout, specs, sumsByCol)),
  )

  const title = normalizeCell(getCellRaw(ws, range.s.r, 0))
  const { date, warning: dateWarning } = suggestOrderDate(sheetName, title)
  if (dateWarning) warnings.push(dateWarning)

  return {
    ok: true,
    sheet: {
      sheetName,
      suggestedChannel: suggestChannel(sheetName),
      suggestedOrderDate: date,
      orders,
      warnings,
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

  // 시스템 경계: 출력 형태 검증
  return ParsedUploadSchema.parse({ fileName, sheets, skipped })
}

// ------------------------------------------------------
// 규격 카탈로그 — 헤더(품목명·규격·포장지)만으로 규격 종류 추출
// (주문 데이터 없는 빈 템플릿에서도 동작. 업로드 매칭 미리보기·테스트용)
// ------------------------------------------------------
export type SpecCatalogEntry = {
  rawItemName: string
  packageType: string
  rawPackaging: string | null
  unitWeightKg: number | null
}
export type SpecCatalogSheet = {
  sheetName: string
  suggestedChannel: PurchaseChannel | null
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
    const specs = extractSpecColumns(ws, merges, range, layout, []).map(
      ({ rawItemName, packageType, rawPackaging, unitWeightKg }) => ({
        rawItemName,
        packageType,
        rawPackaging,
        unitWeightKg,
      }),
    )
    if (specs.length === 0) continue
    sheets.push({
      sheetName: name,
      suggestedChannel: suggestChannel(name),
      specs,
    })
  }
  return { fileName, sheets }
}
