# 계획서 — 목록 표준규격 §32 적용 (표준이 안 닿은 목록 5곳)

- 작성일: 2026-09-08
- 근거: 백로그 `docs/리팩토링-백로그.md` §32
- 기준서: `docs/handoff/디자인시스템/handoff.md` §4.2 (표준값 요약표)
- 선행 작업: §30 제품재고 표준적용(`9f84483`) · R1~R6 · 구분선 원칙 개정(`aa449be`)

---

## 1. 목표

「목록인데 목록으로 세어지지 않은」 화면의 **헤더**를 목록 표준규격에 올린다.
§30(제품재고 grid)에 이은 네 번째 누락 처리이며, 이번에는 백로그의 지적대로
**「목록처럼 보이는 것」 전수**로 범위를 잡았다.

### 표준값 (기준서 §4.2 요약표 — 이번 작업의 정본)

| 항목 | 값 |
| --- | --- |
| 헤더 | `h-10`(40px) · `px-3` · `text-sm`(14px) · `font-medium` · `text-foreground` |
| 헤더 배경 | `bg-slate-50` + `border-b border-slate-200` · 호버 무반응 |
| 본문 셀 | `h-11`(44px) · `px-3 py-0` · `text-sm` · `text-slate-700` |
| 본문 행 | `border-b border-slate-100` + 호버 `bg-slate-50` · 짝수행 음영 없음 |

`uppercase tracking-wider`는 **영문 라벨 전용 토큰**이다. 한글에 `uppercase`는 아무 효과가
없고 `tracking-wider`만 자간을 벌린 채 글자는 10.5~12px로 작아진다 → 오용 = 버그.

---

## 2. 전수 조사 결과

`grep -rn "uppercase tracking-wider"` + 생 `<th>` + `grid-cols-[...]` 헤더 + `divide-y` + `hidden md:flex` 조합으로 훑었다.

### 이번 범위 — 목록 5곳

| # | 위치 | 형태 | 현행 헤더 | 왜 빠졌나 |
| --- | --- | --- | --- | --- |
| 1 | `components/admin/NoticeTable.tsx:129` | 생 `<table>/<th>` | `text-xs font-semibold uppercase tracking-wider` + 세로선 `border-l` | R4b가 생 `<th>` 4파일만 지목 |
| 2 | `components/admin/UserTable.tsx:143` | 생 `<table>/<th>` | 같은 클래스 | 위와 같음 |
| 3 | `app/(dashboard)/_components/recent-logs-list.tsx:49` | div 목록 | `text-[11px] font-bold uppercase tracking-wider` | table도 생 th도 아니라 어느 범위에도 안 걸림 |
| 4 | `app/(dashboard)/sales/upload-dialog.tsx:231` | `sm:grid` 목록 | `text-[11px] font-bold text-slate-400` | **§32에도 없던 누락** — `uppercase`가 없어 grep에 안 걸렸다 |
| 5 | `app/(dashboard)/packages/deduct-dialog.tsx:294` | `sm:grid` 목록 | `text-[10.5px] font-bold uppercase tracking-wider` | **§32가 「섹션 라벨 13곳」으로 오분류** — 실제론 목록 헤더 |

> 4·5번은 §32 작성 시점에 놓친 것으로, 이번 전수 조사에서 새로 나왔다.
> R3이 이미 `milling/stock-list-dialog.tsx`(다이얼로그)를 범위에 넣었으므로
> 「다이얼로그 안이라 범위 밖」은 성립하지 않는다.

### 범위 밖 — 확인했으나 손대지 않는 것

| 위치 | 판단 |
| --- | --- |
| `milling/add-packaging-dialog.tsx:650` | 「컬럼 헤더 **힌트**」(9px). 입력 폼의 보조 라벨이지 목록 헤더가 아니다. 다만 9px는 과소 — §33으로 기록 |
| 섹션 라벨 13곳 (`deduct-dialog` 5 · `repack-dialog:489` · `realtime-status` 3 · `UserPermissionDialog` 2 · `release-history-list:213`) | §32 권장조치대로 **별건**. 규격이 다르고(소제목 vs 40px 헤더) 한 커밋에 섞이면 리뷰가 어렵다 |
| 각 파일의 모바일 카드 뷰 | 목록 표준규격은 데스크탑 범위(작업지시서 「범위 밖」 항목) |

