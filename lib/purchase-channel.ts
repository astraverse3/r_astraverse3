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
