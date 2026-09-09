// 발주서 매트릭스 피벗 — 'use server' 아님(DB 접근 없음, 테스트 가능)
//
// 계획서 `docs/plan/plan-발주서판매처리-D2매트릭스.md` D2a.
//
//   행 = 수령처 · 열 = 제품규격 · 셀 = 주문수량(+ 차감상태)
//
// 호출부(`app/actions/purchase-order-matrix.ts`)가 배치 조회한 결과를 넣는다.
// 여기서 DB를 만지지 않는 이유는 `lib/purchase-order-allocation.ts`와 같다 —
// 피벗·정렬·상태 파생은 순수 계산이라 단위테스트로 굳혀 둘 수 있다.
//
// 🔴 라인 상태는 `computeLineStatus`를 그대로 쓴다. 셀 상태는 그 위에
// 「매칭실패」·「재고부족」 두 가지를 얹은 것이다 — 판정을 두 벌로 만들지 않는다.

import { computeLineStatus } from './purchase-order-allocation'
import { normalizeSpec } from './purchase-order-parser'

// ------------------------------------------------------
// 입력 — 호출부가 배치 조회해서 넣는다
// ------------------------------------------------------

export type MatrixOrderInput = {
  id: number
  vendor: string
  recipient: string
  /** 정렬(최신순)용. ISO 문자열 */
  createdAt: string
}

export type MatrixItemInput = {
  id: number
  orderId: number
  rawItemName: string
  packageType: string
  rawPackaging: string | null
  orderedQty: number
  /** 톤백류 요구 자루중량 (#34). 일반 규격은 null */
  unitWeightKg: number | null
  /** 매칭 실패면 null (#18) */
  productTypeId: number | null
  /** 이 라인에 붙은 movement.count 합 */
  allocatedQty: number
}

/** 등장한 SKU의 표시용 메타 */
export type MatrixSkuInput = {
  id: number
  varietyName: string
  millingType: string
  packageType: string
  packagingName: string
}

/** productTypeId → 지금 쓸 수 있는 개수 */
export type AvailabilityMap = Record<number, number>

export type BuildMatrixInput = {
  orders: MatrixOrderInput[]
  items: MatrixItemInput[]
  skus: MatrixSkuInput[]
  availability: AvailabilityMap
}

// ------------------------------------------------------
// 출력
// ------------------------------------------------------

/**
 * 셀 상태. `PENDING·PARTIAL·COMPLETED`는 라인 상태 그대로고,
 * `UNMATCHED`(매칭실패)와 `SHORTAGE`(재고부족)만 매트릭스가 얹는다.
 */
export type CellStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'UNMATCHED' | 'SHORTAGE'

export type MatrixCell = {
  /** 같은 (수령처, 열)에 라인이 둘 이상일 수 있다 — 전부 담는다 */
  itemIds: number[]
  orderedQty: number
  allocatedQty: number
  status: CellStatus
  /** 아직 못 채운 개수 */
  remainingQty: number
}

export type MatrixColumn = {
  /** 열 식별자. 매칭된 SKU는 `pt:<id>`, 매칭실패는 원본 조합 키 */
  key: string
  productTypeId: number | null
  /** 화면 머리글 2줄용 */
  title: string
  subtitle: string
  packageType: string
  /** 규격 1개당 kg. 알 수 없으면 null */
  unitWeightKg: number | null
  orderedQty: number
  allocatedQty: number
  /** 이 열의 SKU 가용재고. 매칭실패 열은 null */
  availableQty: number | null
}

export type MatrixRow = {
  orderId: number
  /** 발주처≠수령인일 때만 `발주처 → 수령인` */
  label: string
  vendor: string
  recipient: string
  createdAt: string
  /** 열 key → 셀. 주문이 없는 칸은 키가 없다 */
  cells: Record<string, MatrixCell>
  orderedQty: number
  allocatedQty: number
  /** 주문 중량 합. 규격을 kg로 못 읽는 열은 빠진다 */
  orderedKg: number
  /** 이 행에 손댈 일이 남았는가 — 정렬 「작업필요 우선」의 기준 */
  needsWork: boolean
}

export type Matrix = {
  columns: MatrixColumn[]
  rows: MatrixRow[]
  totals: {
    orderedQty: number
    allocatedQty: number
    orderedKg: number
    /** 손댈 일이 남은 행 수 */
    needsWorkRows: number
  }
}

export type MatrixSort = 'recipient' | 'latest' | 'needsWork'

