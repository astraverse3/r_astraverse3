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
import { getDisplayMillingType } from './milling-type-display'

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
  /** 찰벼면 표시를 찹쌀/찰현미로 바꾼다 (`getDisplayMillingType`) */
  varietyType: string | null
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
  /**
   * productTypeId → 지금 쓸 수 있는 **kg 합**. 톤백 열이 쓴다.
   * 🔴 개수 × 요구중량으로 환산하면 틀린다 — 톤백은 자루마다 중량이 제각각이라
   * (실측 203~1,014kg) 11자루 × 1,000 = 11,000이 나오는데 실제는 7,067이다.
   */
  availabilityKg: AvailabilityMap
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
  /** 이 열이 속한 품목 그룹 (`MatrixColumnGroup.key`) */
  groupKey: string
  /** 열 머리글에 찍히는 규격 — 헤더 2행 */
  packageType: string
  /** 규격 1개당 kg. 알 수 없으면 null */
  unitWeightKg: number | null
  orderedQty: number
  allocatedQty: number
  /** 이 열의 SKU 가용재고(개). 매칭실패 열은 null */
  availableQty: number | null
  /**
   * 톤백 열 — 라인이 자루중량(#34)을 갖는다. 같은 SKU라도 중량이 다르면 다른 열이고,
   * 가용은 개수가 아니라 `availableKg`로 읽는다(자루가 제각각이라 개수는 의미가 없다).
   */
  bulk: boolean
  /** 톤백 열의 SKU 가용 kg 합. 톤백이 아니면 null */
  availableKg: number | null
}

/**
 * 열 머리글 1행 = 품목. 같은 품목의 규격들이 그 아래 묶인다.
 * 발주서 원본이 「품목 한 칸 아래 10kg·5kg·1kg」로 되어 있어 그 모양을 그대로 살린다.
 */
export type MatrixColumnGroup = {
  /** `품종|도정|포장지` 또는 매칭실패 원본 조합 */
  key: string
  /** `천지향1세` · 백미가 아니면 `서농22호 · 현미` */
  title: string
  /** 포장지명. 매칭실패면 `매칭실패` */
  packagingName: string
  unmatched: boolean
  /** 이 그룹에 속한 열 키 — 화면이 colspan을 여기서 낸다 */
  columnKeys: string[]
}

