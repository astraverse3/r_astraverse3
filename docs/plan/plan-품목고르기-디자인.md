# 품목 고르기 디자인 정리 (디자이너 작업지시 ⑧)

작성 2026-10-01 · 지시서 `docs/handoff/점검-2026-09/작업지시-8-품목고르기.md` · 시안 `시안/품목고르기-시안.html`

## 범위

화면만 바꾼다(서버 `listAddableSkus`·추가 액션 그대로).

| 파일 | 내용 |
|---|---|
| `.../[uploadId]/qty-stepper.tsx` (신규) | ⑦의 `[−][수량][+]`을 공용 부품으로 뺀다 — 고치기 목록·품목 고르기가 같은 모양을 쓴다(완료 기준 「수량 칸 모양이 ⑦과 같음」) |
| `.../[uploadId]/sku-picker.tsx` | P1 — 고르기 전(검색칸 · focus/글자 있을 때만 결과 최대 5줄 · ↑↓ Enter · 이미 있는 품목 비활성) / 고른 뒤(`[✓ 품목 · 포장지 … 바꾸기] [− n +] [action]` 한 줄) |
| `.../[uploadId]/add-order-dialog.tsx` | P2 — 설명 문구 · 비워도 되는 칸은 placeholder · `QtyRow` 삭제 |
| `.../[uploadId]/order-edit-list.tsx` | P3 — 「품목 추가」를 목록 카드 마지막 줄로 · 펼침 영역 · ✕ 하나 · 「추가」는 수량 옆 · ⑦ 수량 칸을 공용 부품으로 교체 |
| `.../[uploadId]/order-detail-panel.tsx` | P3 — 펼칠 때 본문 스크롤 컨테이너의 `scrollTop`으로 맞추도록 표식(`data-panel-scroll`) |

## 착수 전 대조 (2026-10-01, 지시서 수정 시각 17:10 확인)

| 지시서 | 지금 코드 | 처리 |
|---|---|---|
| P4 「고치는 중」 표시 | ⑦(`ff124fe`)에서 지시서와 같은 클래스로 이미 반영 | **할 일 없음** |
| `taken = lines.map(l => l.productTypeId)` | `OrderLine.productTypeId: number \| null` 있음 | null(매칭실패 줄)은 빼고 넘긴다 |
| 시안 `sku-picker-parts.jsx` | `시안/`에 없음 — 시안이 안 열린다 | 지시서 문구대로 구현. 사용자에게 원본 파일 요청 |
| ⑦ 수량 칸 | `order-edit-list.tsx` 안 `QtyStepper`(줄 전용) | 공용 부품으로 빼서 두 곳이 같이 쓴다 |

## 구현 메모

- 결과 줄은 `onMouseDown`에서 `preventDefault` — 검색칸 포커스가 먼저 빠져 목록이 닫히면 클릭이 허공에 떨어진다.
- 「바꾸기」 → `onChange(null)` 뒤 검색칸에 포커스(지난 검색어 유지).
- 키보드 이동은 이미 있는 품목을 건너뛴다. 목록 안 스크롤도 `scrollTop`으로 맞춘다.

## 검증

`npm test` · `tsc` · `eslint .` → 🖐 지시서 「완료 기준」 8개 사용자 확인
