# 잡곡 재고관리 #7 — 잡곡 포장 다이얼로그

> **상위 계획서**: [plan-잡곡재고관리.md](plan-잡곡재고관리.md) §작업 단계 #7
> **착수 전제**: #6 완료 (제품재고 페이지 `/packages` 신설, 2026-05-04 머지)
> **작성일**: 2026-05-06

---

## 1. 작업 목표

잡곡 원물재고(`Stock` where `category=MISC_GRAIN`, `status=AVAILABLE`)를 선택해 포장하면 `MillingOutputPackage`(`source=MILLED, category=MISC_GRAIN`)로 등록되는 다이얼로그를 신설한다.
**상위 계획서 §247의 단순 가정("stock 1건 = 전부 포장")을 폐기**하고 부분 포장을 정식 지원한다 — 100kg 입고를 5kg×5 + 1kg×N 식으로 여러 번 나눠 포장하는 것이 실제 운영 흐름.

---

## 2. 본 단계 범위 / 범위 밖

### 범위 내
- 잡곡 포장 다이얼로그 컴포넌트 (1개) — 양쪽 진입점에서 공유
- 진입점 ① 원물재고 잡곡 탭 행 메뉴(`...`) → "포장하기"
- 진입점 ② 제품재고 잡곡 탭 헤더 `[+ 포장하기]` 버튼 활성화 (현재 disabled)
- 부분 포장 지원 — 잔량(재고) max 검증
- 원물재고 잡곡 목록 **컬럼 정리**:
  - 수율 컬럼 제거 → 원료(kg) 셀에 밑줄 표시 + 클릭/호버 시 툴팁으로 수율 노출
  - Lot No 컬럼 폭 축소 → 짧은 뱃지(끝 4자리 형식) + 호버 툴팁으로 전체 lot 노출
  - 빈 자리에 **"재고(kg)"** 컬럼 신설 (잔량 표시)
- 그룹 헤더에 `입고 / 재고` 합계 동시 표시 (입고는 톤다운, 재고는 primary 강조)
- `Stock.status` 자동 전이 — 모두 포장 시 `AVAILABLE → CONSUMED`
- 서버 액션 `createMiscPackage` (`app/actions/packages.ts`에 추가)
- 잡곡 전용 포장단위 셋: `10kg / 5kg / 1kg / 800g / 500g / 420g + 기타`
- **제품재고 잡곡 행 수정/삭제** — `/packages` 잡곡 탭에서 행 메뉴(`...`) → 수정/삭제 (벼 행은 비활성)

### 범위 밖 (다른 단계로 이월)
- **#8**: 잡곡 매입 등록 다이얼로그 (`source=PURCHASED`)
- **#9**: 사이드바·모바일 네비 디자인 교체
- **#10**: 엑셀 import/export
- 벼 포장 행 수정/삭제 in `/packages` — 도정관리 페이지에서만 가능 (현행 정책 유지). `/packages`의 벼 행은 메뉴 비활성
- **판매 처리된 포장 행 차단**: 본 단계는 판매 기능 미구현이라 모든 잡곡 포장 행 자유 수정/삭제. #9 이후 판매 도입 시 차단 로직 필요 → **백로그 §14 신설**