export type MatrixRow = {
  orderId: number
  // 이름칸은 화면이 채널 규칙(`ChannelDecl`)으로 vendor·recipient를 직접 조합한다.
  // 조합한 문자열을 여기 두면 정렬 키로 새어 나간다 — 한 번 그랬다(C0-d).
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
  /** 머리글 1행 — 품목. 등장 순서를 지킨다 */
  groups: MatrixColumnGroup[]
  /** 머리글 2행 — 규격. 그룹 순서대로 늘어선다 */
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

export type MatrixSort = 'vendor' | 'recipient' | 'latest' | 'needsWork'

// ------------------------------------------------------
// 열 키 · 표기
// ------------------------------------------------------

/**
 * 열 식별자. 매칭된 라인은 SKU 하나로 모이고, 매칭실패는 **원본 조합**으로 따로 선다.
 * 실패 라인을 하나로 뭉치면 수동지정할 때 무엇을 지정하는지 알 수 없다.
 */
export function columnKeyOf(item: MatrixItemInput): string {
  // 🔴 톤백은 자루중량까지 열 키다. 1,000kg 주문과 200kg 주문이 같은 SKU라고 한 열에
  //    합쳐지면 「톤백 2개」라는 의미 없는 소계가 찍힌다(C0-a, 실데이터 #19 시아스).
  const w = item.unitWeightKg !== null ? `|w:${item.unitWeightKg}` : ''
  if (item.productTypeId !== null) return `pt:${item.productTypeId}${w}`
  return `raw:${item.rawItemName}|${item.packageType}|${item.rawPackaging ?? ''}${w}`
}

/**
 * 열 소계가 가용을 넘는가 — 소계 띠 두 줄을 주황으로 칠하는 판정.
 * 톤백은 kg끼리 비교한다. 개수 비교(주문 2자루 vs 가용 11자루)는 성립하지 않는다.
 */
export function isColumnShort(col: MatrixColumn): boolean {
  if (col.bulk) {
    return col.availableKg !== null && col.orderedQty * (col.unitWeightKg ?? 0) > col.availableKg
  }
  return col.availableQty !== null && col.orderedQty > col.availableQty
}

/** 규격 1개당 kg. 톤백은 라인의 요구 자루중량(#34)을 우선한다. */
export function unitWeightOf(packageType: string, unitWeightKg: number | null): number | null {
  if (unitWeightKg !== null && unitWeightKg > 0) return unitWeightKg
  return normalizeSpec(packageType).weightKg
}

/**
 * 품목 머리글 — `천지향1세`, 도정이 백미가 아니면 `서농22호 · 현미`.
 * 🔴 **백미는 적지 않는다.** 대부분이 백미라 전부 붙이면 글자만 늘고 구분이 안 된다.
 * 찰벼는 저장값이 `백미`여도 `찹쌀`로 보여야 하므로 `getDisplayMillingType`을 먼저 통과시킨다.
 */
export function groupTitleOf(varietyName: string, millingType: string, varietyType: string | null): string {
  const shown = getDisplayMillingType(millingType, varietyType)
  return shown && shown !== '백미' ? `${varietyName} · ${shown}` : varietyName
}

/** 품목 그룹 식별자 — 같은 품종·도정·포장지면 한 그룹으로 묶인다. */
export function groupKeyOf(item: MatrixItemInput, sku: MatrixSkuInput | undefined): string {
  if (!sku) return `raw:${item.rawItemName}|${item.rawPackaging ?? ''}`
  return `g:${sku.varietyName}|${sku.millingType}|${sku.packagingName}`
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
 * 열과 품목 그룹을 세운다.
 *
 * 🔴 **등장 순서를 지킨다.** 이 화면의 목적은 「발주서 원본 그대로의 2D 피벗」이고,
 * `PurchaseOrderItem.id` 순서가 곧 엑셀 열 순서다. 무게순 같은 걸로 재배열하면
 * 사람이 원본과 대조할 수 없다. 그룹도 그 안의 규격도 처음 나온 차례대로 선다.
 */
function buildColumns(input: BuildMatrixInput): {
  groups: MatrixColumnGroup[]
  columns: MatrixColumn[]
} {
  const skuById = new Map(input.skus.map((s) => [s.id, s]))
  const groupByKey = new Map<string, MatrixColumnGroup>()
  const colByKey = new Map<string, MatrixColumn>()

  for (const item of input.items) {
    const sku = item.productTypeId !== null ? skuById.get(item.productTypeId) : undefined
    const gKey = groupKeyOf(item, sku)
    const cKey = columnKeyOf(item)

    if (!groupByKey.has(gKey)) {
      groupByKey.set(gKey, {
        key: gKey,
        title: sku ? groupTitleOf(sku.varietyName, sku.millingType, sku.varietyType) : item.rawItemName,
        packagingName: sku ? sku.packagingName : '매칭실패',
        unmatched: !sku,
        columnKeys: [],
      })
    }
    const group = groupByKey.get(gKey)!

    let col = colByKey.get(cKey)
    if (!col) {
      const bulk = item.unitWeightKg !== null
      col = {
        key: cKey,
        productTypeId: item.productTypeId,
        groupKey: gKey,
        packageType: sku?.packageType ?? item.packageType,
        unitWeightKg: unitWeightOf(item.packageType, item.unitWeightKg),
        orderedQty: 0,
        allocatedQty: 0,
        availableQty:
          item.productTypeId !== null ? (input.availability[item.productTypeId] ?? 0) : null,
        bulk,
        availableKg:
          bulk && item.productTypeId !== null
            ? (input.availabilityKg[item.productTypeId] ?? 0)
            : null,
      }
      colByKey.set(cKey, col)
      group.columnKeys.push(cKey)
    }
    col.orderedQty += item.orderedQty
    col.allocatedQty += item.allocatedQty
  }

  // 열은 그룹 차례대로 늘어놓는다 — 그래야 머리글 colspan과 아래 칸이 맞는다
  const groups = [...groupByKey.values()]
  const columns = groups.flatMap((g) => g.columnKeys.map((k) => colByKey.get(k)!))
  return { groups, columns }
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
    const col = colByKey.get(key)
    // 톤백은 kg 기준 — 「남은 kg > 가용 kg」를 개수 축으로 옮겨 같은 판정식에 넣는다
    // (availableKg / 자루중량 < remaining ⟺ availableKg < remaining × 자루중량).
    const available =
      col === undefined
        ? null
        : col.bulk
          ? col.availableKg !== null && col.unitWeightKg
            ? col.availableKg / col.unitWeightKg
            : null
          : col.availableQty
    cell.status = cellStatusOf(
      cell.orderedQty,
      cell.allocatedQty,
      productTypeByKey.get(key) ?? null,
      available,
    )
    cell.remainingQty = Math.max(0, cell.orderedQty - cell.allocatedQty)
  }

  return {
    orderId: order.id,
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
  const { groups, columns } = buildColumns(input)
  const colByKey = new Map(columns.map((c) => [c.key, c]))

  const itemsByOrder = new Map<number, MatrixItemInput[]>()
  for (const item of input.items) {
    const list = itemsByOrder.get(item.orderId)
    if (list) list.push(item)
    else itemsByOrder.set(item.orderId, [item])
  }

  const rows = input.orders.map((o) => buildRow(o, itemsByOrder.get(o.id) ?? [], colByKey))

  return {
    groups,
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
 * 행 정렬 4종. **원본 배열을 건드리지 않는다.**
 *   vendor    — 발주처별로 뭉친 뒤 그 안에서 수령인 가나다.
 *               택배는 시트 원본에서 같은 발주처가 떨어져 나타나므로 이게 기본이다.
 *   recipient — 수령인 가나다
 *   latest    — 최신 등록 순
 *   needsWork — 손댈 일이 남은 행 먼저, 그 안에서 수령인 가나다
 *
 * 🔴 정렬 키는 필드다. 화면용으로 조합한 문자열(`발주처 → 수령인`)을 키로 쓰면
 * 「수령인 가나다」가 발주처 순이 된다 — C0-d에서 걷어낸 결함.
 */
export function sortMatrixRows(rows: MatrixRow[], sort: MatrixSort): MatrixRow[] {
  const ko = (a: string, b: string) => a.localeCompare(b, 'ko')
  const byRecipient = (a: MatrixRow, b: MatrixRow) => ko(a.recipient, b.recipient)
  const copy = [...rows]
  if (sort === 'vendor') return copy.sort((a, b) => ko(a.vendor, b.vendor) || byRecipient(a, b))
  if (sort === 'recipient') return copy.sort(byRecipient)
  if (sort === 'latest') {
    return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byRecipient(a, b))
  }
  return copy.sort((a, b) => Number(b.needsWork) - Number(a.needsWork) || byRecipient(a, b))
}
