# 계획서 — 품종 관리 행 메뉴 + 곡종 필터 칩

- 대상: `/admin/varieties`
- 근거 핸드오프: 「품종 관리 — 행 메뉴 + 곡종 필터 칩」 (B안 채택, 탭 C안 기각)
- 작성: 2026-09-16 / 현 HEAD `e856bef`

---

## 0. 🔴 구현 전 전수 대조 결과 — 핸드오프가 낡았다

메모리 규칙(「구현 전 현재 코드와 전수 대조」, 5회 실패 이력)에 따라 먼저 대조했다.
**핸드오프를 그대로 따르면 안 되는 지점이 9개** 나왔다.

| # | 핸드오프 기술 | 실제 코드 | 처리 |
|---|---|---|---|
| A | 대상 파일 6개 | `use-bulk-delete-varieties.tsx`(93줄)가 표에 **없다** — 선택 상태·일괄삭제 AlertDialog가 전부 이 파일에 있다 | **파일 삭제** 대상 추가 |
| B | 「삭제는 `DeleteVarietyButton`의 `handleDelete`를 그대로 쓴다」 | 🔴 그 버튼은 **죽은 코드**다. `variety-list-client.tsx:7`에서 import만 되고 JSX 사용 0건. 6/4 이후 미수정이라 **별칭 동반 소멸 경고가 없다** | 지시 **불채택** — 아래 §2.3 |
| C | `GRAIN_LABEL` 을 새로 정의 | 🔴 `lib/variety-labels.ts`에 `VARIETY_TYPE_LABELS`/`getVarietyTypeLabel`이 **이미 있다**(BLACK 포함 7종 완비). 그런데 이 화면은 안 쓰고 삼항 체인을 **2곳**에 중복 중 | 신규 정의 금지, 기존 lib 사용 |
| D | 「기존 `typeOrder`에 BLACK 누락 버그」(단수) | 버그는 사실. 단 `typeOrder`는 **2곳 중복**(`:193` 모바일, `:252` 데스크탑). 칩까지 만들면 3번째가 생긴다 | lib로 **단일 원천화** |
| E | §2.4 좌측 인라인 검색 입력(34px·230px·`Search`) | 🔴 앱 표준은 **우상단 검색 버튼(`SlidersHorizontal`·blue-50) → 필터 다이얼로그**(기준서 §3.4·§4.6) | **결정 필요 ①** |
| F | 빈 상태 `조건에 맞는 품종이 없습니다.` | 기준서 문구 표준은 **해요체** `조건에 맞는 결과가 없어요. 필터를 바꿔보세요.` (현재 코드 `등록된 품종이 없습니다.`도 이미 표준 위반) | **결정 필요 ②** |
| G | §2.2 «열 너비 `w-[52px]`» ↔ §4 «`w-[8%]`» | 핸드오프 **내부 모순**. `table-fixed`+`colgroup` 구조라 px는 안 먹는다 | `%` 채택 |
| G2 | 파일표 «`variety-dialog.tsx` 변경 없음» ↔ §2.3 «`asMenuItem` prop 추가» | 내부 모순 | **변경 있음**으로 확정 |
| H | ⋯ 트리거를 생짜 `<button class="h-7 w-7 …">`로 제시 | 이 앱엔 행 ⋯ 메뉴가 **이미 7곳**. 최신 정본은 `sales/upload-row-menu.tsx`(`Button variant="ghost" size="icon" w-8 h-8 text-slate-400` + `sr-only`) | **기존 패턴 채택** |
| I | 「품종 36건」 | 메모리 기준 **41종**. 계산값이라 구현 영향은 없고, 「디바운스 불필요」 판단도 그대로 유효 | 기록만 |

추가로 시안 HTML `card-layouts/품종관리-행메뉴-곡종탐색-3안.html`은 **저장소에 없다.**
스타일 세부는 문서에 적힌 값 + 앱 기존 패턴으로만 판단했다.

### 🔴 B가 가장 큰 것 — 그대로 하면 `883cd43`을 되돌린다

현재 **단건 삭제는 이미 존재한다.** 위치가 다를 뿐이다 — `variety-dialog.tsx:268~279`, 수정 다이얼로그 푸터의 빨간 「삭제」 버튼.
그리고 그 `handleDelete`(`:115~137`)에는 최근에 넣은 **별칭 동반 소멸 경고**가 붙어 있다:

> 별칭 N개(…)도 함께 사라져, 그 이름으로 오던 발주서 품목이 매칭실패로 돌아갑니다.

