/**
 * 도정 포장 줄에 포장지가 **꼭 있어야 하는가** — 화면(`add-packaging-dialog`)과 서버(`updatePackagingLogs`)가
 * 같이 쓴다 (백로그 §54, 사용자 결정 2026-09-30 「기본 포장지로」).
 *
 * 포장지가 없으면 SKU(`productTypeId`)가 안 붙고, 발주서 판매처리는 SKU로만 찾으므로
 * 그 재고는 영영 「재고 부족」으로 뜬다. 2026-09-30 기준 이렇게 쌓인 줄이 22개였다.
 *
 * 예외: 톤백(서버가 「톤백」 포장지를 강제) · 잔량(SKU 없음이 정상)
 */
import { PACKAGE_TYPE_REMAINDER, PACKAGE_TYPE_TONBAG } from './repack'

type Line = { packageType: string; packagingId?: number | null }

export function needsPackagingPick(line: Line): boolean {
    if (line.packageType === PACKAGE_TYPE_TONBAG || line.packageType === PACKAGE_TYPE_REMAINDER) return false
    return (line.packagingId ?? null) === null
}

export function linesMissingPackaging<T extends Line>(lines: readonly T[]): T[] {
    return lines.filter(needsPackagingPick)
}

/** 「10kg, 5kg 줄의 포장지를 골라 주세요.」 — 같은 규격이 여러 줄이어도 한 번만 */
export function missingPackagingMessage(lines: readonly Line[]): string {
    const specs = [...new Set(lines.map(l => l.packageType))]
    return `${specs.join(', ')} 줄의 포장지를 골라 주세요.`
}
