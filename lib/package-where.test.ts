import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPackageWhere, type PackageFilterParams } from './package-where'

/**
 * 조립된 where를 들여다보기 위한 형태. Prisma 타입은 중첩이 깊어 테스트에서 다루기 번거로워
 * 검사에 필요한 갈래만 **필수로** 적어둔다(옵셔널 체이닝 없이 읽으려고).
 * 실제로 비어 있는 경우는 `assert.equal(w.AND, undefined)`로 확인한다.
 */
type WhereNode = {
    category: string
    source?: unknown
    AND: WhereNode[]
    OR: WhereNode[]
    createdAt: { gte?: Date; lt?: Date }
    incomingDate: { gte?: Date; lt?: Date } | null
}

const build = (p: Partial<PackageFilterParams> = {}) =>
    buildPackageWhere({ category: 'RICE', ...p }) as unknown as WhereNode

// ------------------------------------------------------
// 기본 / 기존 필터 (분리 전 동작 보존 확인)
// ------------------------------------------------------

test('필터가 없으면 category만 남고 AND는 붙지 않는다', () => {
    const w = build()
    assert.deepEqual(w, { category: 'RICE' })
})

test('source 단일은 등호, 복수는 in', () => {
    assert.equal(build({ source: 'MILLED' }).source, 'MILLED')
    assert.deepEqual(build({ source: 'MILLED,PURCHASED' }).source, { in: ['MILLED', 'PURCHASED'] })
})

test('알 수 없는 source 값은 무시한다', () => {
    assert.equal(build({ source: 'BOGUS' }).source, undefined)
})

test('품종은 직접 참조와 stock 경유를 OR로 본다', () => {
    const w = build({ varietyId: '1,2' })
    assert.deepEqual(w.AND[0], {
        OR: [{ varietyId: { in: [1, 2] } }, { stock: { varietyId: { in: [1, 2] } } }],
    })
})

test('숫자가 아닌 품종·연도는 걸러진다', () => {
    assert.equal(build({ varietyId: 'abc' }).AND, undefined)
    assert.equal(build({ productionYear: 'abc' }).AND, undefined)
})

test('생산연도는 stock.productionYear 또는 매입일 연도', () => {
    const w = build({ productionYear: '2025' })
    assert.deepEqual(w.AND[0].OR[0], { stock: { productionYear: 2025 } })
    assert.deepEqual(w.AND[0].OR[1], {
        incomingDate: { gte: new Date('2025-01-01'), lt: new Date('2026-01-01') },
    })
})

// ------------------------------------------------------
// 생산자 / 농가명
// ------------------------------------------------------

test('생산자 1명은 생산자명·실농가·매입처를 OR로 부분일치', () => {
    const w = build({ farmerName: '홍길동' })
    assert.deepEqual(w.AND[0], {
        OR: [
            { stock: { farmer: { name: { contains: '홍길동' } } } },
            { stock: { actualFarmer: { contains: '홍길동' } } },
            { purchaseVendor: { contains: '홍길동' } },
        ],
    })
})

test('생산자 여러 명은 이름별 OR로 감싼다', () => {
    const w = build({ farmerName: '홍길동, 김영희' })
    assert.equal(w.AND[0].OR.length, 2)
    assert.deepEqual(w.AND[0].OR[1].OR[2], { purchaseVendor: { contains: '김영희' } })
})

test('공백뿐인 생산자 입력은 필터를 만들지 않는다', () => {
    assert.equal(build({ farmerName: '  ,  ' }).AND, undefined)
})

// ------------------------------------------------------
// 인증구분
// ------------------------------------------------------

test('인증 단일은 등호', () => {
    const w = build({ certType: '유기농' })
    assert.deepEqual(w.AND[0], { stock: { farmer: { group: { certType: '유기농' } } } })
})

test('인증 복수는 in', () => {
    const w = build({ certType: '유기농,무농약' })
    assert.deepEqual(w.AND[0], {
        stock: { farmer: { group: { certType: { in: ['유기농', '무농약'] } } } },
    })
})

// ------------------------------------------------------
// 포장일자 기간
// ------------------------------------------------------

test('기간은 도정산·매입·매입일누락 3분기를 OR로 본다', () => {
    const w = build({ packedFrom: '2026-06-01', packedTo: '2026-06-30' })
    const or = w.AND[0].OR
    assert.equal(or.length, 3)
    assert.equal(or[0].source, 'MILLED')
    assert.ok(or[0].createdAt)
    assert.equal(or[1].source, 'PURCHASED')
    assert.ok(or[1].incomingDate)
    assert.equal(or[2].incomingDate, null)
})

test('종료일은 당일을 포함한다 — 다음날 미만으로 건다', () => {
    const w = build({ packedTo: '2026-06-30' })
    const range = w.AND[0].OR[0].createdAt
    assert.equal(range.gte, undefined)
    assert.deepEqual(range.lt, new Date(2026, 6 - 1, 30 + 1))
})

test('시작일만 줘도 걸린다', () => {
    const w = build({ packedFrom: '2026-06-01' })
    const range = w.AND[0].OR[0].createdAt
    assert.deepEqual(range.gte, new Date(2026, 6 - 1, 1))
    assert.equal(range.lt, undefined)
})

test('월말을 넘는 종료일은 다음달로 굴러간다', () => {
    // 2026-01-31 종료 → 2026-02-01 미만
    const w = build({ packedTo: '2026-01-31' })
    assert.deepEqual(w.AND[0].OR[0].createdAt.lt, new Date(2026, 1, 1))
})

test('형식이 깨진 날짜는 필터를 만들지 않는다', () => {
    assert.equal(build({ packedFrom: '2026/06/01' }).AND, undefined)
    assert.equal(build({ packedFrom: '' }).AND, undefined)
    // 존재하지 않는 날짜가 조용히 굴러가면 안 된다
    assert.equal(build({ packedTo: '2026-02-31' }).AND, undefined)
})

// ------------------------------------------------------
// 조합
// ------------------------------------------------------

test('필터를 겹쳐 걸면 AND로 쌓인다', () => {
    const w = build({
        varietyId: '3',
        productionYear: '2025',
        farmerName: '홍길동',
        certType: '유기농',
        packedFrom: '2026-06-01',
    })
    assert.equal(w.AND.length, 5)
    assert.equal(w.category, 'RICE')
})
