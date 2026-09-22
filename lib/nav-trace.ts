/**
 * 네비게이션 덫 — 「원물재고 검색 중 도정목록으로 튐」의 원인을 다음 발생 1회로 잡기 위한 임시 계측.
 *
 * 🔴 **원인이 확정되면 걷어낸다.** 계획서 `docs/plan/plan-네비게이션-덫.md` §7.
 *
 * 설계 원칙 3가지 — 어기면 덫이 증상 자체를 가린다:
 *  1. **읽기만 한다.** 이벤트를 삼키지 않는다(`preventDefault`·`stopPropagation` 금지).
 *  2. **조용히 실패한다.** localStorage가 막혀 있어도 앱은 아무 일 없이 동작해야 한다.
 *  3. 🔴 **입력값은 기록하지 않는다.** 남기는 텍스트는 버튼·링크의 라벨뿐(§4.1).
 */

export type TraceKind =
    | 'pointer' // 화면을 눌렀다
    | 'popstate' // 뒤로가기가 들어왔다
    | 'route' // pathname이 바뀌었다
    | 'push' // 코드가 라우팅을 호출했다 (용의자 A·B·C)
    | 'online' // 네트워크 복귀 (reloadOnOnline이 새로고침을 일으킬 수 있는 시점)
    | 'visibility' // 앱이 숨겨지거나 돌아왔다
    | 'load' // 페이지가 로드됐다 (reload인지 navigate인지)

export interface TraceEntry {
    /** epoch ms */
    t: number
    kind: TraceKind
    /** 무슨 일이 있었는지 한 줄. 입력값은 절대 담기지 않는다. */
    detail: string
    /** pointer 이벤트의 좌표 — 화면 어느 구역을 눌렀는지 판별용 */
    x?: number
    y?: number
}

export const TRACE_KEY = 'mill-nav-trace'
export const TRACE_ROUTE_KEY = 'mill-nav-trace-routes'

/** 일반 버퍼 상한. 넘으면 오래된 것부터 버린다. */
export const TRACE_LIMIT = 200
/**
 * 경로 변경은 **따로** 보관한다(계획서 §8.3).
 * 튄 뒤에도 앱을 계속 쓰면 일반 버퍼에서 밀려나는데, 정작 그게 제일 중요한 기록이다.
 */
export const TRACE_ROUTE_LIMIT = 20

/** 버튼 라벨 등에서 가져올 최대 길이 — 길면 로그가 읽기 어려워진다. */
const LABEL_MAX = 40

/** 링 버퍼 — 상한을 넘으면 앞에서부터 버린다. 원본을 건드리지 않는다. */
export function appendCapped<T>(buf: T[], entry: T, limit: number): T[] {
    const next = [...buf, entry]
    return next.length > limit ? next.slice(next.length - limit) : next
}

/**
 * 사용자가 입력한 글자를 흘리지 않기 위한 관문.
 *
 * 🔴 `input`·`textarea`·`select`의 값과 `contenteditable`의 내용은 **읽지 않는다**.
 * 요소가 입력칸이면 라벨 대신 종류만 남긴다.
 */
export function isUserInputElement(tagName: string, isContentEditable: boolean): boolean {
    if (isContentEditable) return true
    const tag = tagName.toLowerCase()
    return tag === 'input' || tag === 'textarea' || tag === 'select'
}

