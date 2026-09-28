import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateLotNo } from './lot-generation'

const lot = (incomingDate: Date) =>
    generateLotNo({
        incomingDate,
        varietyType: 'URUCHI',
        varietyName: '새청무',
        millingType: '백미',
        certNo: '1234',
        farmerGroupCode: '01',
        farmerNo: '001',
    })

// 🔴 로트 날짜는 KST — TZ=UTC(실서버)·Asia/Seoul(개발 PC) 어디서든 같아야 한다 (§39)

test('로트 날짜: UTC 자정 입고일(원물 입고 전량)은 그 날짜', () => {
    assert.equal(lot(new Date('2026-09-15T00:00:00Z')), '260915-11-1234-01001')
})

test('로트 날짜: KST 자정 입고일도 그 날짜 — UTC로 자르면 260914가 된다', () => {
    assert.equal(lot(new Date('2026-09-14T15:00:00Z')).slice(0, 6), '260915')
})

test('로트 날짜: KST 새벽 생성(now)도 한국 날짜', () => {
    assert.equal(lot(new Date('2026-12-31T16:30:00Z')).slice(0, 6), '270101')
})
