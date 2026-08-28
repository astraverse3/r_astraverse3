// 도정 포장 내역 수정 diff — 'use server' 아님(테스트 가능)
//
// 계획서 docs/plan/plan-포장수정-diff.md / 결정 #62~#65:
//   updatePackagingLogs는 원래 「전부 지우고 다시 만든다」였다. 포장 내역을 배치에 딸린
//   단순 값으로 본 설계다. 그 뒤 PackageMovement(판매·재포장 차감)·productTypeId(SKU)·
//   Repack이 이 행을 **참조**하기 시작하면서 전제가 깨졌다.
//     · 참조당하는 행은 FK(onDelete 기본 Restrict)에 걸려 저장 자체가 실패한다 (실측 16/181 배치)
//     · 행 id가 매번 바뀌어 movement가 가리키던 대상이 사라진다
//     · createdAt이 매 저장마다 초기화돼 이력이 날아간다
//
// 그래서 입력에 서버 행 id를 실어 create/update/delete로 나눈다(#62).
// 자연키 매칭은 쓰지 않는다 — id가 없으면 무조건 create다(엉뚱한 줄을 고치는 것보다 낫다).
//
// DB 접근은 하지 않는다. 액션(app/actions/milling.ts)이 조회 결과를 넣어 호출하고
// 그 결과를 트랜잭션으로 실행만 한다.
//
// 차감 규칙과 문구 자체는 `lib/package-guard.ts`가 정한다 — 잡곡 단건 액션도 같은 것을
// 쓴다(#66). 여기서는 그 판정을 **배열 diff에 얹기만** 한다.

import {
  guardDelete,
  guardCountChange,
  DELETE_BLOCKED_HEADER,
  DEDUCTION_HINT,
  blockedMessage,
} from './package-guard'

/** 부동소수 비교 허용 오차 — totalWeight가 클라 계산값이라 필요하다. */
const EPSILON = 1e-6

/**
 * 저장 요청 1줄. 액션이 `MillingOutputInput`을 정규화해 넣는다
 * (stockId는 배치 stock으로 폴백 해석, packagingId는 톤백 sentinel까지 반영).
 */
export type PackagingLine = {
  /** 서버 행 id. 없으면 새 줄이다 */
  id?: number
  packageType: string
  weightPerUnit: number
  count: number
  totalWeight: number
  stockId: number
  /** 잔량·미선택은 null */
  packagingId: number | null
}

/** 지금 DB에 있는 도정 포장 행(재포장 결과 제외 — `lib/batch-outputs.ts`). */
export type ExistingPackagingRow = {
  id: number
  packageType: string
  weightPerUnit: number
  count: number
  totalWeight: number
  stockId: number | null
  /** productType.packagingId 평탄화. SKU 미부여면 null */
  packagingId: number | null
  /** SUM(movements.count) — 판매·재포장 등으로 이미 빠져나간 개수 */
  movedCount: number
}

/**
 * 고쳐야 할 줄. **바뀐 게 없는 줄은 여기 들어오지 않는다**(#65) —
 * UPDATE 왕복도 줄고 createdAt도 지켜진다.
 */
export type PackagingUpdate = {
  id: number
  line: PackagingLine
  /** stockId가 바뀌었다 → lotNo·productCode를 다시 계산해야 한다 (#65) */
  recalcLot: boolean
  /** packageType 또는 packagingId가 바뀌었다 → productTypeId를 다시 계산해야 한다 (#65) */
  recalcProductType: boolean
}

export type PackagingDiffErrorCode =
  | 'INVALID_LINE'
  | 'DUPLICATE_ID'
  | 'DELETE_BLOCKED'
  | 'COUNT_BELOW_MOVED'

export type PackagingDiffError = {
  code: PackagingDiffErrorCode
  message: string
  /** 차감 관련 에러가 가리키는 서버 행 id */
  rowId?: number
}

export type PackagingDiffResult =
  | {
      ok: true
      toCreate: PackagingLine[]
      toUpdate: PackagingUpdate[]
      /** 지울 행 id */
      toDelete: number[]
    }
  | { ok: false; errors: PackagingDiffError[] }

const sameNumber = (a: number, b: number): boolean => Math.abs(a - b) < EPSILON

/**
 * 기존 행과 저장 요청을 맞대어 create·update·delete로 나눈다.
 *
 * 차단 조건 (결정 #63) — FK 에러 대신 **이유가 적힌 도메인 규칙**으로 막는다:
 *   - 이미 차감된 행의 삭제
 *   - 차감량 밑으로의 수량 축소 (가용 재고가 음수가 된다)
 */
