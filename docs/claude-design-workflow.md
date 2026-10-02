# Claude Design 워크플로우 가이드

이 프로젝트(`milling-log`)의 UI 디자인은 **Claude Design**(claude.ai)에서 한다. 2026-04-23부터 Stitch MCP는 제거됐다.

> 2026-10-02 개정 — 요청·질문을 **파일로** 주고받는다(Claude Design 제안, 사용자 합의).
> 그 전에는 요청서를 대화창에 통째로 붙여넣고, 4월 초기엔 「Send to Claude Code」 번들 URL을 `WebFetch`로 읽었다. 둘 다 이제 안 쓴다.

## 두 Claude가 볼 수 있는 것

| | 이 PC의 `milling-log/` 읽기 | 쓰기 |
|---|---|---|
| Claude Code (VS Code) | ✅ | ✅ |
| Claude Design | ✅ **저장하는 순간 보인다** — GitHub가 아니라 PC 폴더를 읽는다. 푸시 불필요 | ❌ → 결과는 다운로드 묶음으로 |

⚠️ Claude Design은 **그 대화에 `milling-log` 폴더가 연결돼 있을 때만** 읽는다. 새 대화를 열면 폴더를 다시 연결한다.

## 흐름

```
[Claude Code]  docs/design-requests/요청-{주제}.md 작성
      │
      │  사용자 → Claude Design: 「새 요청 확인해줘」   (붙여넣기 없음)
      ▼
[Claude Design]  폴더에서 요청을 읽고 시안·지시서 제작 → 다운로드 묶음
      │
      │  사용자: 묶음을 docs/handoff/ 에 풀기 → Claude Code: 「⑬ 반영해」
      ▼
[Claude Code]  현재 코드와 전수 대조 → 적용/완료/기각 표 보고 → 승인 → 구현
      │
      │  되물을 게 있으면 docs/design-requests/질문-{주제}.md 작성
      │  사용자 → Claude Design: 「질문 확인해줘」
      ▼
[Claude Design]  답을 지시서에 고쳐 넣어 묶음으로 다시 → 묶음 안 「답한 질문」 절
```

## 파일 위치

| 무엇 | 어디 | 누가 씀 |
|---|---|---|
| 디자인 요청 | `docs/design-requests/요청-{주제}.md` | Claude Code |
| 되묻는 질문 | `docs/design-requests/질문-{주제}.md` (요청과 같은 폴더) | Claude Code |
| 작업지시·시안 | `docs/handoff/작업지시-N-{주제}/지시서.md` + `시안/` | Claude Design(묶음) → 사용자가 풂 |
| 질문에 대한 답 | 개정된 지시서의 「답한 질문」 절 | Claude Design |

- `docs/design-requests/` 폴더는 첫 요청을 쓸 때 만든다.
- 10/2 이전 요청서(`docs/handoff/요청-*.md` 3개)는 백로그·계획서가 그 경로를 가리키고 있어 옮기지 않았다.
- 요청서는 **그것만 읽어도 되게** 쓴다 — 대상 파일 경로, 현재 동작, 바꾸고 싶은 것, 실데이터 수치(가짜 예시 금지).

## 받은 뒤 (Claude Code)

- **구현 전에 현재 코드와 전수 대조** — 시안이 낡았거나·불완전하거나·근거 소스가 다른 일이 반복됐다. 「시안이 지목한 것」이 아니라 그 프리미티브를 쓰는 **전부**를 grep한다.
- 대조 결과를 **적용/완료/기각 표**로 먼저 보고하고 사용자 판단을 받는다. 기각 이유는 계획서·커밋 메시지에 남긴다.
- 시안은 디자인 의도·맥락만 차용한다. 빠진 기능은 현재 코드 기준으로 채운다.
- 착수 직전에 지시서 **수정 시각을 다시** 본다(대조 보고 뒤 개정되는 일이 있었다). 이의가 나오면 `git diff -- docs/handoff/<폴더>`로 개정부터 확인.
- 지시서와 CLAUDE.md 규칙이 부딪히면 **CLAUDE.md 우선**. 3개 이상 파일 변경이면 계획서 먼저.

## 커밋·문서화

- 계획서 `docs/plan/plan-{작업명}.md` 승인 후 작업
- 결과보고서 `docs/report/report-{작업명}-{날짜}.md`
- `docs/worklog.md` 업데이트 · 미뤄둔 일은 `docs/리팩토링-백로그.md`에 § 번호로

## 제거된 것

- **Stitch MCP** — `~/.claude.json`, `~/.claude/settings.json`에서 제거 (2026-04-23)
- 이전 백업: `~/.claude.json.bak-20260423`, `~/.claude/settings.json.bak-20260423`
- Stitch Google API 키는 **재발급 대상** (Google Cloud 콘솔에서 수동 폐기 권고)

## 트러블슈팅

### Claude Design이 「요청이 없다」고 함
- 그 대화에 `milling-log` 폴더가 연결돼 있는지 — 새 대화면 다시 연결
- 파일이 실제로 저장됐는지(`docs/design-requests/`)

### 시안 HTML이 안 열림
- 시안의 jsx는 **HTML과 같은 폴더**에 있어야 열린다
