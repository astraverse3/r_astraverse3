# 잡곡 재고관리 #4 — `/stocks` → `/raw-stocks` 라우팅 이동 계획

> **작성일**: 2026-04-29
> **상태**: 사용자 승인 대기
> **사전조사**: [research-잡곡재고관리-#4.md](../research/research-잡곡재고관리-#4.md)
> **상위 계획**: [plan-잡곡재고관리.md](plan-잡곡재고관리.md) §작업 단계 #4

---

## 1. 목표

`app/(dashboard)/stocks/`를 `app/(dashboard)/raw-stocks/`로 이동하고, 옛 `/stocks` URL은 영구 리다이렉트(308)로 호환 유지. **페이지 내부 동작·UI는 그대로** — 잡곡 탭/탭 쉘 도입은 #5에서 처리.

CLAUDE.md HARD-GATE 적용 (3개 이상 파일 변경 → 약 28 파일 touch).

---

## 2. 결정 사항 (사전조사 §4 확정)

| # | 결정 포인트 | 결정 |
| --- | --- | --- |
| 1 | 모바일 네비 라벨 | "재고" → **"원물"** (계획서 §107 모바일 5탭 정의와 일치) |
| 2 | `milling-cart-context.tsx` 위치 | **raw-stocks/ 안 그대로 유지** (수술적 변경 원칙) |
| 3 | audit.ts 분기 | **옵션 A — 단순 치환** (`/stocks` → `/raw-stocks`). 308 리다이렉트가 처리하므로 OR 분기는 도달 불가능 코드 |
| 4 | 브레드크럼 `/stocks` 매핑 | **제거** (#0.5에서 임시로 깐 중복, redirect로 자동 처리) |

---

## 3. 변경 범위 (총 약 28 파일)

| 카테고리 | 작업 | 파일 |
| --- | --- | --- |
| 디렉터리 rename | `git mv` 15 파일 | `app/(dashboard)/stocks/*` → `raw-stocks/*` |
| cross-file import | 경로 갱신 2곳 | `components/milling-cart-sheet.tsx:3`, `app/(dashboard)/milling/stock-list-dialog.tsx:26` |
| 네비게이션·UI | 4곳 | `desktop-sidebar.tsx:41-42`, `mobile-nav.tsx:15`(href+label), `milling/stock-list-dialog.tsx:136`, `breadcrumb-display.tsx:40-44` |
| `revalidatePath` 일괄 치환 | 5 파일 25곳 | admin.ts(11), milling.ts(5), release.ts(4), stock.ts(4 + L336 주석), stock-excel.ts(1) |
| audit 분기 | 1곳 | `app/actions/audit.ts:144` |
| 영구 리다이렉트 추가 | 1곳 | `next.config.ts` `nextConfig.redirects` |

상세 위치는 사전조사 §2 참조.

---

## 4. 단계별 접근

### 4.1 디렉터리 이동 (1단계 커밋 단위)
1. `git mv "app/(dashboard)/stocks" "app/(dashboard)/raw-stocks"` — 히스토리 보존
2. cross-file import 2곳 갱신
3. `npx tsc --noEmit` 통과 확인 (이 시점에서 빌드는 깨지지 않아야 함, 단 UI에서 `/stocks` 라우트는 404)

### 4.2 네비게이션·캐시 키·audit 정합화 (2단계, 같은 커밋)
4. `revalidatePath('/stocks')` 25곳 일괄 치환 (정규식 `/stocks` → `/raw-stocks`, 단 worklog/plan/research 등 docs는 제외)
5. 사이드바·모바일 네비 href 갱신, 모바일 라벨 "재고" → "원물"
6. `router.push('/stocks')` 1곳 갱신
7. 브레드크럼 `/stocks` 매핑 제거
8. audit.ts `pathname.startsWith('/stocks')` → `/raw-stocks`
9. `stock.ts:336` 주석 갱신 (`벼 전용 페이지(\`/raw-stocks\` 벼 탭)에서만 호출됨` 형태로 단순화)

### 4.3 영구 리다이렉트 (3단계, 같은 커밋)
10. `next.config.ts`에 `redirects()` 추가:
    ```ts
    async redirects() {
      return [
        { source: '/stocks', destination: '/raw-stocks', permanent: true },
        { source: '/stocks/:path*', destination: '/raw-stocks/:path*', permanent: true },
      ]
    }
    ```

### 4.4 검증
11. `npx tsc --noEmit` 통과
12. 브라우저 스모크 테스트 (§5)

---

## 5. 검증 계획 (브라우저 스모크)

| 시나리오 | 기대 |
| --- | --- |
| `/stocks` URL 직접 입력 | 308 응답 → `/raw-stocks` 자동 이동 |
| `/stocks?varietyId=1` 같은 쿼리 | 쿼리 보존하며 `/raw-stocks?varietyId=1`로 이동 |
| `/raw-stocks` 페이지 렌더 | 필터·테이블·등록 다이얼로그·엑셀 import/export 모두 기존 동작 |
| 사이드바 / 모바일 네비 active 상태 | `/raw-stocks` 진입 시 "원물재고" 항목 활성, 모바일 탭 라벨 "원물" |
| 헤더 브레드크럼 | "원물재고" + 설명 표시 |
| 도정 카트 | 재고 검색 → 담기 → 도정 시작 동작 (milling-cart-context 경로 갱신 검증) |
| 입고 등록·수정·삭제 | 액션 후 목록 즉시 갱신 (revalidatePath 새 경로 정상 동작) |
| 엑셀 import 후 목록 | 즉시 갱신 |
| 활동 로그 페이지 | Stock 엔티티 변경 내역 분류 정상 (audit.ts 분기 검증) |

증거: 각 시나리오 통과 확인을 결과보고서에 명시 기록.

---

## 6. 커밋 전략

본 작업은 논리적으로 분리하기 어려운 단일 변경(라우트 이동 + 호환 유지). **단일 커밋**으로 처리:

```
feat: 잡곡 재고관리 #4 — /stocks → /raw-stocks 라우팅 이동

- 디렉터리 rename (git mv 15 파일)
- cross-file import 2곳 + revalidatePath 25곳 + 네비게이션 4곳 + audit 1곳 갱신
- next.config.ts redirects 추가 (/stocks → /raw-stocks 308)
- 모바일 네비 라벨 "재고" → "원물" (계획서 §107 정합)

페이지 내부 동작·UI는 변경 없음(#5에서 잡곡 탭 도입 예정).
```

---

## 7. 위험 요소

- **revalidatePath 25곳 누락 시**: 입고·도정·릴리즈·관리자 액션 후 재고 목록이 갱신 안 됨 → 스모크 테스트 항목 9가지 모두 통과 필수
- **import 경로 갱신 누락**: 빌드 실패로 즉시 발견 → tsc 단계에서 차단
- **PWA 캐시**: 사용자 단말의 sw.js 캐시 잔존 가능. 308 리다이렉트가 처리하지만 첫 방문 시 약간의 지연 가능성. 본 PR 배포 후 사용자 안내 불필요(자동 처리)
- **결과보고서 #1·#3의 `/stocks` 언급**: 과거 시점 문서, 갱신 불필요(히스토리)

---

## 8. 본 범위 외 (명시적 분리)

- 잡곡 탭 / 탭 쉘 / 잡곡 입고 다이얼로그 — **#5에서 처리**
- 사이드바·모바일 네비 전면 개편(메뉴 구조·아이콘) — **#9에서 처리**. 본 #4는 라우트 의미 정합만 (href + 모바일 라벨 한 줄)
- `milling-cart-context` 위치 변경(lib 승격) — 결정 #2로 보류
- 리팩토링 백로그 §1·§2 부수 이슈 — 본 PR과 분리

---

## 9. 승인 요청

이 계획대로 진행하면 됨? OK 받으면:
1. 구현 시작 (단계 §4)
2. 결과보고서 `docs/report-잡곡재고관리-#4-2026-04-29.md` 작성
3. worklog 갱신, 메모리 갱신 (#5로 재개 지점 이동)
4. 단일 커밋
