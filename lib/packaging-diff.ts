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
  guardIdentityChange,
  DELETE_BLOCKED_HEADER,
  IDENTITY_BLOCKED_HEADER,
  DEDUCTION_HINT,
  blockedMessage,
  describePackage,
  EPSILON,
} from './package-guard'

/**
 * 충돌 안내 문구. 「막혔다」가 아니라 「합쳤으니 확인하고 다시 저장하라」로 읽혀야 한다 —
 * 거부가 재입력 강요가 되면 그게 2026-09-01 사고의 후반부다.
 */
export const STALE_BASELINE_HEADER = '이 창을 연 뒤에 다른 사람이 포장을 추가했어요.'
export const STALE_BASELINE_HINT = '아래에 합쳐 두었습니다. 확인한 뒤 다시 저장해 주세요.'

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
  | 'IDENTITY_BLOCKED'
  /** 화면이 열린 뒤 남이 추가한 행이 있다 — 「내가 못 본 행」은 지우지 않는다 */
  | 'STALE_BASELINE'

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
  baselineIds?: number[],
): PackagingDiffResult {
  const errors: PackagingDiffError[] = []

  // -- 「내가 못 본 행」은 지우지 않는다 (P4 · 2026-09-01 사고) --
  //
  // 화면에서 지운 행과, 화면이 열린 뒤 남이 추가해 **애초에 뜬 적 없는** 행은
  // 서버 입장에서 둘 다 그냥 「입력에 없는 행」이라 구분할 수 없다.
  // 다이얼로그가 열릴 때 받은 행 id 집합(baseline)이 그 둘을 가르는 유일한 정보다.
  //
  // baseline에 없는 기존 행 = 사용자가 볼 기회조차 없었던 행 → 저장을 거부한다.
  // ⚠️ 호출자(액션)는 **반드시 넘긴다**. 선택 인자인 것은 기존 단위테스트 호환 때문이다.
  if (baselineIds !== undefined) {
    const seenByUser = new Set(baselineIds)
    const unseen = existing.filter((row) => !seenByUser.has(row.id))
    if (unseen.length > 0) {
      for (const row of unseen) {
        errors.push({
          code: 'STALE_BASELINE',
          message: `${describePackage(row)}이(가) 새로 추가되었습니다.`,
          rowId: row.id,
        })
      }
      // 다른 검사를 더 해봐야 낡은 화면 기준이라 뜻이 없다. 여기서 끊는다.
      return { ok: false, errors }
    }
  }

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

    // 이미 나간 물건의 정체는 못 바꾼다 — 규격·단중·포장지 (백로그 §19 / #72).
    //
    // 🔴 **`unchanged` 판정 뒤**에 둔다. 안 건드리는 줄까지 검사하면 기존 데이터가
    // 인질이 된다 — `d18487e` 때 「전 줄 유효성」이 배치 #73을 통째로 잠갔다.
    // 차감된 벼 16개 배치가 전부 `잔량`이고 잔량은 화면에 단중 입력칸이 열려 있어,
    // 이 순서가 어긋나면 그 배치들이 통째로 저장 불가가 된다.
    const identity = guardIdentityChange(
      row,
      {
        packageType: line.packageType,
        weightPerUnit: line.weightPerUnit,
        packagingId: line.packagingId,
      },
      {},
    )
    if (!identity.ok) {
      errors.push({ code: 'IDENTITY_BLOCKED', message: identity.reason, rowId: row.id })
      continue
    }

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
 * 충돌로 거부됐을 때, **내가 못 본 서버 행만** 내 입력 뒤에 덧붙인다 (P4).
 *
 * 🔴 내 줄은 손대지 않는다 — 값도, 순서도, 개수도. 거부가 재입력 강요가 되면
 * 그게 2026-09-01 사고의 후반부다. 합친 뒤 사용자가 저장을 다시 누르면 통과한다.
 *
 * 같은 id가 양쪽에 있으면 **내 쪽을 남긴다** — 내가 편집 중인 값이기 때문이다.
 */
export function mergeUnseenRows<T extends { id?: number }>(
  mine: T[],
  server: T[],
): { merged: T[]; incomingIds: number[] } {
  const mineIds = new Set(mine.map((o) => o.id).filter((id): id is number => id !== undefined))
  const incoming = server.filter((r) => r.id !== undefined && !mineIds.has(r.id))
  return {
    merged: [...mine, ...incoming],
    incomingIds: incoming.map((r) => r.id as number),
  }
}

/**
 * 에러를 사용자에게 보여줄 한 덩어리 문장으로 만든다.
 *
 * FK 에러(원인 불명)를 **차단 이유가 적힌 메시지**로 바꾸는 게 결정 #63의 핵심이라,
 * 「무엇이 · 몇 개가 걸렸는지 · 어떻게 풀 수 있는지」를 함께 낸다.
 */
export function formatPackagingDiffErrors(errors: PackagingDiffError[]): string {
  // 낡은 화면은 단독으로 온다(diff가 거기서 끊는다) — 먼저, 그리고 혼자 보여준다.
  const stale = errors.filter((e) => e.code === 'STALE_BASELINE')
  if (stale.length > 0) {
    return blockedMessage(
      STALE_BASELINE_HEADER,
      stale.map((e) => e.message),
      STALE_BASELINE_HINT,
    )
  }

  const blocked = errors.filter((e) => e.code === 'DELETE_BLOCKED')
  const identity = errors.filter((e) => e.code === 'IDENTITY_BLOCKED')
  const shrunk = errors.filter((e) => e.code === 'COUNT_BELOW_MOVED')
  const rest = errors.filter(
    (e) =>
      e.code !== 'DELETE_BLOCKED' &&
      e.code !== 'COUNT_BELOW_MOVED' &&
      e.code !== 'IDENTITY_BLOCKED',
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

  // 삭제·축소와 **문구가 달라야** 사용자가 무엇을 되돌릴지 안다 (#77).
  if (identity.length > 0) {
    blocks.push(
      blockedMessage(
        IDENTITY_BLOCKED_HEADER,
        identity.map((e) => e.message),
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