/** 라벨 정규화 — 줄바꿈·연속 공백을 접고 길이를 자른다. */
export function normalizeLabel(raw: string | null | undefined): string {
    if (!raw) return ''
    const flat = raw.replace(/\s+/g, ' ').trim()
    return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX)}…` : flat
}

/**
 * 눌린 요소를 사람이 읽을 수 있는 식별자로 바꾼다.
 *
 * 무엇을 눌렀는지가 용의자 A·B·C를 가르는 핵심이라, **버튼/링크의 라벨**까지는 남긴다.
 * 다만 입력칸이면 라벨을 읽지 않고 종류만 적는다(§4.1).
 *
 * DOM 탐색은 최대 `maxDepth`단계까지만 — 터치 반응을 늦추지 않기 위해(§8.1).
 */
export function describeElement(
    el: {
        tagName: string
        isContentEditable: boolean
        trace: string | null
        text: string | null
        parent: unknown
    } | null,
    maxDepth = 3,
): string {
    let cur = el
    let depth = 0
    while (cur && depth <= maxDepth) {
        const tag = cur.tagName.toLowerCase()
        if (cur.trace) return `[${cur.trace}]`
        if (isUserInputElement(cur.tagName, cur.isContentEditable)) return `<${tag} 입력칸>`
        if (tag === 'button' || tag === 'a') {
            const label = normalizeLabel(cur.text)
            return label ? `<${tag}> ${label}` : `<${tag}>`
        }
        cur = cur.parent as typeof cur
        depth += 1
    }
    return el ? `<${el.tagName.toLowerCase()}>` : '<unknown>'
}

/** 기록 한 줄을 사람이 읽는 형식으로. 보기 화면과 「텍스트로 복사」가 함께 쓴다. */
export function formatEntry(e: TraceEntry): string {
    const d = new Date(e.t)
    // 🔴 날짜를 함께 적는다 — 시각만 있으면 어느 날 기록인지 가릴 수 없다.
    //    2026-09-22 실측: 하루를 넘긴 기록에서 「오늘 것이 맞나」를 사람이 판별할 수 없었다.
    //    저장은 epoch ms(`t`)라 날짜가 온전히 살아 있고, 깎이던 곳은 표시뿐이었다.
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const DD = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const ms = String(d.getMilliseconds()).padStart(3, '0')
    const pos = e.x !== undefined && e.y !== undefined ? ` (${e.x},${e.y})` : ''
    return `${MM}-${DD} ${hh}:${mm}:${ss}.${ms} ${e.kind.padEnd(10)} ${e.detail}${pos}`
}

/**
 * 경로 변경 줄과 **그 직전 N건**을 묶는다 — 원인은 보통 변경 직전에 있다.
 *
 * 🔴 `after`도 함께 묶는 이유(2026-09-16 실측):
 * 뒤로가기를 누르면 Next가 `popstate`를 먼저 처리해 **화면 갱신이 내 기록보다 앞선다**.
 * 실측에서 `route`가 찍히고 **111ms 뒤에** `popstate`가 찍혔다 — 원인이 결과 아래로 밀린다.
 * 그래서 변경 직후 짧은 시간까지 같은 묶음으로 본다.
 */
export interface TraceCluster {
    route: TraceEntry
    before: TraceEntry[]
    after: TraceEntry[]
}

/** 경로 변경 직후 이만큼은 같은 사건으로 본다(ms). */
export const CLUSTER_AFTER_MS = 1000

export function clusterByRoute(entries: TraceEntry[], before = 5): TraceCluster[] {
    const sorted = [...entries].sort((a, b) => a.t - b.t)
    const out: TraceCluster[] = []
    sorted.forEach((e, i) => {
        if (e.kind !== 'route') return
        const after: TraceEntry[] = []
        for (let j = i + 1; j < sorted.length; j += 1) {
            if (sorted[j].t - e.t > CLUSTER_AFTER_MS) break
            if (sorted[j].kind === 'route') break // 다음 이동은 다음 묶음의 것
            after.push(sorted[j])
        }
        out.push({ route: e, before: sorted.slice(Math.max(0, i - before), i), after })
    })
    return out.reverse() // 최신 묶음이 위
}

/**
 * 경로 변경의 원인 판정.
 *
 * 🔴 **경로만 보고 의심하지 않는다**(2026-09-16 실측에서 오탐 확인).
 * 사용자가 '도정관리'를 직접 눌러 `/raw-stocks → /milling`으로 가도 같은 경로라,
 * 경로로만 판정하면 정상 이동이 전부 빨갛게 뜬다. 그러면 진짜 튐이 파묻힌다.
 *
 * 실제로 쫓는 것은 **「설명되지 않는 이동」** — 누른 것도 없고 뒤로가기도 없이 화면이 바뀐 경우.
 */
export type RouteCause = 'back' | 'code' | 'click' | 'unknown'

export const CAUSE_LABEL: Record<RouteCause, string> = {
    back: '뒤로가기',
    code: '코드가 이동시킴',
    click: '클릭',
    unknown: '원인 불명',
}

/** 원인이 설명되지 않으면 의심한다 — 뒤로가기도 이번 조사에선 확인 대상이라 포함. */
export function isSuspectCause(cause: RouteCause): boolean {
    return cause === 'unknown' || cause === 'back'
}

/**
 * 묶음에서 원인을 읽어낸다 — **가장 가까운 신호 하나**가 원인이다.
 *
 * 🔴 `popstate`를 무조건 우선하면 안 된다(2026-09-16 실측).
 * 3초 전 뒤로가기 뒤에 클릭이 있었는데도 「뒤로가기」로 판정돼 정상 이동이 빨개졌다:
 * ```
 * 20:59:54.626 popstate          ← 별개 사건
 * 20:59:57.711 pointer 도정관리   ← 진짜 원인
 * 21:00:00.596 route / → /milling
 * ```
 * 예외는 `after`의 `popstate` 하나 — 뒤로가기는 화면 갱신보다 늦게 찍히므로,
 * 변경 **직후**에 온 것은 그 변경의 원인이 맞다(`TraceCluster` 주석 참고).
 */
export function causeOfCluster(c: TraceCluster): RouteCause {
    if (c.after.some((e) => e.kind === 'popstate')) return 'back'
    const last = lastSignalOf(c.before)
    if (!last) return 'unknown'
    if (last.kind === 'popstate') return 'back'
    return last.kind === 'push' ? 'code' : 'click'
}

/** 이번 조사가 쫓는 그 이동인지 — 경로만 본다. 의심 판정은 `isSuspectCause`가 따로 한다. */
export function isSuspectRoute(from: string, to: string): boolean {
    return from.startsWith('/raw-stocks') && to.startsWith('/milling')
}

/** 경과 시간을 사람 말로 — 「24.4초 전」처럼. */
export function elapsedLabel(fromT: number, toT: number): string {
    const ms = toT - fromT
    if (ms < 1000) return `${ms}ms 전`
    return `${(ms / 1000).toFixed(1)}초 전`
}

// ---------------------------------------------------------------------------
// localStorage 입출력 — 전부 조용히 실패한다(원칙 2).
// ---------------------------------------------------------------------------

function readKey(key: string): TraceEntry[] {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as TraceEntry[]) : []
    } catch {
        return []
    }
}

function writeKey(key: string, entries: TraceEntry[]): void {
    try {
        localStorage.setItem(key, JSON.stringify(entries))
    } catch {
        // 용량 초과·사생활 모드 등 — 덫 때문에 앱이 멈추면 안 된다.
    }
}

export function readTrace(): TraceEntry[] {
    return readKey(TRACE_KEY)
}

export function readRouteTrace(): TraceEntry[] {
    return readKey(TRACE_ROUTE_KEY)
}

/** 메모리 버퍼에 쌓고, flush 시점에만 localStorage로 내린다(§4.2). */
let pending: TraceEntry[] = []

export function record(kind: TraceKind, detail: string, x?: number, y?: number): void {
    pending.push({ t: Date.now(), kind, detail, ...(x !== undefined ? { x, y } : {}) })
}

/** 원인이 될 수 있는 신호인지 — 나머지(visibility·load·route)는 원인이 아니다. */
export function isSignal(kind: TraceKind): boolean {
    return kind === 'pointer' || kind === 'push' || kind === 'popstate'
}

/** 기록 더미에서 마지막 신호 하나를 고른다. 시간순으로 가장 늦은 것. */
export function lastSignalOf(entries: TraceEntry[]): TraceEntry | null {
    const signals = entries.filter((e) => isSignal(e.kind))
    if (signals.length === 0) return null
    return signals.reduce((a, b) => (b.t >= a.t ? b : a))
}

/**
 * 경로 변경 기록 — 직전 행동을 **한 줄 안에** 함께 남긴다.
 *
 * 🔴 **모듈 전역 변수에 직전 신호를 들고 있으면 안 된다**(2026-09-16 실측).
 * Next가 페이지를 옮기며 이 모듈을 다시 평가하면 그 변수가 초기화돼,
 * 직전에 클릭이 분명히 있었는데도 「직전 행동 없음」으로 찍혔다.
 * 그래서 **이미 저장된 기록에서** 직전 신호를 찾는다 — 저장소는 초기화되지 않는다.
 *
 * 🔴 시간 창으로 자르지 않는다. dev에서는 클릭→이동이 24초 걸리기도 했다(컴파일).
 * 얼마나 떨어져 있든 **직전 행동과 경과 시간을 그대로 적고**, 판단은 사람이 한다.
 */
export function recordRoute(from: string, to: string): void {
    const t = Date.now()
    const last = lastSignalOf([...readTrace(), ...pending])
    const hint = last
        ? `직전 ${last.kind === 'popstate' ? '뒤로가기' : last.detail} (${elapsedLabel(last.t, t)})`
        : '직전 행동 없음'
    record('route', `${from} → ${to} · ${hint}`)
}

export function flushTrace(): void {
    if (pending.length === 0) return
    const batch = pending
    pending = []

    let buf = readKey(TRACE_KEY)
    for (const e of batch) buf = appendCapped(buf, e, TRACE_LIMIT)
    writeKey(TRACE_KEY, buf)

    // 경로 변경은 밀려나지 않게 별도 슬롯에도 복사해 둔다.
    const routes = batch.filter((e) => e.kind === 'route')
    if (routes.length > 0) {
        let rbuf = readKey(TRACE_ROUTE_KEY)
        for (const e of routes) rbuf = appendCapped(rbuf, e, TRACE_ROUTE_LIMIT)
        writeKey(TRACE_ROUTE_KEY, rbuf)
    }
}

export function clearTrace(): void {
    pending = []
    try {
        localStorage.removeItem(TRACE_KEY)
        localStorage.removeItem(TRACE_ROUTE_KEY)
    } catch {
        // 무시
    }
}
