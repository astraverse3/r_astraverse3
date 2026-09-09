# 차감 이력 다이얼로그 재구성 — 구현 지시서

- **시안**: `card-layouts/차감이력-다이얼로그-재구성.html` (A 모바일 1건 · B 모바일 다건 · C 데스크탑 600px)
- **대상 파일**: `app/(dashboard)/packages/movement-history-dialog.tsx` **1개** — 다른 파일 변경 없음
- **작성**: 디자인 · 2026-09-08

---

## 0. 왜 고치는가

현재 화면의 문제는 두 가지고, 둘 다 **구조** 문제다.

1. **헤더 한 줄에 4가지를 넣었다.** `DialogDescription` 하나에 품종·규격·로트칩·「N개 중 M개 차감」이 모두 들어가고 `truncate`가 걸려 있다. 실화면에서 <code>670개 중 670…</code>로 **가장 중요한 숫자가 잘렸다.** 모바일 342px에서는 로트칩만으로도 폭이 소진된다.
2. **이력이 1건일 때 본문이 비고 푸터가 화면을 지배한다.** 모바일 닫기 버튼이 `h-11 w-full`이라 다이얼로그 높이의 약 1/4을 먹는다.

정보를 줄이지 않고 **층을 나눠** 해결한다: 식별(무엇의 이력인가) → 수량 요약 → 이력 행.

---

## 1. 헤더 — 한 줄을 3층으로

`DialogDescription` 한 줄을 **① 품종·규격 / ② 로트 / ③ 숫자 strip** 3층으로 나눈다. 각 층이 자기 폭을 가지므로 `truncate`로 잘릴 것이 없어진다.

### 1-1. 로트: 칩 → 모노스페이스 한 줄

로트칩(`rounded border bg-slate-100 px-1.5 font-mono text-[10px]`)과 `shortLot()` 축약을 **모바일에서 제거**하고, 아래 줄에 **전체 로트를 모노스페이스로 표시**한다.

```tsx
<div className="min-w-0 flex-1">
  <DialogTitle className="text-[15px] font-bold leading-tight text-slate-900">차감 이력</DialogTitle>
  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-slate-600">
    <span className="font-semibold text-slate-800">{row.variety}</span>
    <span className="text-slate-300">·</span>
    <span>{row.spec}</span>
  </div>
  {row.lot && (
    <div className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">{row.lot}</div>
  )}
</div>
```

- `shortLot`은 **좁은 표 셀용 축약**이다. 다이얼로그는 이 행을 확인하러 들어온 화면이므로 전체 로트가 맞다. `title` 속성으로만 전체를 보여주는 건 모바일에서 접근 불가다.
- 로트를 별 줄로 내렸으니 `DialogDescription`의 `truncate`는 **제거**한다.
- 10px → **11px**. 모노스페이스 숫자 10px은 모바일에서 판독 한계다.
- 데스크탑(C안)은 폭이 남으므로 `· {row.lot}`를 품종·규격과 같은 줄에 둔다 — `sm:` 분기 대신 `flex-wrap`으로 자연히 접히게 해도 된다.

### 1-2. 숫자 strip — 3칸 (신규)

「N개 중 M개 차감」 문장을 **입고 / 차감 / 잔여 3칸 strip**으로 대체한다.

```tsx
const remain = (row?.qty ?? 0) - deductedCount

<div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:mt-0 sm:flex sm:shrink-0 sm:text-center">
  <div className="px-2.5 py-2 sm:px-3 sm:py-1.5">
    <div className="text-[10.5px] font-medium text-slate-500">입고</div>
    <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-slate-700 sm:mt-0 sm:text-[13.5px]">
      {row.qty.toLocaleString()}<span className="ml-px text-[11px] font-medium text-slate-400 sm:hidden">개</span>
    </div>
  </div>
  {/* 차감: font-bold text-slate-900 */}
  {/* 잔여: remain === 0 ? 'text-[#b45309]' : 'text-slate-700' */}
</div>
```

