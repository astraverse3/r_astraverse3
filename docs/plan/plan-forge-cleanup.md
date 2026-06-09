# Claude Forge 정리 계획

> 작성일: 2026-04-09
> 작업자: Claude (사용자 승인 대기 중)
> 상태: 계획 단계

---

## 작업 목표

`~/.claude/`에 설치된 [Claude Forge](https://github.com/sangrokjung/claude-forge) 자산 중 **사용자가 실제로 안 쓰는 것**을 제거한다. 사용자 의도: "필요할 때 하나씩 만들어가고 싶다" → 미니멀하게 가는 게 목표.

**중요**: 이 작업은 글로벌 `~/.claude/` 폴더를 건드리는 작업이라 milling-log 프로젝트 코드는 한 줄도 안 바뀐다. 다른 프로젝트에서 Claude Code 쓸 때도 영향 범위가 크다는 걸 명심.

---

## 사전 조사 결과

### 너가 실제로 쓰는 거 (증거 있음)

| 항목 | 증거 |
|---|---|
| `/plan` 패턴, `docs/plan-*.md` | worklog·메모리 다수 확인 |
| 결과보고서·worklog 업데이트 | 메모리 feedback 등록됨 |
| `planner` / `code-reviewer` / `security-reviewer` 에이전트 | `~/.claude/CLAUDE.md` 룰에 명시 |
| Stitch MCP | 메모리 + settings.json permissions |

### 안 쓰는 거 (증거 없음)

- Skills 16개 전부 (worklog 흔적 0)
- Commands 40개 중 `/plan` 빼고 거의 다
- Hooks 16개 전부
- Agents 11개 중 8개 (planner·code-reviewer·security-reviewer 빼고)
- Forge 본체 폴더 `~/.claude/claude-forge/`

### MCP 서버

`claude mcp list` 결과: **stitch 1개만 등록됨**. install.ps1엔 4개 깔라고 돼있었지만 실제로 등록 안 됨. → **MCP는 끊을 거 없음** (stitch는 사용 중).

---

## 작업 범위 (유지/삭제)

### 🟢 유지

#### Agents (3개만)
- `planner.md` — `/plan` 워크플로우에 필요
- `code-reviewer.md` — CLAUDE.md 룰에 명시
- `security-reviewer.md` — CLAUDE.md 룰에 명시

#### Commands (1개만)
- `plan.md` — `/plan` 슬래시 커맨드

#### 그 외 유지
- `~/.claude/CLAUDE.md` — 너 글로벌 룰. **건드리지 않음** (룰 자체는 좋음)
- `~/.claude/settings.json` — hooks 섹션만 비우고 나머지 유지 (language·permissions·stitch MCP 권한 등)
- `~/.claude/projects/`, `sessions/`, `memory/`, `.claude.json`, `plans/`, `file-history/`, `shell-snapshots/`, `telemetry/`, `cache/`, `ide/`, `session-env/`, `homunculus/` — **개인 데이터, 절대 안 건드림**
- `~/.claude/plugins/` — Forge랑 별개로 보임 (plugins/blocklist.json), 유지
- `~/.claude/backups/` — Claude Code 자체 백업, 유지
- Stitch MCP — 사용 중

### 🔴 삭제

#### Forge 본체 폴더
- `~/.claude/claude-forge/` (전체) — git clone 원본. 이 안의 파일들이 ~/.claude/agents 등으로 이미 복사돼 있어서 본체는 안 써도 동작에 영향 없음

#### Agents 8개
- `architect.md`
- `build-error-resolver.md`
- `database-reviewer.md`
- `doc-updater.md`
- `e2e-runner.md`
- `refactor-cleaner.md`
- `tdd-guide.md`
- `verify-agent.md`

#### Commands 39개 (`plan.md` 제외 전부)
agent-router, auto, build-fix, checkpoint, code-review, commit-push-pr, debugging-strategies, dependency-upgrade, e2e, eval, evaluating-code-models, evaluating-llms-harness, explore, extract-errors, forge-update, guide, handoff-verify, init-project, learn, next-task, orchestrate, pull, quick-commit, refactor-clean, security-compliance, security-review, show-setup, stride-analysis-patterns, suggest-automation, summarize, sync-docs, sync, tdd, test-coverage, update-codemaps, update-docs, verify-loop, web-checklist, worktree-cleanup, worktree-start

#### Skills 16개 전부
build-system, cache-components, cc-dev-agent, continuous-learning-v2, eval-harness, frontend-code-review, manage-skills, prompts-chat, security-pipeline, session-wrap, skill-factory, strategic-compact, team-orchestrator, using-superpowers, verification-engine, verify-implementation

#### Hooks 16개 전부
code-quality-reminder.sh, context-sync-suggest.sh, db-guard.sh, expensive-mcp-warning.sh, forge-update-check.sh, hooks.json (참조용 문서), mcp-usage-tracker.sh, output-secret-filter.sh, rate-limiter.sh, remote-command-guard.sh, security-auto-trigger.sh, session-wrap-suggest.sh, task-completed.sh, work-tracker-prompt.sh, work-tracker-stop.sh, work-tracker-tool.sh

→ `~/.claude/hooks/` 폴더 자체 삭제

#### settings.json `hooks` 섹션
현재 PreToolUse·SessionStart·UserPromptSubmit·PostToolUse·Stop 5개 이벤트에 hook이 걸려있음. 이거 다 비움 (`"hooks": {}`).

---

## 단계별 실행 계획

### 1단계: 백업
```bash
# ~/.claude 전체를 별도 폴더로 백업 (제외: 큰 데이터 폴더)
# 사실상 설정 파일들만 백업
cp -r ~/.claude/agents ~/.claude/backups/forge-cleanup-2026-04-09/agents
cp -r ~/.claude/commands ~/.claude/backups/forge-cleanup-2026-04-09/commands
cp -r ~/.claude/skills ~/.claude/backups/forge-cleanup-2026-04-09/skills
cp -r ~/.claude/hooks ~/.claude/backups/forge-cleanup-2026-04-09/hooks
cp ~/.claude/settings.json ~/.claude/backups/forge-cleanup-2026-04-09/settings.json
# claude-forge 본체는 GitHub에서 다시 받을 수 있으니 백업 안 함
```

→ 만약 뭔가 필요한 게 있었으면 이 백업에서 복원 가능.

### 2단계: 삭제 실행
순서:
1. `~/.claude/claude-forge/` 폴더 삭제
2. `~/.claude/agents/` 안에서 8개 파일 삭제
3. `~/.claude/commands/` 안에서 39개 항목 삭제 (`plan.md`만 남김)
4. `~/.claude/skills/` 폴더 통째 삭제
5. `~/.claude/hooks/` 폴더 통째 삭제
6. `~/.claude/settings.json` 의 `hooks` 섹션 → `{}`

### 3단계: 검증
- `ls ~/.claude/agents/` → 3개만 보여야 함
- `ls ~/.claude/commands/` → 1개만
- `~/.claude/skills/`, `hooks/`, `claude-forge/` 부재 확인
- `settings.json` 파싱 가능 + hooks 비어있는지 확인
- `claude mcp list` → stitch만 있는지 확인 (안 건드렸지만 검증)

### 4단계: 결과보고서 작성
- `docs/report-forge-cleanup-2026-04-09.md` 작성
- 변경 사항 요약, 백업 위치, 새 세션 시작 시 주의사항

### 5단계: worklog 업데이트
- `docs/worklog.md` 에 `## 2026-04-09` 섹션 추가

---

## 주의사항 / 확인 필요

### ⚠️ 위험 요소

1. **다른 프로젝트에 영향**: 이 작업은 글로벌 `~/.claude/` 변경이라 다른 프로젝트에서 Claude Code 쓸 때도 적용됨. 만약 다른 프로젝트에서 Forge 워크플로우 쓰고 있었다면 거기도 다 깨짐.
   → **확인 필요**: milling-log 외에 다른 프로젝트도 있는가?

2. **CLAUDE.md 룰 vs 실제 도구 불일치**:
   - CLAUDE.md엔 11개 에이전트 다 나열돼 있음
   - 8개를 지우면 CLAUDE.md 내용과 실제 설치된 에이전트가 안 맞음
   - **선택지**:
     - (A) CLAUDE.md는 그대로 두고 실제 에이전트만 줄임 → 룰 문서가 거짓말이 됨
     - (B) CLAUDE.md의 "Claude Forge 에이전트 목록" 섹션도 같이 정리 → 일관성 유지
   - **추천: B**. CLAUDE.md에서 에이전트 목록 섹션을 3개만 남기게 수정.

3. **새 세션 시작 시 시스템 프롬프트 변경**: hooks·skills 다 지우면 다음 세션부터 system-reminder에 등장하는 skills 목록이 확 줄어듦. 동작에 문제 없지만 시각적으로 달라짐.

4. **Forge 룰 일부는 좋은 거**: CLAUDE.md의 "코딩 원칙 (Claude Forge Rules)" 섹션 (불변성·800줄·HARD-GATE 등)은 Forge 출처지만 너가 쓰는 룰이 됐음 → **유지**. 헤더 이름만 "코딩 원칙"으로 살짝 정리할지는 너 결정.

### ❓ 사용자 확인 필요

- [ ] 다른 프로젝트에서 Forge 쓰고 있나? (있으면 신중하게 진행)
- [ ] CLAUDE.md의 "Claude Forge 에이전트 목록" 섹션도 정리할까? (추천: 예)
- [ ] CLAUDE.md의 "코딩 원칙 (Claude Forge Rules)" 헤더 이름 바꿀까? (추천: 그냥 둠)
- [ ] 백업 위치 `~/.claude/backups/forge-cleanup-2026-04-09/` 로 OK?

---

## 영향 범위 요약

| 변경 종류 | 개수 |
|---|---|
| 삭제할 폴더 | 3개 (claude-forge/, skills/, hooks/) |
| 삭제할 파일 | 약 47개 (agents 8 + commands 39) |
| 수정할 파일 | 1개 (settings.json) |
| 새로 만들 파일 | 2개 (결과보고서, worklog 업데이트) |
| 백업 폴더 | 1개 (~/.claude/backups/forge-cleanup-2026-04-09/) |
| **건드리지 않는 것** | milling-log 프로젝트 코드, 개인 데이터, MCP, CLAUDE.md 룰 본문 |

---

## 승인 후 다음 액션

이 계획서를 사용자가 검토하고 승인하면:
1. 위 ❓ 4개 질문에 답 받기
2. 답에 따라 계획 미세 조정
3. 1단계부터 순서대로 실행
