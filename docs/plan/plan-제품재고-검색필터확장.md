# 계획서 — 제품재고(/packages) 검색 필터 확장

작성일: 2026-09-02

## 배경 / 목표

제품재고 검색이 **생산연도 · 품종 · 출처(잡곡) · 정렬** 4개뿐이라 원하는 재고를 좁히기 어렵다.
원물재고 탭(`/raw-stocks`)의 필터 구성을 참조해 3종을 추가한다.

| 추가 필터 | URL 파라미터 | 매칭 방식 | 노출 |
|:---|:---|:---|:---|
| 포장일자 기간 | `packedFrom`, `packedTo` | 시작·종료 각각 선택 가능(둘 다 포함) | 벼·잡곡 공통 |
| 생산자 / 농가명 | `farmerName` | 부분일치, 콤마로 다중(OR) | 벼·잡곡 공통 |
| 인증구분 | `certType` | 멀티선택(유기농/무농약/일반) | **벼 탭만** |

## 확정된 결정

- **인증은 벼 탭에만 노출** — 잡곡 매입(PURCHASED) 행은 `stock`이 없어 인증 정보 자체가 없다.
  인증 필터를 잡곡에 걸면 매입 재고가 통째로 사라져 혼란만 커지므로 UI에서 아예 뺀다.
  (액션은 파라미터가 들어오면 적용되도록 두되, 잡곡 탭 URL에는 실리지 않는다)
- **생산자 검색 범위 = 목록의 「생산자」 컬럼에 보이는 값 그대로**
  → 도정산은 `stock.farmer.name` · `stock.actualFarmer`, 매입은 `purchaseVendor`까지 OR 검색.
- **포장일자 = 목록의 「포장일자」 컬럼과 동일 기준**
  → 도정산(MILLED)은 `createdAt`, 매입(PURCHASED)은 `incomingDate`(없으면 `createdAt`).

## 변경 범위 (신규 1 + 수정 4)

### 1. `lib/package-where.ts` (신규, 순수 함수)

현재 `getPackages`와 `exportPackages`가 **where 조립을 통째로 복붙**해 두 벌 갖고 있다.
필터가 4개 더 붙으면 한쪽만 고치는 사고가 확정적이라 먼저 공용 함수로 뽑는다.

- `app/actions/packages.ts`는 `'use server'`라 동기 헬퍼를 export 할 수 없다 → `lib/`로 분리해야만 공유된다.
- `buildPackageWhere(params): Prisma.MillingOutputPackageWhereInput` 하나만 export.
- 덤으로 `packages.ts`(현재 1,275줄, 800줄 규칙 초과)의 덩치도 조금 줄어든다.

조립 규칙(기존 3개 + 신규 3개):

```
category / source / varietyId / productionYear   ← 기존 로직 그대로 이관
farmerName  → AND [ OR[ stock.farmer.name contains,
                        stock.actualFarmer contains,
                        purchaseVendor contains ] ]  (이름별 OR)
certType    → AND [ stock.farmer.group.certType in [...] ]
packedFrom/To → AND [ OR[ {source: MILLED,    createdAt: 범위},
                          {source: PURCHASED, incomingDate: 범위},
                          {source: PURCHASED, incomingDate: null, createdAt: 범위} ] ]
```

- 종료일은 **그날 포함** → 내부적으로 `lt: 종료일 + 1일`.
- 한쪽만 입력해도 동작(`gte`만/`lt`만). 날짜 형식이 깨지면 그 필터는 무시.

### 2. `app/actions/packages.ts`

- `GetPackagesParams`에 `packedFrom?` `packedTo?` `farmerName?` `certType?` 추가.
- `getPackages` · `exportPackages`의 where 조립부를 `buildPackageWhere(params)` 호출로 교체.
- 조회 결과 가공(그룹핑·정렬·가용수량)은 **손대지 않는다**.

### 3. `app/(dashboard)/packages/page.tsx`

- `RicePanelLoader` / `MiscPanelLoader`의 `filters`에 새 파라미터 4개 전달.
- 인증(`certType`)은 벼 로더에서만 읽는다(잡곡 URL엔 안 실리지만 명시적으로 차단).

### 4. `app/(dashboard)/packages/package-search-dialog.tsx`

레이아웃(기존 2열 그리드 유지):

| | 좌 | 우 |
|:--|:--|:--|
| 1행 | 생산연도 | 정렬 |
| 2행 | 품종 | **인증구분**(벼) / 출처(잡곡) |
| 3행 | **생산자 / 농가명** | — |
| 4행 | **포장일자 시작** | **포장일자 종료** |

- 상태값 4개 추가 + 기존 `useEffect` URL 동기화 · `handleApply` · `handleReset` · `activeFilterCount`에 반영.
- 생산자 입력은 원물재고와 동일하게 Enter 시 적용, 날짜는 `type="date"`(프로젝트 기존 패턴).

### 5. `app/(dashboard)/packages/active-package-filters.tsx`

