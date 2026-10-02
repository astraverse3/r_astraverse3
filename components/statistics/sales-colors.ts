import { CHANNEL_META } from '@/lib/purchase-channel'
import type { SalesChannel } from '@/lib/sales-stats'

// 판매분석 채널 색 — 색은 채널을 따라간다(순위·필터가 바뀌어도 그대로). 순서 = 쌓는 순서 = SALES_CHANNELS.
// 발주서 5채널은 채널 배지 점(lib/purchase-channel.ts `CHANNEL_META.color`)과 한 원천이다.
// 인접 쌍 검증(dataviz validate_palette, light, 2026-10-02 작업지시 ⑪ 이마트 #b9472a):
// 색약 ΔE 9.1(서울급식↔해남급식) · 일반 19.6 통과.
// ⚠️ 서울급식·해남급식·기업별은 흰 바탕 대비 3:1 미만 — 색만으로 읽히지 않게 범례·표를 늘 같이 둔다.
export const SALES_CHANNEL_COLOR: Record<SalesChannel, string> = {
  DELIVERY: CHANNEL_META.DELIVERY.color,
  EMART: CHANNEL_META.EMART.color,
  MEAL_SEOUL: CHANNEL_META.MEAL_SEOUL.color,
  MEAL_HAENAM: CHANNEL_META.MEAL_HAENAM.color,
  CORPORATE: CHANNEL_META.CORPORATE.color,
  DIRECT: '#008300',
}

/** 채널이 섞인 줄(품종·제품)의 막대 — 한 계열이라 한 색 */
export const SALES_SINGLE_COLOR = '#2a78d6'
