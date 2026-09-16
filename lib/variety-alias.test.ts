import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAlias,
  validateAlias,
  validateAliasList,
  validateVarietyName,
  type AliasVariety,
} from './variety-alias'

// 실데이터에서 뽑은 최소 집합(2026-09-15 Neon 실측 별칭 6종 중 관련분)
const VARIETIES: AliasVariety[] = [
  { id: 1, name: '서농22호', aliases: ['가바'] },
  { id: 2, name: '흑미', aliases: ['가바흑미'] },
  { id: 3, name: '발아현미', aliases: ['가바발아현미'] },
  { id: 4, name: '천지향1세', aliases: ['천지향'] },
  { id: 5, name: '찰보리', aliases: ['보리'] },
]

const target = (id: number): AliasVariety => {
  const v = VARIETIES.find((x) => x.id === id)
  if (!v) throw new Error('unreachable')
  return v
}

function reasonOf(r: ReturnType<typeof validateAlias>): string {
  assert.equal(r.ok, false)
  if (r.ok) throw new Error('unreachable')
  return r.reason
}

test('빈 값은 거절한다', () => {
  assert.equal(reasonOf(validateAlias('   ', target(1), VARIETIES)), 'empty')
})

test('그 품종의 이름과 같으면 거절한다 — 별칭이 필요 없다', () => {
  assert.equal(reasonOf(validateAlias('서농22호', target(1), VARIETIES)), 'same_as_name')
})

test('같은 품종에 이미 있으면 거절한다', () => {
  assert.equal(reasonOf(validateAlias('가바', target(1), VARIETIES)), 'duplicate')
})

test('다른 품종의 이름·별칭과 겹치면 거절한다 (구 결정 S)', () => {
  // 이름과 겹침
  const byName = validateAlias('흑미', target(1), VARIETIES)
  assert.equal(reasonOf(byName), 'conflict')
  assert.equal(byName.ok, false)
  if (!byName.ok) assert.match(byName.message, /흑미/)

  // 다른 품종의 별칭과 겹침
  assert.equal(reasonOf(validateAlias('보리', target(1), VARIETIES)), 'conflict')
})

test('도정 단어가 섞이면 거절한다 (구 결정 T)', () => {
  assert.equal(
    reasonOf(validateAlias('백미 천지향5세', target(4), VARIETIES)),
    'milling_token',
  )
  assert.equal(reasonOf(validateAlias('현미천지향5세', target(4), VARIETIES)), 'milling_token')
})

test('가바발아현미는 통과한다 — 위탁가공 별도품종을 먼저 걷어내므로', () => {
  // 실제 쓰이는 별칭. 도정검사가 이걸 막으면 기존 데이터가 재등록 불가가 된다.
  const r = validateAlias('가바발아현미', { id: 3, name: '발아현미', aliases: [] }, [
    { id: 3, name: '발아현미', aliases: [] },
  ])
  assert.equal(r.ok, true)
})

test('비교는 공백을 무시한다 — 매처와 같은 규칙', () => {
  // 매처가 `stripSpaces` 동일비교로 별칭을 찾으므로, 공백만 다른 값은 같은 값이다
  assert.equal(reasonOf(validateAlias('가 바', target(1), VARIETIES)), 'duplicate')
  assert.equal(reasonOf(validateAlias('서농 22호', target(1), VARIETIES)), 'same_as_name')
})

test('normalizeAlias: 앞뒤 공백·줄바꿈·다중공백을 정리한다', () => {
  assert.equal(normalizeAlias('  가바 \n 현미쌀 '), '가바 현미쌀')
})

test('통과한 값은 정규화된 표기로 돌려준다', () => {
  const r = validateAlias('  가바  쌀 ', target(1), VARIETIES)
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.value, '가바 쌀')
})

test('validateAliasList: 목록 안의 중복을 걸러낸다', () => {
  const r = validateAliasList(['알파', '알 파'], { id: 1, name: '서농22호', aliases: [] }, VARIETIES)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'duplicate')
    assert.equal(r.input, '알 파')
  }
})

test('validateAliasList: 기존 6종은 전부 통과한다 (리스크 §6 — 기존 값이 새 규칙에 걸리지 않는지)', () => {
  for (const v of VARIETIES) {
    const r = validateAliasList(v.aliases, { ...v, aliases: [] }, VARIETIES)
    assert.equal(r.ok, true, `${v.name}: ${r.ok ? '' : r.message}`)
  }
})

// ------------------------------------------------------
// 품종명 검증 — 이름↔별칭 충돌 (validateVarietyName)
// ------------------------------------------------------

function nameReason(r: ReturnType<typeof validateVarietyName>): string {
  assert.equal(r.ok, false)
  if (r.ok) throw new Error('unreachable')
  return r.reason
}

test('품종명: 빈 값은 거절한다', () => {
  assert.equal(nameReason(validateVarietyName('  ', null, VARIETIES)), 'empty')
})

test('품종명: 다른 품종의 이름과 같으면 거절한다', () => {
  assert.equal(nameReason(validateVarietyName('흑미', null, VARIETIES)), 'duplicate_name')
})

test('품종명: 공백만 다른 이름도 거절한다 — 매처가 구분하지 못한다', () => {
  // DB의 name unique는 이걸 통과시킨다. 통과하면 매처에 같은 이름 둘이 생긴다.
  assert.equal(nameReason(validateVarietyName('서농 22호', null, VARIETIES)), 'duplicate_name')
})

test('🔴 품종명: 다른 품종이 별칭으로 쓰는 이름은 거절한다 (efdbeb7 재발 방지)', () => {
  // 「보리」는 찰보리의 별칭. 이 이름으로 품종을 만들면 매처가 name을 먼저 봐서
  // 찰보리의 별칭이 그 순간 무력화된다.
  const r = validateVarietyName('보리', null, VARIETIES)
  assert.equal(nameReason(r), 'alias_taken')
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.message, /찰보리/)
})

test('품종명: 자기 자신의 이름은 통과한다 — 곡종만 바꾸는 경우', () => {
  const r = validateVarietyName('서농22호', 1, VARIETIES)
  assert.equal(r.ok, true)
})

test('품종명: 자기 별칭과 같으면 거절한다', () => {
  // 찰보리(id 5)를 「보리」로 개명 — 자기 별칭과 충돌
  assert.equal(nameReason(validateVarietyName('보리', 5, VARIETIES)), 'own_alias')
})

test('품종명: 겹치지 않으면 통과하고 정규화된 표기를 돌려준다', () => {
  const r = validateVarietyName('  새청무  ', null, VARIETIES)
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.value, '새청무')
})

test('품종명: 기존 41종은 자기 id로 전부 통과한다 (개명 없이 곡종만 고치는 경우)', () => {
  for (const v of VARIETIES) {
    assert.equal(validateVarietyName(v.name, v.id, VARIETIES).ok, true, v.name)
  }
})
