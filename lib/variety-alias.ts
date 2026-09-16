// 품종 별칭 검증 — 순수 모듈 (계획서 `plan-품종별칭-관리화면.md` 결정 X)
//
// 🔴 2026-09-16에 발주서 수동지정(`learnVarietyAlias`)이 제거되면서, 별칭을 만드는 경로는
//    품종 관리 화면 하나뿐이 됐다. 즉 **이 검증이 별칭을 막는 마지막이자 유일한 곳**이다.
//    화면(즉시 피드백)과 서버 액션(전수 재검증)이 같은 함수를 부른다.
//
// 비교 규칙은 매처와 같아야 한다 — 매처가 별칭을 `stripSpaces` 동일비교로 찾기 때문에,
// 여기서 공백만 다른 값을 통과시키면 화면엔 두 칩인데 매처엔 같은 값이 된다.

import { hasMillingToken, stripSpaces } from './purchase-order-matcher'

/** 검증에 필요한 품종 최소 형태(전체 목록을 주입 — 순수함수 유지). */
export type AliasVariety = {
  id: number
  name: string
  aliases: string[]
}

export type AliasRejectReason =
  | 'empty' // 빈 값
  | 'same_as_name' // 그 품종의 이름과 같음 → 별칭이 필요 없다
  | 'duplicate' // 같은 품종에 이미 있음
  | 'conflict' // 다른 품종의 이름·별칭과 같음(구 결정 S)
  | 'milling_token' // 도정 단어가 섞임(구 결정 T)

export type AliasValidation =
  | { ok: true; value: string }
  | { ok: false; reason: AliasRejectReason; message: string }

/** 앞뒤 공백 제거 + 내부 다중공백을 한 칸으로. 저장되는 표기는 이 결과다. */
export function normalizeAlias(input: string): string {
  return input.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * 별칭 1개를 검증한다.
 *
 * @param input      사용자가 입력한 원문
 * @param target     편집 중인 품종. `aliases`는 **화면의 현재 칩 목록**(저장 전 상태)을 넘긴다
 * @param varieties  전체 품종 목록(target 포함/미포함 무관 — id로 걸러낸다)
 */
export function validateAlias(
  input: string,
  target: AliasVariety,
  varieties: AliasVariety[],
): AliasValidation {
  const value = normalizeAlias(input)
  if (!value) {
    return { ok: false, reason: 'empty', message: '별칭을 입력하세요.' }
  }

  const key = stripSpaces(value)

  if (stripSpaces(target.name) === key) {
    return {
      ok: false,
      reason: 'same_as_name',
      message: '품종명과 같습니다. 별칭 없이도 매칭됩니다.',
    }
  }

  if (target.aliases.some((a) => stripSpaces(a) === key)) {
    return { ok: false, reason: 'duplicate', message: '이미 등록된 별칭입니다.' }
  }

  // 구 결정 S — 매처는 먼저 만난 쪽을 집는다. 겹치면 엉뚱한 품종에 붙는다.
  const clash = varieties.find(
    (v) =>
      v.id !== target.id &&
      (stripSpaces(v.name) === key || v.aliases.some((a) => stripSpaces(a) === key)),
  )
  if (clash) {
    return {
      ok: false,
      reason: 'conflict',
      message: `「${clash.name}」이(가) 이미 쓰는 이름입니다.`,
    }
  }

  // 구 결정 T — 도정이 품종 기본값으로 굳어 나중에 조용한 오매칭이 된다.
  if (hasMillingToken(value)) {
    return {
      ok: false,
      reason: 'milling_token',
      message: '백미·현미 같은 도정 단어는 별칭에 넣을 수 없습니다.',
    }
  }

  return { ok: true, value }
}

export type AliasListValidation =
  | { ok: true; values: string[] }
  | { ok: false; input: string; reason: AliasRejectReason; message: string }

/**
 * 별칭 목록 전체를 검증한다(서버 액션의 전수 재검증 — 클라이언트 검증을 믿지 않는다).
 * 앞에서 통과한 값을 누적해 가며 검사하므로 목록 안의 중복도 걸린다.
 */
export function validateAliasList(
  inputs: string[],
  target: AliasVariety,
  varieties: AliasVariety[],
): AliasListValidation {
  const accepted: string[] = []
  for (const input of inputs) {
    const r = validateAlias(input, { ...target, aliases: accepted }, varieties)
    if (!r.ok) return { ok: false, input, reason: r.reason, message: r.message }
    accepted.push(r.value)
  }
  return { ok: true, values: accepted }
}

// ------------------------------------------------------
// 품종명 검증 — 🔴 이름과 별칭은 **같은 네임스페이스**를 공유한다
//
// 매처 `resolveVariety`는 **name 정확일치를 먼저** 보고, 실패해야 aliases를 본다.
// 그래서 어떤 품종의 이름이 다른 품종의 별칭과 겹치면 **그 별칭은 그 순간 무력화된다.**
// `efdbeb7`(보리·찰보리 통합)에서 실제로 겪은 일 — 빈 품종 하나가 별칭을 가로챘다.
//
// `validateAlias`는 「별칭 → 다른 품종의 이름·별칭」 방향만 막는다. 이 함수가 반대 방향이다.
// 둘이 같은 파일에 있는 건 의도다 — 한쪽만 고치면 다른 쪽으로 같은 충돌이 들어온다.
// ------------------------------------------------------

export type NameRejectReason =
  | 'empty'
  | 'duplicate_name' // 다른 품종의 이름과 같음
  | 'alias_taken' // 다른 품종이 별칭으로 쓰는 이름 → 그 별칭이 죽는다
  | 'own_alias' // 자기 자신의 별칭과 같음

export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: NameRejectReason; message: string }

/**
 * 품종명을 검증한다.
 *
 * @param input      입력한 이름
 * @param targetId   수정 중인 품종 id. **신규 등록이면 `null`**
 * @param varieties  전체 품종 목록
 */
export function validateVarietyName(
  input: string,
  targetId: number | null,
  varieties: AliasVariety[],
): NameValidation {
  const value = normalizeAlias(input) // 정리 규칙은 별칭과 같다
  if (!value) {
    return { ok: false, reason: 'empty', message: '품종명을 입력하세요.' }
  }

  const key = stripSpaces(value)

  // 공백만 다른 이름은 매처가 구분하지 못한다(같은 값으로 본다) → 막는다.
  // DB의 name unique는 공백 차이를 다른 값으로 보므로 여기서만 걸린다.
  const sameName = varieties.find((v) => v.id !== targetId && stripSpaces(v.name) === key)
  if (sameName) {
    return {
      ok: false,
      reason: 'duplicate_name',
      message: `이미 존재하는 품종입니다${sameName.name === value ? '' : ` (${sameName.name})`}.`,
    }
  }

  const aliasOwner = varieties.find(
    (v) => v.id !== targetId && v.aliases.some((a) => stripSpaces(a) === key),
  )
  if (aliasOwner) {
    return {
      ok: false,
      reason: 'alias_taken',
      message: `「${aliasOwner.name}」이(가) 별칭으로 쓰는 이름입니다. 이 이름을 쓰면 그 별칭이 무력화됩니다.`,
    }
  }

  const self = targetId === null ? null : varieties.find((v) => v.id === targetId)
  if (self?.aliases.some((a) => stripSpaces(a) === key)) {
    return {
      ok: false,
      reason: 'own_alias',
      message: `이 품종의 별칭 「${value}」과(와) 같습니다. 별칭에서 지운 뒤 이름을 바꾸세요.`,
    }
  }

  return { ok: true, value }
}