- **잔여는 지금 화면에 아예 없다.** 사용자가 `qty − deducted`를 머리로 계산하고 있었다. 「되돌릴까?」의 판단 근거가 바로 이 값이다.
- **잔여 0은 앰버(`#b45309`)**. 「다 빠졌다」를 색으로 알린다. 빨강은 오류를 뜻하므로 쓰지 않는다 — 정상 상태다.
- 차감만 `font-bold text-slate-900`(대표값 규약). 입고·잔여는 `text-slate-700`.
- 모바일은 3칸 grid가 헤더 아래 전폭, 데스크탑은 헤더 우측에 inline. **`sm:` 하나로 갈린다.**
- `deductedCount`의 기존 계산(로드 전 스냅샷 / 로드 후 `items` 합)은 **그대로 유지**한다. 되돌리기 직후 strip 3칸이 동시에 갱신되는 것이 이 구조의 이득이다.

### 1-3. 닫기 ✕

`[&>button]:text-slate-400`만 걸려 있어 히트영역이 작다. **8×8(32px) + `hover:bg-slate-100`**으로 키운다. 푸터 전폭 버튼을 줄이는 만큼 여기가 주 닫기 수단이 된다.

---

## 2. 이력 행 — 날짜를 맨 앞으로

현재 순서는 `유형칩 · 수량 · 날짜`다. **이력은 시간축으로 읽으므로 날짜가 첫 컬럼**이어야 한다.

```
[09-06]  [판매]  120개   한마음마트 | 작업자 김종수        [되돌리기]
```

### 모바일

```tsx
<div className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-slate-500">{mv.occurredAt}</span>
      <span className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-px text-[11px] text-slate-500">{MOVEMENT_TYPE_LABEL[mv.type]}</span>
      <b className="text-[13.5px] font-bold tabular-nums text-slate-900">{mv.count.toLocaleString()}개</b>
    </div>
    {/* 메타 — mt-1 */}
  </div>
  {/* 되돌리기 또는 자물쇠 */}
</div>
```

- 행 여백 `py-3` → **`py-2.5`**, 메타 `mt-1.5` → **`mt-1`**. 행 높이 약 62px → **52px**.
- 경계선을 `border-t first:border-t-0` → **`border-b last:border-b-0`**으로 바꾼다. 마지막 행 선과 푸터 상단선이 겹치던 문제가 사라진다.
- 본문 컨테이너 `py-1.5` → **`py-1`**.
- 날짜는 `text-[12px]` 유지, 수량은 13px → **13.5px**(행의 대표값).
- 메타 줄(`거래처 · 비고 | 작업자`)은 **현행 그대로**. 「작업자」 라벨 항상 붙이기 규칙도 유지.

### 데스크탑 — 고정폭 컬럼

600px에서는 행들이 세로로 정렬되어야 스캔이 된다. 날짜·유형·수량을 **고정폭**으로 잡고 비고만 신축한다.

| 컬럼 | 폭 | 정렬 |
| --- | --- | --- |
| 날짜 | `w-[42px]` | 좌 |
| 유형칩 | `w-[52px]` | 중앙 (`text-center`) |
| 수량 | `w-[62px]` | **우** (`text-right`) |
| 비고 | `flex-1 min-w-0 truncate` | 좌 |
| 액션 | `shrink-0` | 우 |

`gap-4`. 수량 우측정렬은 자리수가 다른 값(42개 / 1,692개)의 끝을 맞추기 위한 것이므로 **반드시 지킨다.**

---

## 3. 되돌리기 막힌 건 — 박스 제거

현행은 `rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5` 박스 + `Lock` 아이콘이다. **박스가 행 본체보다 시각적으로 무거워 시선을 뺏는다.** 되돌릴 수 없다는 건 부수 정보인데 가장 큰 요소가 됐다.

바꾸는 방식: **되돌리기 버튼 자리에 자물쇠 아이콘 버튼**(`h-8 w-8 rounded-md bg-slate-100 text-slate-400`, `title`에 사유) + **아래 한 줄 문구**(`text-[11px] text-slate-500`, 박스 없음).

```tsx
{mv.cancellable && canCancel ? (
  <Button …>되돌리기</Button>
) : !mv.cancellable ? (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400"
        title={mv.fromRepack ? REPACK_CANCEL_BLOCKED : ORDER_CANCEL_BLOCKED}>
    <Lock className="h-3.5 w-3.5" />
  </span>
) : null}
```

