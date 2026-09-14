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
}

export const CHANNEL_DECL: Record<PurchaseChannel, ChannelDecl> = {
  DELIVERY: { primary: 'recipient', constantSide: null, columnLabel: '수령인' },
  EMART: { primary: 'recipient', constantSide: 'vendor', columnLabel: '수령인' },
  MEAL_SEOUL: { primary: 'vendor', constantSide: 'recipient', columnLabel: '발주처' },
  MEAL_HAENAM: { primary: 'recipient', constantSide: 'vendor', columnLabel: '수령인' },
  CORPORATE: { primary: 'single', constantSide: 'vendor', columnLabel: '거래처' },
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
