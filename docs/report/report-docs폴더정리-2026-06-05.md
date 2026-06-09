# 결과보고서 — docs 폴더 분류별 정리 (2026-06-05)

> **계획서**: [../plan/plan-docs폴더정리.md](../plan/plan-docs폴더정리.md)

## 변경 사항 요약

`docs/` 루트에 평면적으로 흩어져 있던 문서 70여 개를 분류별 하위 폴더로 재배치하고, 깨지는 참조 경로를 전부 보정했다.

### 폴더 구조 (after)
```
docs/
├─ plan/      ← plan-*.md (33, 본 정리 계획서 포함)
├─ report/    ← report-*.md (31)
├─ research/  ← research-*.md (5)
├─ handoff/   ← claude design 산출물 통합
│   ├─ 디자인시스템/            (현 활성 번들: design-system.html, status-migration.md 등)
│   ├─ 잡곡재고관리/            (구 handoff-잡곡재고관리/, .gitignore 미추적 유지)
│   ├─ 원물카드_상태간소화_A안/
│   ├─ 모바일-디자인점검.html
│   ├─ 벼탭-디자인점검.html
│   └─ 투입내역-요약-소계-시안.html
├─ worklog.md            ← 루트 유지
├─ permission-matrix.md  ← 루트 유지 (lib/permissions.ts 등 참조)
├─ 리팩토링-백로그.md     ← 루트 유지
└─ claude-design-workflow.md ← 루트 유지
```

### 이동 방식
- 추적 파일은 `git mv`로 히스토리 보존 (git이 rename으로 정확히 인식)
- 미추적 폴더(`handoff-잡곡재고관리/`)는 일반 이동 — Windows 폴더 이동 권한 이슈로 PowerShell `Move-Item` 사용

### 참조 경로 보정
| 대상 | 처리 |
|---|---|
| 문서 간 상호링크 | 카테고리 교차 참조에 `../plan/`·`../report/`·`../research/` 부여, `./`접두·`docs/`절대형 정규화 |
| `status-migration.md` 참조 | `handoff/디자인시스템/` 하위로 이동 → 경로 조정 |
| `scripts/seed-misc-grain-varieties.ts` | 주석 경로 `docs/plan/plan-잡곡재고관리.md` |
| `components/ui/milling-status-badge.tsx` | 주석 경로 `docs/handoff/디자인시스템/status-migration.md` |
| `.gitignore` | `/docs/handoff-*/` → `/docs/handoff/잡곡재고관리/` |
| `README.md` | 워크플로 가이드 경로 `docs/plan/`·`docs/report/` 반영 |
| 자동 메모리 | `docs/plan-`·`docs/report-`·`docs/research-`·`docs/handoff-잡곡재고관리/` 일괄 보정 |

## 주요 결정 사항
- **handoff 완전 정리 채택**: 현 활성 번들도 `handoff/디자인시스템/`으로 묶어 모든 핸드오프를 작업별 폴더로 통일 (사용자 요청)
- **`투입내역-요약-소계-시안.html` 포함**: 계획 단계엔 없었으나 추적 중인 시안 파일이라 "디자인 시안은 handoff로" 의도에 맞춰 함께 이동
- **루트 유지 4종**: 참조가 많거나 단일 진실 원천이라 `lib/permissions.ts` 등 코드 참조를 깨지 않기 위해 위치 보존

## 검증
- 전체 `.md` 깨진 링크 전수 검사: **이동으로 인한 깨짐 0건**
- 코드 변경은 주석/문자열뿐 → 빌드 영향 없음

## 확인이 필요한 사항
이동과 **무관한 기존 깨진 링크 2건**을 발견했으나 수술적 원칙상 손대지 않았다. 정리 원하면 별도로 처리 가능:
1. `plan/plan-stats-cleanup.md → README.md` — `docs/README.md`가 존재한 적 없음(루트 `README.md` 의도로 추정)
2. `report/report-도정상태3단계-2026-05-20.md → ./draft-공지-잡곡재고관리-2026-05-08.md` — draft 공지 파일은 이미 삭제됨(공지 등록 완료 시점)
