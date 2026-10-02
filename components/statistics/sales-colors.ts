import type { SalesChannel } from '@/lib/sales-stats'

// 판매분석 채널 색 — 색은 채널을 따라간다(순위·필터가 바뀌어도 그대로). 순서 = 쌓는 순서 = SALES_CHANNELS.
// 인접 쌍 검증(dataviz validate_palette, light): 색약 ΔE 9.1 · 일반 16.3 통과.
// 택배·이마트·서울급식은 채널 배지(lib/purchase-channel.ts)와 같은 계열이다.
// ⚠️ 서울급식·해남급식·기업별은 흰 바탕 대비 3:1 미만 — 색만으로 읽히지 않게 범례·표를 늘 같이 둔다.
export const SALES_CHANNEL_COLOR: Record<SalesChannel, string> = {
  DELIVERY: '#2a78d6',
  EMART: '#4a3aa7',
  MEAL_SEOUL: '#1baf7a',
  MEAL_HAENAM: '#eda100',
  CORPORATE: '#e87ba4',
  DIRECT: '#008300',
}

/** 채널이 섞인 줄(품종·제품)의 막대 — 한 계열이라 한 색 */
export const SALES_SINGLE_COLOR = '#2a78d6'
