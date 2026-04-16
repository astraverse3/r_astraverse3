# Claude Forge 정리 결과보고서

> 작업일: 2026-04-09
> 작업자: Claude (사용자 승인 후 진행)
> 관련 계획서: [docs/plan-forge-cleanup.md](plan-forge-cleanup.md)
> 상태: ✅ 완료

---

## 작업 목표

`~/.claude/`에 설치된 [Claude Forge](https://github.com/sangrokjung/claude-forge) 자산 중 사용자가 실제로 안 쓰는 것을 제거하고, 핵심만 남긴 미니멀 환경으로 정리.

---

## 변경 사항 요약

### 🗑️ 삭제

| 대상 | 결과 |
|---|---|
| `~/.claude/claude-forge/` 폴더 | 통째 삭제 (Forge 본체 git clone 원본) |
| `~/.claude/agents/` | 11개 → 3개 (8개 삭제) |
| `~/.claude/commands/` | 40개 → 1개 (39개 삭제) |
| `~/.claude/skills/` 폴더 | 통째 삭제 (16개) |
| `~/.claude/hooks/` 폴더 | 통째 삭제 (16개 스크립트 + hooks.json) |
| `~/.claude/settings.json`의 `hooks` 섹션 | 5개 이벤트 → `{}` |

### ✏️ 수정

- `~/.claude/CLAUDE.md`
  - "코딩 원칙 (Claude Forge Rules)" → "코딩 원칙" (Forge 단어 제거)
  - "Claude Forge 에이전트 목록" 섹션 → "사용 가능한 에이전트" (11개 → 3개로 정리)

### 🟢 유지된 항목

**Agents (3개)**
- `planner.md`
- `code-reviewer.md`
- `security-reviewer.md`

**Commands (1개)**
- `plan.md` (`/plan` 슬래시 커맨드)

**개인 데이터 (절대 안 건드림)**
- `~/.claude/projects/`, `sessions/`, `memory/`, `.claude.json`, `plans/`, `file-history/`, `shell-snapshots/`, `telemetry/`, `cache/`, `ide/`, `session-env/`, `homunculus/`, `backups/`, `plugins/`

**MCP 서버**
- `stitch` 1개 (사용 중) — install.ps1엔 4개 깔라고 돼있었지만 실제로 등록된 건 stitch뿐이라 끊을 거 없었음

**설정 (settings.json)**
- `language: korean`
- `permissions.allow` 14개 (Read·Glob·Grep·Bash·Edit·Write + Stitch MCP 권한 8개)

---

## 백업 위치

`~/.claude/backups/forge-cleanup-2026-04-09/`

다음을 백업해 둠 (만약 뭔가 다시 필요하면 이 폴더에서 복원 가능):
- `agents/` (11개 원본)
- `commands/` (40개 원본)
- `skills/` (16개 원본)
- `hooks/` (16개 + hooks.json)
- `settings.json` (hooks 가득 찼던 원본)
- `CLAUDE.md` (Forge 단어 들어있던 원본)

> ⚠️ `claude-forge/` 본체 폴더는 백업 안 함. 필요 시 GitHub에서 다시 받을 수 있음:
> ```bash
> git clone https://github.com/sangrokjung/claude-forge.git
> ```

---

## 검증 결과

```
=== agents ===
code-reviewer.md
planner.md
security-reviewer.md

=== commands ===
plan.md

=== skills/hooks/claude-forge ===
OK - none exist

=== settings.json ===
hooks key: {}
language: korean
permissions allow count: 14

=== mcp ===
stitch: https://stitch.googleapis.com/mcp (HTTP) - ✓ Connected
```

전부 의도한 대로.

---

## 주요 결정 사항

1. **`/plan` 슬래시 커맨드는 살림** — worklog·메모리에서 사용 패턴 확인됨. 작업 절차 룰의 핵심.

2. **에이전트 3개만 살림** — `~/.claude/CLAUDE.md`의 "보안 원칙" 섹션에서 `security-reviewer` 명시적으로 호출. `code-reviewer`도 룰에 명시. `planner`는 `/plan` 동작에 필요할 가능성.

3. **MCP는 손 안 댐** — 등록된 게 stitch 1개뿐이고 그건 사용 중. install.ps1에 적힌 context7·playwright·memory·sequential-thinking은 애초에 등록 안 돼있었음 (사용자가 그때 'n' 했거나 건너뜀).

4. **CLAUDE.md 룰 본문은 유지** — "불변성·800줄·HARD-GATE" 같은 코딩 원칙은 출처가 Forge지만 사용자가 일상으로 쓰는 룰이 됨. 헤더 이름에서 "Claude Forge Rules" 단어만 제거.

5. **개인 데이터·플러그인·백업 폴더는 절대 안 건드림** — `projects/`, `sessions/`, `memory/`, `plugins/`, `backups/` 등은 Forge랑 무관하거나 사용자 데이터.

---

## 새 세션 시작 시 변경되는 것

다음 번 Claude Code 세션을 새로 열면 이런 변화가 있을 거야:

- **system-reminder의 skills 목록**이 확 줄어듦 (50+개 → 약 7개 ─ Anthropic 기본 제공만 남음)
- **slash command 자동완성**에서 `/plan` 1개만 보임
- **세션 시작/종료 시 hook 실행 메시지**가 사라짐 (work-tracker, context-sync-suggest, forge-update-check, session-wrap-suggest 등)
- **Edit/Write 후 자동 보안검사·코드품질 알림**이 사라짐 (code-quality-reminder, security-auto-trigger)
- **bash 명령 실행 전 remote-command-guard** 체크가 사라짐

이번 세션은 이미 시작된 상태에서 변경한 거라 system-reminder는 그대로 옛날 목록을 보여줄 수 있어 (캐시). 다음 세션부터 깔끔해짐.

---

## 사용자 확인 필요 사항

- [ ] **새 세션 한 번 띄워서 슬래시 명령·자동완성이 의도대로 줄었는지 직접 확인**해줘.
- [ ] 며칠 써보고 **빠진 게 정말 필요해지면 백업 폴더에서 골라서 복원**하면 됨. 한 달 정도 지나도 안 쓰면 백업 폴더도 지워도 OK.
- [ ] 혹시 hook으로 자동화하고 싶었던 게 있으면 나중에 하나씩 새로 만들면 돼 (`update-config` 스킬로 settings.json hooks 추가 가능).

---

## 영향 받지 않는 것

- ✅ milling-log 프로젝트 코드 (한 줄도 안 바뀜)
- ✅ git 상태 (M docs/plan-statistics.md 그대로)
- ✅ 다른 프로젝트 (사용자 확인: 다른 프로젝트 없음)
- ✅ Stitch MCP (사용 중, 그대로)
- ✅ 메모리·세션·프로젝트 기록
