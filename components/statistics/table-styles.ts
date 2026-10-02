// 통계 표 PC 공통 겉모양 — 작업지시 ⑫ C. 판매분석 · 원물출고 · 재고분석 · 수율분석 표가 같은 값을 쓴다.
// 기준은 판매분석 시안(⑪): 머리글 12px · 행 13px · 회색 머리줄 · 줄무늬 없음 · 행 h-11.
// 행 높이(h-11)·아래선(slate-100)·호버(slate-50)는 `components/ui/table`의 TableRow/TableCell 기본값이라 여기 두지 않는다 —
// 칸에 `py-*`를 더하면 h-11보다 커지니 넣지 말 것.

/** 표를 감싸는 카드 — 수율 표도 테두리를 넣는다 */
export const STAT_TABLE_CARD = 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'

/** `<Table>` — 행 글자 13px */
export const STAT_TABLE = 'w-full text-[13px]'

/** 머리글 줄 `<TableRow>` — h-10은 TableHead 기본값 */
export const STAT_HEAD_ROW = 'bg-slate-50 border-b border-slate-200 hover:bg-slate-50'

/** 머리글 칸 `<TableHead>` — 12px medium slate-600 */
export const STAT_HEAD = 'text-xs font-medium text-slate-600'

/** 순위 칸 */
export const STAT_RANK = 'text-right tabular-nums text-slate-500'

/** 이름 칸의 이름 */
export const STAT_NAME = 'font-medium text-slate-800'

/** 이름 뒤 보조 글자(작목반·채널·생산자·비고) — 12px */
export const STAT_SUB = 'text-xs text-slate-500'

/** 주 값(판매량·총 입고·생산량) — 오른쪽 정렬 */
export const STAT_NUM_MAIN = 'text-right tabular-nums font-semibold text-slate-800'

/** 나머지 숫자 — 오른쪽 정렬 */
export const STAT_NUM = 'text-right tabular-nums text-slate-600'

/** 눌리는 숫자(팝업) — 점선 밑줄 한 종류 */
export const STAT_LINK = 'underline decoration-dotted decoration-slate-400 underline-offset-[3px] hover:text-primary transition-colors'