// ------------------------------------------------------
// 열 키 · 표기
// ------------------------------------------------------

/**
 * 열 식별자. 매칭된 라인은 SKU 하나로 모이고, 매칭실패는 **원본 조합**으로 따로 선다.
 * 실패 라인을 하나로 뭉치면 수동지정할 때 무엇을 지정하는지 알 수 없다.
 */
export function columnKeyOf(item: MatrixItemInput): string {
  if (item.productTypeId !== null) return `pt:${item.productTypeId}`
  return `raw:${item.rawItemName}|${item.packageType}|${item.rawPackaging ?? ''}`
}

/**
 * 행 머리글 — 발주처와 수령인이 다를 때만 `A → B`로 적는다 (택배·기업별은 파서가
 * 빈 수령인에 발주처를 복사해 두므로 대부분 같다).
 */
export function rowLabelOf(vendor: string, recipient: string): string {
  const v = vendor.trim()
  const r = recipient.trim()
  if (!r || v === r) return v
  return `${v} → ${r}`
}

/** 규격 1개당 kg. 톤백은 라인의 요구 자루중량(#34)을 우선한다. */
export function unitWeightOf(packageType: string, unitWeightKg: number | null): number | null {
  if (unitWeightKg !== null && unitWeightKg > 0) return unitWeightKg
  return normalizeSpec(packageType).weightKg
}

// ------------------------------------------------------
// 셀 상태
// ------------------------------------------------------

/**
 * 셀 상태 판정. 순서가 곧 우선순위다.
 *   완료 → 매칭실패 → 재고부족 → 부분/미차감
 *
 * 🔴 **완료를 맨 앞에 둔다.** 다 나간 셀은 매칭이 어떻든 재고가 없든 손댈 일이 없다.
 * 🔴 **매칭실패가 재고부족보다 앞이다.** 무엇을 낼지 모르는데 재고를 논할 수 없다.
 */
export function cellStatusOf(
  orderedQty: number,
  allocatedQty: number,
  productTypeId: number | null,
  availableQty: number | null,
): CellStatus {
  const line = computeLineStatus(orderedQty, allocatedQty)
  if (line === 'COMPLETED') return 'COMPLETED'
  if (productTypeId === null) return 'UNMATCHED'
  const remaining = orderedQty - allocatedQty
  if (availableQty !== null && availableQty < remaining) return 'SHORTAGE'
  return line
}

/** 손댈 일이 남았는가 — 완료만 아니면 남은 것으로 본다. */
const isUnfinished = (s: CellStatus): boolean => s !== 'COMPLETED'

// ------------------------------------------------------
// 피벗
// ------------------------------------------------------

/**
 * 열 목록을 세운다. 등장 순서가 아니라 **규격 무게 내림차순**으로 세운다 —
 * 20kg·10kg처럼 큰 것이 왼쪽에 오는 편이 발주서 원본과 눈이 맞는다.
 * 무게를 못 읽는 열은 뒤로 보내고, 그 안에서는 이름순이다.
 */
function buildColumns(input: BuildMatrixInput): MatrixColumn[] {
  const skuById = new Map(input.skus.map((s) => [s.id, s]))
  const byKey = new Map<string, MatrixColumn>()

  for (const item of input.items) {
    const key = columnKeyOf(item)
    const sku = item.productTypeId !== null ? skuById.get(item.productTypeId) : undefined
    let col = byKey.get(key)
    if (!col) {
      col = {
        key,
        productTypeId: item.productTypeId,
        title: sku ? `${sku.varietyName} ${sku.millingType}` : item.rawItemName,
        subtitle: sku ? `${sku.packageType} · ${sku.packagingName}` : `${item.packageType} · 매칭실패`,
        packageType: sku?.packageType ?? item.packageType,
        unitWeightKg: unitWeightOf(item.packageType, item.unitWeightKg),
        orderedQty: 0,
        allocatedQty: 0,
        availableQty:
          item.productTypeId !== null ? (input.availability[item.productTypeId] ?? 0) : null,
      }
      byKey.set(key, col)
    }
    col.orderedQty += item.orderedQty
    col.allocatedQty += item.allocatedQty
  }

  return [...byKey.values()].sort(compareColumns)
}

