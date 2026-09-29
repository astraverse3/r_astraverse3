import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lotTail, pickFirstLot, shouldAlignToFirstLot } from './lot-generation'

// 🔴 TZ=UTC·TZ=Asia/Seoul 두 번. 입고일은 UTC 자정(화면 입력)과 KST 자정이 섞여 저장된다 — 둘 다 같은 날로 읽혀야 한다.

const TAIL = '18-15102443-11'
const c = (lotNo: string, iso: string) => ({ lotNo, incomingDate: new Date(iso) })

test('lotTail: 앞 6자리(입고일)를 뗀 나머지', () => {
    assert.equal(lotTail('251020-18-15102443-11'), TAIL)
    assert.equal(lotTail('251016-131-15107943-501'), '131-15107943-501')
})

test('pickFirstLot: 뒷자리 같은 것 중 가장 이른 입고일 — 윤영식 IPS 5개 로트 모양', () => {
    const first = pickFirstLot([
        c('251021-18-15102443-11', '2025-10-21T00:00:00Z'),
        c('251020-18-15102443-11', '2025-10-20T00:00:00Z'),
        c('251020-18-15102443-11', '2025-10-20T00:00:00Z'),
        c('251104-18-15102443-11', '2025-11-04T00:00:00Z'),
    ], TAIL)
    assert.deepEqual(first, { date: '2025-10-20', lotNo: '251020-18-15102443-11', count: 2 })
})

test('pickFirstLot: 뒷자리가 다르면 후보가 아니다 — 작목반이 바뀌었거나 옛 품목코드로 저장된 로트', () => {
    assert.equal(pickFirstLot([c('251020-12-15102443-11', '2025-10-20T00:00:00Z')], TAIL), null)
    assert.equal(pickFirstLot([c('251020-18-99999999-11', '2025-10-20T00:00:00Z')], TAIL), null)
})

test('pickFirstLot: KST 자정 저장분(UTC 전날 15:00)도 그 날로 비교', () => {
    const first = pickFirstLot([
        c('251021-18-15102443-11', '2025-10-21T00:00:00Z'),
        c('251020-18-15102443-11', '2025-10-19T15:00:00Z'), // KST 10/20 00:00
    ], TAIL)
    assert.equal(first?.date, '2025-10-20')
})

test('pickFirstLot: 후보가 없으면 null', () => {
    assert.equal(pickFirstLot([], TAIL), null)
})

test('shouldAlignToFirstLot: 첫 로트보다 늦을 때만 맞춘다', () => {
    const first = { date: '2026-10-20', lotNo: '261020-18-15102443-11', count: 3 }
    assert.equal(shouldAlignToFirstLot(first, '2026-10-22'), true)
    assert.equal(shouldAlignToFirstLot(first, '2026-10-20'), false) // 같은 날 = 이미 같은 로트
    assert.equal(shouldAlignToFirstLot(first, '2026-10-18'), false) // 소급 입력 = 새 로트
    assert.equal(shouldAlignToFirstLot(null, '2026-10-22'), false)
})
