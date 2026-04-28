# Claude Design 워크플로우 가이드

이 프로젝트(`milling-log`)에서 **Claude Design → Claude Code 핸드오프 번들**로 UI를 만드는 표준 절차다. 2026-04-23부터 Stitch MCP는 제거됐고, 모든 디자인 작업은 Claude Design에서 한다.

## 전체 흐름

```
[claude.ai Claude Design]
        │
        │ 1. 코드베이스 attach (최초 1회)
        │ 2. 프롬프트로 시안 제작 / 변형 / 편집
        │ 3. Export → "Send to Claude Code"
        ▼
[핸드오프 번들 생성]
   ├─ 디자인 파일
   ├─ 채팅 로그
   ├─ PROMPT.md (스택·컨벤션·우선순위)
   └─ 공유 URL
        │
        │ 4. 생성된 "붙여넣기용 프롬프트" 복사
        ▼
[VSCode Claude Code (여기)]
        │
        │ 5. 복사한 프롬프트 붙여넣기
        │ 6. Claude가 번들 URL 읽고 PROMPT.md 따라 구현
        │ 7. 타입체크 / 빌드 / 수동 확인
        ▼
[커밋 + worklog 기록]
```

## 1. Claude Design 쪽에서

### 최초 세팅 (한 번만)
- [claude.ai](https://claude.ai) → Claude Design 진입
- **Attach codebase** → `milling-log` 리포 연결 (완료: 2026-04-23)
- Claude가 기존 컴포넌트·컬러·타이포 읽어서 디자인 시스템 자동 구성

### 디자인 작업
- 프롬프트로 화면/프로토타입/목업 생성
- 캔버스에서 인라인 코멘트·드래그로 수정
- `generate_variants` 대신 채팅으로 "다른 톤으로 3개 만들어줘" 식으로 변형

### 핸드오프
- 완성되면 **Export** 클릭
- **"Send to Claude Code"** 선택 (터미널 밖이면 "Send to Claude Code Web")
- 번들이 패키징되고, **붙여넣기용 프롬프트**가 생성됨 (번들 URL 포함)

## 2. 여기(VSCode Claude Code)에서

### 붙여넣기 단계
Claude Design에서 복사한 프롬프트를 그대로 이 창에 붙여넣으면 된다. 프롬프트에는:
- 번들 URL
- "이 URL을 읽고 PROMPT.md의 지시를 따르라"는 안내
- 구현 우선순위

### Claude가 자동으로 할 일
1. 번들 URL을 `WebFetch`로 읽어 `PROMPT.md` 확인
2. 이 프로젝트 규칙(CLAUDE.md, 기존 컴포넌트 패턴)과 대조
3. **3개 이상 파일 변경이면 `/plan` 먼저** (전역 CLAUDE.md 규칙)
4. 승인 후 구현 → 타입체크·빌드 → 결과보고서 작성

### 사용자 확인 포인트
- 번들이 기존 컴포넌트를 **재사용**하는지, 중복 컴포넌트를 **새로 만드는지** 확인 (재사용 우선)
- 색상·타이포 토큰이 이 프로젝트의 디자인 토큰을 쓰는지 확인
- 모바일 대응 (이 프로젝트는 모바일 중심)

## 3. 커밋·문서화

기존 규칙 그대로:
- `docs/plan-{작업명}.md` 승인 후 작업
- `docs/report-{작업명}-{날짜}.md` 작성
- `docs/worklog.md` 업데이트
- 커밋 메시지: `feat: ...` / `fix: ...` 관례 유지

## 제거된 것

- **Stitch MCP** — `~/.claude.json`, `~/.claude/settings.json`에서 제거 (2026-04-23)
- 이전 백업: `~/.claude.json.bak-20260423`, `~/.claude/settings.json.bak-20260423`
- Stitch Google API 키는 **재발급 대상** (Google Cloud 콘솔에서 수동 폐기 권고)

## 트러블슈팅

### 번들 URL이 열리지 않음
- 조직 내부 URL이라 로그인 세션 필요
- 만료됐으면 Claude Design에서 다시 Export

### PROMPT.md가 기존 컨벤션과 충돌
- Claude가 번들 그대로 구현하지 말고, **CLAUDE.md 규칙 우선**으로 조정
- 충돌 내역은 결과보고서 "확인이 필요한 사항"에 명시

### 코드베이스 attach가 낡음
- 리포에 큰 변경(폴더 구조, 컴포넌트 리네임) 있으면 Claude Design에서 re-attach