---

## 3. 결정 사항 (2026-09-08 협의)

| 결정 | 내용 | 이유 |
| --- | --- | --- |
| D1 | **recent-logs-list는 헤더 토큰만** 수정. 행 밀도(`py-2.5` / `text-[13px]`)는 현행 유지 | 대시보드 카드 하나에 10건을 담는 위젯이다. 44px 행이면 카드가 세로로 커져 위젯의 목적이 깨진다 |
| D2 | **신규 2곳(4·5) 포함** | 백로그가 「전수로 잡아라」고 못 박았다. 지금 빼면 다섯 번째 누락이 된다 |
| D3 | **섹션 라벨 13곳은 별건 미룸** | §32 권장조치 그대로. 백로그 §33으로 승격 |
| D4 | **4·5번도 헤더만.** 행은 손대지 않는다 | 두 화면 모두 체크박스·select·date·number **입력 컨트롤이 들어간 편집형 행**이다. 44px/14px로 올리면 컨트롤 크기까지 연쇄되고, 다이얼로그 스크롤 영역에 보이는 행 수가 줄어든다. §32 권장조치도 헤더만 특정했다 |
| D5 | **1·2번은 `ui/table` 프리미티브로 교체** | R3이 생 `<th>`에 대해 이미 정한 방식. 프리미티브가 이미 표준값을 갖고 있어(`TableHead: h-10 px-3 text-foreground font-medium`) 개별 클래스를 걷어내는 것만으로 표준이 된다 |

---

## 4. 변경 파일 및 작업 내용

### 4-1. `components/admin/NoticeTable.tsx` (공지 관리)

- 데스크탑 뷰(`hidden lg:block`)의 생 `<table>/<thead>/<tr>/<th>/<tbody>/<td>` →
  `Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`로 교체
- 헤더 행: `<TableRow className="bg-slate-50 border-b border-slate-200 hover:bg-slate-50">`
  - `text-xs font-semibold text-slate-500 uppercase tracking-wider` **삭제** (프리미티브가 대신함)
- **세로 구분선 `border-l border-slate-100` 전부 제거** — R3에서 감사 로그에 적용한 것과 같은 원칙
- `<th>`에 남기는 것: 정렬(`text-center`/`text-left`)과 폭(`w-20` 등)뿐
- `<td>`의 `px-4/px-5 py-3.5` 제거 → 프리미티브 `px-3 h-11`. 2줄 셀(제목+내용)은 높이 예외로 자연 증가
- `<tbody className="divide-y divide-slate-100">` → `TableBody` (행 구분은 `TableRow`의 `border-b`가 담당)
- 행 호버 `hover:bg-slate-50/50` → 프리미티브 `hover:bg-slate-50`
- ⚠️ 모바일 카드 뷰는 **건드리지 않는다**

### 4-2. `components/admin/UserTable.tsx` (사용자 관리)

- 4-1과 동일한 교체. 세로선은 원래 없다
- `<td>` 안의 개별 `text-sm text-slate-600`은 프리미티브와 같은 값이므로 제거,
  의도적으로 다른 값(`text-xs text-slate-400` 가입일 = 보조값)은 유지
- ⚠️ 모바일 카드 뷰 건드리지 않음

### 4-3. `app/(dashboard)/_components/recent-logs-list.tsx` (대시보드 최근 작업)

- 49행 헤더만:
  - `text-[11px] font-bold text-slate-500 ... uppercase tracking-wider`
  - → `h-10 px-3 text-sm font-medium text-foreground bg-slate-50 border-b border-slate-200`
  - `rounded-lg`·`bg-slate-50/80`·`py-2.5`는 표준 헤더 형태로 정리
- **본문 행은 무변경** (D1)

### 4-4. `app/(dashboard)/sales/upload-dialog.tsx` (발주서 업로드 시트 선택)

- 231행 헤더만:
  - `text-[11px] font-bold text-slate-400 py-2` → `h-10 items-center text-sm font-medium text-foreground`
  - `bg-slate-50 border-b border-slate-200` sticky는 유지 (이미 표준과 같음)
  - `px-2` → `px-3`? → **`px-2` 유지**: 그리드 첫 칸이 34px 체크박스 컬럼이라
    행(`px-2`)과 어긋나면 컬럼이 밀린다. 체크박스 컬럼 예외(작업지시 R1)