- 적용된 값 배지 추가: 생산자명 / 인증 / `06-01~06-30` 형태의 기간.
- `activeFilterCount` 계산에 포함(현재 배지 영역이 개수 0이면 통째로 숨는 구조).

## 검증

- `npm run test` (신규 `lib/package-where.test.ts` — 기간 경계·매입/도정산 분기·다중 이름 OR 조립 확인)
- `tsc --noEmit`, `eslint`
- `next build`는 하지 않음(dev 서버 상시 기동)
- 화면 확인은 사용자 브라우저에서:
  - 벼 탭에 인증칸 있고 잡곡 탭엔 없는지
  - 기간 검색이 목록 「포장일자」 컬럼과 어긋나지 않는지(종료일 당일 포함)
  - 매입 잡곡이 매입처명으로 검색되는지
  - 엑셀 내려받기가 화면과 같은 범위로 나오는지
  - 초기화 후 필터 배지가 사라지는지

## 추가 요청 — 기본 생산연도 규칙 분리 (작업 중 확정)

같은 「11월 기준」 한 줄이 **7곳에 복붙**돼 있었고, 벼와 잡곡의 수확철이 다른데
한 규칙을 쓰고 있던 게 문제의 뿌리였다. `lib/production-year.ts`로 뽑아 받아쓴다.

### 새 규칙

| | 1~5월 | 6~9월 | 10~12월 |
|:---|:---|:---|:---|
| **벼** 검색 | 전년 | 전년 | 올해 + 전년 |
| **잡곡** 검색 | 전년 + 재작년 | 올해 + 전년 | 올해 + 전년 |

- 벼는 가을 한 번 수확 → 수확기(10~12월)에 두 해를 함께 본다(종전 11월 → 10월로 앞당김).
- 잡곡은 여름·가을 두 번 → 6월부터 당해년도분이 들어온다. **항상 2년분**을 본다.
  1~5월에 재작년까지 보는 건 그때 올해분이 아직 없어서다 —
  [올해, 전년]으로 두면 한 해가 늘 0건이라 사실상 1년분만 보인다.
- 등록 폼처럼 **한 해만 찍는 곳**은 별도 함수: 벼 11월 / 잡곡 6월부터 당해년도.

### 적용처 (7곳)

| 파일 | 함수 | 값 변화 |
|:---|:---|:---|
| ~~`packages/package-search-dialog.tsx`~~ | **적용 취소** (아래 재검토) | 기본값 없음 |
| `raw-stocks/stock-filters.tsx` | `defaultProductionYears('RICE')` | ✅ |
| `raw-stocks/misc/misc-stock-filters.tsx` | `defaultProductionYears('MISC_GRAIN')` | ✅ |
| `raw-stocks/misc/add-misc-stock-dialog.tsx` | `defaultProductionYear('MISC_GRAIN')` | ✅ 6월 기준 |
| `raw-stocks/add-stock-dialog.tsx` | `defaultProductionYear('RICE')` | 동일(단일 원천화) |
| `admin/farmers/add-farmer-dialog.tsx` | `defaultProductionYear('RICE')` | 동일(단일 원천화) |
| `sales/release-section.tsx` | `defaultProductionYear('RICE')` | 동일(단일 원천화) |

🔴 **`useMemo` 필수** — 기본값이 문자열에서 **배열**로 바뀌었다. 렌더마다 새 참조가 만들어져
URL 동기화 `useEffect`의 의존성에 그대로 넣으면 무한 루프에 빠진다.

### 재검토 — 제품재고는 기본 생산연도를 두지 않는다 (사용자 지적)

「작년 재고가 남았는데 목록에 안 보이면 묻힌다」. 맞는 지적이라 제품재고에서만 걷어냈다.

**판단 근거는 데이터 분포가 아니라 구조다.** 제품재고 목록은 가용 0인 행이 **이미 자동으로
빠진다**(소진분 제외). 그래서 목록에 남은 건 정의상 전부 **실재 재고**이고, 거기에 연도를
기본으로 걸면 **팔아야 할 물건이 숨는다.** 오래된 재고일수록 먼저 나가야 하는데 필터는
정확히 그걸 가린다.

원물재고는 반대다 — 도정하면 `CONSUMED`로 빠지고 작업 대상이 당해년도 위주라 기본값이
실제로 쓸모가 있다. **그래서 원물재고 벼·잡곡 탭은 그대로 둔다.**

※ 조회해 본 현재 데이터(목록 608행이 전부 2025년산)는 근거로 쓰지 않았다 —
아직 과거 데이터가 다 들어오지 않은 상태라 미래를 말해주지 못한다(사용자 지적).

## 확인 필요 / 범위 밖

- 생산자 검색은 **부분일치**라 "김"만 쳐도 다 걸린다(원물재고와 동일 동작).
- 그룹 합계·「차감된 재고 보기」 동작은 기존 그대로. 필터가 걸리면 그 범위 안에서만 집계된다.
- 잡곡 탭 인증 필터는 이번에 넣지 않는다. 매입 잡곡에 인증을 기록하려면 스키마부터 손봐야 해서 별건.
