# 계획서 — 다이얼로그 바탕 회색 정리 (백로그 §22)

- **작성일**: 2026-09-02
- **백로그**: §22 [디자인][전역] 다이얼로그 바탕이 회색이다
- **선행 관계**: 이 작업 → 모바일 점검 라운드(§16·§23) → 605행 소급 정리 → D2 매트릭스
- **왜 모바일보다 먼저인가**: 모바일 점검 대상이 거의 다 다이얼로그다. 순서를 뒤집으면 모바일 보다가
  배경 이상을 발견해 또 개별 `bg-white`를 손으로 박고, §22 정리 때 그걸 다시 걷어낸다 = 같은 파일 2회 수정.

---

## 1. 목표

`DialogContent`의 배경 토큰이 잘못 잡혀 다이얼로그 카드가 회색으로 뜨는 것을 **한 곳에서** 고치고,
지금까지 지점마다 손으로 박아온 `bg-white` 명시를 걷어낸다.

---

## 2. 현황 (2026-09-02 코드 실측)

### 2.1 뿌리

| 위치 | 값 |
|---|---|
| `app/globals.css:55` | `--background: #f1f5f9` (slate-100, **페이지 바탕**) |
| `app/globals.css:60` | `--card: #ffffff` |
| `app/globals.css:64` | `--popover: #ffffff` |
| `components/ui/dialog.tsx:63` | `DialogContent` → `bg-background` 🔴 |
| `components/ui/alert-dialog.tsx:39` | `AlertDialogContent` → `bg-background` 🔴 |
| `components/ui/sheet.tsx:63` | `SheetContent` → `bg-background` (판단 필요, §5.2) |