- 이득: **행 높이가 일정해진다.** 되돌리기 가능/불가가 같은 자리에서 아이콘만 다르다.
- 문구는 사유의 핵심 명사(`발주서 상세`, 재포장 사유의 해당 화면명)만 `font-semibold text-slate-600`으로 올린다.
- 데스크탑은 문구를 **비고 컬럼 시작점(`pl-[204px]` = 42+16+52+16+62+16)** 에 맞춘다. 어중간한 들여쓰기는 컬럼 정렬을 깬다.
- 🔴 `cancellable`만 보고 판정하는 기존 규칙은 **불변**. `fromRepack`/`fromOrder`는 문구 선택용.

---

## 4. 푸터

```tsx
<div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-5">
  <Button variant="outline" size="sm" className="h-9 bg-white px-5 sm:h-8 sm:px-4" onClick={() => onOpenChange(false)}>닫기</Button>
</div>
```

`h-11 w-full sm:h-8 sm:w-auto` → **`h-9 px-5`(모바일도 우측 정렬)**.

- 근거: 이 다이얼로그는 **읽기 전용**이고 닫는 경로가 이미 셋(✕, 스크림 탭, 안드로이드 백)이다. 전폭 버튼은 「제출」의 어포던스인데 여기엔 제출이 없다.
- 44px 히트타겟 규칙은 **주 동작에 적용**한다. 여기의 주 동작은 되돌리기(`h-8`이지만 폭이 있어 면적 확보)이고, 닫기는 보조다. `h-9`(36px) + `px-5`로 면적을 준다.
- 세로 여백도 `py-3` → `py-2.5`.

---

## 5. 유지 — 건드리지 않을 것

- `cancellable`만 보는 되돌리기 노출 규칙, 서버 재검증
- `MOVEMENT_TYPE_LABEL` 칩 — 라벨은 **판매·증정·분실·파손·기타 + 재포장** 6종뿐이다. **「발주서」라는 라벨은 없다**(시안 초판의 오류, 수정됨). 발주서에서 유래한 건도 칩은 `판매`이고 되돌리기 불가는 **자물쇠로만** 구분된다. 「작업자」 라벨 항상 붙이기
- `deductedCount` 재계산(스냅샷 → `items` 합), 마지막 항목 되돌리면 자동 닫기
- 로딩 / 에러 / 「차감 이력이 없어요」 3상태 — 문구·`text-[12.5px]` 그대로
- `confirmDialog` 문구, 토스트, `triggerDataUpdate()` + `router.refresh()`
- `DialogContent`의 `flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]` — 🔴 `flex flex-col`은 필수다. 기본 `grid`로 둔 다이얼로그는 **푸터가 잘린다**
- **되돌리기는 1건씩**(백로그 §24). 이 시안은 묶음 되돌리기를 전제하지 않는다 — 필요해지면 기능 추가로 별건
- **배경을 지정하지 않는다.** `DialogContent`는 `bg-card`가 자동이라 `bg-white`를 박으면 안 된다. 시안 HTML의 `bg-white`·`#fff`는 정적 파일이라 넣은 값이니 그대로 옮기지 말 것 — 칩·되돌리기 버튼은 **`bg-background`**로, 푸터·strip의 `bg-slate-50`은 유지(카드 위 한 단 톤으로 의도한 값)

---

## 6. 체크리스트

- [ ] 헤더 3층 분리 · `DialogDescription` `truncate` 제거
- [ ] 로트 전체 표시(모노 11px) · 모바일 로트칩·`shortLot` 제거
- [ ] 숫자 strip 3칸 · 잔여 신규 계산 · 잔여 0 앰버 `#b45309`
- [ ] ✕ 히트영역 32px
- [ ] 행: 날짜 첫 컬럼 · `py-2.5` · 메타 `mt-1` · `border-b last:border-b-0`
- [ ] 데스크탑 고정폭 컬럼(42/52/62) · 수량 우측정렬
- [ ] 막힌 건 박스 제거 → 자물쇠 버튼 + 한 줄 문구 · 데스크탑 `pl-[204px]`
- [ ] 푸터 `h-9` 우측 정렬
- [ ] **회귀**: 사유 배지 6종 폭(가장 긴 「재포장」이 `w-[52px]`에 들어가는지) / 이력 1건 / 5건 이상 스크롤 / 되돌리기 후 strip 3칸 동시 갱신 / 막힌 건만 있는 행 / `canCancel=false`(권한 없음) / 벼 탭 진입 / 로트 없는 행
