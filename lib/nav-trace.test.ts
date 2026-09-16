import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    appendCapped,
    isUserInputElement,
    normalizeLabel,
    describeElement,
    clusterByRoute,
    causeOfCluster,
    lastSignalOf,
    isSignal,
    isSuspectCause,
    isSuspectRoute,
    elapsedLabel,
    formatEntry,
    type TraceEntry,
} from './nav-trace'

const entry = (t: number, kind: TraceEntry['kind'], detail = ''): TraceEntry => ({ t, kind, detail })

// --- 링 버퍼 ---------------------------------------------------------------

test('appendCapped: 상한 아래면 그대로 쌓인다', () => {
    const r = appendCapped([1, 2], 3, 5)
    assert.deepEqual(r, [1, 2, 3])
})

test('appendCapped: 상한을 넘으면 오래된 것부터 버린다', () => {
    const r = appendCapped([1, 2, 3], 4, 3)
    assert.deepEqual(r, [2, 3, 4])
})

test('appendCapped: 원본 배열을 건드리지 않는다', () => {
    const src = [1, 2]
    appendCapped(src, 3, 5)
    assert.deepEqual(src, [1, 2])
})

// --- 🔴 입력값 제외 (계획서 §4.1) ------------------------------------------

test('isUserInputElement: input·textarea·select·contenteditable을 입력칸으로 본다', () => {
    assert.equal(isUserInputElement('INPUT', false), true)
    assert.equal(isUserInputElement('textarea', false), true)
    assert.equal(isUserInputElement('SELECT', false), true)
    assert.equal(isUserInputElement('DIV', true), true)
    assert.equal(isUserInputElement('BUTTON', false), false)
})

test('describeElement: 입력칸은 라벨을 읽지 않고 종류만 남긴다 — 입력값 유출 차단', () => {
    const el = {
        tagName: 'INPUT',
        isContentEditable: false,
        trace: null,
        text: '홍길동', // 사용자가 친 생산자명. 절대 새어나가면 안 된다.
        parent: null,
    }
    const r = describeElement(el)
    assert.equal(r, '<input 입력칸>')
    assert.ok(!r.includes('홍길동'))
})

test('describeElement: 입력칸이 버튼 안에 있어도 입력칸이 먼저 걸린다', () => {
    const el = {
        tagName: 'TEXTAREA',
        isContentEditable: false,
        trace: null,
        text: '1004',
        parent: { tagName: 'BUTTON', isContentEditable: false, trace: null, text: '적용하기', parent: null },
    }
    assert.equal(describeElement(el), '<textarea 입력칸>')
})

// --- 요소 식별자 -----------------------------------------------------------

test('describeElement: 버튼이면 라벨까지 남긴다 — 용의자 A·B·C를 가르는 핵심', () => {
    const el = {
        tagName: 'BUTTON',
        isContentEditable: false,
        trace: null,
        text: '수정',
        parent: null,
    }
    assert.equal(describeElement(el), '<button> 수정')
})

test('describeElement: data-trace가 있으면 그것을 최우선으로 쓴다', () => {
    const el = {
        tagName: 'BUTTON',
        isContentEditable: false,
        trace: 'cart-update',
        text: '수정',
        parent: null,
    }
    assert.equal(describeElement(el), '[cart-update]')
})

test('describeElement: 자식 span을 눌러도 부모 버튼을 찾아 올라간다', () => {
    const el = {
        tagName: 'SPAN',
        isContentEditable: false,
        trace: null,
        text: '도정',
        parent: {
            tagName: 'BUTTON',
            isContentEditable: false,
            trace: 'nav-tab-milling',
            text: '도정',
            parent: null,
        },
    }
    assert.equal(describeElement(el), '[nav-tab-milling]')
})

test('describeElement: maxDepth를 넘으면 더 올라가지 않는다 — 터치 지연 방지', () => {
    const deep = {
        tagName: 'SPAN',
        isContentEditable: false,
        trace: null,
        text: null,
        parent: {
            tagName: 'SPAN',
            isContentEditable: false,
            trace: null,
            text: null,
            parent: {
                tagName: 'SPAN',
                isContentEditable: false,
                trace: null,
                text: null,
                parent: {
                    tagName: 'SPAN',
                    isContentEditable: false,
                    trace: null,
                    text: null,
                    parent: {
                        tagName: 'BUTTON',
                        isContentEditable: false,
                        trace: 'too-far',
                        text: '못 찾음',
                        parent: null,
                    },
                },
            },
        },
    }
    assert.equal(describeElement(deep, 3), '<span>')
})

test('describeElement: null이면 unknown', () => {
    assert.equal(describeElement(null), '<unknown>')
})

// --- 라벨 정규화 -----------------------------------------------------------

test('normalizeLabel: 줄바꿈·연속 공백을 한 칸으로 접는다', () => {
    assert.equal(normalizeLabel('  도정\n  작업   시작 '), '도정 작업 시작')
})

test('normalizeLabel: 40자를 넘으면 자른다', () => {
    const r = normalizeLabel('가'.repeat(60))
    assert.equal(r.length, 41) // 40자 + 말줄임표
    assert.ok(r.endsWith('…'))
})

