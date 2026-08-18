// 수율 필터 공유 헬퍼.
// 목록 조회(getMillingLogs)와 엑셀 다운로드(exportMillingLogs)가 동일하게 사용해
// 화면과 엑셀 결과가 어긋나지 않도록 한다.
//
// 수율은 DB 컬럼이 아니라 outputs 합산으로 계산하는 값이라 prisma where로 못 거른다.
// findMany 이후 post-query 필터로 사용한다.

type YieldFilterBatch = {
    isClosed: boolean
    totalInputKg: number
    outputs: { totalWeight: number }[]
}

/**
 * 배치가 수율 필터 조건에 맞는지 판정한다.
 * - yieldRate가 없거나 'ALL'이면 전부 통과
 * - 미마감(!isClosed) 배치는 수율이 확정 안 됐으므로 제외
 * - 구간 경계는 이하(<=)/이상(>=)
 */
export function matchesYieldFilter(batch: YieldFilterBatch, yieldRate?: string): boolean {
    if (!yieldRate || yieldRate === 'ALL') return true

    // 미마감 배치는 수율 미확정 → 제외
    if (!batch.isClosed) return false

    const productionSum = batch.outputs.reduce((sum, out) => sum + out.totalWeight, 0)
    const rate = batch.totalInputKg > 0 ? (productionSum / batch.totalInputKg) * 100 : 0

    switch (yieldRate) {
        case 'upto_50':
            return rate <= 50
        case 'upto_60':
            return rate <= 60
        case 'upto_70':
            return rate <= 70
        case 'over_70':
            return rate >= 70
        default:
            return true
    }
}
