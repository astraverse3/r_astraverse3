# 계획서 — 목록 표준 밝은 톤 개정 (디자이너 A안)

> 작성: 2026-09-29 · 상태: **승인됨 · 진행 중** (사용자: 헤더 12곳 전부 · 푸시는 끝나고 한 번에)
> 정본: [`docs/handoff/list-standard/밝은톤-개정-2026-09-29.md`](../handoff/list-standard/밝은톤-개정-2026-09-29.md) — 파일별 변경값은 그 문서를 따른다. 여기엔 **대조 결과와 차이만** 적는다.
> 발단: 사용자 「펼치면 행이 더 어두워지는데, 더 밝아지는 게 낫지 않아?」 → 디자이너 개정

## 대조 결과 (2026-09-29 코드 전수 grep)

| 항목 | 개정 문서 | 코드 실측 | 처리 |
|---|---|---|---|
| 그룹·서브행 (`bg-slate-100` · `hover:bg-slate-200/70`) | 4화면 | 4화면 · 7곳 — **일치** | 문서대로 |
| 컬럼 헤더 행 `bg-slate-50 … hover:bg-slate-50` | TableRow 7곳 + grid 2곳 | TableRow **12곳** + grid 2곳 | 🔴 **빠진 5곳도 같이** (사용자 승인): stock-list-dialog · release-history-list 중첩표 · NoticeTable · UserTable · MillingTable — 안 바꾸면 이 5곳만 회색 헤더로 남는다 |
| `upload-table.tsx:76` | 범위 밖 | — | 손대지 않음 |
| `design-system.html` §12~14 신설 섹션 | (지시 없음) | — | 이번 범위 밖, 별도 대조 |

## 순서 · 커밋

1. 코드 — 헤더(`TableHead` 글자 + 헤더 행 14곳) · 그룹 헤더 4화면 · 서브행 4화면(+`isLast` prop) — 1커밋
2. 기준서 — `list-spec-instructions.md` · `README.md` · `디자인시스템/handoff.md §4.2` (개정 문서 §4) — 1커밋
3. 결과보고서 · worklog → 오늘 미푸시분과 함께 푸시

## 검증

- tsc 0 · `eslint .` 0/0 · `npm test`
- 재검사: `hover:bg-slate-200/70` 0 · 그룹/서브행 `bg-slate-100` 0 · 헤더 행 `bg-slate-50` 0(upload-table 제외)
- 🖐 브라우저: 개정 문서 §3 체크리스트
