import type { QuickPeriod } from '@/app/actions/statistics'

export type MainTab = 'period' | 'variety' | 'millingType'

/** short = 모바일 라벨 — 「별」을 뗀다(백로그 §97 · 판매분석과 같은 규칙) */
export const MAIN_TABS: { key: MainTab; label: string; short: string }[] = [
  { key: 'period',      label: '기간별',     short: '기간' },
  { key: 'variety',     label: '품종별',     short: '품종' },
  { key: 'millingType', label: '도정구분별', short: '도정구분' },
]

export const QUICK_PERIODS: { key: QuickPeriod; label: string }[] = [
  { key: 'cropYear', label: '연산' },
  { key: '1y',       label: '1년' },
  { key: '6m',       label: '6개월' },
  { key: '3m',       label: '3개월' },
  { key: '1m',       label: '1개월' },
  { key: '1w',       label: '1주' },
  { key: 'custom',   label: '' },
]

export const DEFAULT_PERIOD_VARIETIES       = ['하이아미', '서농22호', '천지향1세', '천지향5세', '새청무']
export const DEFAULT_VARIETIES              = ['백옥찰', '서농22호', '천지향1세', '새청무', '하이아미']
export const DEFAULT_MILLINGTYPE_VARIETIES  = ['백옥찰', '서농22호', '천지향1세', '천지향5세', '새청무', '하이아미']
export const MAX_VARIETY_SELECT             = 5
