import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONNECTION_ERROR, settle } from './settle-action'

test('settle: 성공 결과는 그대로 통과', async () => {
    const res = await settle(Promise.resolve({ success: true as const, data: 3 }))
    assert.deepEqual(res, { success: true, data: 3 })
})

test('settle: 액션이 돌려준 실패도 그대로 — 서버가 준 문구를 덮지 않는다', async () => {
    const res = await settle(Promise.resolve({ success: false as const, error: '재고가 부족합니다' }))
    assert.deepEqual(res, { success: false, error: '재고가 부족합니다' })
})

test('settle: reject는 실패 결과로 — 호출부 `!res.success` 분기가 받는다', async () => {
    const original = console.error
    console.error = () => {}
    try {
        const res = await settle(Promise.reject(new TypeError('Failed to fetch')))
        assert.deepEqual(res, { success: false, error: CONNECTION_ERROR })
    } finally {
        console.error = original
    }
})
