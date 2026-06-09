# 잡곡 재고관리 #4 — `/stocks` → `/raw-stocks` 라우팅 이동 사전조사

> **작성일**: 2026-04-29
> **대상 작업**: `plan-잡곡재고관리.md` §작업 단계 #4 (벼 탭 유지, **이동만**)
> **핵심**: 디렉터리 rename + import/링크/캐시 키/audit 매칭 일괄 갱신 + 영구 리다이렉트

---

## 1. 작업 본질

- `app/(dashboard)/stocks/` → `app/(dashboard)/raw-stocks/` **rename** (git mv로 히스토리 보존)
- 페이지 내부 동작·UI는 **그대로** (계획서 §369: 벼 탭 내부 디자인은 범위 밖). 잡곡 탭/탭 쉘 도입은 **#5에서 처리**
- `/stocks` → `/raw-stocks` 영구 리다이렉트(308) 추가 — 북마크·외부 링크·PWA 캐시 보호
- 미들웨어 권한 가드는 `/admin/*`만 적용([middleware.ts:27](../middleware.ts#L27))이라 본 이동은 **권한 영향 없음**

---

## 2. 영향 범위 — 코드 변경 카테고리별

### 2.1 디렉터리 이동 (15 파일 일괄)
```
app/(dashboard)/stocks/
  ├ page.tsx                     ┐
  ├ stock-page-client.tsx         │
  ├ stock-page-wrapper.tsx        │
  ├ stock-list-client.tsx         │
  ├ stock-table-row.tsx           │
  ├ stock-filters.tsx             │
  ├ active-filters.tsx            │   git mv
  ├ stock-excel-buttons.tsx       │ ─────────►   app/(dashboard)/raw-stocks/...
  ├ add-stock-dialog.tsx          │
  ├ edit-stock-dialog.tsx         │
  ├ delete-stock-button.tsx       │
  ├ release-stock-dialog.tsx      │
  ├ start-milling-dialog.tsx      │
  ├ use-bulk-delete-stocks.tsx    │
  └ milling-cart-context.tsx     ┘
```

### 2.2 cross-file import 경로 갱신 (2곳)
| 파일 | 라인 | 현재 | 변경 |
| --- | --- | --- | --- |
| [components/milling-cart-sheet.tsx](../components/milling-cart-sheet.tsx) | 3 | `'@/app/(dashboard)/stocks/milling-cart-context'` | `'@/app/(dashboard)/raw-stocks/milling-cart-context'` |
| [app/(dashboard)/milling/stock-list-dialog.tsx](../app/(dashboard)/milling/stock-list-dialog.tsx) | 26 | 동일 | 동일 |

> **참고**: `milling-cart-context`를 `lib/` 또는 `contexts/`로 옮겨 라우트 종속성을 끊을 수도 있으나 본 #4 범위 외(수술적 변경 원칙). raw-stocks 디렉터리 안에 그대로 둠.

### 2.3 네비게이션·UI 링크 (4곳)
| 파일 | 라인 | 변경 |
| --- | --- | --- |
| [components/desktop-sidebar.tsx](../components/desktop-sidebar.tsx) | 41-42 | `href="/stocks"` + `isActive('/stocks')` → `/raw-stocks` |
| [components/mobile-nav.tsx](../components/mobile-nav.tsx) | 15 | `{ href: '/stocks', ..., label: '재고' }` → `/raw-stocks` (라벨 "원물"로 갱신할지 별도 결정 — §4 결정 포인트) |
| [app/(dashboard)/milling/stock-list-dialog.tsx](../app/(dashboard)/milling/stock-list-dialog.tsx) | 136 | `router.push('/stocks')` → `/raw-stocks` |
| [components/breadcrumb-display.tsx](../components/breadcrumb-display.tsx) | 40-44 | #0.5에서 미리 추가해 둔 `/stocks` 매핑 제거(이미 `/raw-stocks` 매핑 존재 → 중복 해소). 리다이렉트가 처리하므로 안전 |

> 참고: 사이드바·모바일 네비 전면 개편(메뉴 구조)은 **#9 단계**. 본 #4에서는 라우트 일관성 차원에서 링크만 갱신.

### 2.4 `revalidatePath('/stocks')` 호출 일괄 갱신 (총 25곳)
| 파일 | 호출 수 |
| --- | --- |
| [app/actions/admin.ts](../app/actions/admin.ts) | 11 |
| [app/actions/milling.ts](../app/actions/milling.ts) | 5 |
| [app/actions/release.ts](../app/actions/release.ts) | 4 |
| [app/actions/stock.ts](../app/actions/stock.ts) | 4 |
| [app/actions/stock-excel.ts](../app/actions/stock-excel.ts) | 1 |

→ 모두 `'/raw-stocks'`로 일괄 치환. `revalidatePath`는 캐시 키이므로 redirect를 거치지 않음. 새 경로로 정확히 호출되어야 입고 등록·수정·삭제·엑셀 후 목록 즉시 갱신 동작.

> stock.ts:336 주석 `// 벼 전용 페이지(\`/stocks\`, \`/raw-stocks\` 벼 탭)에서만 호출됨.`는 #1에서 미리 둘 다 가정해 둔 것 — 주석도 정리.

### 2.5 audit 분류 매칭 (1곳)
[app/actions/audit.ts:144](../app/actions/audit.ts#L144) `pathname.startsWith('/stocks')` → `pathname.startsWith('/raw-stocks')`로 변경. (과거 `/stocks` 경로로 들어온 클라이언트 호출이 없을 거라 안심 — redirect로 전환됨. 다만 PWA 캐시·앱 단축아이콘 잔존 가능성 고려해 **둘 다 매칭**하도록 OR 분기 권장)

### 2.6 영구 리다이렉트 추가 ([next.config.ts](../next.config.ts))
현재 redirects 정의 없음. `nextConfig`에 추가:
```ts
async redirects() {
  return [
    { source: '/stocks', destination: '/raw-stocks', permanent: true },
    { source: '/stocks/:path*', destination: '/raw-stocks/:path*', permanent: true },
  ]
}
```
- `permanent: true` → 308 응답 (브라우저·검색엔진이 영구 캐시)
- 두 줄 — 루트 경로와 하위 경로(쿼리 파라미터 포함) 모두 처리

---

## 3. 영향 없음 (확인 완료)

| 항목 | 사유 |
| --- | --- |
| 미들웨어 권한 가드 | `/admin/*`만 매칭 — `/stocks`/`/raw-stocks`에 가드 없음 |
| `app/(dashboard)/page.tsx` 홈 대시보드 | grep 결과 `/stocks` 링크 0건 |
| `app/(dashboard)/_components/recent-logs-list.tsx` | 활동 로그 표시만, 라우트 링크 없음 |
| audit log 과거 기록 | 과거 `/stocks` pathname 기록은 그대로 보존(히스토리). 신규 호출만 `/raw-stocks`로 분류 |
| 결과보고서 `#1`·`#3`의 `/stocks` 언급 | 과거 시점 문서, 갱신 불필요 |

---

## 4. 결정 포인트

### 4.1 모바일 네비 라벨
[mobile-nav.tsx:15](../components/mobile-nav.tsx#L15) 현재 `label: '재고'`. `/raw-stocks`로 이동했으니 **"원물"로 갱신**할지, "재고" 유지할지.
- 권장: **"원물"** — 계획서 §107 모바일 5탭 정의(`📦 원물`)와 일치
- 단, 사이드바·모바일 네비 전면 개편은 #9이므로 라벨까지 본 #4에서 손댈지 사용자 판단 필요

### 4.2 `milling-cart-context.tsx` 위치
- 옵션 A (권장): raw-stocks 디렉터리 안 그대로 — 수술적 변경 원칙
- 옵션 B: `lib/contexts/milling-cart-context.tsx` 또는 `app/(dashboard)/_contexts/`로 승격해 라우트 종속성 제거 — 잡곡·매입 다이얼로그가 #7~#8에서 카트를 쓰지 않을 거면 옵션 A로 충분

### 4.3 audit.ts 분기 처리
- 옵션 A: `/stocks` → `/raw-stocks`로 단순 치환 (redirect로 전환되니 새 호출은 `/raw-stocks`만)
- 옵션 B (권장): `pathname.startsWith('/raw-stocks') || pathname.startsWith('/stocks')` OR 분기 — PWA 캐시·앱 단축 아이콘 잔존을 방어

### 4.4 브레드크럼 `/stocks` 매핑
- 권장: **제거**. redirect 후엔 클라이언트가 항상 `/raw-stocks`로 매칭됨. #0.5에서 임시로 깔아둔 중복

---

## 5. 위험 요소

- **PWA 캐시**: `next.config.ts`의 `next-pwa`가 sw.js 등록. 사용자가 PWA로 설치한 경우 옛 `/stocks` 라우트가 캐시될 수 있음 → redirect 가 처리하지만 첫 로드 시 약간의 지연 가능
- **북마크/모바일 홈 단축**: `permanent: true` 308이 갱신해 줌
- **revalidatePath 25곳**: 본 PR에서 누락 시 재고 등록·수정 후 목록이 갱신되지 않음 → 스모크 테스트로 반드시 확인
- **`category: 'RICE'` 필터**: #1에서 이미 주입 완료. 본 #4와 무관. 잡곡 탭·매입 분기는 #5~#7에서 도입
- **ts/lint 영향**: rename 후 import 경로 2곳 갱신을 빼먹으면 빌드 실패 — 사전조사로 식별 완료

---

## 6. 작업 순서 (권장)

1. `git mv` 디렉터리 rename (15 파일)
2. cross-file import 2곳 갱신
3. `revalidatePath('/stocks')` 25곳 일괄 치환 (정규식 `'/stocks'` → `'/raw-stocks'`)
4. 네비게이션 링크 4곳 갱신 + 브레드크럼 `/stocks` 매핑 제거
5. audit.ts 분기 (옵션 B 권장: OR 분기)
6. next.config.ts redirects 추가
7. `npx tsc --noEmit` 통과 확인
8. 브라우저 스모크 테스트:
   - `/stocks` 입력 → 308 → `/raw-stocks` 자동 이동
   - `/raw-stocks` 페이지 정상 렌더 (필터·테이블·엑셀·등록 다이얼로그 모두 기존 동작)
   - 사이드바·모바일 네비 active 상태 (`/raw-stocks`에서)
   - 헤더 브레드크럼 "원물재고" + 설명 표시
   - 도정 카트 동작 확인 (검색→담기→도정시작)
   - 입고 등록·수정·삭제 후 목록 즉시 갱신 (revalidatePath 정상 동작)
   - 활동 로그 페이지에서 Stock 변경 내역 분류 정상

---

## 7. 영향 파일 합계

| 카테고리 | 파일 수 | 비고 |
| --- | --- | --- |
| rename 대상 | 15 | git mv |
| import 갱신 | 2 | cross-file |
| 라우트 링크 | 4 | sidebar/mobile-nav/router.push/breadcrumb |
| revalidatePath | 5 (호출 25곳) | actions 디렉터리 |
| audit 분기 | 1 | audit.ts |
| redirects | 1 | next.config.ts |
| **합계** | **약 28 파일 touch** | rename 제외 시 13 파일 수정 |

3개 이상 파일 변경이라 본 작업 시작 전 `docs/plan-잡곡재고관리-#4.md` 본 계획서 작성 필요(CLAUDE.md HARD-GATE).

---

## 8. 다음 액션

1. 본 사전조사 사용자 검토
2. §4 결정 포인트 4건 확정
3. `docs/plan-잡곡재고관리-#4.md` 본 계획서 작성 후 승인 → 구현
