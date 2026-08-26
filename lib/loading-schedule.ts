// 묶음 목록의 「상차」 열 — 표시 라벨과 정렬 순서 (계획서 plan-배송상차정보.md §4-S4).
//
// 목적은 상차를 시스템으로 관리하는 게 아니라 **먼저 나갈 것이 먼저 포장되도록** 순서를 잡는 것이다.
// 그래서 기본 정렬이 업로드 시각순이 아니라 상차 임박순이다.
//
// 상차 완료 판정에 별도 플래그를 두지 않는다 — **상차일이 오늘보다 과거면 완료**로 본다(계획서 §5).

export type LoadingTimeSlot = 'UNKNOWN' | 'AM' | 'PM' | 'EXACT'

export type LoadingInfo = {
  loadingDate: string | null // 'yyyy-mm-dd'
  loadingTimeSlot: LoadingTimeSlot
  loadingTime: string | null // 'HH:mm' — slot이 EXACT일 때만
  vendorName: string | null
}

/** 상차 셀의 표시 상태. 색·강조는 화면이 이 값으로 정한다 */
export type LoadingTone =
  | 'today' // 오늘 나간다 — 가장 급하다
  | 'upcoming' // 내일 이후
  | 'unset' // 배차 미정 — 눌러서 채우는 자리
  | 'done' // 상차일이 지났다

export type LoadingDisplay = {
  tone: LoadingTone
  /** '오늘 14:00' · '내일' · '8/22 오전' · '배차 미정' · '8/18 상차 완료' */
  label: string
  /** 배송업체명 — 라벨 뒤에 ' · '로 붙는다. 없으면 null */
  vendorName: string | null
}

const SLOT_LABEL: Record<Exclude<LoadingTimeSlot, 'EXACT' | 'UNKNOWN'>, string> = {
  AM: '오전',
  PM: '오후',
}

/**
 * 정렬용 대표 시각. 표시가 아니라 순서를 정하려는 값이라 오전·오후를 근사해도 된다.
 * 시각 미정은 그날의 맨 뒤로 보낸다 — 시각이 정해진 건이 먼저 눈에 들어와야 한다.
 */
function timeSortKey(slot: LoadingTimeSlot, time: string | null): string {
  if (slot === 'EXACT' && time) return time
  if (slot === 'AM') return '09:00'
  if (slot === 'PM') return '14:00'
  return '99:99'
}

/** 'yyyy-mm-dd' → 'M/D' */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

function timeText(slot: LoadingTimeSlot, time: string | null): string {
  if (slot === 'EXACT' && time) return time
  if (slot === 'AM' || slot === 'PM') return SLOT_LABEL[slot]
  return ''
}

/** 'yyyy-mm-dd' 두 개의 날짜 차이(일). 문자열을 UTC 자정으로 읽어 시간대 영향을 없앤다 */
function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/**
 * 상차 정보를 화면 표시용으로 바꾼다.
 * @param todayIso 오늘 날짜 'yyyy-mm-dd' (KST). 서버에서 계산해 넘긴다 — hydration 불일치를 피한다
 */
export function describeLoading(info: LoadingInfo, todayIso: string): LoadingDisplay {
  if (!info.loadingDate) {
    return { tone: 'unset', label: '배차 미정', vendorName: info.vendorName }
  }

  const diff = dayDiff(todayIso, info.loadingDate)
  if (diff < 0) {
    // 지난 상차는 흐리게 남는다. 업체명까지 붙이면 완료된 줄이 오히려 도드라진다
    return { tone: 'done', label: `${shortDate(info.loadingDate)} 상차 완료`, vendorName: null }
  }

  const time = timeText(info.loadingTimeSlot, info.loadingTime)
  const day = diff === 0 ? '오늘' : diff === 1 ? '내일' : shortDate(info.loadingDate)
  return {
    tone: diff === 0 ? 'today' : 'upcoming',
    label: time ? `${day} ${time}` : day,
    vendorName: info.vendorName,
  }
}

/**
 * 상차 임박순 정렬 키. 작을수록 위로 온다.
 *
 * 오늘 이후(임박한 순) → 배차 미정 → 지난 상차(최근 것부터).
 * 상차일이 없는 묶음을 뒤로 보내므로, 상차 정보가 전부 비어 있는 기존 묶음은 지금과 같은 순서로 보인다(계획서 §5).
 */
export function loadingSortKey(info: LoadingInfo, todayIso: string): [number, number, string] {
  if (!info.loadingDate) return [1, 0, '']

  const diff = dayDiff(todayIso, info.loadingDate)
  const time = timeSortKey(info.loadingTimeSlot, info.loadingTime)
  // 지난 상차는 그룹 2에서 최근 것이 위로 오도록 diff(음수)를 뒤집는다
  return diff < 0 ? [2, diff * -1, time] : [0, diff, time]
}

/** 두 묶음의 상차 순서 비교. 같은 순위면 0을 돌려주고 호출부가 업로드 최신순으로 잇는다 */
export function compareLoading(a: LoadingInfo, b: LoadingInfo, todayIso: string): number {
  const ka = loadingSortKey(a, todayIso)
  const kb = loadingSortKey(b, todayIso)
  for (let i = 0; i < 3; i++) {
    if (ka[i] < kb[i]) return -1
    if (ka[i] > kb[i]) return 1
  }
  return 0
}

/** 오늘 날짜 'yyyy-mm-dd' (KST). 서버가 UTC로 돌아도 한국 날짜를 본다 */
export function todayIsoKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