핸드오프가 쓰라는 `delete-button.tsx`의 확인 문구는 `정말 이 품종을 삭제하시겠습니까?` 한 줄뿐이다.
지시대로 그 파일을 되살려 ⋯ 메뉴에 붙이면 **경고가 조용히 사라진다.**

---

## 1. 목표

1. 왼쪽 체크박스 열 · 상단 일괄삭제 버튼 · 모바일 선택 FAB 제거 → **행 끝 ⋯ 메뉴(수정·삭제)**
2. 곡종 **필터 칩**(기본값 = 전체) 추가
3. 품종명·별칭 **검색**
4. 곁다리로 드러난 것 정리 — 곡종 라벨/정렬 단일 원천화, `BLACK` 정렬 누락 버그

---

## 2. 변경 범위

| 파일 | 변경 |
|---|---|
| `lib/variety-labels.ts` | `VARIETY_TYPE_ORDER` + `sortByVarietyType` 추가 (BLACK 포함) |
| `app/(dashboard)/admin/varieties/variety-list-client.tsx` | 주 작업 — 체크박스 제거, ⋯ 메뉴, 칩, 검색, 라벨/정렬 lib 위임 |
| `app/(dashboard)/admin/varieties/variety-row-menu.tsx` | **신규** — ⋯ 메뉴(수정·삭제) |
| `app/(dashboard)/admin/varieties/variety-dialog.tsx` | 외부 제어용 props 추가 + 삭제 확인 로직 추출 |
| `app/(dashboard)/admin/varieties/delete-variety.ts` | **신규** — `confirmAndDeleteVariety()` 공용 (별칭 경고 포함) |
| `app/(dashboard)/admin/varieties/variety-page-client.tsx` | 일괄삭제 버튼 · 선택 카운트 · FAB 제거 |
| `app/(dashboard)/admin/varieties/variety-page-wrapper.tsx` | 선택 상태 제거 → 사실상 껍데기 |
| `app/(dashboard)/admin/varieties/use-bulk-delete-varieties.tsx` | **파일 삭제** |
| `app/(dashboard)/admin/varieties/delete-button.tsx` | **파일 삭제** (죽은 코드) |
| `app/(dashboard)/admin/varieties/alias-editor.tsx` | 변경 없음 (확인 완료) |
| `app/(dashboard)/admin/varieties/page.tsx` | 변경 없음 |

**서버 액션·쿼리·권한 규칙은 그대로.** 권한 키는 현행 `SUPPLY_MANAGE` 유지(결정 V′).
단 `deleteVarieties`(일괄 액션, `app/actions/admin.ts:221`)는 **호출부가 사라져 고아가 된다** → **결정 필요 ③**

---

## 3. 단계별 접근

### 3.1 단계 1 — 곡종 단일 원천 (선행)

`lib/variety-labels.ts`에 정렬 순서를 얹는다. 라벨 맵은 이미 있으므로 **추가만** 한다.

```ts
export const VARIETY_TYPE_ORDER: Record<string, number> = {
    URUCHI: 1, GLUTINOUS: 2, INDICA: 3, BLACK: 4, MISC_GRAIN: 5, OTHER: 6, PURCHASED: 7,
}
```

- 🔴 `BLACK: 4` — 현재 두 `typeOrder` 모두 BLACK이 빠져 `|| 99`로 매입 뒤에 떨어진다(서농24호 1건).
- `variety-list-client.tsx`의 삼항 라벨 체인 2곳(`:169~174`, `:276~282`)과 `typeOrder` 2곳(`:193`, `:252`)을 **전부** lib 호출로 교체.
- 기존 사용처 2곳(`product-type-page-client.tsx`, `actions/packages.ts`)은 라벨만 쓰므로 영향 없음.

### 3.2 단계 2 — 삭제 확인 로직 추출 (B 대응)

`delete-variety.ts` 신규 — `variety-dialog.tsx:115~137`의 별칭 경고 로직을 **그대로 옮긴다**(재작성 아님).

```ts
export async function confirmAndDeleteVariety(v: { id: number; name: string; aliases?: string[] }): Promise<boolean>
```

- `variety-dialog.tsx`의 `handleDelete`는 이 함수를 호출하도록 축약 → **경고 문구가 두 벌이 되지 않는다.**
- ⋯ 메뉴의 삭제도 같은 함수를 부른다.
- `delete-button.tsx`는 삭제(대체 완료).

### 3.3 단계 3 — ⋯ 행 메뉴

