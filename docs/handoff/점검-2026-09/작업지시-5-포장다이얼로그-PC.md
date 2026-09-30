# 작업지시 ⑤ 포장 다이얼로그 PC — 표시 정리 (sm 이상)

> 대상: `app/(dashboard)/milling/packaging-rows.tsx`(`PackagingRowDesktop`, `PackagingRowsHeader` PC 부분), `add-packaging-dialog.tsx`(규격 버튼 `sm:`, 그룹 헤더·소계, 하단 바 `sm:`), `spec-summary.tsx` · 작성 2026-09-30
> 시안: `시안/디자인점검-시안.html` → 섹션 **③-3 PC**. 비교는 「현재」와 「제안 — 편집 / 마감됨 / 조회 전용」입니다.
> 원칙: 마우스를 쓰는 화면이라 **누르는 곳은 32px**이면 충분합니다. 바꾸는 건 글자 크기와 명암(③ T2), 칸 폭, 하단 바뿐이에요. **모바일(④ C안) 코드는 건드리지 마세요.** 다이얼로그 폭 `sm:max-w-[500px]`과 `sm:px-6`은 그대로 둡니다(본문 약 452px).

---

## P1. 편집 행 (`PackagingRowDesktop`)

```ts
- grid-cols-[40px_120px_1fr_64px_24px] gap-1   (행 px-3 py-1.5)
+ grid-cols-[52px_minmax(0,1fr)_104px_76px_28px] gap-1.5   (행 px-3 py-1)
```
PC 헤더도 같은 값으로 맞추고 한 상수로 묶습니다(`DESKTOP_EDIT_COLS`).

| 칸 | 현재 | 제안 |
|---|---|---|
| 규격 | 뱃지 11px `stone-100/600` | 뱃지 12px semibold `bg-slate-100 text-slate-700` · 잔량 `bg-yellow-100 text-yellow-800` |
| 포장지 | select `h-7` 11px `border-stone-200` | select `h-8` 13px `border-slate-300 text-slate-800` · 포장지 미선택 시 `border-rose-300 text-rose-700` 유지 |
| 포장지(톤백) | 「포장지: 톤백」 11px stone-400 | 「톤백」 13px slate-500 |
| 포장지(잔량) | 「—」 stone-300 | 「포장지 없음」 13px slate-500 |
| 수량 | ± 버튼 22px 원형 + 숫자 12px | **외곽선으로 묶은 스테퍼** `h-8` · 버튼 `w-7 bg-slate-50 hover:bg-slate-100` · 숫자 14px mono bold · 테두리 `border-slate-300` |
| 수량(잔량) | 숫자 1만 표시 · 중량칸에 kg 입력 | 스테퍼 자리에 **kg 입력** `h-8 w-[72px]` 14px mono bold + 「kg」 11px slate-500 (모바일 C안과 같은 배치) |
| 중량(계산값) | 12px bold + 「kg」 9px | 14px mono bold, 단위 생략(헤더에 「중량(kg)」) · `pr-1` |
| 중량(톤백 입력) | `h-6 w-11` 11px | 칸 폭 전체(76px) `h-8 px-2` 14px mono bold 오른쪽 정렬 |
| 삭제 | 22px 원형 · `text-stone-300` | `h-8 w-7 rounded-md` · 아이콘 15px · `text-slate-400 hover:text-rose-600 hover:bg-rose-50` |

- 입력칸 14px(`text-sm`)은 PC라 iOS 확대와 상관없습니다.
- 수량 직접 입력, 포커스 시 전체 선택, `data-weight-index`는 지금 동작 그대로 둡니다.

## P2. 컬럼 헤더 (PC)

`text-[9px] text-stone-300` → **11px semibold slate-500**입니다. 「규격 / 포장지 / 수량 / 중량(kg)」이고, 여백은 `pt-2 pb-0.5`입니다.

## P3. 규격 버튼 (PC)

`sm:h-7 sm:text-[11px] sm:gap-1` → **`sm:h-8 sm:text-[13px]`**입니다. gap 4px와 10열 한 줄은 그대로 둡니다. 영역 여백 `px-3 py-3` → `sm:px-3 sm:py-2`, hover는 `bg-slate-200`, `기타`는 점선 `border-slate-300 text-slate-600`입니다.

