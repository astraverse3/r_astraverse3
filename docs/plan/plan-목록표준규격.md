# 계획서 — 목록 표준규격 통일 (데스크탑)

- 작성 2026-09-03 / **개정 2026-09-03 (시안 v2 수령)**
- 핸드오프: `docs/handoff/list-standard/` (`README.md` → `list-spec-instructions.md` → `list-spec.html`)
- 상태: **착수 — 블로커 A·B·C·D 2026-09-03 전부 결정됨(아래 2.7)**

## 0. v1 대비 무엇이 바뀌었나

시안이 갱신되며 **타이포가 정반대로 뒤집혔고** 범위가 R1~R3 → R1~R5로 늘었다.

| 항목 | v1 (09-02) | v2 (09-03) |
| --- | --- | --- |
| 헤더 타이포 | 13px / **700** / slate-**500** | 14px / **500** / slate-**900** |
| 본문 타이포 | 13.5px / slate-700 | 14px / slate-700 (`text-sm` 상속) |
| 컬럼 폭 | 언급 없음 | `colgroup` **% 비율** + `table-layout:fixed`, 로트 ≥24% |
| 펼침 그룹 | 범위 밖 | **R3 신설** — slate 묶음톤 통일, `#00a2e8` 제거 |
| 문서 개정 | 없음 | **R5 신설** — `handoff.md` §4.2 |
| 파일명 | `작업지시-…md` / `목록-표준규격-시안.html` | `list-spec-instructions.md` / `list-spec.html` |

**v1 계획서의 색상 방향 결정(토큰 치환)은 무의미해졌다** — 아래 3절 참조.

## 1. 목표

목록 테이블 11곳의 헤더·행 스펙과 **펼침 그룹 표현**을 통일한다.
`components/ui/table.tsx`를 정비하고, 각 목록의 개별 클래스·하드코딩 색을 걷어낸다.

## 2. 사전 대조 결과

### 2.1 시안이 정확했던 것 (실물 일치 — 라인 번호까지)

| 주장 | 확인 |
| --- | --- |
| `TableCell`이 `p-2` | ✅ |
| `farmer-list.tsx:371` 그룹헤더 `bg-[#00a2e8]/20`, hover `/16`, 접힘 `bg-white` | ✅ |
| `farmer-list.tsx:405` 서브행 `bg-[#00a2e8]/7` | ✅ |
| `farmer-list.tsx:395` "클릭해서 펼치기/접기" 안내 | ✅ |
| `stock-list-client.tsx:234` 그룹헤더 `h-12` + `shadow-sm` | ✅ |
| `misc-stock-list-client.tsx:211` `bg-slate-50/60` | ✅ |
| `isMulti` · `inExpandedGroup` · `isMultiFarmer` 패턴 존재 | ✅ |
| R4 헤더 클래스 7개 파일 | ✅ (v1에서 확인, 변동 없음) |

### 2.2 🔴 블로커 A — R5 「이미 개정 완료」가 이 저장소에선 사실이 아니다

지시서 R5와 README는 `handoff.md` §4.2가 **이미 개정됐으니 확인만 하면 된다**고 적었다. 실제로는:

| 확인 항목 | 결과 |
| --- | --- |
| `docs/handoff/디자인시스템/handoff.md:346` | `text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2` — **옛 값** |
| `docs/handoff/잡곡재고관리/handoff.md:346` | 동일하게 옛 값 |
| 새 값 `text-sm font-medium text-slate-900` 저장소 전체 검색 | **0건** |
| git 이력 | `939795b`(2026-06-09 폴더 이동)가 마지막. 개정 커밋 없음 |
| 미커밋 변경 | `list-standard/` 외 없음 |

→ 클로드디자인 워크스페이스에서만 고쳐졌고 저장소에 반영되지 않았다.
**R5는 「확인만」이 아니라 실작업이다.** 추가로 `handoff.md`가 **2벌**이라 대상 지정이 필요하다.

### 2.3 🔴 블로커 B — `#00a2e8` 체크리스트가 R3 범위와 모순

