# Stitch MCP → Claude Design 마이그레이션 계획

작성일: 2026-04-23
작업명: claude-design-migration

## 작업 목표

- 기존 Stitch MCP 연결을 제거하고, Anthropic이 출시한 **Claude Design** 기반 워크플로우로 전환한다.
- Claude Design의 **"Send to Claude Code" 핸드오프 번들** 방식을 프로젝트 표준 디자인 작업 흐름으로 문서화한다.
- 현재 VSCode Claude Code 세션에 붙은 `mcp__stitch__*` 툴을 제거해 툴 목록을 깨끗하게 정리한다.

## 배경 / 선택 이유

| 항목 | Stitch (Google) | Claude Design (Anthropic) |
|---|---|---|
| 코드베이스 인식 | 약함 | 코드베이스·디자인 파일 읽고 디자인 시스템 자동 구성 |
| Claude Code 연동 | MCP 툴 호출 (단방향) | 원클릭 핸드오프 번들 + PROMPT.md |
| 산출물 | 화면 시안 | 프로토타입 / 슬라이드 / HTML·PDF·PPTX / Canva |
| 모델 | Gemini | Opus 4.7 |
| 요금 | 별도 | Pro/Max/Team/Enterprise 플랜 포함 |

사용자가 이미 Claude Pro/Max 환경에서 작업 중이고, 이 프로젝트는 전적으로 Claude Code로 빌드하고 있어 핸드오프 번들 워크플로우가 그대로 맞물린다. 사용자는 이미 Claude Design에서 이 프로젝트 코드베이스 attach를 완료했다.

## 변경 범위

### 수정 파일

1. **`C:\Users\nbcue\.claude.json`** (전역 Claude 설정)
   - `mcpServers.stitch` 항목 제거 → `"mcpServers": {}`로 남김
   - 변경 전 파일 전체 백업 (`~/.claude.json.bak-20260423`)

2. **`C:\Users\nbcue\.claude\settings.json`** (전역 settings)
   - `permissions.allow`에서 아래 7개 제거:
     - `mcp__stitch__list_projects`
     - `mcp__stitch__create_project`
     - `mcp__stitch__get_project`
     - `mcp__stitch__list_screens`
     - `mcp__stitch__get_screen`
     - `mcp__stitch__generate_screen_from_text`
     - `mcp__stitch__edit_screens`
     - `mcp__stitch__generate_variants` (실제 8개)

### 신규 파일

3. **`docs/claude-design-workflow.md`** — 팀/향후-클로드용 핸드오프 가이드
   - claude.ai에서 디자인 → Export → "Send to Claude Code" 복사
   - VSCode Claude Code 창에 붙여넣기 → 번들 URL 기반으로 구현
   - 번들에 포함된 `PROMPT.md` 규칙 따르는 법
   - 구현 완료 후 타입체크·빌드 검증 체크리스트

### 영향 없는 영역

- `src/` 이하 프로덕트 코드: **이번 단계에서는 변경 없음** (마이그레이션은 툴/워크플로우 교체일 뿐, 기존 UI 리뉴얼은 별도 작업)
- `CLAUDE.md`, `agents/`: 변경 없음

## 단계별 접근 방식

1. **[승인 단계]** 본 계획서 사용자 승인
2. **백업** — `~/.claude.json`, `~/.claude/settings.json` 각각 `.bak-20260423` 사본 생성
3. **Stitch MCP 제거** — `.claude.json`에서 `mcpServers.stitch` 항목 삭제, `mcpServers` 빈 객체로 유지
4. **settings.json 권한 정리** — `permissions.allow`에서 `mcp__stitch__*` 항목 8개 제거
5. **JSON 유효성 검증** — 두 파일 모두 `node -e "JSON.parse(require('fs').readFileSync('...'))"` 확인
6. **재시작 안내** — VSCode Claude Code 세션 재시작 시 stitch 툴이 사라지는 걸 사용자가 확인
7. **워크플로우 가이드 작성** — `docs/claude-design-workflow.md` 신규 생성
8. **결과보고서 + worklog** — `docs/report-claude-design-migration-2026-04-23.md` 작성, `docs/worklog.md`에 2026-04-23 항목 추가

## 리스크 / 확인 필요 사항

1. **`~/.claude.json`은 여러 전역 설정 통합 파일** — JSON 파싱 오류 나면 Claude Code 자체가 뜨지 않을 수 있음. **반드시 백업 후 편집, 편집 후 JSON.parse 검증**.
2. **Google API 키 노출 리스크** — `stitch.headers["X-Goog-Api-Key"]`에 들어있던 키가 이 세션의 툴 출력에 한 번 노출됨. 로컬 파일이라 외부 유출은 아니지만, 폐기·재발급을 권장. (Google Cloud 콘솔에서 해당 API 키 삭제)
3. **Claude Design 접근 가능 여부** — research preview이므로 플랜에 따라 롤아웃이 다를 수 있음. 사용자가 이미 "attach codebase"까지 완료했으므로 문제없다고 간주.
4. **핸드오프 번들 URL의 수명·권한** — Anthropic이 조직 내부 공유 URL로 발급. 세션이 만료되거나 조직 밖 공유 시 접근 불가할 수 있으니 필요한 번들은 로컬로 동기화.
5. **settings.json의 JSON 형식** — 후행 콤마 발생하지 않도록 순수 편집 (Edit 툴로 정확히 교체).

## 승인 요청

위 계획대로 진행해도 될까?
- (a) 그대로 진행
- (b) 수정사항 있음 → 지적해줘
- (c) 스티치 API 키 재발급부터 먼저 할래
