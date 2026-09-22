// 매트릭스 화면 묶음이 공유하는 폭 · sticky 좌표 · 숫자 표기.
//
// 🔴 **여기서 흩지 말 것.** 칸 폭(`W_*`)과 sticky `left`(`L_*`)는 **한 쌍**이라 따로 놀면
// 가로 스크롤할 때만 열이 어긋나 보이고 눈으로는 원인을 못 찾는다. 한곳에 두면 쌍이 보인다.

// ------------------------------------------------------
// sticky 좌표 — 좌측 고정 4칸 (선택 · 이름 · 상태 · 진행)
// ------------------------------------------------------
/**
 * 좌측 고정 칸의 폭 — **width·min·max를 한꺼번에** 준다.
 *
 * 🔴 `width`만 주면 지켜지지 않는다. 테이블 auto 레이아웃은 내용(`whitespace-nowrap`)에 맞춰
 * 칸을 늘리는데, sticky `left`는 아래 상수로 **고정**돼 있어 실제 위치와 어긋난다. 그러면
 * 가로 스크롤할 때 상태·진행 칸이 왼쪽으로 당겨져 이름 칸을 덮고, 소계·가용 줄의 라벨
 * (`colSpan`이라 실제 열 합 폭을 갖는다)만 튀어나와 보인다.
 * 실측(2026-09-16): 이름칸 184 지정 → **201로 렌더**, 좌측 합 387 vs sticky 영역 370.
 */
export const fixedW = (w: number) => ({ width: w, minWidth: w, maxWidth: w })

/**
 * 매트릭스 셀을 DOM에서 찾는 선택자.
 * 🔴 매칭실패 열 키는 **엑셀 원본 문자열**(`raw:품목명|규격|포장지`)이라 따옴표·역슬래시가
 *    들어올 수 있다. 속성 선택자 값에서 그 둘만 이스케이프하면 된다.
 */
export const cellSelector = (key: string) => `[data-cell="${key.replace(/["\\]/g, '\\$&')}"]`

// 행 일괄선택 체크박스 칸 (D3). 맨 왼쪽이라 뒤 칸들의 left가 전부 이만큼 밀린다.
export const W_CHECK = 34
// 204 = 실측이 원한 폭(201)에 여유 3px. 좁히면 잘림만 늘고, 넓히면 표가 그만큼 밀린다.
export const W_NAME = 204
// 이름칸 앞 값 고정 폭 — 구분선이 모든 행에서 같은 x에 서야 한다(핸드오프 §4).
// ⚠️ 104px는 재검토 대상: `이마트본사 김보훈`·`울림생협 북가좌점`·`롯데백화점 평촌점`은 잘린다.
export const W_NAME_HEAD = 104
export const W_STATUS = 60
export const W_PROGRESS = 92
export const L_NAME = W_CHECK
export const L_STATUS = W_CHECK + W_NAME
export const L_PROGRESS = W_CHECK + W_NAME + W_STATUS
export const W_LEFT = W_CHECK + W_NAME + W_STATUS + W_PROGRESS
/** 좌측 고정 칸 수 — 소계 줄이 이만큼 합쳐 라벨을 적는다 */
export const LEFT_COLS = 4

// 헤더 4행 높이 (그룹 · 규격 · 소계 · 가용)
//
// 🔴 소계 두 줄은 높이가 다르다. 소계는 「할 일」, 가용은 「조건」이라 주·보조 관계가
// 눈에 보여야 한다 — 같은 크기로 두면 어느 쪽이 주문이고 어느 쪽이 재고인지 안 갈린다.
export const H_GROUP = 38
export const H_SPEC = 24
export const H_SUM_MAIN = 40
export const H_SUM_SUB = 28

export const fmt = (n: number) => n.toLocaleString()
export const fmtKg = (n: number) => (Math.round(n * 10) / 10).toLocaleString()