/** 규격 무게 내림차순 → 무게 미상은 뒤로 → 이름순 */
function compareColumns(a: MatrixColumn, b: MatrixColumn): number {
  const aw = a.unitWeightKg
  const bw = b.unitWeightKg
  if (aw !== null && bw !== null && aw !== bw) return bw - aw
  if (aw === null && bw !== null) return 1
  if (aw !== null && bw === null) return -1
  return a.title.localeCompare(b.title, 'ko') || a.subtitle.localeCompare(b.subtitle, 'ko')
}

/**
 * 한 행(수령처)의 셀을 채운다.
 * 🔴 상태는 라인마다 내지 않고 **셀 합계가 다 모인 뒤** 한 번에 낸다 —
 * 같은 칸에 라인이 둘이면 합쳐서 봐야 「부분」인지 「완료」인지가 맞다.
 */
function buildRow(
  order: MatrixOrderInput,
  items: MatrixItemInput[],
  colByKey: Map<string, MatrixColumn>,
): MatrixRow {
  const cells: Record<string, MatrixCell> = {}
  const productTypeByKey = new Map<string, number | null>()
  let orderedQty = 0
  let allocatedQty = 0
  let orderedKg = 0

  for (const item of items) {
    const key = columnKeyOf(item)
    const cell = cells[key] ?? {
      itemIds: [],
      orderedQty: 0,
      allocatedQty: 0,
      status: 'PENDING' as CellStatus,
      remainingQty: 0,
    }
    cell.itemIds.push(item.id)
    cell.orderedQty += item.orderedQty
    cell.allocatedQty += item.allocatedQty
    cells[key] = cell
    productTypeByKey.set(key, item.productTypeId)

    orderedQty += item.orderedQty
    allocatedQty += item.allocatedQty
    const w = unitWeightOf(item.packageType, item.unitWeightKg)
    if (w !== null) orderedKg += w * item.orderedQty
  }

  for (const [key, cell] of Object.entries(cells)) {
    cell.status = cellStatusOf(
      cell.orderedQty,
      cell.allocatedQty,
      productTypeByKey.get(key) ?? null,
      colByKey.get(key)?.availableQty ?? null,
    )
    cell.remainingQty = Math.max(0, cell.orderedQty - cell.allocatedQty)
  }

  return {
    orderId: order.id,
    label: rowLabelOf(order.vendor, order.recipient),
    vendor: order.vendor,
    recipient: order.recipient,
    createdAt: order.createdAt,
    cells,
    orderedQty,
    allocatedQty,
    orderedKg,
    needsWork: Object.values(cells).some((c) => isUnfinished(c.status)),
  }
}

/**
 * 매트릭스를 세운다. 정렬은 `sortMatrixRows`가 따로 한다 —
 * 화면에서 정렬만 바꿀 때 피벗을 다시 돌 이유가 없다.
 */
export function buildMatrix(input: BuildMatrixInput): Matrix {
  const columns = buildColumns(input)
  const colByKey = new Map(columns.map((c) => [c.key, c]))

  const itemsByOrder = new Map<number, MatrixItemInput[]>()
  for (const item of input.items) {
    const list = itemsByOrder.get(item.orderId)
    if (list) list.push(item)
    else itemsByOrder.set(item.orderId, [item])
  }

  const rows = input.orders.map((o) => buildRow(o, itemsByOrder.get(o.id) ?? [], colByKey))

  return {
    columns,
    rows,
    totals: {
      orderedQty: rows.reduce((s, r) => s + r.orderedQty, 0),
      allocatedQty: rows.reduce((s, r) => s + r.allocatedQty, 0),
      orderedKg: rows.reduce((s, r) => s + r.orderedKg, 0),
      needsWorkRows: rows.filter((r) => r.needsWork).length,
    },
  }
}

// ------------------------------------------------------
// 정렬
// ------------------------------------------------------

/**
 * 행 정렬 3종. **원본 배열을 건드리지 않는다.**
 *   recipient — 수령처 가나다
 *   latest    — 최신 등록 순
 *   needsWork — 손댈 일이 남은 행 먼저, 그 안에서 가나다
 */
export function sortMatrixRows(rows: MatrixRow[], sort: MatrixSort): MatrixRow[] {
  const byLabel = (a: MatrixRow, b: MatrixRow) => a.label.localeCompare(b.label, 'ko')
  const copy = [...rows]
  if (sort === 'recipient') return copy.sort(byLabel)
  if (sort === 'latest') {
    return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byLabel(a, b))
  }
  return copy.sort((a, b) => Number(b.needsWork) - Number(a.needsWork) || byLabel(a, b))
}