`variety-row-menu.tsx` 신규. 트리거는 `upload-row-menu.tsx` 패턴 그대로:

```tsx
<Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400">
  <MoreVertical className="w-4 h-4" /><span className="sr-only">품종 메뉴</span>
</Button>
```

- 메뉴: `수정`(`Pencil` 3.5) / `DropdownMenuSeparator` / `삭제`(`Trash2` 3.5, `text-red-600 focus:text-red-600 focus:bg-red-50`)
- 🔴 다이얼로그는 **메뉴 밖에서** 열린다 — `VarietyDialog`에 `open`/`onOpenChange` 외부 제어 props를 추가하고 메뉴는 상태만 켠다.
  (핸드오프의 `asMenuItem` + `onSelect preventDefault`는 트리거를 메뉴 안에 두는 방식이라 Radix 포커스 복귀가 얽힌다. `upload-row-menu`가 이미 「메뉴는 상태만 켜고 Dialog는 형제로」 방식이고, 그게 앱 정본이다.)
  → `VarietyDialog`는 `mode="create"`/모바일 기존 트리거를 **그대로 유지**하고, props가 넘어올 때만 외부 제어로 동작한다.
- `canManage === false` → ⋯ 열 자체를 렌더하지 않음(현행 분기 유지)

### 3.4 단계 4 — 칩 + 검색

- 칩: 단일 선택, 기본 「전체」, `useState`만(URL·localStorage 없음), 개수는 **검색과 무관한 전체 기준**, 0건 곡종 칩은 생성 안 함
- 검색: 품종명 **+ 별칭** 클라이언트 필터, 칩과 AND
- `No` 열은 필터된 목록 기준 1부터 (현행 `index + 1` 그대로)

### 3.5 단계 5 — 선택 상태 제거

`variety-page-client.tsx`(일괄삭제 버튼·`{n}개 선택`·FAB) → `variety-page-wrapper.tsx` → `use-bulk-delete-varieties.tsx` 삭제 순으로 걷어낸다.

### 3.6 단계 6 — 열 너비

```tsx
// canManage (5열)
<col className="w-[8%]" /><col className="w-[32%]" /><col className="w-[30%]" /><col className="w-[22%]" /><col className="w-[8%]" />
// !canManage (4열) — 현행 9/31/33/27 유지
```

### 3.7 모바일

기존 곡종 그룹 카드(`MobileVarietyGroups`) 구조 유지. 체크박스 제거, 우측 연필 → ⋯ 메뉴, 검색은 `w-full`로 노출, FAB 제거.

---

## 4. 검증

`tsc` + `eslint` + `test`까지 실행하고, 화면 확인은 사용자 브라우저로 넘긴다(`next build` 금지).

1. 체크박스 열·상단 삭제 버튼 없음, 칩은 「전체」
2. ⋯ → 수정 → 다이얼로그가 열린 채 유지
3. ⋯ → 삭제 → **별칭 있는 품종은 별칭 경고가 뜬다**(← B 회귀 방지 핵심)
4. 재고 연결 품종 삭제 시 서버 거부 toast
5. 칩 「흑미 1」 → 1건 / 「전체」 복귀
6. 검색 `가바` → 별칭 매칭
7. 칩+검색 AND → 0건 문구 + 전체 보기
8. 🔴 **흑미가 인디카 다음** — 데스크탑 표·모바일 그룹 **양쪽**
9. `SUPPLY_MANAGE` 없는 계정 → ⋯ 열·등록 버튼 없음, 목록·별칭·검색·칩 정상
10. 모바일 카드 ⋯ 동작

---

## 5. 결정 사항 (2026-09-16 사용자 확정)

### ① 검색 UI — **인라인 입력 채택**
핸드오프대로 목록 위에 검색창을 상시 노출한다. 41종짜리 한 화면에 필터 다이얼로그는 과하고,
칩이 이미 상시 노출이라 결이 맞는다. 표준 이탈이므로 기준서에
「관리 화면 소규모 목록은 인라인 검색 예외」를 한 줄 명문화한다.

### ② 빈 상태 문구 — **이 화면만 해요체로**
- `등록된 품종이 없습니다.` → `등록된 품종이 없어요.`
- 필터 0건 → `조건에 맞는 결과가 없어요. 필터를 바꿔보세요.` + 「전체 보기」

앱 전체 문구 통일은 별건으로 남긴다.

### ③ `deleteVarieties` — **남긴다**
`app/actions/admin.ts:221`을 두고 「호출부 없음」 주석만 단다. 액션 삭제는 수술적 범위를 넘는다.