`popover.tsx` · `dropdown-menu.tsx` · `select.tsx`는 `bg-popover`(#ffffff)라 **이미 정상**. 손댈 것 없음.

### 2.2 다크모드 — 확인 결과 **무관**

`app/globals.css`에 `.dark` 팔레트 정의는 있으나 실제로는 안 쓴다:
- `app/**/*.tsx`의 `dark:` 유틸리티 **0건**
- `ThemeProvider` · `next-themes` · `prefers-color-scheme` 사용처 **없음**

→ 백로그 §22의 「다크모드도 함께 확인」 항목은 **이번 범위에서 제외**한다(검증 불가능·의미 없음).

### 2.3 지금까지 손으로 박은 곳 (걷어낼 대상)

| 파일 | 줄 |
|---|---|
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 504 |
| `app/(dashboard)/milling/stock-list-dialog.tsx` | 190 |
| `app/(dashboard)/packages/deduct-dialog.tsx` | 156 |
| `app/(dashboard)/packages/movement-history-dialog.tsx` | 105 |

### 2.4 파급 규모

- `<DialogContent>` 사용 파일 **27개**
- `<AlertDialogContent>` / `<SheetContent>` 사용 파일 **7개**

이 중 **회색 바탕을 전제로 흰 요소를 얹은 화면**만 개별 보정이 필요하다. 파일 내
`bg-white` / `bg-slate-50` 사용량으로 후보를 좁혔다(전수 눈검사는 하지 않는다):

| 파일 | 흰 요소 | slate-50 | 성격 |
|---|---|---|---|
| `packages/deduct-dialog.tsx` | 6 | 4 | 이미 `bg-white` 명시됨 → 제거해도 결과 동일 |
| `packages/misc-package-dialog.tsx` | 4 | 5 | 대부분 **컨트롤**(버튼·인풋·배지) — 무영향 |
| `components/milling-cart-sheet.tsx` | 4 | 2 | 🔴 **회색 위 흰 카드 나열** — §5.2 |
| `packages/movement-history-dialog.tsx` | 4 | 2 | 이미 명시됨 |
| `milling/add-packaging-dialog.tsx` | 4 | 0 | 이미 명시됨 |
| `packages/repack-dialog.tsx` | 2 | 2 | 🔴 **429줄 흰 카드**가 회색 바탕 전제 — 보정 필요 |
| 나머지 | 0~3 | 0~5 | 폼 위주 — 무영향 예상 |

---

## 3. 범위

### 하는 것
1. `dialog.tsx` · `alert-dialog.tsx`의 `bg-background` → `bg-card`
2. 개별 파일 `bg-white` 수동 명시 4곳 제거
3. 회색 전제 화면 보정 — `repack-dialog.tsx:429`
4. 백로그 정리 — §22 해소 표시 + **이미 해소됐는데 표시만 안 된 §13·§14** 정리

### 안 하는 것 (별도 항목으로 분리)
- 🔴 **`button.tsx:16` outline variant의 `bg-background`** — outline 버튼 배경이 회색이다.
  같은 뿌리지만 **전 앱 버튼에 파급**돼 위험도가 다르다. `repack-dialog.tsx:592`가 이걸 손으로
  `bg-white` 되돌린 증거다. → **백로그 §25로 신규 기록**, 이번엔 손대지 않는다.
- `switch.tsx:28` thumb · `multi-select.tsx:84` — 같은 성격, §25에 함께 기록
- `calendar.tsx:38` — popover 안에서 `bg-transparent`로 무력화됨. 조치 불요

---

## 4. 단계

### 단계 1 — 코어 토큰 교체 (2파일)
- `components/ui/dialog.tsx:63` `bg-background` → `bg-card`
- `components/ui/alert-dialog.tsx:39` `bg-background` → `bg-card`

### 단계 2 — 수동 명시 걷어내기 (4파일)
§2.3의 4곳에서 `bg-white` 제거. **결과 픽셀은 동일해야 한다**(`--card: #ffffff`).
변화가 보이면 그 자체가 회귀 신호.

### 단계 3 — 회색 전제 화면 보정
- `repack-dialog.tsx:429` — 흰 카드가 흰 바탕에 묻힌다. `border-slate-200`만으로는 대비가 약하다.
  → 카드를 `bg-slate-50`으로 뒤집는다(회색 위 흰 카드 → 흰 위 회색 카드).
- 단계 1 적용 후 나머지 다이얼로그도 **사용자 브라우저 확인**으로 회귀 여부 판단(§6).

### 단계 4 — 백로그 정리
- §22 해소 표시 (커밋 해시 기입)
- **§13** `getPackages` 2달 cutoff → 실측 결과 `lib/package-where.ts`에 cutoff **없음**.
  9/02 검색 필터 정리 때 사라졌다. 해소 표시 + `app/actions/packages.ts:1111` 낡은 주석 정리
- **§14** 비판매 차감 처리 → 9/01 재고차감 D1~D7이 구현체. 해소 표시
- **§25 신규** — outline 버튼·switch·multi-select의 `bg-background` (§3 비범위 항목)

---

## 5. 결정이 필요한 것

### 5.1 `Sheet`도 함께 바꿀까 — **제외 권장**
`SheetContent`도 `bg-background`(회색)다. 그런데 유일한 실사용처인 `milling-cart-sheet.tsx`는
**회색 바탕 위에 흰 카드 4개를 얹는** 구조다 — 의도된 설계로 보인다.
흰색으로 바꾸면 카드가 통째로 묻히고, 카드 4개를 전부 `bg-slate-50`으로 뒤집어야 한다.
이번 목적(다이얼로그 카드 성격 바로잡기)과 성격이 다르므로 **Sheet는 회색 유지**를 권장한다.

### 5.2 `repack-dialog` 카드 처리 방식
- **A안 (권장)**: 카드를 `bg-slate-50`으로 뒤집는다 — 대비 유지, 다른 다이얼로그와 패턴 일치
- B안: `bg-white` 유지하고 `shadow-sm` 추가 — 흰 위 흰이라 대비가 그림자에만 의존

---

## 6. 검증

- `tsc --noEmit` 0
- `npm test` — 현재 200/200 유지 (표시 계층만 바뀌므로 숫자 불변이 정상)
- `eslint` 신규 0건
- `next build` **미실행** (dev 서버 상시 기동 — 프로젝트 규칙)
- 🔴 **브라우저 확인은 사용자 몫** — 다이얼로그 27개 전수는 무리이므로 §2.4 표의 상위 6개
  + 자주 쓰는 폼 다이얼로그 3~4개를 표본으로 제안

---

## 7. 위험

| 위험 | 등급 | 대응 |
|---|---|---|
| 회색 전제 화면을 놓쳐 요소가 묻힘 | 중 | §2.4로 후보 6개 좁힘 + 사용자 표본 확인 |
| outline 버튼 회색이 흰 바탕에서 도드라짐 | 낮 | 이미 흰 카드 위에서 같은 상태 = 신규 회귀 아님. §25로 분리 |
| `bg-white` 제거가 실제로는 색을 바꿈 | 낮 | `--card: #ffffff` 확인됨. 변화 보이면 즉시 되돌림 |
| Sheet 미변경으로 일관성 흠 | 낮 | §5.1에 근거 기록, 의도된 제외 |

**복잡도: 낮음** — 표시 계층만, 서버·스키마 무관. 파일 7~8개.
