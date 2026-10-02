// 통계 필터 색 — 작업지시 ⑫ B-1(T1 보라 폐기). 조건마다 색을 나누지 않고 파랑 하나로 한다.
// 구분은 칩 앞의 조건 이름(인증 · 작목반 · 품종 · 생산자 · 도정구분 · 곡종 · 채널)이 맡는다 —
// 「김영수」가 생산자인지 작목반인지는 색으로는 어차피 못 읽는다. 기간 칩만 회색(slate)이다.

/** 적용된 조건 칩(글자만) */
export const FILTER_CHIP = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700'

/** 눌러서 빼는 칩 */
export const FILTER_CHIP_BUTTON = `${FILTER_CHIP} hover:bg-blue-100 transition-colors`

/** 칩 앞 조건 이름 */
export const FILTER_CHIP_KEY = 'text-blue-700/70'

/** 드롭다운·입력칸에 값이 있을 때 */
export const FILTER_ACTIVE = 'bg-blue-50 text-blue-700'

/** 시트·드롭다운 목록에서 고른 항목 */
export const FILTER_PICKED = 'bg-blue-500 text-white'
