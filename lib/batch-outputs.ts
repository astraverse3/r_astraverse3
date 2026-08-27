/**
 * 「도정 산출만」 필터 (결정 #61).
 *
 * 재포장 결과 행(`MillingOutputPackage.repackId != null`)은 **원본의 `batchId`를 승계한다**
 * (`app/actions/repack.ts` — 로트·농가·품종을 이어받으려면 필요하다. 결정 #43 §3.4).
 * 그래서 `millingBatch.outputs` 관계로 접근하면 도정 산출과 재포장 결과가 **섞여 나온다.**
 *
 * 섞이면 이런 일이 생긴다 — 전부 2026-08-27 실측으로 확인했다:
 *   · 같은 쌀이 두 번 세어져 생산량·수율이 부푼다 (배치 #145 수율 63.50% → 실제 62.67%)
 *   · 도정관리 포장 다이얼로그에 재포장 결과가 「도정 때 포장한 것」처럼 복원된다
 *   · 포장 수정이 `deleteMany({ batchId })`로 재포장 결과까지 지우려다
 *     `PackageMovement`의 FK(onDelete 기본값 Restrict)에 걸려 **통째로 실패한다**
 *
 * 지점마다 손으로 `repackId: null`을 붙이면 반드시 빠뜨린다(실제로 두 번 놓쳤다).
 * `batch.outputs`를 읽거나 지우는 코드는 **예외 없이** 아래 조각을 쓴다.
 *
 * 재포장 결과를 일부러 보려는 곳은 `repackId`로 직접 조회한다 — 그건 도정 산출이 아니다.
 */

/** where 절 조각. `millingOutputPackage`를 직접 조회할 때 스프레드한다. */
export const MILLED_OUTPUT_ONLY = { repackId: null }

/**
 * `batch.outputs` 관계에 스프레드한다.
 * ```ts
 * outputs: { ...MILLED_OUTPUTS, select: { totalWeight: true } }
 * ```
 */
export const MILLED_OUTPUTS = { where: MILLED_OUTPUT_ONLY }
