// 기본 생산연도 규칙 — 'use server' 아님(테스트 가능)
//
// 같은 「11월 기준」 한 줄이 화면 7곳에 복붙돼 있었다.
// 벼와 잡곡은 수확철이 다른데 한 규칙을 쓰고 있었던 게 문제의 뿌리다.
//
//   벼   — 가을 한 번. 수확기(10~12월)엔 갓 들어온 올해분과 아직 남은 전년분을 함께 본다
//   잡곡 — 여름·가을 두 번. 6월부터 올해분이 들어오기 시작한다. **늘 2년분**을 본다
//
// 검색(복수)과 등록 폼(단일)은 고르는 방식이 달라 함수를 나눴다.
// 등록은 한 해만 찍어야 하므로 "새 수확분이 실제로 들어오기 시작하는 달"을 쓴다.

export type YearCategory = 'RICE' | 'MISC_GRAIN'

/** 벼 검색이 두 해를 함께 보기 시작하는 달 (수확기 진입) */
const RICE_HARVEST_MONTH = 10
/** 벼 등록에서 당해년도를 기본으로 찍기 시작하는 달 — 10월엔 아직 당해년도 벼가 안 들어온다 */
const RICE_NEW_CROP_MONTH = 11
/** 잡곡에 당해년도분이 들어오기 시작하는 달 */
const MISC_NEW_CROP_MONTH = 6

/**
 * 검색 필터의 기본 생산연도(복수). 최신 연도가 앞에 온다.
 *
 *   벼   1~9월 → [전년] / 10~12월 → [올해, 전년]
 *   잡곡 1~5월 → [전년, 재작년] / 6~12월 → [올해, 전년]
 *
 * 잡곡이 1~5월에 재작년까지 보는 건 그때 올해분이 아직 없어서다 —
 * [올해, 전년]으로 두면 한 해가 늘 0건이라 사실상 1년분만 보인다.
 */
export function defaultProductionYears(category: YearCategory, now: Date = new Date()): string[] {
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    if (category === 'MISC_GRAIN') {
        return month >= MISC_NEW_CROP_MONTH
            ? [String(year), String(year - 1)]
            : [String(year - 1), String(year - 2)]
    }

    return month >= RICE_HARVEST_MONTH ? [String(year), String(year - 1)] : [String(year - 1)]
}

/**
 * 등록 폼처럼 한 해만 찍어야 하는 곳의 기본값.
 *
 *   벼   11월부터 당해년도
 *   잡곡  6월부터 당해년도
 */
export function defaultProductionYear(category: YearCategory, now: Date = new Date()): number {
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const boundary = category === 'MISC_GRAIN' ? MISC_NEW_CROP_MONTH : RICE_NEW_CROP_MONTH
    return month >= boundary ? year : year - 1
}
