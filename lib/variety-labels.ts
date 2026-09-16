/**
 * Variety.type 한글 라벨 매핑.
 * 매입 신규 등록 시 동일 name 충돌 안내, 품종 관리 화면 라벨링 등에 사용.
 */

export const VARIETY_TYPE_LABELS: Record<string, string> = {
    URUCHI: '메벼',
    GLUTINOUS: '찰벼',
    INDICA: '인디카',
    BLACK: '흑미',
    MISC_GRAIN: '잡곡',
    OTHER: '기타',
    PURCHASED: '매입',
}

export function getVarietyTypeLabel(type: string): string {
    return VARIETY_TYPE_LABELS[type] ?? type
}

/**
 * Variety.type 정렬 순서 — 메벼 → 찰벼 → 인디카 → 흑미 → 잡곡 → 기타 → 매입.
 *
 * 🔴 BLACK이 빠지면 흑미가 `?? 99`로 매입 뒤에 떨어진다.
 *    실제로 품종 관리 화면의 `typeOrder` 두 벌 모두 BLACK이 빠져 있었다(2026-09-16 해소).
 *    라벨과 함께 여기 한 곳에서만 정한다.
 */
export const VARIETY_TYPE_ORDER: Record<string, number> = {
    URUCHI: 1,
    GLUTINOUS: 2,
    INDICA: 3,
    BLACK: 4,
    MISC_GRAIN: 5,
    OTHER: 6,
    PURCHASED: 7,
}

export function getVarietyTypeOrder(type: string): number {
    return VARIETY_TYPE_ORDER[type] ?? 99
}

/** 곡종 순 → 같은 곡종 안에서는 이름 가나다순. 원본 배열을 건드리지 않는다. */
export function sortByVarietyType<T extends { name: string; type: string }>(varieties: T[]): T[] {
    return [...varieties].sort((a, b) => {
        const diff = getVarietyTypeOrder(a.type) - getVarietyTypeOrder(b.type)
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name, 'ko')
    })
}
