# 판매관리 설계 참고 사항

조사일: 2026-04-28
출처: 잡곡 재고관리 #1 사전조사 중 발견. 판매관리(`/sales`) 본 작업은 잡곡 #9 라우트 이관 + 후속 별도 계획서.
관련 문서: [plan-잡곡재고관리.md §판매관리 연동 포인트](plan-잡곡재고관리.md), [research-잡곡스키마-호출부.md](research-잡곡스키마-호출부.md)

---

## 1. 모델 명칭 정리

- 계획서에 등장하는 **`ReleaseLog`** 는 실제 schema의 **`StockRelease`** 를 가리킨다. 이름이 다르니 구현 시 `StockRelease`로 통일해서 작성. (필요하면 후속에서 모델명 리네이밍 이슈로 분리)
- 관련 테이블: `Stock` ↔ `StockRelease` (1:N, `Stock.releaseId`로 연결)
- 출고 시 `Stock.status = 'RELEASED'` + `releaseId` 세팅 패턴

## 2. 기존 출고 로직의 한계

### 2.1 `app/actions/output-statistics.ts:95` — `getOutputStatistics`
```ts
const packages = await prisma.millingOutputPackage.findMany({
  where: {
    batch: { date: { gte: filters.from, lte: filters.to }, ...varietyFilter },
  },
  ...
})
```
- **`where: { batch: { ... } }` 형식이라 `batch=null`인 매입품(잡곡)이 자동 제외됨**
- 잡곡 매입을 포함하려면 OR 조건 재설계 필요:
  ```ts
  where: {
    OR: [
      { batch: { date: {...}, ...varietyFilter } },          // 도정산
      { source: 'PURCHASED', purchaseDate: {...}, ...varietyFilter },  // 매입
    ]
  }
  ```
- `varietyFilter`도 `stocks: { some: { varietyId: ... } }` 형식이라 매입품에서 동작 안 함 → `OR` 분기 내부에서 각자 처리

### 2.2 `output-statistics.ts:65` — `getOutputVarietyOptions`
- `prisma.variety.findMany({ where: { stocks: { some: { batch: { date: ... } } } } })`
- 동일 이유로 매입 품종이 드롭다운에 안 뜸 → 판매분석 확장 시 매입 분기 추가

### 2.3 출고는 품종 필터 미적용 (의도적)
- `output-statistics.ts` 코드 주석: `"출고는 품종 필터 미적용 — 생산 기준 통계"`
- "판매분석"으로 확장 시 일관성 재검토 필요. 판매 기준으로 보면 출고도 품종 필터 적용이 자연스러움

## 3. 라우트 이관 (#9 단계) 시 영향 범위

### 3.1 `/releases` → `/sales` 리다이렉트
- 영구 리다이렉트 추가 (next.config.ts `redirects()` 또는 별도)
- **하드코딩 `/releases` 링크 전수조사** 필요
  - 모바일 홈 최근활동 / 공지 본문 / 사이드바 / 모바일 네비
  - revalidatePath 호출부도 확인 (`revalidatePath('/releases')` → `revalidatePath('/sales')`)

### 3.2 출고 탭 = 기존 `/releases` 그대로 이관
- 영향받는 컴포넌트: `release-page-wrapper`, `release-filters`, `release-excel-button` 등
- 기능·UI 변경 없이 컨테이너만 `/sales?tab=release`로 옮기는 것이 원칙

### 3.3 통계 라벨 변경 — "출고분석" → "판매분석"
- URL `/statistics/output`은 유지 (북마크 보호)
- 변경 위치:
  - `components/desktop-sidebar.tsx` — 사이드바 라벨
  - `components/breadcrumb-display.tsx` — 헤더 브레드크럼 PAGE_CONFIG
  - `app/(dashboard)/statistics/output/page.tsx` — 페이지 타이틀
  - 기타 텍스트 하드코딩 위치 grep

## 4. 미결정 설계 사항 (다음 판매관리 계획서에서 결정)