검수 체크리스트: *"`#00a2e8`이 코드베이스에서 사라졌는가 (`grep -r "00a2e8"`)"*
그러나 실제 **31건**이고 R3가 제거하는 것은 **2건**(그룹 헤더·서브행)뿐이다.

나머지 29건은 그룹 표현과 무관한 **의미색**이다:

| 위치 | 용도 |
| --- | --- |
| `farmer-list.tsx:196` | **무농약 인증 칩** (R2 규약은 무농약=sky — 별개 논의) |
| `farmer-list.tsx:247·253·292·450` | 연락처 버튼·아이콘 호버 |
| `farmer-filters.tsx:98·102` | 활성 필터 배지 |
| `log-list.tsx:141·148·155·268·375` | 총건수 강조·포커스링·상세 버튼 |
| `realtime-status.tsx:195·221` | 메벼 진행바 그래디언트·범례 |
| `admin/users/page.tsx:20` · `excel-buttons.tsx:106` | 총건수·아이콘 호버 |

체크리스트를 문자 그대로 만족시키면 **6개 파일에서 의미색까지 제거**해야 한다 → 범위 폭발.

### 2.4 🔴 블로커 C — 「그룹 헤더 44px」와 「misc가 정본」이 충돌

R3는 `misc-stock-list-client.tsx`를 **펼침 그룹 정본**으로 삼고 `/60`→`/75`만 맞추라고 한다.
그런데 정본인 `misc-stock-list-client.tsx:210`도 **`h-12`(48px)** 를 갖고 있다.
`stock-list-client.tsx`에서만 `h-12`를 빼라고 하므로, 지시대로 하면
**정본이 자기 체크리스트(「본문·그룹 헤더 행이 모두 44px」)를 위반**한다.

부수: 두 파일 모두 `border-slate-200/70`인데 스펙은 `/80`이다.

### 2.5 여전한 누락 D — 본문 행 파일 3개 (v1에서 지적, v2에도 반영 안 됨)

R4 표는 `ui/table`을 쓰는 11개 파일 중 **헤더가 있는 7개만** 지목한다.

| 누락 파일 | TableCell | 문제 |
| --- | --- | --- |
| `milling/milling-table-row.tsx` | 23 | `py-3 px-3 text-sm text-slate-500` |
| `raw-stocks/stock-table-row.tsx` | 21 | `py-2 px-1 text-xs text-slate-500` |
| `raw-stocks/misc/misc-stock-table-row.tsx` | 25 | `text-xs text-slate-400` |

새 스펙은 `TableCell`을 `h-11 px-3 py-0`로 바꾸는데 이 파일들의 `py-2 px-1 text-xs`가 **그대로 덮어쓴다.**
→ 「본문 행 44px」 달성 불가. **R4 대상을 7개 → 10개로 확장한다.**

추가로 `components/admin/BackupManager.tsx`(TableCell 11)는 시안 범위 밖이지만
프리미티브 파급을 받는다. 클래스는 손대지 않되 **회귀 확인 대상**에 포함한다.

### 2.6 부수 — 옛 파일 3개가 폴더에 남아 있다

`작업지시-목록-표준규격.md` · `목록-표준규격-시안.html` · `density-{a,b,c}-*.html` (전부 09-02자).
새 README는 `list-spec-instructions.md`·`list-spec.html`·`opt-*.html`을 가리키므로 **정본이 헷갈린다.**
착수 전에 옛 파일을 지우거나 `_deprecated/`로 옮긴다.

## 2.7 블로커 결정 (2026-09-03, 사용자·디자이너 확정)

네 건 모두 대조 결과가 맞다는 확인을 받았고, 지시서·README도 이 결정대로 개정됐다.

| # | 결정 |
| --- | --- |
| **A** R5 | **실작업**(「완료」 표기는 지시서 오류). `docs/handoff/디자인시스템/` **1벌만** 개정. `잡곡재고관리/`엔 `> 정본은 docs/handoff/디자인시스템/ 입니다.` 한 줄만 추가 — 2벌 동기화가 불일치의 재발원 |
| **B** `#00a2e8` | **체크리스트 축소**. `grep 0건` → 「`farmer-list.tsx` L371·L405에서 제거, 나머지 29건 의미색은 건드리지 않았는가」 |
| **C** 그룹 높이 | **44px 규칙 우선**. 잡곡이 정본인 것은 **묶음톤·단일건 낱개 패턴**이고 행 높이는 아니다. misc도 `h-12`→`h-11`, `/70`→`/80` — 벼와 동일 조치 |
| **D** R4 | **10파일 확장 채택**. `*-table-row.tsx` 3개 누락은 지시서 실수 |

