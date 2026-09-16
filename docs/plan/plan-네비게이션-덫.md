# 계획서 — 네비게이션 덫 (화면 튐 원인 추적)

_작성: 2026-09-16 · 임시 계측. 원인 확정 후 **걷어내는 것이 전제**._

## 1. 목표

모바일 PWA에서 간헐적으로 일어나는 **「원물재고 검색 중 도정목록으로 화면이 튐」의 원인을, 다음 발생 1회로 확정**한다.

재현이 안 되는 현상이라 코드 정적 분석으로는 두 번 연속 빗나갔다(아래 §2). 추측을 더 쌓는 대신 **발생 순간의 사실을 폰 안에 기록**해 두고, 다음에 튀었을 때 꺼내 본다.

**이 작업은 버그 수정이 아니다.** 원인을 특정하는 것까지가 범위이고, 수정은 원인이 확정된 뒤 별건으로 한다.

## 2. 지금까지 기각된 가설 (다시 세우지 말 것)

| 가설 | 기각 근거 |
|---|---|
| 과거 `/stocks` 308 리다이렉트 재발 | 코드에 `/stocks` 잔재 0건. 2026-06-09에 이미 수정됨 |
| 시스템 뒤로가기 **제스처** | 사용자 폰은 3버튼 네비게이션 → 가장자리 스와이프 백이 존재하지 않음 |
| 하단 탭바 오터치 ghost click | **실기기 검증** — 다이얼로그 연 채 탭바 '도정' 자리를 눌러도 다이얼로그만 닫히고 머문다 |
| 서비스 워커 캐시가 경로를 바꿈 | 캐시는 「그 주소에 틀린 내용」·「새로고침」까지만 가능. **앱의 리다이렉트 목적지 어디에도 `/milling`이 없다**(308은 `/raw-stocks`·`/sales`, 미들웨어는 `/`·`/login`) |
| `useEffect`·타이머 안의 자동 라우팅 | 전수 조사 결과 0건 |
| next-auth 세션 만료 리다이렉트 | 목적지가 `/login`·`/` 뿐 |

## 3. 남은 용의자 (덫이 가려야 할 것)

앱 전체에서 `/milling`으로 밀어내는 코드는 **아래 4개뿐**이다.

| # | 용의자 | 위치 | 판별 신호 |
|---|---|---|---|
| A | 장바구니 '수정' 버튼 — 확인창 없이 즉시 저장 + 이동. **화면 최하단 가로 꽉 찬 버튼**(왼손 엄지 위치) | `components/milling-cart-sheet.tsx:43` | 그 버튼에 pointerdown + 액션 호출 기록 |
| B | 도정시작 제출 | `app/(dashboard)/raw-stocks/start-milling-dialog.tsx:93` | 상동 |
| C | 하단 탭바 '도정' | `components/mobile-nav.tsx` `handleNav` | 탭 버튼에 pointerdown |
| D | 뒤로가기(버튼·제스처·시스템 어느 경로든) | — | **pointerdown 없이 `popstate`만** |
| E | 위 어디에도 안 걸림 | — | pathname은 바뀌었는데 선행 신호 없음 → 미지의 경로 |

**중요한 배경 사실** — 이 상황은 코드가 자동으로 만든다:
`app/(dashboard)/milling/stock-list-dialog.tsx:163`이 `startEditing()`을 켜고 **쿼리 없이** `/raw-stocks`로 보낸다 → ① 히스토리 직전이 `/milling`이 되고 ② 쿼리가 없어 모바일 검색 다이얼로그가 자동 오픈되고([stock-filters.tsx:91-104]) ③ 카트가 편집모드라 장바구니 시트도 자동 오픈된다. 즉 **A와 D가 동시에 사정권에 들어온 상태**가 만들어진다.

## 4. 기록 설계

### 4.1 기록 대상

| 이벤트 | 남기는 것 |
|---|---|
| `pointerdown` (전역, capture) | 시각 · **눌린 요소의 식별자**(태그 + `data-trace` + 가장 가까운 button/a의 텍스트 40자) · 좌표 |
| `popstate` | 시각 · 직전/현재 pathname |
| pathname 변경 | 시각 · from → to |
| `/milling` push 호출 | 시각 · **어느 핸들러**인지(A/B/C 명시 태그) |
| `online` / `visibilitychange` | 시각 · 상태 |
| 페이지 로드 | `performance.getEntriesByType('navigation')[0].type` (reload인지 navigate인지) |

🔴 **입력값은 절대 기록하지 않는다.** `input`/`textarea`의 `value`, 생산자명·중량 등 사용자가 친 글자는 대상에서 제외한다. 기록하는 텍스트는 **버튼/링크의 라벨**뿐.

### 4.2 저장