export function diffPackaging(
  existing: ExistingPackagingRow[],
  lines: PackagingLine[],
): PackagingDiffResult {
  const errors: PackagingDiffError[] = []

  // -- 같은 행을 두 줄이 가리키면 어느 쪽을 반영할지 정할 수 없다 --
  const seen = new Set<number>()
  for (const line of lines) {
    if (line.id === undefined) continue
    if (seen.has(line.id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        message: `같은 포장 행(#${line.id})이 두 번 들어왔습니다. 화면을 새로고침한 뒤 다시 저장해 주세요.`,
        rowId: line.id,
      })
    }
    seen.add(line.id)
  }

  if (errors.length > 0) return { ok: false, errors }

  const byId = new Map(existing.map((row) => [row.id, row]))

  const toCreate: PackagingLine[] = []
  const toUpdate: PackagingUpdate[] = []
  const kept = new Set<number>()
  /** 실제로 쓰기가 일어나는 줄만 모은다 — 유효성은 여기에만 건다(아래 §유효성) */
  const written: { line: PackagingLine; no: number }[] = []

  for (const [i, line] of lines.entries()) {
    const row = line.id === undefined ? undefined : byId.get(line.id)

    // id가 없거나, 있어도 기존에 없는 행이면 새로 만든다.
    // (후자는 화면이 낡은 경우다. 원래 행은 아래에서 delete 대상이 되므로 결과적으로 교체된다.)
    if (!row) {
      toCreate.push({ ...line, id: undefined })
      written.push({ line, no: i + 1 })
      continue
    }

    kept.add(row.id)

    // 이미 나간 것보다 적게 남길 수는 없다 — 가용 재고가 음수가 된다 (#68)
    const shrink = guardCountChange(row, line.count)
    if (!shrink.ok) {
      errors.push({ code: 'COUNT_BELOW_MOVED', message: shrink.reason, rowId: row.id })
      continue
    }

    const recalcLot = line.stockId !== row.stockId
    const recalcProductType =
      line.packageType !== row.packageType || line.packagingId !== row.packagingId

    const unchanged =
      !recalcLot &&
      !recalcProductType &&
      line.count === row.count &&
      sameNumber(line.weightPerUnit, row.weightPerUnit) &&
      sameNumber(line.totalWeight, row.totalWeight)

    if (unchanged) continue

    toUpdate.push({ id: row.id, line, recalcLot, recalcProductType })
    written.push({ line, no: i + 1 })
  }

  // -- 입력에서 빠진 행 = 삭제 --
  const toDelete: number[] = []
  for (const row of existing) {
    if (kept.has(row.id)) continue
    const removable = guardDelete(row)
    if (!removable.ok) {
      errors.push({ code: 'DELETE_BLOCKED', message: removable.reason, rowId: row.id })
      continue
    }
    toDelete.push(row.id)
  }

  // -- 유효성 — **새로 쓰거나 고치는 줄에만** 건다 --
  //
  // 안 건드리는 줄까지 검사하면 기존 데이터가 인질이 된다. 실제로 실DB에
  // 「잔량 0kg × 5」(배치 #73, 2026-08-27 실측)가 한 건 있어서, 전 줄 검사로는
  // 그 배치의 다른 포장을 고치는 것조차 막혔다. 잘못된 값은 그 줄을 실제로
  // 고치거나 지울 때만 문제 삼는다 — 삭제는 막지 않으니 정리 경로도 열려 있다.
  for (const { line, no } of written) {
    // 화면은 로트(생산자)별로 쪼개져 있어 줄 번호만으로는 못 찾는다 —
    // 22줄·생산자 5명짜리 배치(#73)가 실제로 있다. 규격을 함께 낸다.
    const where = line.packageType?.trim() ? `${no}번째 줄(${line.packageType})` : `${no}번째 줄`

    if (!line.packageType?.trim()) {
      errors.push({ code: 'INVALID_LINE', message: `${where}: 규격을 선택해 주세요.` })
    }
    if (!(line.weightPerUnit > 0)) {
      errors.push({
        code: 'INVALID_LINE',
        message: `${where}: 단위 중량을 입력해 주세요.`,
      })
    }
    if (!Number.isInteger(line.count) || line.count <= 0) {
      errors.push({
        code: 'INVALID_LINE',
        message: `${where}: 개수는 1개 이상의 정수여야 합니다.`,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  return { ok: true, toCreate, toUpdate, toDelete }
}

/**
 * 에러를 사용자에게 보여줄 한 덩어리 문장으로 만든다.
 *
 * FK 에러(원인 불명)를 **차단 이유가 적힌 메시지**로 바꾸는 게 결정 #63의 핵심이라,
 * 「무엇이 · 몇 개가 걸렸는지 · 어떻게 풀 수 있는지」를 함께 낸다.
 */
export function formatPackagingDiffErrors(errors: PackagingDiffError[]): string {
  const blocked = errors.filter((e) => e.code === 'DELETE_BLOCKED')
  const shrunk = errors.filter((e) => e.code === 'COUNT_BELOW_MOVED')
  const rest = errors.filter(
    (e) => e.code !== 'DELETE_BLOCKED' && e.code !== 'COUNT_BELOW_MOVED',
  )

  const blocks: string[] = []

  if (blocked.length > 0) {
    blocks.push(
      blockedMessage(
        DELETE_BLOCKED_HEADER,
        blocked.map((e) => e.message),
        DEDUCTION_HINT,
      ),
    )
  }

  if (shrunk.length > 0) {
    blocks.push(shrunk.map((e) => e.message).join('\n'))
  }

  if (rest.length > 0) {
    blocks.push(rest.map((e) => e.message).join('\n'))
  }

  return blocks.join('\n\n')
}
