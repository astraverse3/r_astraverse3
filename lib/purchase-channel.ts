// 발주 채널 5종(#26·#30)의 표시 정보 — 서버·클라이언트 공용.
// 시트명 prefix로 추측하지만 최종 확정은 사람이 한다(#31).

import type { PurchaseChannel } from '@prisma/client'

export const PURCHASE_CHANNELS = [
  'DELIVERY',
  'EMART',
  'MEAL_SEOUL',
  'MEAL_HAENAM',
  'CORPORATE',
] as const satisfies readonly PurchaseChannel[]

/** 채널 배지 — 색은 시안(`docs/handoff/발주서판매처리/엑셀업로드-2단계-데스크탑.html`) 기준. */
export const CHANNEL_META: Record<PurchaseChannel, { label: string; badge: string }> = {
  DELIVERY: { label: '택배', badge: 'bg-blue-50 text-blue-700' },
  EMART: { label: '이마트', badge: 'bg-violet-50 text-violet-700' },
  MEAL_SEOUL: { label: '서울급식', badge: 'bg-teal-50 text-teal-700' },
  MEAL_HAENAM: { label: '해남급식', badge: 'bg-cyan-50 text-cyan-700' },
  CORPORATE: { label: '기업별', badge: 'bg-slate-100 text-slate-600' },
}

export function channelLabel(channel: PurchaseChannel): string {
  return CHANNEL_META[channel].label
}

/**
 * 채널별 발주처·수령인 표기 선언 (D2c C0-c · `docs/handoff/발주서판매처리/표기규칙-핸드오프.md`).
 *
 * 이름 열은 `굵은 값 ｜ 세로선 ｜ 연한 값` 한 형태만 쓰고, 채널마다 바뀌는 건
 * **두 값의 순서**와 **열 머리 라벨**뿐이다. 기준은 「행마다 변하는 값이 앞에 굵게」 —
 * 서울급식만 발주처(구청)가 변수라 순서가 뒤집힌다. 예외가 아니라 같은 규칙의 결과다.
 *
 * `constantSide`는 §6 업로드 검증용(백로그)이라 아직 읽는 곳이 없다.
 */
export type ChannelDecl = {
  /** 이름칸 앞(굵은) 값. `single`은 한 값만(기업별=시트명이 곧 발주처) */
  primary: 'recipient' | 'vendor' | 'single'
  /** 시트 안에서 상수여야 하는 쪽. 없으면 null */
  constantSide: 'vendor' | 'recipient' | null
  /** 이름 열 머리 — `수령인` · `발주처` · `거래처`만 쓴다(§7 용어) */
  columnLabel: '수령인' | '발주처' | '거래처'
  /**
   * 모바일에서 건을 여는 방식.
   *
   * - `inline` — 목록 안에서 행이 펼쳐진다. 건 상세 화면이 없다
   * - `sheet`  — 건 상세 화면(Sheet)을 연다
   *
   * 🔴 **데이터가 아니라 채널로 가른다**(2026-09-22 결정). 건수·평균 품목수로 판정하면
   * 같은 채널인데 **시트마다 화면이 달라져** 「이 채널은 이렇게 쓰는 것」이라는 학습이 안 선다.
   * 다음 주 택배가 3건만 들어와도 화면이 바뀌어서는 안 된다.
   */
  detail: 'inline' | 'sheet'
}

// `detail`의 근거는 **건당 품목 수**다(실측 2026-09-22).
//   택배 67건 · 평균 1.18품목(1품목 건이 58) → 건 상세를 열어도 카드 한 장이라 깊이만 는다
//   나머지 1~3건 · 건당 3~8품목      → 목록 안에서 펼치면 목록이 아니라 스크롤이 된다
export const CHANNEL_DECL: Record<PurchaseChannel, ChannelDecl> = {
  DELIVERY: { primary: 'recipient', constantSide: null, columnLabel: '수령인', detail: 'inline' },
  EMART: { primary: 'recipient', constantSide: 'vendor', columnLabel: '수령인', detail: 'sheet' },
  MEAL_SEOUL: { primary: 'vendor', constantSide: 'recipient', columnLabel: '발주처', detail: 'sheet' },
  MEAL_HAENAM: { primary: 'recipient', constantSide: 'vendor', columnLabel: '수령인', detail: 'sheet' },
  CORPORATE: { primary: 'single', constantSide: 'vendor', columnLabel: '거래처', detail: 'sheet' },
}

/**
 * 「여유」 행 — 주문이 아니라 여분으로 더 보내는 물량(핸드오프 §4-b). 재고는 실제로 나간다.
 * 발주처 자리(서울급식)든 수령인 자리(발주처가 상수인 채널)든 올 수 있어 **양쪽을 본다**.
 * 쓰는 곳: 이름 정렬에서 맨 아래(`sortMatrixRows`) · §6 상수 검증에서 제외(백로그).
 */
export const SPARE_NAMES = ['여유', '여분'] as const

export function isSpareRow(row: { vendor: string; recipient: string | null }): boolean {
  const spare = SPARE_NAMES as readonly string[]
  return spare.includes(row.vendor) || (row.recipient !== null && spare.includes(row.recipient))
}

/**
 * 이름칸에 찍을 [앞, 뒤] 값. 뒤가 없거나 앞과 같으면 한 줄(뒤=null).
 * 🔴 택배는 전 행 2단이 기본이다 — 실측 95.5%가 발주처≠수령인. 동일명 3건만 한 줄.
 */
export function nameTiersOf(
  decl: ChannelDecl,
  row: { vendor: string; recipient: string | null },
): [string, string | null] {
  if (decl.primary === 'single') return [row.vendor, null]
  const [head, tail] =
    decl.primary === 'vendor' ? [row.vendor, row.recipient] : [row.recipient, row.vendor]
  const h = head || row.vendor
  return [h, tail && tail !== h ? tail : null]
}

/**
 * 모바일 건 목록에서 **행을 묶는 축** — 묶음 안에서 반복되는 쪽의 이름.
 *
 * 🔴 **`nameTiersOf`의 tail을 빌려 쓰면 안 된다**(2026-09-23 실측으로 드러난 결함).
 * 그 함수는 **이름 열 표시**용이라 앞뒤가 같으면 뒤를 생략한다 — 표시로는 옳지만
 * 그룹 축으로 쓰면 「생략」이 **「소속 없음」**이 된다. 택배는 수령인 칸이 비면 파서가
 * 발주처를 복사하므로(#26) 자기 이름으로 받는 건이 전부 「미지정」으로 빠졌다.
 * 실측 67건 중 3건 — 그중 **해남로컬푸드는 그룹이 통째로 사라졌다**(1건짜리라서).
 *
 * 📌 공용 순수함수를 쓰는 것과, 그 함수가 쓰이는 화면 구조가 같은 것은 다르다(백로그 §45와 같은 자리).
 *
 * 축은 `primary`의 **반대쪽**이다 — 행마다 변하는 값이 primary니 반복되는 건 나머지다.
 *   택배·이마트·해남급식 → 발주처   서울급식 → 수령인   기업별 → 없음(한 값뿐)
 */
export function groupAxisOf(
  decl: ChannelDecl,
  row: { vendor: string; recipient: string | null },
): string | null {
  if (decl.primary === 'single') return null
  return (decl.primary === 'vendor' ? row.recipient : row.vendor) || null
}
