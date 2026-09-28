/**
 * KST 날짜 공용 헬퍼 (백로그 §39).
 *
 * 🔴 `toISOString().slice(0, 10)`으로 날짜를 만들지 말 것 — UTC로 잘라서 KST 00~09시가 하루 밀린다.
 *
 * DB의 날짜는 두 규칙이 섞여 있다 — UTC 자정(원물 입고일·도정일·발주일)과 KST 자정(차감 발생일 등).
 * KST 하루 = [UTC 전날 15:00, UTC 당일 15:00)라서 **읽기를 KST로 하면 둘 다 같은 날짜**가 나온다.
 *
 * 🔴 프로세스 시간대(`getDate()` 등)에 기대지 않는다 — 개발 PC는 KST, Vercel은 UTC다.
 *    +9시간 후 `getUTC*`만 쓴다(한국은 서머타임이 없다).
 */

export const KST_TIME_ZONE = 'Asia/Seoul'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 날짜 → 'yyyy-mm-dd' (KST) */
export function toKstDate(d: Date | string): string {
  return new Date(new Date(d).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 오늘 'yyyy-mm-dd' (KST) */
export function todayKst(now: Date = new Date()): string {
  return toKstDate(now)
}

/** 날짜 → 'yyyy-mm' (KST) */
export function toKstMonth(d: Date): string {
  return toKstDate(d).slice(0, 7)
}

/**
 * 'yyyy-mm-dd' → KST 하루 [00:00, 다음 날 00:00). Prisma where에 그대로 쓴다.
 * 형식이 어긋나거나 없는 날짜(2026-02-31)면 null.
 */
export function kstDayRange(ymd: string | undefined): { gte: Date; lt: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? '').trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utcMidnight = Date.UTC(y, mo - 1, d)
  // Date.UTC는 2026-02-31을 조용히 3월로 굴린다 — 되돌려 확인한다
  const check = new Date(utcMidnight)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null
  const start = utcMidnight - KST_OFFSET_MS
  return { gte: new Date(start), lt: new Date(start + DAY_MS) }
}

/** 연도 → KST 1월 1일 00:00 ~ 다음 해 1월 1일 00:00 */
export function kstYearRange(year: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, 0, 1) - KST_OFFSET_MS),
    lt: new Date(Date.UTC(year + 1, 0, 1) - KST_OFFSET_MS),
  }
}

/** 한국어 표기 (`2026. 9. 8.` / 시각 포함 `2026. 9. 8. 오후 3:00:00`) — KST 고정 */
export function formatKstKo(d: Date, withTime = false): string {
  return withTime
    ? d.toLocaleString('ko-KR', { timeZone: KST_TIME_ZONE })
    : d.toLocaleDateString('ko-KR', { timeZone: KST_TIME_ZONE })
}