- `sheet-row.tsx` **무변경** (D4)

### 4-5. `app/(dashboard)/packages/deduct-dialog.tsx` (제품재고 차감)

- 294행 헤더만:
  - `text-[10.5px] font-bold uppercase tracking-wider text-slate-400`
  - → `text-sm font-medium text-foreground`
  - `bg-white` → **`bg-slate-50`** (표준 헤더 배경. `bg-white` 하드코딩 제거 = §22 방향)
  - `pb-1.5 pt-1` → `h-10 items-center`
  - `border-b border-slate-200` 유지, sticky 유지
- 본문 행 무변경 (D4)

---

## 5. 단계별 진행

1. **S1** — `NoticeTable.tsx` · `UserTable.tsx` `ui/table` 교체 (2파일, 커밋 1)
2. **S2** — 헤더 토큰 3곳: `recent-logs-list` · `upload-dialog` · `deduct-dialog` (3파일, 커밋 1)
3. **S3** — 검증: `tsc --noEmit` + `eslint`. 화면 확인은 사용자 브라우저
4. **S4** — 문서: 백로그 §32 해결 표시 + §33 신설(섹션 라벨 13곳 + add-packaging 9px 힌트) ·
   기준서 §4.2에 「전수 범위 잡는 법」 한 줄 · 결과보고서 · worklog

> S1/S2를 나누는 이유: S1은 마크업 구조 교체(회귀 위험 있음), S2는 클래스 한 줄 치환이다.
> 문제가 생겼을 때 되돌릴 단위를 분리해 둔다.

---

## 6. 검수 체크리스트

- [ ] 5곳 헤더가 전부 40px · 14px · `font-medium` · `text-foreground` · `bg-slate-50`
- [ ] `grep -rn "uppercase tracking-wider" app/ components/` 결과에서 **목록 헤더가 사라졌는가**
      (남는 것은 섹션 라벨 13곳뿐 = §33 범위)
- [ ] 공지 관리 테이블의 세로 구분선이 제거됐는가
- [ ] 공지/사용자 목록의 **정렬이 기존과 동일한가** (표준 작업에서 정렬은 안 바꾼다)
- [ ] 공지 제목 2줄 셀이 잘리지 않는가
- [ ] recent-logs-list의 **행 밀도가 그대로인가** (D1 — 바뀌면 회귀)
- [ ] upload-dialog 헤더와 SheetRow의 **컬럼이 어긋나지 않는가** (grid 정의가 같아야 함)
- [ ] deduct-dialog sticky 헤더가 스크롤 시 여전히 고정되는가
- [ ] `npx tsc --noEmit` 통과 · `npx next lint` 신규 경고 없음

---

## 7. 위험 요소

| 위험 | 대응 |
| --- | --- |
| `ui/table` 교체 시 `<td>` 안의 커스텀 레이아웃(아바타·스위치·2줄 셀)이 깨질 수 있다 | `TableCell`의 `whitespace-nowrap`이 기본이므로 2줄 셀에는 `whitespace-normal` 명시. 셀 내부 `<div>` 구조는 그대로 옮긴다 |
| `TableCell h-11`이 2줄 콘텐츠를 자를 수 있다 | `h-11`은 최소 높이로 동작(td). 콘텐츠가 크면 자연 증가 — R3에서도 「2줄 셀 예외」로 인정 |
| upload-dialog 헤더 패딩을 px-3으로 바꾸면 컬럼이 밀린다 | 4-4에 명시한 대로 `px-2` 유지 |
| deduct-dialog는 2026-09-03 모바일 라운드를 막 끝낸 화면 | 데스크탑 전용 헤더(`hidden ... sm:grid`)만 건드린다. 모바일 경로 무영향 |

---

## 8. 범위 밖 (하지 않는 것)

- 섹션 라벨 13곳의 `uppercase` 제거 → §33
- 모바일 카드 뷰 일체
- 각 목록의 **컬럼 정렬 변경** (표준 작업 불변 원칙)
- 기능·데이터·서버 액션 무변경 — **순수 스타일/마크업 작업**
