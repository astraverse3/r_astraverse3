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