## P4. 그룹 헤더 · 소계

- **헤더**: `bg-slate-50 border-slate-200 px-3 py-2`, 한 줄입니다.
  - 이름 13px bold slate-800, 품종 12px slate-500, LOT 11px mono slate-500 말줄임
  - 오른쪽: `{입력} → 예상 {예상}kg` 12px slate-600. 숫자는 mono이고 예상값은 bold `text-blue-700`입니다.
  - 지금의 `text-[10px] stone-300 →` 화살표는 글자 「→ 예상」으로 바꿉니다.
- **소계**(여러 생산자일 때만, 지금 조건 그대로): 12px slate-600 「소계 **N** / M kg」. 숫자는 mono이고, 예상을 넘으면 N이 `text-amber-700`입니다(지금은 amber-600).

## P5. 규격별 합계 밴드 (PC)

③ T3 1-1과 같은 카드이고 모바일과 공통입니다. 따로 할 일은 없고, 그라데이션과 그림자가 빠졌는지만 확인하세요.

## P6. 하단 바 (PC) — 두 줄을 한 줄로

```
총 포장 1,091kg                [🗑 포장 초기화] [🔒 작업 마감] [기록 저장]
```
- 여백 `sm:pt-4 sm:pb-0`, 점선 구분선은 없앱니다. 좌우 여백은 추가하지 않습니다(본문 여백을 그대로 씁니다).
- 왼쪽: 「총 포장」 13px slate-600 + 숫자 **18px mono bold** slate-900 + 「kg」 13px slate-500. 모바일처럼 두 줄로 쌓지 않고 한 줄입니다.
- 오른쪽은 모두 `h-9`, `gap-2`입니다. PC는 폭에 여유가 있어서 **문구를 줄이지 않습니다**.
  - **포장 초기화**: ghost `text-rose-700 hover:bg-rose-50`, 13px semibold, 아이콘 13px
  - **작업 마감**: `bg-amber-50 border-amber-200 text-amber-800`, 13px semibold
  - **기록 저장**: primary `px-4`, 14px semibold
- 초기화와 저장 사이에 마감이 끼어 있어서 둘이 떨어져 있고, 초기화는 confirm도 거칩니다.
- **마감됨**: 총 포장 + 오른쪽 「마감 해제」 `h-9` outline `border-slate-300 text-slate-800`
- **조회 전용**: 총 포장 + 오른쪽 12px slate-500 「조회 전용」
- 버튼 구조, 핸들러, disabled 조건, 로딩 문구는 지금 그대로 둡니다.

## P7. 읽기 전용 행 (PC)

`isClosed || !canManage`일 때 PC도 모바일처럼 **읽기 전용 행 컴포넌트를 따로** 둡니다(`PackagingRowReadOnlyDesktop`).
- `grid-cols-[52px_minmax(0,1fr)_64px_76px] gap-1.5`, 행 `px-3 py-1.5 min-h-8`
- 규격 뱃지(P1과 같음), 포장지명 13px slate-700 말줄임(톤백은 「톤백」, 잔량은 「—」)
- 수량: 14px mono + 「개」 11px slate-500, 오른쪽 정렬
- 중량: 14px mono bold, 오른쪽 정렬
- 헤더도 같은 칸 폭으로: 「규격 / 포장지 / 수량 / 중량(kg)」
- 규격 버튼, 스테퍼, select, 삭제는 모두 없습니다(지금과 같음).

---

### 확인
- 1280px 뷰포트(다이얼로그 500px):
  - 톤백 중량 **12,345**, 포장지명이 긴 「친환경 무농약 10kg 지대(신)」, 수량 **999**가 잘리지 않아야 합니다.
  - 가로 스크롤이 없어야 합니다.
- `grep -E "stone-|text-\[(9|10|10\.5)px\]"` 결과가 `packaging-rows.tsx`와 `add-packaging-dialog.tsx`에서 0건이어야 합니다.
- 모바일 C안 화면에 변화가 없어야 합니다(390px 전후 스크린샷 비교).
- 편집 / 마감됨 / 조회 전용 × 단일·다중 생산자를 스크린샷으로 남기고 `docs/worklog.md`에 기록합니다.
