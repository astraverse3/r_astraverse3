# 건 상세 「고치기」 디자인 정리 (디자이너 작업지시 ⑦)

작성 2026-10-01 · 지시서 `docs/handoff/점검-2026-09/작업지시-7-건상세-고치기.md` · 시안 `시안/건상세-고치기버튼-시안.html`(A안)

## 범위

화면만 바꾼다(서버·판정 그대로). 대상 2파일:
- `app/(dashboard)/sales/purchase/[uploadId]/order-detail-panel.tsx` — E1 헤더
- `app/(dashboard)/sales/purchase/[uploadId]/order-edit-list.tsx` — E2 목록 · E3 푸터

## 착수 전 대조 (2026-10-01, 지시서 수정 시각 16:22 확인)

| 지시서 | 지금 코드 | 처리 |
|---|---|---|
| 「지금」 시안 | 오늘 `c3950ba` 화면과 같다 | 그대로 |
| SheetContent 기본 닫기 숨김 | `components/ui/sheet.tsx`에 `showCloseButton` prop · `SheetClose` export 있음 | `showCloseButton={false}` + 묶음 안 `SheetClose` |
| 모바일 입력칸 16px(「④ 규칙」) | **④는 반대로 16→14px**, `app/layout.tsx`가 `maximumScale: 1`이라 확대가 안 일어남. 포장 다이얼로그 `MOBILE_INPUT`도 `text-sm` | **④를 따라 14px**(사용자 동의) |
| 선행 ② 타입 토큰 | 아직 없음(백로그 §86·§87) | 지시서의 px 값 그대로. ② 때 같이 토큰화 |
| 고치기 버튼 `bg-white` | 규칙 §25 「outline에 `bg-white` 금지」 | `bg-card` |
| 시안 HTML 위치 | `점검-2026-09/` 바로 아래(`design-canvas.jsx`를 못 찾음) | `시안/`으로 옮김 |

## 추가 (사용자 동의)

- **0으로 「저장」 = 휴지통과 같은 확인창.** 지금은 0을 저장하면 확인 없이 품목이 취소된다(− 버튼이 생기면 더 쉽게 0이 된다).

## 검증

`npm test` · `tsc` · `eslint .` → 🖐 지시서 「완료 기준」 9개를 사용자가 확인