test('normalizeLabel: 빈 값은 빈 문자열', () => {
    assert.equal(normalizeLabel(null), '')
    assert.equal(normalizeLabel(undefined), '')
    assert.equal(normalizeLabel('   '), '')
})

// --- 경로 변경 묶음 --------------------------------------------------------

test('clusterByRoute: 경로 변경 줄과 그 직전 N건을 묶는다', () => {
    const entries = [
        entry(1, 'pointer', 'a'),
        entry(2, 'pointer', 'b'),
        entry(3, 'route', '/raw-stocks → /milling'),
        entry(4, 'pointer', 'c'),
    ]
    const r = clusterByRoute(entries, 5)
    assert.equal(r.length, 1)
    assert.equal(r[0].route.detail, '/raw-stocks → /milling')
    assert.deepEqual(r[0].before.map((e) => e.detail), ['a', 'b'])
})

// 🔴 실측 결함 ②: 뒤로가기가 화면 갱신보다 111ms 늦게 찍혔다(2026-09-16)
test('clusterByRoute: 경로 변경 직후 1초 내 기록도 같은 묶음에 넣는다 — 뒤로가기가 늦게 찍히므로', () => {
    const entries = [
        entry(1000, 'pointer', 'a'),
        entry(2000, 'route', '/milling → /raw-stocks'),
        entry(2111, 'popstate', '현재 /raw-stocks'), // 결과보다 늦게 도착한 원인
    ]
    const r = clusterByRoute(entries)
    assert.deepEqual(r[0].after.map((e) => e.kind), ['popstate'])
})

test('clusterByRoute: 1초를 넘긴 뒤 기록은 다음 사건으로 본다', () => {
    const entries = [entry(2000, 'route', 'r'), entry(3500, 'pointer', '한참 뒤')]
    const r = clusterByRoute(entries)
    assert.deepEqual(r[0].after, [])
})

test('clusterByRoute: 다음 경로 변경이 오면 after를 거기서 끊는다', () => {
    const entries = [
        entry(1000, 'route', '첫번째'),
        entry(1100, 'pointer', 'x'),
        entry(1200, 'route', '두번째'),
        entry(1300, 'pointer', 'y'),
    ]
    const r = clusterByRoute(entries)
    const first = r.find((c) => c.route.detail === '첫번째')!
    assert.deepEqual(first.after.map((e) => e.detail), ['x'])
})

// --- 🔴 실측 결함 ①: 경로만 보고 의심하면 정상 이동이 전부 빨개진다 --------

test('causeOfCluster: 직전에 클릭이 있으면 정상 이동이다', () => {
    const c = {
        route: entry(2000, 'route', '/raw-stocks → /milling'),
        before: [entry(1000, 'pointer', '<a> 도정관리')],
        after: [],
    }
    assert.equal(causeOfCluster(c), 'click')
    assert.equal(isSuspectCause('click'), false)
})

test('causeOfCluster: 코드가 보낸 이동은 code — 용의자 A·B·C', () => {
    const c = {
        route: entry(2000, 'route', 'r'),
        before: [entry(900, 'pointer', '<button>'), entry(1000, 'push', '용의자A 장바구니 수정 → /milling')],
        after: [],
    }
    assert.equal(causeOfCluster(c), 'code')
})

test('causeOfCluster: popstate가 after에 있어도 뒤로가기로 잡는다 — 늦게 찍히는 게 정상', () => {
    const c = {
        route: entry(2000, 'route', 'r'),
        before: [entry(1000, 'pointer', '<div>')],
        after: [entry(2111, 'popstate', '현재 /raw-stocks')],
    }
    assert.equal(causeOfCluster(c), 'back')
    assert.equal(isSuspectCause('back'), true)
})

// 🔴 실측 결함 ③: popstate를 무조건 우선하면 그 뒤의 클릭을 무시한다(2026-09-16)
test('causeOfCluster: 뒤로가기 뒤에 클릭이 있으면 클릭이 원인이다 — 가장 가까운 신호가 이긴다', () => {
    const c = {
        route: entry(21_00_00, 'route', '/ → /milling'),
        before: [
            entry(20_59_54, 'popstate', '현재 /'), // 3초 전, 별개 사건
            entry(20_59_57, 'pointer', '<a> 도정관리'), // 진짜 원인
        ],
        after: [],
    }
    assert.equal(causeOfCluster(c), 'click')
})

test('causeOfCluster: before의 마지막이 popstate면 뒤로가기가 맞다', () => {
    const c = {
        route: entry(3000, 'route', 'r'),
        before: [entry(1000, 'pointer', '<a> 어딘가'), entry(2000, 'popstate', '현재 /')],
        after: [],
    }
    assert.equal(causeOfCluster(c), 'back')
})

test('causeOfCluster: after의 popstate는 before에 무엇이 있든 이긴다 — 늦게 찍히는 진짜 원인', () => {
    const c = {
        route: entry(2000, 'route', 'r'),
        before: [entry(1000, 'pointer', '<a> 도정관리')],
        after: [entry(2010, 'popstate', '현재 /')],
    }
    assert.equal(causeOfCluster(c), 'back')
})

