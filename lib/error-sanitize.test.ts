import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardErrorMessage, sanitizeErrorMessage } from './error-sanitize'

// lib/auth-guard.ts의 클래스와 같은 name을 가진 오류 (auth-guard는 next-auth를 끌고 와 import하지 않는다)
function named(name: string, message: string): Error {
    const e = new Error(message)
    e.name = name
    return e
}

test('guardErrorMessage: 세션 만료는 한글 안내', () => {
    assert.equal(guardErrorMessage(named('AuthError', 'Unauthorized'), '실패'), '로그인이 만료됐어요. 새로고침 후 다시 로그인해 주세요.')
})

test('guardErrorMessage: 권한 없음은 한글 안내 (영문 권한 키를 노출하지 않는다)', () => {
    assert.equal(guardErrorMessage(named('ForbiddenError', 'Forbidden: missing permission "OPERATION_MANAGE"'), '실패'), '이 작업을 할 권한이 없어요.')
})

test('guardErrorMessage: 그 밖의 오류는 fallback — 메시지를 흘리지 않는다', () => {
    assert.equal(guardErrorMessage(new Error('재고가 부족합니다'), '실패'), '실패')
    assert.equal(guardErrorMessage('문자열', '실패'), '실패')
})

test('sanitizeErrorMessage: 가드 오류는 영문 원문 대신 한글 안내', () => {
    assert.equal(sanitizeErrorMessage(named('ForbiddenError', 'Forbidden: Admin only'), '실패'), '이 작업을 할 권한이 없어요.')
    assert.equal(sanitizeErrorMessage(named('AuthError', 'Unauthorized'), '실패'), '로그인이 만료됐어요. 새로고침 후 다시 로그인해 주세요.')
})

test('sanitizeErrorMessage: 기존 동작 유지 — 일반 메시지는 통과, 민감 정보는 fallback', () => {
    assert.equal(sanitizeErrorMessage(new Error('재고가 부족합니다'), '실패'), '재고가 부족합니다')
    assert.equal(sanitizeErrorMessage(new Error('Invalid prisma.stock.update() invocation'), '실패'), '실패')
})