### 4.1 재고 차감 방식
- 옵션 A: `MillingOutputPackage.count` 감소 (단순, 이력 유실)
- 옵션 B: `status` 필드 추가 (`AVAILABLE`/`SOLD`/`PARTIAL`) + 별도 판매 이력 모델
- 옵션 C: 신규 `Sale` 모델 생성, `MillingOutputPackage`는 불변 + 판매분만큼 차감 뷰 계산
- 출고 탭(StockRelease)과의 관계도 같이 결정해야 함

### 4.2 주문서 자동 매칭
- 매칭 키 후보: `source` + `category` + `varietyId` + `lotNo` + `packageType`
- 매입품은 `lotNo` 없음 → 매칭 키에서 제외하거나 `purchaseFrom`+`purchaseDate`로 대체
- 동일 lotNo + 동일 packageType 다중 row 처리 (재고 우선순위: FIFO/LIFO 결정)

### 4.3 판매분석 차트 재정의
- 3탭(벼/잡곡/출고)을 모두 포괄하는 상위 지표
- 기존 차트(`OverlappingBar` 생산량/출고량 + 수율)는 도정 중심 → 판매 기준으로 재구성 필요
- 매입품은 수율 개념 없음 → 차트 분기 또는 지표 단순화

## 5. 필터 확장 — 판매관리 화면 UI에서 필요할 항목

기존 `/releases` 필터(생산자/기간/출고처) 외에 추가로 필요한 것:

| 필터 | 데이터 소스 | 비고 |
|------|------------|------|
| `source` (도정산/매입) | `MillingOutputPackage.source` | 신규 enum |
| `category` (벼/잡곡) | `MillingOutputPackage.category` | 탭 자체로 대체 가능 |
| `lotNo` | `MillingOutputPackage.lotNo` | 매입품은 null이라 도정산 탭에서만 |
| `packageType` (20kg/10kg/...) | `MillingOutputPackage.packageType` | 잡곡은 g 단위 추가됨(#3) |
| `purchaseFrom` (매입처) | `MillingOutputPackage.purchaseFrom` | 잡곡 탭 전용, autocomplete |
| `farmerName` (생산자) | `Stock.farmer.name` via batch | 도정산 탭에서만 |

검색 UX는 기존 재고/도정 패턴(쉼표 다중값, 멀티셀렉트)과 일관되게.

## 6. 데이터 정합성 가드

- 잡곡 매입 등록 시 zod 검증 (Server Action 레벨):
  - `source === 'PURCHASED'` → `purchaseFrom`, `purchaseDate` 필수, `batchId`, `stockId` null
  - `source === 'MILLED'` → `batchId`, `stockId` 필수
- DB CHECK 제약은 마지막 안전망. 사용자 피드백은 zod 에러 메시지로 제공
- AuditLog `entity` 값:
  - 현재: `'MillingOutputPackage'`
  - 후속 #13 리네이밍 시 `'Package'`로 변경 → 기존 로그 호환을 위해 마이그레이션 스크립트 또는 `entity IN ('MillingOutputPackage', 'Package')` 조회

## 7. revalidatePath 경로 정리

판매관리 관련 액션 추가/수정 시 호출해야 할 path:
- `/sales` (신규)
- `/packages` (제품재고, #6)
- `/statistics/output` ("판매분석")
- 잡곡 매입/포장 액션은 위 3개 모두 invalidate 필요

기존 `milling.ts`의 포장 액션은 `revalidatePath('/milling')`만 호출 → 잡곡 매입/포장 도입 시 경로 추가 보강.

---

## 8. 다음 액션 (판매관리 본 작업 시작 시)

1. 본 문서 + [plan-잡곡재고관리.md §판매관리 연동 포인트](plan-잡곡재고관리.md) 읽고 시작
2. 별도 계획서 `docs/plan-판매관리.md` 작성 — 위 §4 미결정 사항 결정 포함
3. 잡곡 #6(제품재고), #7(잡곡 포장), #8(잡곡 매입) 완료 후 진행 권장 (데이터 모델 확정된 뒤)
