# 계획서 — docs 폴더 분류별 정리

## 작업 목표
`docs/` 루트에 평면적으로 흩어진 문서 70여 개를 분류별 하위 폴더로 정리한다.
링크·코드·메모리에서 참조하는 경로가 깨지지 않도록 일괄 보정한다.

## 변경 후 폴더 구조

```
docs/
├─ plan/          ← plan-*.md (24개)
├─ report/        ← report-*.md (26개)
├─ research/      ← research-*.md (5개)
├─ handoff/       ← claude design 핸드오프 산출물 통합 (완전 정리 채택)
│   ├─ 디자인시스템/              ← 현 handoff/ 루트 번들 이동 (status-migration.md 포함)
│   ├─ 잡곡재고관리/              ← handoff-잡곡재고관리/ 이동
│   ├─ 원물카드_상태간소화_A안/    ← 이동
│   ├─ 모바일-디자인점검.html      ← 이동
│   ├─ 벼탭-디자인점검.html        ← 이동
│   └─ 투입내역-요약-소계-시안.html ← 이동 (추적 중인 시안 파일)
│
├─ worklog.md                ← 루트 유지 (참조 다수)
├─ permission-matrix.md      ← 루트 유지 (lib/permissions.ts 등 참조)
├─ 리팩토링-백로그.md         ← 루트 유지
├─ claude-design-workflow.md ← 루트 유지
└─ plan-docs폴더정리.md       ← 본 계획서 (작업 후 plan/으로 이동)
```

### 핵심 결정 (사용자 확정 완료)
- plan / report / research → 각자 하위 폴더
- claude design 산출물(핸드오프 번들 2개 + 시안 html 2개) → `handoff/` 하위로 통합
- `handoff-잡곡재고관리/` → `handoff/잡곡재고관리/` (.gitignore도 함께 정리)
- worklog · permission-matrix · 리팩토링-백로그 · claude-design-workflow → **루트 유지**
- **완전 정리 채택**: 현 활성 디자인시스템 번들도 `handoff/디자인시스템/`으로 묶고, `milling-status-badge.tsx`의 `status-migration.md` 참조 주석을 함께 수정

## 단계별 접근

### 1단계 — 폴더 생성 + 파일 이동 (git mv)
- `git mv` 로 이동해 히스토리 보존
- `plan-*.md` → `plan/`, `report-*.md` → `report/`, `research-*.md` → `research/`
- `handoff-잡곡재고관리/` → `handoff/잡곡재고관리/`
- `원물카드_상태간소화_A안/` → `handoff/원물카드_상태간소화_A안/`
- `모바일-디자인점검.html`, `벼탭-디자인점검.html` → `handoff/`

### 2단계 — 문서 내부 상호링크 보정
폴더가 갈리면서 **다른 카테고리를 가리키는 상대링크**가 깨진다. 같은 폴더 내 참조는 무관.

| 위치 | 참조 대상 | 보정 |
|---|---|---|
| `plan/` 내 문서 | report / research | `](../report/...)`, `](../research/...)` |
| `report/` 내 문서 | plan / research | `](../plan/...)`, `](../research/...)` |
| `research/` 내 문서 | plan | `](../plan/...)` |
| 루트(worklog 등) | plan / report / research | `](plan/...)`, `](report/...)`, `](research/...)` |

- `](plan-xxx.md)` 형식(절대형)도 위치에 맞게 정규화
- 보정 대상 문서는 약 20개 (grep으로 식별 완료), 이동 후 깨진 링크를 재검증

### 3단계 — 코드·설정 보정
- `scripts/seed-misc-grain-varieties.ts` 주석 → `docs/plan/plan-잡곡재고관리.md`
- `.gitignore` `/docs/handoff-*/` → `/docs/handoff/잡곡재고관리/` (추적 제외 유지)
- `README.md` 워크플로 규칙 문구 → `docs/plan/`, `docs/report/` 경로 반영
- `lib/permissions.ts`, `misc-package-panel.tsx`, `milling-status-badge.tsx` → **변경 불필요**
  (permission-matrix·handoff/status-migration 모두 위치 그대로)

### 4단계 — 메모리 경로 보정
- `project_misc_grain_feature.md` 등에 박힌 `docs/plan-잡곡재고관리.md` → `docs/plan/...`
  (permission-matrix.md는 루트 유지라 그대로)

### 5단계 — 검증
- `git status`로 이동 누락 확인
- docs 내부에서 깨진 상대링크(`grep`으로 존재하지 않는 경로) 0건 확인
- 본 계획서를 `plan/`으로 이동, `docs/worklog.md` 작업일지 갱신

## 확인이 필요한 사항
- **handoff/ 내부 추가 정리 여부**: 현재는 활성 번들을 `handoff/` 루트에 그대로 두는 "최소 변경" 안.
  더 깔끔하게 현 번들도 `handoff/디자인시스템/` 서브폴더로 묶을 수 있으나, 이 경우
  `milling-status-badge.tsx`의 `status-migration.md` 참조 주석도 함께 바꿔야 함. (기본: 최소 변경)
