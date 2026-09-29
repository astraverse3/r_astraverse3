# 계획서 — 디자인 간단 3건 (§35 헤더 호버 · 제품재고 접힌 그룹 · §25 outline 회색)

> 작성: 2026-09-29 · 상태: ✅ **완료 2026-09-29** (`b1b68cc` · `c9c06e8` · `6d9f4f3`) — 보고서 [report-디자인-간단3건-2026-09-29.md](../report/report-디자인-간단3건-2026-09-29.md)
> 발단: 9/29 할일 순서 3번 — 사용자 「디자이너 부를 일 아니면 이어서」. 셋 다 색·클래스만 바뀐다(동작 변화 없음).
> 🔴 구현 전 전수 대조 규칙([[design_tool_claude_design]]) — 「지목된 곳」이 아니라 **그 클래스·프리미티브를 쓰는 전부**를 셌다.

---

## A. §35 목록 헤더가 호버 때 배경을 잃는다

- **현상**: 헤더 행이 `bg-slate-50 … hover:bg-transparent` — `TableRow` 프리미티브의 `hover:bg-slate-50`을 덮어서 **마우스를 올리면 회색이 빠지고 흰색이 비친다.** 기준서 §4.2는 「헤더는 호버에 반응하지 않는다」
- **실측 12곳 / 11파일** (백로그엔 10곳 — 그 뒤 2곳이 더 생겼다): farmer-list · log-list · variety-list-client · milling-list-client · stock-list-dialog · misc-stock-list-client · stock-list-client · release-history-list(2곳) · NoticeTable · UserTable · MillingTable
- **처방**: `hover:bg-transparent` → `hover:bg-slate-50` 일괄 (배경과 같은 색 = 호버해도 안 바뀐다). 1커밋

## B. 제품재고 목록 — 접힌 그룹이 흰 배경

- **현상**: [package-row.tsx:347](../../app/(dashboard)/packages/package-row.tsx#L347) 그룹 줄이 펼쳤을 때만 `bg-slate-100`이고 **접혔을 땐 색이 없다(흰색).** 표준(`docs/handoff/list-standard/list-spec-instructions.md:26`)은 「접힌 그룹 = `bg-slate-50` + 상하 `border-slate-200/80`, **흰 배경 금지**」. 잡곡 원물 목록은 이미 그렇게 돼 있다
- **처방**: 접힘 = `bg-slate-50 border-t border-slate-200/80`, 호버 `hover:bg-slate-50` → `hover:bg-slate-100`(배경보다 한 단 어둡게 — 잡곡 원물과 같은 값)
  - 목록은 `divide-y divide-slate-100`으로 행을 가른다 → 펼친 그룹처럼 **위 경계만** 주면 아래는 다음 행의 경계가 맡는다(이중선 방지)
- **모바일 카드는 안 건드린다** — 모바일 표준(§4.2.7)은 카드가 흰색이 맞다

## C. §25 outline 버튼이 회색(`bg-background`)

- **현상**: `--background`가 페이지 회색(`#f1f5f9`)이라 [button.tsx:16](../../components/ui/button.tsx#L16) outline 버튼이 **흰 카드·다이얼로그 위에서 회색 버튼**이 된다. 그래서 자리마다 `bg-white`를 손으로 박아 왔다. §22(다이얼로그 바탕)와 같은 뿌리
- **실측**: outline 버튼 **68개 / 42파일**
  - 배경을 직접 지정한 17개 → **영향 없음**
  - 그중 `bg-white`를 박아 둔 8개(deduct-dialog 2 · movement-history-dialog 2 · repack-dialog 4) → **이제 중복이라 걷어낸다**
  - 나머지 **43개가 회색 → 흰색**. 대부분 다이얼로그·카드 안(=원래 흰색이어야 했던 자리)이고, 페이지 바탕(회색) 위에 있는 건 「회색 위 흰 버튼」이 된다 — 일반적인 컨트롤 모양
- **같은 뿌리 2곳도 같이**: [switch.tsx:28](../../components/ui/switch.tsx#L28) 스위치 손잡이 · [multi-select.tsx:84](../../components/ui/multi-select.tsx#L84) 미선택 체크박스 → `bg-card`
- **안 건드림**: `sheet.tsx`(Sheet는 회색 유지 — [[dialog_background_token]]) · `calendar.tsx`(팝오버 안에서 `bg-transparent`로 무력화, 백로그 §25 「조치 불요」)
- **처방**: `bg-background` → `bg-card` 3곳 + `bg-white` 8곳 삭제

## 순서 · 커밋

A → B → C, 커밋 3개. C가 파급이 제일 커서 마지막.

## 검증

- tsc 0 · `eslint .` 0/0 · `npm test` (클래스만 바뀌어 로직 영향 없음 — 회귀 확인용)
- 재검사: `hover:bg-transparent` 헤더 0 · outline `bg-white` 0 · `bg-background` = sheet·calendar만
- 🖐 브라우저(사용자): ① 원물·도정·관리 목록 헤더에 마우스 → 회색 유지 ② 제품재고 벼 탭 접힌 그룹 연회색·펼치면 한 단 진하게
  ③ 다이얼로그 안 outline 버튼(재고차감·재포장·차감이력·포장) 흰색 ④ **페이지 바탕 위 outline 버튼**(목록 상단 툴바 등)이 어색하지 않은지 — 이상하면 그 자리만 되돌린다 ⑤ 설정 스위치 손잡이·다중선택 체크박스

## 위험

| 위험 | 대응 |
|---|---|
| C가 앱 전체 버튼 43개를 바꾼다 | 원래 의도(흰 컨트롤)로 돌아가는 방향. 이상한 자리가 보이면 그 자리만 `bg-slate-50` 등으로 지정 |
| `bg-white` 삭제 중 amber 테두리 버튼의 다른 클래스를 건드림 | `bg-white` 토큰만 지운다 |