### 본 단계에서 placeholder 처리할 것
- 제품재고 잡곡 탭 `[+ 매입 등록]` — 여전히 disabled (#8 머지 시 활성)
- 원물재고 잡곡 행 메뉴의 "포장하기" 항목은 `status=AVAILABLE`이고 재고 > 0일 때만 활성
- 제품재고 벼 행 메뉴 수정/삭제 — disabled + 툴팁 "도정관리 페이지에서 처리"

---

## 3. 핵심 설계 결정

### 3.1 재고(잔량) 계산 — DB 필드 추가 X, sum 계산
```ts
remainingKg = stock.weightKg - sum(MillingOutputPackage.totalWeight where stockId = stock.id)
```

- `getMiscStocks`에서 각 stock에 대해 `outputPackages: { select: { totalWeight: true } }` include로 조회 후 합산
- 별도 컬럼 추가하지 않음 — 정합성 리스크 회피 + 원자성 단순화 (포장 등록·삭제·수정 시 자동 반영)
- 재검토 트리거: 한 stock당 포장 행이 수십 건 넘어가면 GROUP BY aggregate로 전환 검토

### 3.2 status 자동 전이 (등록·수정·삭제 모두)
- **등록**: `remainingKg - totalWeight ≤ ε` (ε=0.001) 일 때 `Stock.status = 'CONSUMED'`로 전이, 그 외엔 `AVAILABLE` 유지
- **수정**: 변경 후 잔량 재계산 → `0`이면 `CONSUMED`, 양수면 `AVAILABLE`로 복원 (이전에 `CONSUMED`였더라도)
- **삭제**: 잔량 복구 → 양수가 되면 `CONSUMED → AVAILABLE`로 복원
- **음수 방지**: zod schema에서 `totalWeight ≤ remainingKg` 검증. 동시성 충돌 시 트랜잭션 내부 재검증으로 차단

### 3.3 다이얼로그 1개 + 양쪽 진입점
```
컴포넌트: app/(dashboard)/packages/misc-package-dialog.tsx (신규, 'use client')

Props:
  - open: boolean
  - onOpenChange: (o: boolean) => void
  - stockId?: number    // 진입점 ①(원물 행 메뉴): 미리 지정 → stock 선택 단계 스킵
  - varieties: Variety[]  // 정보 표시용
```

**진입점 ① (원물재고 misc-stock-list-client)**:
- 행 메뉴에 "포장하기" `DropdownMenuItem` 추가 (수정·삭제 위)
- 클릭 시 `setPackageTarget(stock.id)` + `setPackageOpen(true)`
- stock 정보(품종/생산자/남은재고)는 다이얼로그 상단에 fixed 표시, 변경 불가

**진입점 ② (제품재고 misc-package-panel)**:
- 현재 disabled 버튼을 활성화 → 클릭 시 `setPackageOpen(true)`, `stockId` prop 미전달
- 다이얼로그 1번째 단계: stock 선택 (남은재고 > 0인 AVAILABLE만 노출, Combobox)

### 3.4 잡곡 포장단위 셋 (인라인 정의)
계획서 §249·#3 정책 그대로:
```ts
const PACKAGE_TEMPLATES_MISC = [
    { label: '10kg', weight: 10 },
    { label: '5kg',  weight: 5 },
    { label: '1kg',  weight: 1 },
    { label: '800g', weight: 0.8 },
    { label: '500g', weight: 0.5 },
    { label: '420g', weight: 0.42 },
    { label: '기타', weight: 0 },  // 사용자 입력값
]
```
- 7칸 그리드 (모바일은 2열, 데스크톱은 4열)
- "기타" 선택 시 weightPerUnit 직접 입력 (kg 단위, 0.01~30 범위)
- `weightPerUnit × count = totalWeight` 자동 계산. 사용자는 weightPerUnit·count만 입력. totalWeight는 미리보기 표시

### 3.5 lotNo 처리
- 원물 stock.lotNo를 그대로 복사 (잡곡 일반 인증은 null)
- `MillingOutputPackage.lotNo = stock.lotNo` (null 가능)
- 매입품(#8)과 달리 잡곡 도정산은 lot이 있을 수 있으므로, lot 칩이 제품재고 목록에서 자연스럽게 표시됨

### 3.6 CHECK 제약 검증
- `pkg_milled_has_source`: source=MILLED → `stockId IS NOT NULL OR varietyId IS NOT NULL` (raw SQL 마이그레이션 정의 그대로). 본 단계는 stockId 채우므로 통과
- `pkg_purchased_required_fields`: source=PURCHASED → 본 단계 무관 (#8)
- batchId는 잡곡 도정산은 항상 null (잡곡은 배치 개념 없음 — `MillingBatch` 미사용). schema상 nullable이므로 OK

### 3.7 권한
- 기존 `STOCK_MANAGE` 권한 재사용 (잡곡 입고와 동일 키). 별도 `PACKAGE_MANAGE` 분리는 #9.5에서 결정 — 본 단계에서는 `STOCK_MANAGE` 가드

### 3.8 컬럼 정리 — 원물재고 잡곡 목록
**현행 13컬럼 → 13컬럼 유지** (수율 컬럼만 빠지고 재고 컬럼이 들어옴)

| 변경 전 | 변경 후 |
|---|---|
| Lot No (110px) | Lot No (60px) — 짧은 뱃지(`...A1B2`) + hover 툴팁 전체 |
| 원료(kg) (70px) | 원료(kg) (70px) — 밑줄(`underline decoration-dotted`) + hover/click 툴팁에 수율 |
| 수율 (60px) | **재고(kg) (70px)** — primary 컬러 강조, 0이면 회색 |

- **모바일 카드**: lot 뱃지·수율 표시는 현행 유지(이미 작은 뱃지 형태). 잔량 라벨만 추가 (`재고 12.5kg` 우측 상단 또는 입고중량 옆)
- 헤더 합계: 그룹 헤더 셀에 `입고 1,200 / 재고 850` 두 줄 또는 한 줄 (디자인은 #7a 구현 시 결정)

### 3.9 제품재고 행 수정/삭제 — 데이터 일관성
**범위**: 잡곡 행만(MILLED/PURCHASED 둘 다). 벼 행은 메뉴 disabled.

#### 삭제 처리
- **MILLED**: 트랜잭션 안에서 `delete(package)` → `recompute(stock.remainingKg)` → 잔량이 양수면 `Stock.status = 'AVAILABLE'`로 복원 (CONSUMED였을 경우)
- **PURCHASED**: 단순 delete (stock 참조 없음)

#### 수정 처리
- **변경 가능 필드**: `packageType`, `weightPerUnit`, `count`. `totalWeight = weightPerUnit × count` 자동 재계산
- **MILLED 수정 검증**: 같은 stock에 묶인 다른 포장 합 + 새 totalWeight ≤ stock.weightKg
- **PURCHASED 수정**: 매입처·매입일·품종도 수정 가능 (stock 영향 없음)
- 수정 후 status 재평가 — 등록·삭제와 동일 로직

#### 통계·판매 영향
- 현재 `app/actions/output-statistics.ts` 등 통계는 매번 fresh fetch라 자동 반영
- 판매 처리(미구현) 도입 후엔 "이미 판매된 행은 수정/삭제 차단" 로직 필요 → **백로그 §14 신설**

---

## 4. 변경 파일 목록 (예상)

### 신규
- `app/(dashboard)/packages/misc-package-dialog.tsx` — 다이얼로그 컴포넌트 (양쪽 진입점 공유)

### 수정 — Server Actions
- `app/actions/packages.ts`
  - `createMiscPackage(input)` — zod + 트랜잭션 (재고 재검증 → MillingOutputPackage 생성 → status 전이) + audit + revalidatePath
  - `updateMiscPackage(id, input)` — 트랜잭션 (대상 조회 → 같은 stock 내 다른 포장 합 + 새 totalWeight ≤ stock.weightKg 검증 → 업데이트 → status 재평가)
  - `deleteMiscPackage(id)` — 트랜잭션 (대상 조회 → 삭제 → MILLED면 stock status 재평가)
  - `getAvailableMiscStocks()` — 진입점 ②(stock 미지정) selector용 (`category=MISC_GRAIN, status=AVAILABLE, remainingKg > 0`)
- `app/actions/misc-stock.ts`
  - `getMiscStocks` 반환값 확장 — 각 stock에 `remainingKg` 필드 추가 (outputPackages aggregate)
  - 그룹 합계에 `remainingTotal` 필드 추가

### 수정 — UI (원물재고 잡곡)
- `misc-stock-table-row.tsx`
  - **컬럼 정리**: 수율 컬럼 제거, "재고(kg)" 컬럼 신설(primary 강조)
  - 원료(kg) 셀에 `underline decoration-dotted decoration-slate-300` + Tooltip(`수율 87.5%`)
  - Lot No 셀: 폭 60px로 축소, `...A1B2` 형식 뱃지 + Tooltip(전체 lot)
  - 모바일 카드: 잔량 라벨 추가 (입고중량 옆 또는 우측)
  - 메뉴에 "포장하기" 항목 추가 (`onPackage` prop, `disabled={!isAvailable || remainingKg <= 0}`)
- `misc-stock-list-client.tsx`
  - 헤더 컬럼 정리(수율 → 재고)
  - 그룹 헤더 셀에 `입고 / 재고` 합계 동시 표시
  - "포장하기" 메뉴 핸들러 + dialog 마운트 + state(`packageTarget`, `packageOpen`)

### 수정 — UI (제품재고)
- `app/(dashboard)/packages/misc-package-panel.tsx`
  - `[+ 포장하기]` disabled 제거, 다이얼로그 트리거로 변경
- `app/(dashboard)/packages/package-row.tsx` (또는 행 컴포넌트)
  - 잡곡 행에만 `...` 메뉴 노출 (수정/삭제). 벼 행은 disabled + 툴팁
- `app/(dashboard)/packages/` 신규 컴포넌트
  - `edit-misc-package-dialog.tsx` — 포장 수정 다이얼로그 (포장단위/규격/수량 변경)

---

## 5. 단계별 작업 (커밋 단위)

### 진행 현황 (2026-05-06)
- ✅ #7a (`3390363`)
- ✅ 제품재고 컬럼 정리 (`c12dcae`) — 본 #7 흐름에서 별도 style 커밋
- ✅ #7b (`56db3aa`)
- ✅ #7c (`afd39da`)
- 🟡 #7d — 잔여 항목 (아래 §#7d 참조)

---

### #7a — 컬럼 정리 + 재고 노출 + 액션 셸
- `getMiscStocks` 반환에 `remainingKg` 포함, 그룹에 `remainingTotal` 포함
- 원물재고 잡곡 컬럼 정리:
  - 수율 컬럼 제거 → 원료(kg) 셀에 밑줄 + 툴팁(수율)
  - Lot No 컬럼 폭 축소 + 뱃지(`...A1B2`) + 툴팁(전체)
  - "재고(kg)" 컬럼 신설
- 그룹 헤더에 `입고 / 재고` 합계
- `app/actions/packages.ts`에 `createMiscPackage` / `updateMiscPackage` / `deleteMiscPackage` skeleton (not implemented)
- 다이얼로그 트리거(원물·제품재고 양쪽) 자리만 + 클릭 시 토스트 "준비중"
- **검증**: 기존 stock의 재고가 입고중량과 동일 표시(포장 0건). 툴팁 정상 동작. 모바일 카드 정상

### #7b — 포장 등록 다이얼로그 + 본구현
- `misc-package-dialog.tsx` 본구현 — 포장단위 7칸 그리드, weightPerUnit/count 입력, totalWeight 미리보기, 재고 max 검증
- `createMiscPackage` 트랜잭션 본구현 — 재고 재계산 → MillingOutputPackage 생성 → status 전이
- 양쪽 진입점에서 다이얼로그 마운트
- 진입점 ②: `getAvailableMiscStocks` selector
- **검증**: 100kg 입고 → 5kg×3 포장 → 재고 85 → 5kg×17 포장 → 재고 0 + status CONSUMED. 제품재고 잡곡 탭에 2건 노출

### #7c — 포장 수정/삭제 다이얼로그 + 본구현
- `edit-misc-package-dialog.tsx` 본구현
- `updateMiscPackage` / `deleteMiscPackage` 트랜잭션 본구현 (status 재평가 포함)
- 제품재고 잡곡 행에 `...` 메뉴 노출, 벼 행은 disabled + 툴팁
- **검증**: CONSUMED 된 stock의 포장 1건 삭제 → status AVAILABLE 복원. 수정으로 totalWeight 늘려 stock 한계 초과 시 차단

### #7d — 권한·동시성·UX 마무리

**현재까지 진행 (#7a~c에서 자연스럽게 처리된 부분)**
- ✅ 동시성 — 트랜잭션 내부 재검증 + status 조건부 update (createMisc/update/delete 모두)
- ✅ revalidatePath 3개 경로 — `/raw-stocks`, `/packages`, `/`
- ✅ audit log — 생성·수정·삭제 모두

**잔여 항목 (다음 세션 재개 지점)**
- 🟡 모바일 다이얼로그 fit 검수
  - `misc-package-dialog.tsx` (등록), `edit-misc-package-dialog.tsx` (수정) 두 다이얼로그
  - 모바일 viewport에서 stock 카드 목록 max-h, 키보드 가림, 포장단위 그리드 2열 정상 동작 확인
  - **참고**: 백로그 §16에 벼 포장 다이얼로그 모바일 짤림 이슈 있음 — 같은 패턴 검토 필요할 수도
- 🟡 권한 정책 결정 — `STOCK_MANAGE` 단독 vs `PACKAGE_MANAGE` 분리
  - 현재 `requireSession`만 적용(잡곡 misc-stock 액션과 일관성). 명시 권한 가드는 미적용
  - 결정: **#9.5 권한 체계 정리 단계에서 일괄 처리** — 본 #7d 단독으로 권한 분리만 하면 다른 신규 화면(매입·판매)과 정책 일관성 깨질 수 있음
  - 본 #7d는 권한 정책 **확정 메모만** 본 plan에 추가 → 실제 가드 코드는 #9.5에서

**검증**: 모바일 다이얼로그 사용 시 잘림·깜빡임 없음, 키보드 입력 시 인풋이 가려지지 않음

---

## 6. 위험 요소

- **부동소수 오차**: weightKg=100, packages 합 99.9999... 등으로 status 전이가 누락될 수 있음 → ε=0.001 톨러런스 적용
- **동시성**: 두 사용자가 동일 재고를 동시에 포장 → Prisma `$transaction` 내 재계산 후 `update where: { id, status: 'AVAILABLE' }` 조건부 업데이트로 후행 차단. 단일 운영자 환경이라 우선순위 낮지만 토스트 메시지는 명확히
- **revalidate 경로**: `/raw-stocks` + `/packages` + `/` 모두 (포장 등록·수정·삭제 모두)
- **stock 자체 수정·삭제 차단(CONSUMED 시)**: 기존 misc-stock-table-row 로직이 자동 적용. 단 본 단계에서 포장 행 삭제로 status가 AVAILABLE로 복원되면 수정·삭제 다시 활성 — 의도된 동작
- **포장 수정 시 stock weightKg 한계 검증**: 같은 stock의 다른 포장 합 + 새 totalWeight ≤ stock.weightKg. 누락 시 음수 재고 발생
- **벼와 다른 흐름**: 벼는 `/milling`에서 배치 단위 포장. 잡곡은 stock 단위 직접 포장 — 다이얼로그 헤더에 "잡곡 포장" 명시
- **재고 컬럼 vs 페이지 타이틀 중복감**: 페이지가 "원물재고"인데 컬럼도 "재고" — 시각 구분(입고는 회색, 재고는 primary)으로 해소
- **Lot 뱃지 끝 4자리 충돌**: 동일 prefix + 동일 끝 4자리는 거의 없지만, 그룹 헤더 펼침 시 한 그룹 안에 같은 끝 4자리가 보일 가능성 → 호버 툴팁이 fallback. 컬럼 정렬·식별엔 영향 없음
- **다이얼로그 사이즈**: 진입점 ②는 stock 선택 단계가 추가되므로 1단 기본보다 키 큰 다이얼로그. 모바일 dvh 확인
- **판매 처리 도입 시 차단 누락**: 본 단계는 판매 미구현이라 OK. #9 이후 도입 시 백로그 §14 처리

---

## 7. 검증 시나리오 (수동)

1. **단순 1회 포장**: 보리 50kg → 5kg×10 → 재고 0, status CONSUMED, 제품재고 잡곡에 1건
2. **부분 포장(2회)**: 통밀 100kg → 5kg×4(20kg) → 재고 80, AVAILABLE → 1kg×80 → 재고 0, CONSUMED
3. **부분 포장(혼합 규격)**: 검정보리 30kg → 1kg×10 + 500g×20 + 420g×23 → 재고 0 (ε 내)
4. **초과 입력 차단**: 재고 5kg에서 5kg×2 입력 시 에러
5. **status 전이**: 재고 0 후 행이 "소진됨"으로, stock 수정·삭제·포장 모두 비활성
6. **두 진입점 일관성**: 원물 행 메뉴 ↔ 제품재고 헤더 버튼 동일 결과
7. **포장 삭제 → status 복원**: CONSUMED 된 stock의 포장 1건 삭제 → 재고 양수 → AVAILABLE 복원, stock 수정 다시 활성
8. **포장 수정**: 5kg×4(20kg) → 5kg×2(10kg)로 수정 → stock 재고 +10kg 복원
9. **포장 수정 한계 초과 차단**: stock weightKg=100, 다른 포장 합 80 → 새 포장을 25kg로 수정 시도 → 에러
10. **벼 행은 수정/삭제 비활성**: `/packages` 벼 탭의 행 메뉴는 비활성 + 툴팁
11. **컬럼 툴팁**: 원료(kg) 호버 시 수율 / Lot 뱃지 호버 시 전체 lot
12. **그룹 헤더 합계**: `입고 1,200 / 재고 850` 같이 표시
13. **권한**: STOCK_MANAGE 없는 계정은 메뉴·버튼 비노출
14. **모바일**: 다이얼로그 높이·키보드 가림·포장단위 그리드 2열

---

## 8. 다음 단계 예고 (#8)

- 잡곡 매입 등록 다이얼로그 — `source=PURCHASED, batchId=null, stockId=null, varietyId 직접 지정`
- 매입처 자동완성 (`getPurchaseVendors` 이미 구현됨)
- 로트번호 생성 안 함
- 본 단계의 다이얼로그 구조와 분리 (트리거·필드 셋 다름) — 별도 컴포넌트

---

## 부록: 본 단계 범위에서 제외된 항목

### 비판매 차감 (증정/분실/파손) — 백로그 §14
- 사용자 요청(2026-05-06): 정상 판매가 아닌 사유로 포장 수량 차감 (stock 미복원)
- 결정: **판매처리(#9 이후)와 같은 흐름으로 통합 설계**. 본질이 동일(포장 수량 차감 + 사유)이라 일반화 모델 추천
- 본 #7c는 정정 용도의 수정/삭제(stock 복원)까지만 다룸. 차감(stock 미복원)은 별도
