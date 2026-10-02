/**
 * 도정 포장 줄의 포장지 검사 — 아래 겹침 검사(§98)도 여기 있다.
 *
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

/** 줄마다 포장지를 고르는 규격인가 — 톤백·잔량이 아니면 고른다 */
function picksPackaging(line: Line): boolean {
    return line.packageType !== PACKAGE_TYPE_TONBAG && line.packageType !== PACKAGE_TYPE_REMAINDER
}

export function needsPackagingPick(line: Line): boolean {
    return picksPackaging(line) && (line.packagingId ?? null) === null
}

export function linesMissingPackaging<T extends Line>(lines: readonly T[]): T[] {
    return lines.filter(needsPackagingPick)
}

/** 「10kg, 5kg 줄의 포장지를 골라 주세요.」 — 같은 규격이 여러 줄이어도 한 번만 */
export function missingPackagingMessage(lines: readonly Line[]): string {
    const specs = [...new Set(lines.map(l => l.packageType))]
    return `${specs.join(', ')} 줄의 포장지를 골라 주세요.`
}

type KeyedLine = Line & { id?: number; stockId?: number | null }

/**
 * 재고·규격·포장지가 같은 줄 묶음 중 **새 줄(id 없음)이 섞인 것** — 화면만 쓴다 (백로그 §98).
 *
 * 같은 규격이라도 포장지가 다르면 다른 줄이다(10kg 일반 포대 + 10kg 한살림 포대).
 * 포장지까지 같으면 한 줄로 쓰라고 막는다. 다만 이미 저장된 줄끼리 겹친 건 두고 본다 —
 * 둘 다 차감이 붙어 있으면 합칠 방법이 없어 저장이 영영 막힌다.
 *
 * 서버는 막지 않는다 — 같은 포장지 두 줄은 SKU가 깨지는 게 아니라(§54와 다르다) 지저분할 뿐이다.
 * 톤백·잔량은 자루·자투리마다 한 줄이 정상이라 뺀다. 포장지 없는 줄은 위 검사가 잡는다.
 */
export function duplicatePackagingLines<T extends KeyedLine>(lines: readonly T[]): T[] {
    const groups = new Map<string, T[]>()
    for (const line of lines) {
        if (!picksPackaging(line) || line.packagingId == null) continue
        const key = `${line.stockId ?? ''}|${line.packageType}|${line.packagingId}`
        groups.set(key, [...(groups.get(key) ?? []), line])
    }
    return [...groups.values()]
        .filter(group => group.length > 1 && group.some(l => l.id === undefined))
        .flat()
}

/** 「10kg, 5kg 줄 중에 포장지까지 같은 줄이 있어요. 한 줄로 합쳐 주세요.」 */
export function duplicatePackagingMessage(lines: readonly Line[]): string {
    const specs = [...new Set(lines.map(l => l.packageType))]
    return `${specs.join(', ')} 줄 중에 포장지까지 같은 줄이 있어요. 한 줄로 합쳐 주세요.`
}