🔴 **R5 잔여 문제**: 지시서는 개정본이 「이 패키지에 이미 적용된 상태로 들어 있다」고 하나,
`docs/handoff/list-standard/`에 `handoff/` 하위 폴더도 개정본도 **없다**(저장소 검색 0건).
→ 복사가 아니라 지시서의 before→after 목록을 보고 **직접 작성**한다. §4.2.3은 값이 명시돼 있다.

## 3. v1의 「색상 방향」 결정은 폐기 — 이제 쟁점이 아니다

v1은 시안의 `text-slate-500`(헤더)이 프로젝트의 토큰 방향(§22)과 어긋난다고 보고
토큰 치환(`text-muted-foreground`)을 결정했다. **v2에서 타이포가 뒤집히며 문제가 사라졌다.**

| v2 스펙 | 현행 `table.tsx` 기본값 | 관계 |
| --- | --- | --- |
| `text-slate-900` | `text-foreground` = `#0f172a` | **같은 값** |
| `font-medium` | `font-medium` | 동일 |
| `h-10` | `h-10` | 동일 |
| `text-sm`(14px) | `Table`의 `text-sm` 상속 | 동일 |
| `px-3` | `px-2` | **여기만 다름** |

→ **R1의 `TableHead` 변경은 실질적으로 `px-2` → `px-3` 하나뿐이다.**
`text-slate-900`을 그대로 쓸지 `text-foreground`를 유지할지는 렌더 결과가 같으므로,
**기존 토큰(`text-foreground`)을 유지**한다(§22 방향 보존, 값 동일).
`TableCell`·`TableRow`는 실변경이 있다(`p-2` → `px-3 py-0 h-11`, 구분선·호버).

## 4. 변경 범위

### R1 — 공통 프리미티브 (1파일)

`components/ui/table.tsx`

```
TableHead: h-10 px-3 text-left align-middle font-medium text-foreground whitespace-nowrap   (변경: px-2→px-3)
TableCell: h-11 px-3 py-0 align-middle whitespace-nowrap text-slate-700                      (변경: p-2 → 전면)
TableRow:  border-b border-slate-100 hover:bg-slate-50 transition-colors
```

- `Table`의 `text-sm` 유지 → 헤더·본문 14px 상속
- 헤더 행: `bg-slate-50 border-b border-slate-200 hover:bg-transparent`
- 체크박스·아이콘 전용 컬럼만 `px-1` 예외
- 2줄 셀 행은 `h-11` 대신 `min-h-11 py-2`

### R1b — 컬럼 폭 `colgroup` % 이전

각 목록의 `<TableHead className="w-[..px]">`를 걷어내고 `<colgroup>`에 %로 옮긴다.
합 100%, 로트 컬럼 **≥24%**.
🔴 `w-[..]` 제거는 R4의 「정렬·폭 보존」 원칙과 충돌하므로 **R1b에서만 의도적으로 제거**한다.

### R2 — 셀 클래스 규약 (문서 기준, 코드 변경 없음)

### R3 — 펼침 그룹 통일 (3파일) — **블로커 C 결정 후 착수**

| 파일 | 조치 |
| --- | --- |
| `admin/farmers/farmer-list.tsx` L371·L405 | `#00a2e8` 계열 → slate 묶음톤. 접힘 `bg-white` → `bg-slate-50` |
| `raw-stocks/stock-list-client.tsx` L234 | `h-12`·`shadow-sm` 제거, 서브행 묶음톤 추가 |
| `raw-stocks/misc/misc-stock-list-client.tsx` L211 | `/60` → `/75` (+ **`h-12` 처리는 블로커 C 결정에 따름**) |

