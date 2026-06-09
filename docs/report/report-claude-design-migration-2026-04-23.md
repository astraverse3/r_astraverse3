# Stitch MCP → Claude Design 마이그레이션 결과보고서

작성일: 2026-04-23
작업명: claude-design-migration
계획서: [plan-claude-design-migration.md](../plan/plan-claude-design-migration.md)

## 변경 사항 요약

### 제거
- `~/.claude.json`의 `mcpServers.stitch` (HTTP MCP 등록) → `mcpServers: {}`로 비움
- `~/.claude/settings.json`의 `permissions.allow`에서 `mcp__stitch__*` 툴 8개 제거
  - `mcp__stitch__list_projects`
  - `mcp__stitch__create_project`
  - `mcp__stitch__get_project`
  - `mcp__stitch__list_screens`
  - `mcp__stitch__get_screen`
  - `mcp__stitch__generate_screen_from_text`
  - `mcp__stitch__edit_screens`
  - `mcp__stitch__generate_variants`

### 백업 (복원용)
- `~/.claude.json.bak-20260423`
- `~/.claude/settings.json.bak-20260423`

### 신규 문서
- [docs/plan-claude-design-migration.md](../plan/plan-claude-design-migration.md) — 마이그레이션 계획
- [docs/claude-design-workflow.md](../claude-design-workflow.md) — Claude Design 핸드오프 표준 절차

### 영향 없음
- `src/`, `app/` 등 프로덕트 코드: 변경 없음 (이번 단계는 툴·워크플로우 교체만)

## 주요 결정 사항

1. **`mcpServers`를 빈 객체로 유지** — 키 자체를 삭제하지 않고 `{}`로 남김. 추후 Figma MCP 등 다른 MCP 추가 시 스키마 유지 목적.
2. **권한 목록 정리 범위** — `Read/Glob/Grep/Bash/Edit/Write` 기본 툴은 그대로 유지. Stitch 권한만 분리 제거.
3. **settings.json 복원 경로 명시** — 백업 파일명을 `.bak-20260423`로 통일해 날짜만 보고도 복원 가능.

## 검증

- `node -e "JSON.parse(...)"` 로 두 파일 유효성 확인
  - `claude.json` OK, `mcpServers: {}`
  - `settings.json` OK, `allow: ["Read","Glob","Grep","Bash","Edit","Write"]`
- 현재 세션에 아직 `mcp__stitch__*` 툴이 붙어있는 건 **세션 시작 시점에 로드된 deferred 툴**이기 때문이며, VSCode Claude Code 재시작하면 사라진다.

## 확인이 필요한 사항

1. **Google API 키 폐기** — 이전 stitch MCP에 박혀있던 GCP API 키(헤더명 `X-Goog-Api-Key`, 값은 보안상 마스킹 처리: `[REDACTED-revoked-2026-05-08]`)는 이번 세션 툴 출력에 한 번 노출됐다. Google Cloud 콘솔에서 **해당 API 키 삭제/재발급 권고**. 로컬 파일 한정이라 외부 유출 확정은 아니지만, 보안 원칙상 재발급이 안전.
2. **VSCode Claude Code 재시작 필요** — 재시작 후 툴 목록에서 `mcp__stitch__*` 완전히 사라지는지 확인해줘.
3. **Claude Design 첫 실사용** — 다음 디자인 작업 때 `docs/claude-design-workflow.md` 절차대로 돌려보고, 실제 사용하며 미흡한 부분은 가이드에 추가 보완.
4. **백업 파일 보관 기간** — 2주 후(2026-05-07) 문제 없으면 `.bak-20260423` 두 개 삭제해도 됨.

## 다음 단계

- 기존 UI(공지사항 팝업, 재고 필터 등) 리뉴얼하고 싶은 화면이 있으면 Claude Design에서 시안 뽑고, "Send to Claude Code"로 여기 다시 찾아와.
