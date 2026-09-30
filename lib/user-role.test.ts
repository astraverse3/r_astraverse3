import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isApprovedRole, USER_ROLE } from './user-role'

test('isApprovedRole: ADMIN·USER만 통과', () => {
  assert.equal(isApprovedRole(USER_ROLE.ADMIN), true)
  assert.equal(isApprovedRole(USER_ROLE.USER), true)
})

test('isApprovedRole: 승인 대기·삭제된 사용자는 막는다', () => {
  assert.equal(isApprovedRole(USER_ROLE.PENDING), false)
  assert.equal(isApprovedRole(USER_ROLE.REVOKED), false)
})

test('isApprovedRole: 모르는 값·빈 값도 막는다 (허용 목록)', () => {
  assert.equal(isApprovedRole(''), false)
  assert.equal(isApprovedRole(undefined), false)
  assert.equal(isApprovedRole(null), false)
  assert.equal(isApprovedRole('admin'), false) // 대소문자 다르면 다른 값
  assert.equal(isApprovedRole('GUEST'), false)
})