- 단일 건 그룹은 잡곡 `isMulti` 패턴을 따른다 (그룹 헤더 미렌더)
- `farmer-list`의 `isMultiFarmer` 분기도 동일 정리
- L395 안내 문구는 **세 화면 모두 넣거나 모두 빼거나** — 한쪽만 남기지 않는다

### R4 — 화면별 클래스 제거 (**10파일**, v2 지시서의 7 + 누락 3)

7개는 지시서 표 그대로. 추가 3개는 2.5절의 `*-table-row.tsx`.
**보존 필수**: `text-left/center/right`, `hidden sm:table-cell` 등 반응형 표시 제어.
(단 `w-[..]`는 R1b에서 colgroup으로 이전되므로 예외)

### R4b — 생 `<th>` → `ui/table` 교체 (4파일)

`log-list.tsx`(7, `border-l` 10건 제거) · `product-type-page-client.tsx`(14) ·
`stock-tables.tsx`(24) · `MillingTable.tsx`(2)

### R5 — 문서 개정 — **블로커 A 결정 후 착수**

지시서는 「완료」라고 하나 **실제로는 미개정**이다. 대상 파일 선택 필요:
`docs/handoff/디자인시스템/handoff.md` / `docs/handoff/잡곡재고관리/handoff.md` (2벌 존재).
`design-system.html`도 같은 폴더에 2벌 있다.

## 5. 진행 순서

0. **블로커 A·B·C 사용자 결정** ← 지금 여기
1. 옛 핸드오프 파일 정리 (2.6)
2. **R1 + R1b** → farmer-list 1곳만 눈으로 확인 (프리미티브라 여기서 틀리면 전부 틀린다)
3. **R4 + R4b** (헤더·본문 짝으로)
4. **R3** 펼침 그룹
5. **R5** 문서
6. 검수 체크리스트 → 커밋

## 6. 범위 밖

- 컬럼 **정렬** 규칙 정리 (기준선만 시안 2절에 기록)
- **모바일 카드** — `mobile-package-card.tsx`, `misc-stock-table-row.tsx` 카드 모드,
  `farmer-list.tsx` 모바일 그룹, `stock-list-client.tsx` 모바일 카드
- 앱 전체 slate → 토큰 전환 (1,953건, 별도 과제)
- **`#00a2e8` 의미색 29건** (블로커 B — 별도 결정 없으면 범위 밖)

## 7. 검수 체크리스트

- [ ] 헤더 40px / 본문·그룹 헤더 44px
- [ ] 헤더 14px · `font-medium` · slate-900 톤 (연한 회색 bold 잔존 없음)
- [ ] 헤더 배경 `bg-slate-50`, 호버 무반응
- [ ] 펼친 그룹 헤더와 서브행이 같은 톤
- [ ] 접힌 그룹 헤더가 흰 배경이 아님
- [ ] 하위 1건 그룹에 토글 없음
- [ ] 로트번호 미절단 (컬럼 ≥24%)
- [x] 짝수행 음영 — 사전 확인 완료 (전 코드베이스 0건)
- [ ] **정렬이 기존과 동일** (바뀌면 회귀)
- [ ] 감사 로그 세로 구분선 제거
- [ ] `BackupManager.tsx`(범위 밖) 목록 미파손
- [ ] `misc-stock-table-row.tsx` 카드 모드 그대로
- [ ] `tsc` · `eslint` 통과 (dev 검증에 `next build` 금지)
- [ ] ~~`grep -r "00a2e8"` 0건~~ → **블로커 B 결정에 따라 「그룹 표현 2건 제거」로 축소 제안**

## 8. 리스크

| 리스크 | 대응 |
| --- | --- |
| 프리미티브 변경이 범위 밖 화면에 파급 | 전수 grep 완료 — `BackupManager.tsx` 1건, 회귀 확인만 |
| 헤더/본문이 다른 파일이라 반쪽 적용 | R4를 10파일로 확장, 헤더-row 짝 단위 커밋 |
| `w-[..]` 제거가 정렬 보존 원칙과 충돌 | R1b에서만 의도적으로 제거, 그 외 단계에선 보존 |
| `misc-stock-table-row.tsx` 카드 모드 훼손 | 테이블 분기만 수정 |
| 옛 시안 파일과 혼동 | 착수 전 정리(2.6) |