- `localStorage` 링 버퍼, **최근 200건**. 넘으면 오래된 것부터 버린다.
- 쓰기 부담을 줄이려고 메모리에 쌓고 **① pathname 변경 시 ② 1초 유휴 시 ③ `visibilitychange`(숨김)** 에 flush.
- 🔴 `localStorage` 접근은 전부 `try/catch` — 실패해도 앱은 아무 일 없이 동작해야 한다.
- 🔴 **`reloadOnOnline`(기본 켜짐) 때문에 앱이 통째로 새로고침될 수 있다** → 메모리만 쓰면 증거가 날아간다. localStorage가 필수인 이유.

### 4.3 보는 방법

- `/admin/trace` 페이지 신규 — 기록을 시간 역순으로 표시. **pathname 변경 줄을 강조**하고 그 직전 5건을 묶어 보여준다.
- 「지우기」·「텍스트로 복사」 버튼.
- 권한: **ADMIN 전용**(`middleware.ts`의 `ADMIN_ROUTE_PERMISSIONS`에 `permission: null`로 등록).
- 진입: 모바일 헤더 설정 메뉴 · 데스크탑 사이드바의 관리자 영역에 항목 추가(ADMIN에게만 보임).

## 5. 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/nav-trace.ts` | **신규** — 기록 버퍼·직렬화·요소 식별자 추출. 순수 로직은 단위테스트 |
| `lib/nav-trace.test.ts` | **신규** — 링 버퍼 상한·입력값 제외·요소 식별자 추출 |
| `components/nav-trace.tsx` | **신규** — 전역 리스너 + pathname 감시 클라이언트 컴포넌트 |
| `app/(dashboard)/layout.tsx` | 1줄 삽입 |
| `app/(dashboard)/admin/trace/page.tsx` | **신규** — 보기 화면 |
| `middleware.ts` | `/admin/trace` ADMIN 전용 등록(1줄) |
| `components/mobile-header.tsx` | 관리자 메뉴 항목 1개 |
| `components/desktop-sidebar.tsx` | 관리자 메뉴 항목 1개 |
| `components/milling-cart-sheet.tsx` | `handleUpdate`에 기록 1줄 (용의자 A) |
| `app/(dashboard)/raw-stocks/start-milling-dialog.tsx` | `handleSubmit`에 기록 1줄 (용의자 B) |
| `components/mobile-nav.tsx` | `handleNav`에 기록 1줄 (용의자 C) |

## 6. 단계

1. `lib/nav-trace.ts` + 테스트 — 버퍼·식별자 추출 (화면 없이 검증 가능)
2. `components/nav-trace.tsx` + 레이아웃 삽입 — 전역 리스너
3. 용의자 A·B·C에 기록 1줄씩
4. `/admin/trace` 화면 + 권한 + 메뉴 진입
5. `tsc --noEmit` · `eslint` · `npm test` 통과 확인 → **사용자 브라우저 확인** → 배포

🔴 **덫은 실서버에 배포돼야 작동한다** — dev에서는 PWA가 꺼져 있고, 증상 자체가 실기기 PWA에서만 나온다.

## 7. 제거 조건 (잊지 말 것)

**원인이 확정되면 즉시 걷어낸다.** 남겨두면:
- 전역 `pointerdown` 리스너가 상시 돌고
- `localStorage`에 계속 쓰고
- 관리자 메뉴에 쓸모없는 항목이 남는다

제거 시 되돌릴 파일은 §5 표 전부. 커밋을 **덫 설치 1개 · 제거 1개**로 깔끔히 나눠 `git revert` 한 번으로 걷히게 한다.

## 8. 위험 / 확인 필요

1. **성능** — 전역 `pointerdown`은 `passive: true` + capture로 붙이고 핸들러 안에서 DOM 탐색을 최소화한다(최대 3단계 상향). 스크롤·터치 반응에 영향 없어야 한다.
2. **덫이 증상을 가릴 가능성** — 리스너가 이벤트를 삼키면 안 된다. `preventDefault`·`stopPropagation` 절대 금지, 오직 읽기만.
3. **기록 누락** — 튐이 일어난 뒤 사용자가 계속 앱을 쓰면 200건 버퍼에서 밀려날 수 있다. → pathname 변경 기록은 **별도 슬롯에 최근 20건을 따로** 보관해 밀려나지 않게 한다.
4. **개인정보** — §4.1의 입력값 제외 규칙을 테스트로 고정한다.

## 9. 함께 발견된 별건 (이 계획서 범위 밖)

덫 조사 중 드러난 **실제 결함**. 별도 판단 필요:

- **`reloadOnOnline` 기본 켜짐** — `online` 이벤트마다 앱 전체 새로고침. 지하 나올 때·WiFi↔LTE 전환 시 발동하고 **입력 중이면 날아간다**. 현장 폰 사용 앱에 위험.
- **`others` NetworkFirst가 모든 페이지 요청을 가로챔** — 10초 내 응답 없으면 최대 24시간 된 캐시를 내준다. 슬롯 32개 LRU.
- **`next-pwa` 5.6은 2022년 이후 배포 중단** — Next 16 + App Router 지원 범위 밖. 후속은 Serwist.
- 남은 308 리다이렉트 4개(`/stocks`·`/releases`) — 이번 증상과 무관하나 위생 차원 정리 대상.