// --- 마지막 신호 고르기 -----------------------------------------------------

test('lastSignalOf: 시간이 가장 늦은 신호를 고른다', () => {
    const r = lastSignalOf([
        entry(1000, 'pointer', 'a'),
        entry(3000, 'push', 'c'),
        entry(2000, 'popstate', 'b'),
    ])
    assert.equal(r?.detail, 'c')
})

test('lastSignalOf: 신호가 아닌 것(visibility·load·route)은 무시한다', () => {
    const r = lastSignalOf([
        entry(1000, 'pointer', 'a'),
        entry(5000, 'visibility', 'visible'),
        entry(6000, 'load', '/'),
        entry(7000, 'route', 'r'),
    ])
    assert.equal(r?.detail, 'a')
})

test('lastSignalOf: 신호가 없으면 null', () => {
    assert.equal(lastSignalOf([entry(1000, 'visibility', 'hidden')]), null)
})

test('isSignal: 원인이 될 수 있는 종류만 참', () => {
    assert.equal(isSignal('pointer'), true)
    assert.equal(isSignal('push'), true)
    assert.equal(isSignal('popstate'), true)
    assert.equal(isSignal('visibility'), false)
    assert.equal(isSignal('load'), false)
    assert.equal(isSignal('route'), false)
})

test('causeOfCluster: 아무 신호도 없으면 원인 불명 — 이게 진짜 찾는 것', () => {
    const c = {
        route: entry(2000, 'route', 'r'),
        before: [entry(1000, 'visibility', 'visible')],
        after: [],
    }
    assert.equal(causeOfCluster(c), 'unknown')
    assert.equal(isSuspectCause('unknown'), true)
})

test('isSuspectRoute는 경로만 본다 — 정상 클릭 이동도 true라서 단독 판정 금지', () => {
    assert.equal(isSuspectRoute('/raw-stocks', '/milling'), true)
    // 같은 경로라도 원인이 클릭이면 의심 대상이 아니다
    assert.equal(isSuspectCause('click'), false)
})

// --- 경과 시간 표기 --------------------------------------------------------

test('elapsedLabel: 1초 미만은 ms로', () => {
    assert.equal(elapsedLabel(1000, 1300), '300ms 전')
})

test('elapsedLabel: 1초 이상은 초로 — dev에서 24초까지 벌어진다', () => {
    assert.equal(elapsedLabel(0, 24400), '24.4초 전')
})

test('clusterByRoute: before 개수를 넘으면 가까운 것만 남긴다', () => {
    const entries = [
        entry(1, 'pointer', 'a'),
        entry(2, 'pointer', 'b'),
        entry(3, 'pointer', 'c'),
        entry(4, 'route', 'r'),
    ]
    const r = clusterByRoute(entries, 2)
    assert.deepEqual(r[0].before.map((e) => e.detail), ['b', 'c'])
})

test('clusterByRoute: 최신 묶음이 위로 온다', () => {
    const entries = [entry(1, 'route', '첫번째'), entry(2, 'route', '두번째')]
    const r = clusterByRoute(entries)
    assert.deepEqual(r.map((c) => c.route.detail), ['두번째', '첫번째'])
})

test('clusterByRoute: 시간순이 뒤섞여 들어와도 정렬해서 묶는다', () => {
    const entries = [entry(3, 'route', 'r'), entry(1, 'pointer', 'a'), entry(2, 'pointer', 'b')]
    const r = clusterByRoute(entries)
    assert.deepEqual(r[0].before.map((e) => e.detail), ['a', 'b'])
})

test('clusterByRoute: 경로 변경이 없으면 빈 배열', () => {
    assert.deepEqual(clusterByRoute([entry(1, 'pointer', 'a')]), [])
})

// --- 쫓는 경로 판별 --------------------------------------------------------

test('isSuspectRoute: 원물재고 → 도정목록이 이번에 쫓는 이동', () => {
    assert.equal(isSuspectRoute('/raw-stocks', '/milling'), true)
    assert.equal(isSuspectRoute('/raw-stocks?tab=misc', '/milling'), true)
})

test('isSuspectRoute: 반대 방향이나 무관한 이동은 아니다', () => {
    assert.equal(isSuspectRoute('/milling', '/raw-stocks'), false)
    assert.equal(isSuspectRoute('/raw-stocks', '/packages'), false)
})

// --- 표시 형식 -------------------------------------------------------------

test('formatEntry: 시각·종류·내용이 한 줄에 담긴다', () => {
    const d = new Date(2026, 8, 16, 14, 5, 3, 7)
    const r = formatEntry({ t: d.getTime(), kind: 'route', detail: '/raw-stocks → /milling' })
    assert.ok(r.startsWith('14:05:03.007'))
    assert.ok(r.includes('route'))
    assert.ok(r.includes('/raw-stocks → /milling'))
})

test('formatEntry: 좌표가 있으면 덧붙인다', () => {
    const r = formatEntry({ t: Date.now(), kind: 'pointer', detail: '<button> 수정', x: 120, y: 700 })
    assert.ok(r.endsWith('(120,700)'))
})
