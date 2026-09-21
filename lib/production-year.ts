// 기본 생산연도 규칙 — 'use server' 아님(테스트 가능)
//
// 같은 「11월 기준」 한 줄이 화면 7곳에 복붙돼 있었다.
// 벼와 잡곡은 수확철이 다른데 한 규칙을 쓰고 있었던 게 문제의 뿌리다.
//
//   벼   — 가을 한 번. 수확기(9~12월)엔 갓 들어온 올해분과 아직 남은 전년분을 함께 본다
//   잡곡 — 여름·가을 두 번. 6월부터 올해분이 들어오기 시작한다. **늘 2년분**을 본다
//
// 검색(복수)과 등록 폼(단일)은 고르는 방식이 달라 함수를 나눴다.
// 등록은 한 해만 찍어야 하므로 "새 수확분이 실제로 들어오기 시작하는 달"을 쓴다.

export type YearCategory = 'RICE' | 'MISC_GRAIN'

// 🔴 2026-09-21: 벼 경계를 10월·11월 → 둘 다 9월로 당겼다.
//    옛 주석은 "10월엔 아직 당해년도 벼가 안 들어온다"였는데, 2026-09-15에 조생종
//    26년산이 실제로 입고되면서 그 근거가 무너졌다(시스템 가동 후 첫 연도 전환).
//    지금은 두 값이 같지만 **합치지 않는다** — 검색 범위와 등록 기본값은 다른 판단이고,
//    실제로 한 번 갈렸던 이력이 있다.

/** 벼 검색이 두 해를 함께 보기 시작하는 달 (수확기 진입) */
const RICE_HARVEST_MONTH = 9
/** 벼 등록에서 당해년도를 기본으로 찍기 시작하는 달 — 조생종이 9월 중순부터 들어온다 */
const RICE_NEW_CROP_MONTH = 9
/** 잡곡에 당해년도분이 들어오기 시작하는 달 */
const MISC_NEW_CROP_MONTH = 6

/**
 * 대시보드 집계가 당해년도로 넘어가는 달 — 등록·검색(9월)보다 **일부러 늦다**.
 *
 * 등록과 검색은 신곡이 들어오는 즉시 보여야 하니 9월에 넘긴다.
 * 집계는 반대다 — 신곡 몇 톤백 들어왔다고 기준을 옮기면 보유재고·진행률·수율이
 * 한꺼번에 0에 가까워져 **화면이 통째로 빈다**(2026-09-21에 실제로 그랬다:
 * 26년산 15행이 들어오자 보유 398,790kg → 10,884kg, 진행률 76.4% → 7.0%).
 * 신곡 도정이 본격적으로 도는 11월에 넘긴다.
 */
const DASHBOARD_NEW_CROP_MONTH = 11

/**
 * 검색 필터의 기본 생산연도(복수). 최신 연도가 앞에 온다.
 *
 *   벼   1~8월 → [전년] / 9~12월 → [올해, 전년]
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
 *   벼    9월부터 당해년도
 *   잡곡  6월부터 당해년도
 */
export function defaultProductionYear(category: YearCategory, now: Date = new Date()): number {
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const boundary = category === 'MISC_GRAIN' ? MISC_NEW_CROP_MONTH : RICE_NEW_CROP_MONTH
    return month >= boundary ? year : year - 1
}

/**
 * 대시보드처럼 **한 해 실적을 집계하는 화면**의 기준 연도.
 *
 *   11월부터 당해년도 (등록·검색은 9월 — `defaultProductionYear` 참고)
 *
 * 한 해를 통으로 봐야 의미가 있는 값들(진행률·수율)을 다루므로 **두 해를 섞지 않는다**.
 */
export function dashboardProductionYear(now: Date = new Date()): number {
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    return month >= DASHBOARD_NEW_CROP_MONTH ? year : year - 1
}

// ------------------------------------------------------
// 연도 선택 목록
//
// 같은 [2026, 2025, 2024, 2023]이 화면 5곳에 각각 하드코딩돼 있었다(한 곳은 3년치).
// 해가 바뀌면 다섯 곳을 손으로 고쳐야 하는 구조 — 이 파일이 애초에 풀려던 문제
// (같은 규칙의 복붙)가 연도 목록에 그대로 남아 있었다.
//
// 여기서 "올해"는 달력 연도다. 수확 경계(위 상수들)와 무관하다 —
// **고를 수 있는 범위**이지 기본값이 아니기 때문이다.
// ------------------------------------------------------

/** 목록에 담는 햇수 (올해 포함) */
const YEAR_OPTION_SPAN = 4

/** 연도 선택 목록. 올해부터 과거로 내려가며 최신이 앞에 온다. */
export function productionYearOptions(now: Date = new Date()): number[] {
    const year = now.getFullYear()
    return Array.from({ length: YEAR_OPTION_SPAN }, (_, i) => year - i)
}

/** 검색 필터(MultiSelect)가 쓰는 `{label, value}` 형태 */
export function productionYearFilterOptions(now: Date = new Date()): { label: string; value: string }[] {
    return productionYearOptions(now).map(y => ({ label: `${y}년`, value: String(y) }))
}

/**
 * 기존 값이 목록 밖일 수 있는 곳(수정 다이얼로그)용.
 *
 * 🔴 이게 없으면 오래된 재고를 수정할 때 Select가 **빈칸으로 열리고
 *    저장하는 순간 연도가 날아간다.** 목록은 최근 4년이지만 재고는 그보다 오래 남는다.
 */
export function productionYearOptionsWith(value: number, now: Date = new Date()): number[] {
    const options = productionYearOptions(now)
    return options.includes(value) ? options : [...options, value].sort((a, b) => b - a)
}
