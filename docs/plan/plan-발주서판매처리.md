# 계획서(초안): 발주서 업로드 → 제품재고 차감 → 판매관리

> **상태: 작성 중 (결정 #1~#25 확정 — 도메인 정책결정 + 품목명↔품종 매칭 전략 + 금액 정책 완료. 블로커 해제. 서버액션·단계설계 미작성. UI 세부는 Claude Design 위임)**
> 2026-06-05 1차 작성. 2026-06-08 결정 #6~#12(포장지 마스터/매핑/매칭, 건/라인 단위, 저장 3계층), #13~#18(탭=제품판매/원물출고, 권한 역할분리, 업로드 즉시적재, 중복경고, 차감취소=하드삭제, 매칭실패=수동), #19~#21(차감모델 PackageMovement 통합·단일 type enum, 진입점 3개+화면 분리, 포장지 빈칸=기본포장지) 추가. #9·#9.5 정합성 확인(§3.8), 발주서.xlsx 실측(§2.1).
> **2026-06-09 품목명↔품종 매칭 블로커 해소**(미팅 정정 반영): 발주서 18종 ↔ DB 품종 실데이터 대조 완료(§6.1.1). 도메인 사실 — 가바=서농 가바미 통칭. 가바백미/현미=서농22호(단순도정) / 가바흑미=흑미(id18 잡곡) / 가바발아현미=발아현미(id47 잡곡) / 천지향=천지향1세 / 찹쌀=백옥찰. 결정 #5 번복(정규화+별칭), #1 보강(도정유형 매칭키, 흑미·발아현미 제외), #22(별칭=`Variety.aliases`), #23(파이프라인), #24(가공형태 이분+서농24호 RICE 환원). ⚠️박태일 서농24호≠오점기 흑미(별개 품종).
> **2026-06-15 설계 전환 — 포장지 마스터 → 제품유형(ProductType/SKU) 카탈로그로 격상**(사용자 제안 + 적대적 점검): 발주서 매칭 4키(품종+도정+규격+포장지)가 4개 테이블에 흩어진 산만함을 **단일 SKU 엔티티로 정규화**. `ProductType(varietyId, millingType, packageType, packagingId)` `@@unique` 신설 → 매칭=`WHERE productTypeId=X` 1:1. `PackagingMapping` 폐기(기본 포장지=`ProductType.isDefault`). **3경로(도정산·잡곡포장·잡곡매입) 전부 연동 + find-or-create**(매입잡곡도 포함 → 향후 발주서 매입품 리스크 해소). `source`는 SKU에 없음 → 위탁분·매입분 동일 SKU 공유(통합 FIFO). NULL 유니크 구멍 방지: `millingType` NOT NULL(잡곡=`''`), `packagingId` NOT NULL('미지정' sentinel 행). `productCode`는 SKU 미귀속(파생 유지). → 결정 #1·#6·#7·#23 갱신, §8.1 분리(아래). 구현 계획서: [plan-제품유형마스터.md](plan-제품유형마스터.md).
> **다음 세션:** 설계 — 엑셀 파싱 상세 + Server Actions 목록 + 개별판매 입력필드 + 단계별 구현순서. UI 세부는 Claude Design 핸드오프. 설계 완료 → 승인 → 구현(**제품유형 마스터가 선행 1순위**, 별도 계획서 승인 대기). ⚠️구현 전 후속확인: §6.1.1 끝(가바발아현미/흑미 재고 적재 후 검증) + §6.2(서농24호 RICE 환원, lot코드 정합성) — 둘 다 발주서 매칭 본구현과 병행/선행 데이터 정리.

## 1. 작업 목표 / 비즈니스 흐름

통합 발주서(엑셀)를 업로드하면 품목·규격별로 **제품재고(완제품 포장)**에서 차감해 판매처리하고, 그 내역을 **판매관리(/sales)** 메뉴에서 관리한다.

1. 영업 담당(`SALES_MANAGE`)이 통합 발주서 엑셀을 작성해 업로드
2. 포장 담당이 내용 확인 → 규격별 재고 파악 → 자동매칭 / 재고부족 해결
3. 발주서 건별 처리 완료 시 제품재고 차감
4. 완료 건은 엑셀 다운로드 시 **생산자명 + 로트번호가 채워진 상태**

### 1.1 제품재고 차감은 3경로 (결정 #19·#20 — 백로그 §14 통합)
발주서는 차감의 **한 경로(일괄)**일 뿐. 제품재고(`MillingOutputPackage`) 차감을 단일 모델(`PackageMovement`)로 일반화한다.
- **발주서 일괄**: 위 흐름 (type=SALE, 발주서 라인 연결)
- **개별 판매등록**: 발주서 없이 건별 수동 판매 (type=SALE). 제품판매 탭 + **제품재고 목록(`/packages`) 행**에서 진입
- **비판매 차감**: 증정/분실/파손/기타 (type=GIFT|LOST|DAMAGED|OTHER). 제품재고 목록 행에서 진입. ⚠️원물(stock) 복원 안 함
- 판매등록 화면과 비판매차감 화면은 **분리**(결정 #20). 모델만 하나로 통합.

## 2. 발주서 엑셀 구조 분석 (docs/resources/발주서.xlsx)

- **2차원 매트릭스(피벗) 양식**. 시트가 거래처 유형별로 분리: `발주서(택배)`, `발주서 (이마트)`
- **가로축(열) = 제품규격**, 4줄 헤더:
  - 행0: 품목명 (`유기농\n천지향5세`, `유기농\n찹쌀`, `프로틴\n라이스\nIPS` …) — **병합셀**이라 그룹 첫 칸에만 표시
  - 행1: 농가명 — **비어있음** (= 포장담당이 매칭하면 채워질 칸)
  - 행2: 포장지 (`자연주의`, `아이담쌀`, `PET` …)
  - 행3: 중량 (`10kg`, `1kg`, `5kg`, `420g` …)
  - 행4: (택배)소계
- **세로축(행, 행5~) = 발주처/수령인**
  - 택배 시트: `(발주처)` `(수령인)` 2열
  - 이마트 시트: `이마트` + `여주/대구/시화` 형태
- **셀 값 = 주문 수량(개수)**, 빈 셀 = 주문 없음
- 업로드 시점엔 농가명/로트 빈칸 → 처리 완료 후 다운로드 시 채워짐

### 2.1 실측 결과 (2026-06-08, xlsx raw 셀 파싱 — 행 인덱스 0-base)
실제 파일 파싱으로 확인된 정확한 구조. `xlsx`(SheetJS)의 `sheet_to_json`은 병합셀/4줄헤더 못 다룸 → **raw 셀 좌표 접근**(`ws['C1'].v`)+`ws['!merges']` 병합 펼치기로 파싱해야 함.
- **시트 2개**: `발주서(택배)`(A1:AJ30, 규격 34열), `발주서 (이마트)`(A1:I8, 규격 7열). 시트명에 '이마트' 포함 여부로 channel 판별.
- **좌측 라벨 열(A) = 행 식별 키**: r1=품목명행(라벨없음), `A2='농가명'`, `A3='포장지'`, `A4='중량'`, `A5='택배 소계'`, `A6='(발주처)'/B6='(수령인)'`. → A열 라벨로 헤더 4줄·소계·데이터시작 위치 자동 탐지(행 위치 하드코딩 회피).
- **규격 열 시작 = C열**(택배: A=발주처·B=수령인 / 이마트: A='이마트'고정·B=지점). 이마트는 r6~r8에 `이마트/여주`·`이마트/대구`·`이마트/시화` **이미 채워진 고정 발주처**.
- **r0 품목명 = 병합셀**(예 `D1:F1`=찹쌀 3규격, `G1:K1`=천지향 5규격). 병합 범위 첫 칸에만 값 → `!merges`로 펼쳐 각 규격 열에 품목명 채움.
- **r2 포장지 = 띄엄띄엄**(병합 아님). **포장지 없는 규격 다수**(천지향5세 10kg 등엔 포장지 칸 빔) → 빈칸은 품종×중량 **기본 포장지로 간주**(결정 #21).
- **r3 중량 = 모든 규격 칸에 존재**. r4 소계행은 데이터 아님(무시).
- **줄바꿈 = CRLF(`\r\n`)** — 품목명 정규화 시 `\r`까지 제거(`/[\r\n]+/g`).
- ✅**핵심 난점 — 품목명↔품종 매칭 = 2026-06-09 해소**(§6.1.1 실데이터 대조 + 미팅 정정): 발주서 품목은 `유기농 천지향5세`, `유기농 가바백미/가바현미/가바발아현미/가바흑미`, `유기농 천지향5세 오분도미`(이마트), `프로틴 라이스 IPS`, `자스민 라이스 CJ6`, `유기농 찰보리` 등. DB 품종명과 **그대로는 0% 매칭**: ①`유기농`·`프로틴 라이스`·`자스민 라이스` 접두 ②가공형태(백미/현미/오분도미=단순도정 vs 흑미/발아현미=위탁가공 별도잡곡품종)가 품목명에 결합 ③현장통칭(가바/천지향/찹쌀)이 행정품종명(서농22호/천지향1세/백옥찰)과 문자유사성 0. → **정규화(접두·도정유형 분리)로 15종 자동 + 별칭(`Variety.aliases`)으로 4종 + 도정유형 매칭키 추가 + 가공형태 이분**(결정 #5 번복·#1 보강·#22·#23·#24).

## 3. 기존 코드베이스 분석 (조사 완료)

### 3.1 제품재고 = `MillingOutputPackage` (prisma/schema.prisma:133)
- `source`(MILLED|PURCHASED), `category`(RICE|MISC_GRAIN)
- MILLED: `batchId`/`stockId` (도정산, stock 1:1 매핑 → 생산자·로트가 stock 기준)
- PURCHASED: `varietyId`/`purchaseVendor`/`incomingDate` (잡곡 외부매입)
- 포장정보: `packageType`(중량 문자열), `weightPerUnit`, `count`(=재고 개수), `totalWeight`
- `productCode`, `lotNo` (PURCHASED는 null, MILLED는 stock.lotNo 복사)
- **포장지(브랜드) 필드는 없음** ← 발주서의 포장지와 간극

### 3.2 생산자/로트 정보 경로
- MILLED: `package.stock.farmer.name`(생산자) / `package.lotNo ?? package.stock.lotNo`(로트) / 작목반은 `stock.farmer.group`
- PURCHASED: `package.purchaseVendor` / 로트 없음

### 3.3 차감(소비)은 "직접 빼기"가 아니라 **"합으로 잔량 계산"** 패턴
- 잡곡 포장(`createMiscPackage`)은 stock에서 차감하지 않고, 포장 레코드를 **생성**한 뒤 `stock.weightKg - SUM(outputPackages.totalWeight)`로 잔량을 산출
- 동시성 가드: `status='AVAILABLE'` 조건부 `updateMany`
- → **판매 차감도 같은 철학으로**: 가용수량 = `package.count - SUM(판매배분.qty)`

### 3.4 판매처리는 이미 "#9 작업"으로 예약돼 있음 (중요)
- `getPackages` (packages.ts:101-113): **1달 이전 도정산(MILLED)은 제품재고 화면에서 임시 제외** 중. 주석: *"판매처리 도입(#9 이후) 시 이 블록 제거"*
- `deleteMiscPackage` (packages.ts:607): *"비판매 차감(증정/분실/파손)은 백로그 §14, #9 판매처리와 통합 설계"*
- `exportPackages` (packages.ts:988~): json_to_sheet → base64 → recordAuditLog(EXPORT) 패턴. 다운로드 출력 참고 모델
- 관련 기존 계획서: `docs/plan/plan-잡곡재고관리-#9.md`, `#9.5.md` (✅ 2026-06-08 확인 완료 → 아래 §3.8)

### 3.8 #9 / #9.5 정합성 확인 결과 (2026-06-08, 선행 인프라 = 전부 재사용)
- **`/sales` 라우트 = 이미 존재** (#9a). 현재 벼/잡곡/출고 3탭 쉘, 벼·잡곡은 `coming-soon-panel.tsx` "준비중" **빈 placeholder**(기능 없음 → 제거해도 무손실). → 발주서 탭은 이 쉘에 붙인다.
- **`SALES_MANAGE` 권한 = 이미 신설** (#9.5). #9.5 정의가 *"출고 + **향후 벼/잡곡 판매** 등록/수정/삭제"* → 발주서 판매처리가 바로 그 "향후 판매"의 본 구현. 신규 권한 키 안 만들고 재사용.
- **`docs/permission-matrix.md` = 권한 단일 진실 원천** (#9.5 신설). 발주서 관련 권한 매핑도 여기 등록해야 함.
- **#9 비범위 명시**: *"벼/잡곡 판매 탭 본 구현 — 별도 계획"* → 본 계획서가 그 자리를 채움.
- revalidate 경로 `/sales`, 브레드크럼 `?tab=` 파싱 로직 기존 재사용 가능.

### 3.5 출고(StockRelease)와는 별개 도메인
- 기존 출고 = 원물(Stock) 차감 (release.ts `createStockRelease`)
- 발주서 판매처리 = 제품재고(MillingOutputPackage) 차감 → 새 도메인

### 3.6 판매관리 화면 = app/(dashboard)/sales/
- `page.tsx`: 탭 분기 (`release` 구현 / `rice`·`misc` 준비중 ComingSoonPanel)
- `sales-tabs.tsx`: 탭 정의(`TABS` 배열, value: rice/misc/release, badge '준비중')
- release/ 하위에 구현 패턴 참고용 컴포넌트 다수 (filters, history-list, excel-button, mobile-card, edit-dialog)

### 3.7 공통 인프라
- 엑셀: 가져오기 `app/actions/excel.ts`(FormData→XLSX.read→Zod→DB), 내보내기 base64 패턴
- 파일검증: `lib/file-validation.ts` (10MB, .xlsx/.xls, MIME)
- 권한: `lib/auth-guard.ts` `requirePermission('SALES_MANAGE')`, `docs/permission-matrix.md`
- 감사로그: `lib/audit.ts` `recordAuditLog`
- 에러: `lib/error-sanitize.ts` `sanitizeErrorMessage`
- 메뉴: 판매관리(/sales) 이미 desktop-sidebar / mobile-nav 등록됨

## 4. 확정된 설계 결정 (사용자 승인 완료)

| # | 항목 | 결정 |
|---|------|------|
| 1 | 재고 매칭 키 | **품종 + 도정유형 + 중량(packageType) + 포장지** (4키). (2026-06-08 포장지 추가 / 2026-06-09 도정유형 추가: 가바백미·현미가 같은 서농22호의 다른 도정이라 재고 구분에 도정유형 필수. 제품재고는 `batch.millingType`[MILLED]에서, 발주서는 품목명 접미 파싱에서 추출해 대조.) **⚠️도정유형 분리 대상 = 백미/현미/오분도미/칠분도미만. '흑미'·'발아현미'는 제외** — 둘 다 단순도정이 아니라 위탁가공 거쳐 별도 잡곡품종으로 입고됨(가바흑미→흑미 id18, 가바발아현미→발아현미 id47). 도정 아닌 품종 식별 토큰으로 취급(#23·#24). |
| 2 | 포장지 | **제품재고(`MillingOutputPackage`)의 정식 속성으로 승격** — 포장 등록 단계부터 입력받아 발주서 매칭에 사용. (2026-06-08 변경: 기존 '발주 라인 기록만' → 정식 매칭 키로) |
| 3 | 자동매칭 | **FIFO(오래된 도정/입고분부터) 자동추천 + 포장담당이 로트 수동 변경 가능** |
| 4 | 재고부족 | **부분처리 + 부족분 표시**. 발주서는 '부분완료' 상태로 남아 추후 보충 |
| 5 | 품목명 매칭 | ~~별칭 없는 정규화 정확일치~~ **(2026-06-09 번복)** → **정규화 + 별칭 하이브리드**. 실데이터 대조(§6.1.1) 결과 순수 정규화는 18종 중 15종만 커버, 현장통칭 3종(가바/천지향/찹쌀)은 행정품종명과 문자유사성 0이라 규칙으로 도달 불가 → **별칭 도입 불가피**. ①정규화로 접두(`유기농`·`프로틴 라이스`·`자스민 라이스`)·도정유형 접미 분리 후 `Variety.name` 정확일치 ②잔여는 `Variety.aliases` 조회(#22) ③실패는 포장담당 수동지정(#18). 2026-06-09 결정 |
| 6 | 포장지 데이터 형태 | **포장지 마스터 테이블** (자유 텍스트/상수 아님). 2026-06-08 결정 |
| 7 | 마스터 구조 | **품종×중량 → 허용 포장지 매핑(기본값 지정)** 구조. 포장 등록 시 해당 조합의 기본 포장지 자동 추천. 2026-06-08 결정 |
| 8 | 매핑 강제성 | **자동추천용(강제 아님)**. 포장 등록 시 기본 포장지 자동 선택되되, 전체 포장지 목록에서 다른 것도 자유 선택 가능. 2026-06-08 결정 |
| 9 | 포장지 발주서 매칭 | **정확일치(품종과 동일)**. 품종+중량+포장지 3키 모두 일치해야 자동매칭. 포장지 불일치는 매칭 실패 → 포장담당 수동 해결. 2026-06-08 결정 |
| 10 | 기존 재고 백필 | **기본 포장지로 일괄 백필**. 마이그레이션 시 각 재고의 품종×중량 기본 포장지를 자동 주입. 선행조건: 매핑 마스터 사전 정비(기본값 누락 조합은 백필 불가 → 별도 점검). 2026-06-08 결정 |
| 11 | 발주서 건 단위 | **발주처+수령인 1행 = 1건**. 완료·부분완료 상태가 배송행 단위로 돈다(`PurchaseOrder` 1행=1건). 2026-06-08 결정 |
| 12 | 차감·완료 판정 단위 | **`PurchaseOrderItem`(라인) 단위**. 충분한 라인은 즉시 차감 확정, 부족 라인은 미결로 남아 건은 `PARTIAL`. 추후 보충 시 잔여 차감. 차감 *기록*은 `SalesAllocation`(로트별), *판정*은 라인. `PurchaseOrder.status`는 라인 집계 파생값(전부 차감=COMPLETED/일부=PARTIAL/없음=PENDING). UX는 '건 단위 처리 버튼 + 라인별 부분성공' 방향(UI 단계 확정). 2026-06-08 결정 |
| 13 | `/sales` 탭 구조 | **제품판매 / 원물출고 2탭**. #9이 깔아둔 벼·잡곡 "준비중" placeholder 탭은 **제거**(빈 껍데기라 무손실). 발주서가 벼+잡곡을 한 매트릭스에 다 담으므로 분리 불필요. (2026-06-08 라벨 확정: "발주서"→**제품판매**=제품재고 `MillingOutputPackage` 차감 / "출고"→**원물출고**=원물 `Stock` 차감. 탭 이름이 두 도메인 구분을 그대로 드러냄, §3.5 참조. 발주서는 제품판매 탭의 입력수단일 뿐, 향후 직접판매도 같은 탭에 흡수.) 2026-06-08 결정 |
| 14 | 권한 역할 분리 | **업로드/수정/삭제 = `SALES_MANAGE`** (영업담당) · **조회 = 가드 없음**(누구나) · **매칭/차감/처리 = `MILLING_MANAGE`** (포장담당). §2 흐름(영업 업로드 → 포장 매칭)과 일치. `permission-matrix.md`에 등록. 2026-06-08 결정 |
| 15 | 업로드 시점 적재 | **업로드 즉시 파싱 → DB 적재**. 올리는 순간 `PurchaseOrder`/`PurchaseOrderItem` 생성(status=PENDING), 매칭은 그 위에서 진행. 미리보기-확정 2단계 아님. 잘못 올린 건 삭제로 처리. 2026-06-08 결정 |
| 16 | 재업로드 중복 | **중복 감지 후 경고**. 업로드 시 기존 데이터와 키(파일명/발주날짜+발주처+수령인 조합) 대조 → 중복 가능성 있으면 경고 + 진행 여부 확인. 강제 차단 아님(사용자 확정 시 적재). 이중차감 사고 방지 목적. 2026-06-08 결정 |
| 17 | 차감 취소/되돌리기 | **하드 삭제**. `SalesAllocation` 레코드 자체를 삭제 → 가용수량(`count - SUM(allocation)`) 자동 복원, 라인 status 재계산(→PENDING/PARTIAL), 건 status 파생 갱신. ⚠️ 하드 삭제라 레코드 이력이 안 남으므로 **차감·취소 시 `recordAuditLog`로 감사로그 필수 기록**(보완책). 기존 `cancelStockRelease`와 패턴은 다름(그쪽은 soft). 2026-06-08 결정 |
| 18 | 매칭 실패 처리 | **포장담당 수동 해결**(결정 #5 연장). 품종명/포장지 불일치 라인은 '매칭실패' 표시 → 포장담당이 상세에서 수동으로 품종·로트 지정. 업로드 자체는 막지 않음. 해당 건은 PARTIAL/PENDING로 남아 추후 해결. 2026-06-08 결정 |
| 19 | 차감 모델 통합 | **`SalesAllocation` → `PackageMovement`로 일반화**(백로그 §14 추천 모델 채택). 제품재고 차감을 **단일 모델**로: **`type` 단일 enum = SALE\|GIFT\|LOST\|DAMAGED\|OTHER** + `orderItemId?`(발주서 경로만, 개별판매·비판매차감은 null). (2026-06-08 변경: `type`+`reason` 2필드 → **1필드 통합**. 판매=SALE, 나머지=비판매 차감 사유. nullable·무효조합 제거, 백로그 §14 '판매도 사유의 하나' 표현과 일치.) 매출/손실 구분 = `type==='SALE'`. 세 경로가 한 테이블, 가용수량 = `count - SUM(movement.count)` 단일 계산. ⚠️비판매도 stock(원물) 복원 안 함(백로그 §14). 2026-06-08 결정 |
| 20 | 차감 진입점·UX | **진입점 3개**: ①발주서 일괄(제품판매 탭) ②개별 판매등록(제품판매 탭 + **제품재고 목록 `/packages` 행**) ③비판매 차감(제품재고 목록 행). **판매등록 화면과 비판매차감 화면은 분리**(통합 단일화면 아님): 판매=거래처·수량·로트, 비판매차감=사유·메모·수량·로트. 모델은 #19로 통합돼도 입력 화면은 둘. 2026-06-08 결정 |
| 21 | 포장지 빈칸 규격 | **기본 포장지로 간주**. 발주서에서 포장지 칸이 빈 규격(실측상 다수)은 해당 **품종×중량의 기본 포장지**(`PackagingMapping.isDefault`, 결정 #7·#10)를 적용해 매칭. 결정 #9(포장지 정확일치)의 보완 규칙. 2026-06-08 결정 |
| 22 | 품종 별칭 모델 | **`Variety.aliases String[] @default([])` 필드 추가**(별도 `VarietyAlias` 테이블 아님 — 사용자 결정 "품종 테이블에 별칭 필드 하나"). Postgres 배열이라 품종당 별칭 N개 수용. 초기값: **서농22호=`['가바']`**(가바백미/현미는 도정유형으로 분리되므로 통칭 1개), **흑미=`['가바흑미']`**(id18, 도정 분리 안 하고 구 전체를 별칭으로), **발아현미=`['가바발아현미']`**(id47, 위탁가공품), 천지향1세=`['천지향']`, 백옥찰=`['찹쌀']`. 매칭 실패 수동지정(#18) 시 `aliases`에 append하는 **학습형** 운영 권장. **도메인 사실(2026-06-09 미팅 확정)**: '가바'=서농 계열 가바미 통칭. 가바백미/현미=**서농22호**(단순도정, RICE 도정산) / 가바발아현미=**발아현미(id47)**(서농22호 현미를 발아위탁 가공→잡곡 입고) / 가바흑미=**흑미(id18, 잡곡)**(발주서는 '흑미'로 표기·관리). ⚠️**박태일 서농24호 ≠ 오점기 흑미**(둘 다 흑미 계통이나 별개 품종). 서농24호는 **원물출고 RICE 품종**으로 별도 정리(§6.2), 발주서·가바흑미와 무관. 2026-06-09 결정 |
| 23 | 매칭 파이프라인 | **3단계**: ①**정규화** — CRLF·공백 제거, 인증/브랜드 접두 분리(`유기농`·`프로틴 라이스`·`자스민 라이스`), 도정유형 접미 분리(**백미/현미/오분도미/칠분도미** — ⚠️'흑미'·'발아현미' 제외[#1·#24])로 (품종토큰, 도정유형) 분해 ②**품종 해석** — 잔여 토큰으로 `Variety.name` 정확일치 → 실패 시 `Variety.aliases.has(토큰)` 조회(가바흑미·가바발아현미처럼 도정 미분리 구 전체도 여기서 매칭) ③**재고 매칭** — (품종+도정유형+중량+포장지) 4키(결정 #1)로 `MillingOutputPackage` FIFO 매칭(결정 #3). 어느 단계든 실패 시 라인=매칭실패 → 포장담당 수동(#18). 2026-06-09 결정 |
| 24 | 가공형태 이분 + 흑미/서농24호 분리 | **발주서 가공형태를 2분류**(2026-06-09 미팅): **(a) 단순도정**(백미/현미/오분도미/칠분도미) = 원품종 유지 + 도정유형 매칭키(#1) / **(b) 위탁가공→별도 잡곡품종**(흑미·발아현미) = 원품종과 무관하게 잡곡 품종으로 통째 매칭(도정 분리 안 함). 가바흑미→흑미(id18), 가바발아현미→발아현미(id47). 근거: 위탁가공품은 시스템상 잡곡으로 입고처리·판매되는 게 업무흐름과 자연스러움(원물 stock과 분리). **⚠️부수 데이터 정리(발주서 범위 밖, §6.2)**: 박태일 서농24호(흑미 계통이나 가바흑미와 별개 품종)는 과거 RICE→현재 MISC_GRAIN으로 잘못 전환됨 → **원물출고 RICE 품종으로 환원**(stock 10건 이미 RICE/RELEASED라 재고목록 영향 0, 잡곡 품종 드롭다운에서만 빠짐. type 정합성[흑미계통이면 BLACK?] 환원 시 확인). 2026-06-09 결정 |
| 25 | 판매 금액 비관리 | **수량 차감만, 금액(단가·매출액) 미관리**. `PackageMovement`에 unitPrice/amount 필드 두지 않음. 본 시스템은 **재고 정확성**에 집중하고 매출 정산은 외부(회계)에서. 발주서가 수량 중심(금액 없음, §2.1)인 흐름과 일관. 개별판매·비판매차감도 금액 없이 수량·거래처·로트만. (향후 매출 집계 필요 시 별도 확장 — 현재 범위 밖.) 2026-06-09 결정 |

## 5. 잠정 도메인 모델 설계 (검토 중)

```
# 품종 별칭 (2026-06-09 신규 결정 #22) — 현장통칭 → 행정품종명 매칭
Variety += aliases String[] @default([])
  - 서농22호=['가바'], 흑미=['가바흑미'], 발아현미=['가바발아현미'], 천지향1세=['천지향'], 백옥찰=['찹쌀']  (초기 시드)
  - 가바=서농 가바미 통칭. 가바백미/현미=서농22호(단순도정) / 가바흑미=흑미(id18 잡곡) / 가바발아현미=발아현미(id47 잡곡) — 흑미·발아현미는 위탁가공 별도품종이라 도정분리 안 하고 통째 별칭(#24)
  - 매칭: 정규화(흑미·발아현미는 도정분리 제외) 후 name 정확일치 실패 시 aliases.has(토큰) 조회
  - 수동매칭(#18) 시 append로 학습. 별도 테이블 없이 Variety에 직접

# 포장지 마스터 (2026-06-08 신규 결정)
Packaging            (포장지 마스터)
  - name (자연주의 | 아이담쌀 | PET …), active
PackagingMapping     (품종×중량 → 허용 포장지)
  - varietyId, packageType(중량), packagingId, isDefault
  - 포장 등록 시 isDefault 자동 추천. 강제 아님(전체 목록 자유선택)
MillingOutputPackage += packagingId?  (포장지 — 포장 등록 단계부터 입력, FIFO 매칭 키)
  - 매핑 밖 값도 허용되므로 nullable + 자유선택 가능
  - 기존 레코드는 packagingId=null → 마이그레이션/백필 전략 별도 결정 필요

# 발주서 도메인 — 저장 단위는 3계층 (엑셀 매트릭스 대응)
#   엑셀 행(발주처+수령인) → PurchaseOrder      (1건)
#   엑셀 셀(행 × 규격열)   → PurchaseOrderItem  (품종+중량+포장지 1조합 + 주문수량)  ← "품종·중량 단위"
#   item을 실제 차감한 로트 → PackageMovement    (item 1개 → 로트 N개 분할 가능, type=SALE)
#   ⇒ 한 건에 품목 라인 여러 개. 차감 판정=라인 단위, 차감 기록=로트별 배분 (결정 #12)
PurchaseOrder        (주문 1건 = 발주처 + 수령인 = 엑셀 한 행)
  - orderDate, channel(택배|이마트), vendor(발주처), recipient(수령인)
  - status: PENDING | PARTIAL | COMPLETED  ← 라인 집계 파생값(별도 수기관리 X)
  - uploadBatchId? (업로드 묶음, 선택)
PurchaseOrderItem    (품목 라인 = 엑셀 셀 1개 = 품종+도정유형+중량+포장지 1조합)
  - orderId, rawItemName(원본 품목명), varietyId(매칭 결과)
  - millingType?(도정유형 — 매칭 키, 결정 #1·#23. ⚠️단순도정만: 백미/현미/오분도미/칠분도미.
        위탁가공품[흑미·발아현미]은 null = 도정유형 매칭 제외[#24]. 제품재고 측 도정유형은
        batch.millingType[MILLED]에서 읽고, 잡곡 PURCHASED는 batch 없어 자연히 null → 양측 null로 일치)
  - packagingId(포장지 — 매칭 키, 결정 #9), packageType(중량), orderedQty(주문수량)
  - 라인별 진행: orderedQty vs SUM(movement.count where orderItemId=this) → 충족/부분/미결 판정

# 제품재고 차감 통합 모델 (결정 #19 — 백로그 §14 추천 PackageMovement 채택)
#   발주서 일괄 / 개별 판매 / 비판매 차감 = 모두 "MillingOutputPackage에서 N개 차감"
PackageMovement      (제품재고 차감 — 세 경로 단일 테이블)
  - packageId(MillingOutputPackage), count(차감 개수)
  - type: SALE | GIFT | LOST | DAMAGED | OTHER       ← 단일 enum (판매=SALE, 나머지=비판매 차감 사유)
                                                        type+reason 2필드 통합 → 무효조합·nullable 제거
  - orderItemId?: PurchaseOrderItem                 (발주서 경로만, 개별판매·비판매차감은 null)
  - customer?(개별판매 거래처 등), note?, occurredAt
  - ※ 금액(단가·매출액) 필드 없음 — 수량 차감만, 매출 정산은 외부 회계(결정 #25)
  - → 가용재고 = package.count - SUM(movement.count)  ← 경로 무관 단일 계산
  - 매출/손실 구분 = (type === 'SALE'). 생산자·로트는 packageId로 추적
  - ⚠️비판매(SALE 외)도 stock(원물) 복원 안 함(백로그 §14)
  - 차감 취소(결정 #17) = 레코드 하드 삭제 → 가용수량 자동 복원 + recordAuditLog 기록
```

- **차감 방식**: `count` 직접 감소(이력X, 위험) vs **PackageMovement 합산(채택 — 기존 잡곡포장 패턴 일관, 부분처리·취소·이력·다경로 자연스러움)**
- `getPackages` 1달 cutoff(백로그 §13)는 PackageMovement 도입 후 "가용수량 0 제외"로 대체 → 임시 블록 제거
- 진입점 3개·판매/차감 화면 분리는 결정 #20 참조

## 6. 남은 결정/설계 항목 (다음 세션)

### 6.0 포장지 마스터 (결정 완료 → 구현 작업으로 전환, 2026-06-08)
- [ ] `Packaging`, `PackagingMapping` 모델 + `MillingOutputPackage.packagingId?` 마이그레이션
- [ ] 포장지 마스터/매핑 관리 화면 (목록·기본값 지정)
- [ ] 포장 등록 화면 3곳 포장지 입력 추가: 도정산 [add-packaging-dialog], 잡곡 매입 [misc-purchase-dialog], 잡곡 포장 [misc-package-dialog] — 기본 포장지 자동추천 + 자유선택
- [ ] 기존 재고 백필 마이그레이션(기본 포장지 주입) + 기본값 누락 조합 사전 점검 스크립트
- [ ] 발주서 매칭 로직에 매칭 키 반영(품종+도정유형+중량+포장지 4키, 결정 #1)

### 6.1 발주서·판매 도메인 남은 결정
- [x] **"발주서 건"의 단위 확정**: → **발주처+수령인 1행 = 1건** (결정 #11, 2026-06-08)
- [ ] 엑셀 매트릭스 **파싱 전략** 상세: 4줄 헤더, 병합셀 펼치기, 시트별 발주처 열 구조 차이 흡수, 품종명 정규화(공백/줄바꿈 제거)·정확일치 검증
- [x] **도메인 정책 결정** 확정: 업로드 시점(#15), 재업로드 중복(#16), 차감 취소(#17), 매칭 실패(#18) — 2026-06-08
- [x] **엑셀 매트릭스 파싱 전략**: 실측 완료(§2.1) — raw 셀 접근+병합 펼치기, A열 라벨로 헤더 탐지, 시트명→channel, CRLF 정규화, 포장지 빈칸=기본(#21).
- [x] **품목명↔품종 매칭 (블로커 해소, 2026-06-09)**: 실데이터 대조(§6.1.1) → 정규화+별칭 하이브리드(#5 번복)·도정유형 매칭키(#1)·`Variety.aliases`(#22)·파이프라인(#23) 확정.
- [ ] **Server Actions 목록** 확정: 업로드/파싱, 자동매칭(FIFO), 수동 로트변경, 건별 완료처리(=차감), 부분완료, 다운로드 export, 조회/취소 (다음 세션 — 설계)
- [x] **UI 탭 구조**: → **제품판매 / 원물출고 2탭** (벼·잡곡 placeholder 제거) (결정 #13, 2026-06-08). 세부 화면(목록 드릴다운/상세 매칭/모바일)은 UI 설계 단계.
- [x] **차감 모델·진입점**: → `PackageMovement` 통합(결정 #19) + 진입점 3개·판매/차감 화면 분리(결정 #20). 백로그 §13·§14 통합 처리 대상. 2026-06-08
- [x] **판매 금액/단가 모델 (결정 #25, 2026-06-09)**: → **수량 차감만, 금액 미관리**. `PackageMovement`에 금액 필드 없음, 매출 정산은 외부 회계. 발주서 수량 중심 흐름과 일관.
- [ ] **개별 판매등록 / 비판매차감 화면 설계**: 제품판매 탭 + 제품재고 목록(`/packages`) 행 트리거. 입력 필드(거래처·가격 등) 확정 필요 (다음 세션 — 설계)
- [!] **UI 세부(레이아웃·비주얼·컴포넌트)는 Claude Design 핸드오프로 위임** (사용자 결정). 본 계획서/내 설계 범위는 *화면 목록 + 각 화면이 담아야 할 데이터·상호작용 요구사항*까지만. 비주얼 디자인은 파지 않음. → [[design_tool_claude_design]] 워크플로우. 화면 후보: 발주서 묶음목록 / 건목록 / 건상세(라인별 매칭·재고부족) / 개별 판매등록 / 비판매차감 / 제품재고 목록 행 트리거 / 각 모바일
- [x] **권한 역할 분리**: → 업로드=SALES_MANAGE / 조회=공개 / 매칭·차감=MILLING_MANAGE (결정 #14, 2026-06-08). permission-matrix.md 등록은 구현 단계.
- [ ] 감사로그 액션 종류, revalidate 경로(`/sales`) 확정
- [ ] 단계별 구현 순서 + 파일 단위 작업 목록, 리스크(양식 변동/품종명 불일치/이중차감 동시성), 테스트 방안
- [x] 기존 `plan-잡곡재고관리-#9.md`/`#9.5.md` 설계 의도 확인 → §3.8 반영 (2026-06-08)

### 6.1.1 품목명↔품종 매칭 실데이터 대조 (2026-06-09, 결정 #5·#1·#22·#23·#24 근거)
발주서.xlsx 품목 **18종** ↔ DB Variety(RICE 21·MISC_GRAIN 19) 전수 대조 결과. 순수 정규화로 **15종 자동**, 별칭 매핑 필요 **품종 5개**(서농22호·흑미·발아현미·천지향1세·백옥찰).

**A. 정규화만으로 정확일치 (15종)** — 접두 제거 후 `Variety.name` 일치
- 잡곡: 검정보리·귀리·찰보리·기장·차조·수수·팥 (`유기농` 접두 제거)
- 벼: 천지향5세·하이아미 (`유기농` 제거) / IPS (`프로틴 라이스` 제거) / CJ6 (`자스민 라이스` 제거)

**B. 별칭 매핑 (품종 5개)** — 현장통칭↔행정품종명, 문자유사성 0 → 정규화 불가 (2026-06-09 미팅 정정 반영)
| 발주서 통칭 | DB 품종(정식) | 근거 |
|---|---|---|
| 가바백미 / 가바현미 | **서농22호** (RICE/URUCHI, id14) | '가바'=서농 계열 가바미 통칭. 22호 일반 가바미 → 백미/현미는 **단순도정**(도정유형 매칭키로 분리, #1·#24a) |
| 가바발아현미 | **발아현미** (MISC_GRAIN, id47) | 서농22호 현미를 **발아위탁 가공** → 시스템상 '발아현미' 잡곡으로 입고(#24b). 도정 아닌 별도품종 → '가바발아현미' 구 전체 별칭 |
| 가바흑미 | **흑미** (MISC_GRAIN, id18) | 2026-06-09 미팅: 발주서는 '흑미'로 표기·관리. 도정 아닌 품종 → '가바흑미' 구 전체 별칭(#24b). ⚠️**박태일 서농24호**(흑미 계통이나 **별개 품종**, 원물출고 RICE로 환원 §6.2)와 무관 |
| 천지향 (세대 무표기) | **천지향1세** | 무표기='1세'. 천지향5세는 발주서에 별도 규격으로 공존 |
| 찹쌀 | **백옥찰** | '찹쌀'은 곡종(GLUTINOUS)명일 뿐 → 백옥찰로 매핑(사용자 확인) |

**C. 가공형태 이분 (결정 #24)** — 발주서 가공형태가 두 성격: **(a) 단순도정**(백미/현미/오분도미/칠분도미)은 원품종 유지 + 도정유형 매칭키(#1). 가바백미/가바현미=서농22호 도정차이, 이마트 천지향5세 오분도미도 동일. **(b) 위탁가공→별도 잡곡품종**(흑미/발아현미)은 도정 분리 안 하고 잡곡 품종으로 통째 매칭(가바흑미→흑미 id18, 가바발아현미→발아현미 id47). 시스템상 위탁도정/발아로 잡곡 입고·판매되는 게 업무흐름과 자연스러움.

**데이터 실태 확인(2026-06-09)**: 흑미(id18)=위탁도정 잡곡 1건 가용(진도벤처팜·오점기, lot코드15). 서농24호(id20)=RICE/RELEASED 10건(박태일, lot코드11) — 품종 마스터만 MISC_GRAIN으로 전환돼 stock과 불일치 → §6.2에서 RICE 환원. 발아현미(id47)=GERMINATION 잡곡 1건 가용(미력 발아위탁, 원품종 서농22호, lot코드00=미분류). 재고목록 필터는 `stock.category` 기준(misc-stock.ts:310/stock.ts:338), 품종 드롭다운만 `variety.category` 기준(misc-stock.ts:481).

**⚠️ 구현 전 후속 확인** (서농22호·흑미·발아현미 제품재고[포장] 적재 후 검증): ①가바발아현미 재고가 발아현미(id47) 잡곡 포장으로 들어오는지(원품종 서농22호 추적 정보는 stock에 없음 — 현재 가바뿐이라 무방하나 타 원품종 발아현미 생기면 구분 불가). ②흑미(id18) 재고에 가바 외 일반 흑미 섞이는지(현재 발주서엔 가바흑미만 → 무방). ③lot코드 정합성(발아현미 00, 서농24호 11) 별도 점검은 §6.2.

### 6.2 서농24호 RICE 환원 (발주서 범위 밖 — 원물출고 도메인 데이터 정리, 결정 #24)
2026-06-09 미팅: **박태일 서농24호**는 흑미 계통이지만 발주서 가바흑미(=오점기 흑미, id18)와 **별개 품종**. 과거 RICE→현재 MISC_GRAIN으로 품종 마스터가 잘못 전환돼 stock과 불일치.
- [ ] `Variety` 서농24호(id20) `category` MISC_GRAIN → **RICE 환원** + `type` 정합성 결정(흑미 계통이면 `BLACK`? 기존 stock lot코드=11[일반백미]과 대조). 로트규정상 흑미=미곡류라 RICE가 맞음.
- 영향: stock 10건 이미 `category=RICE`/RELEASED → **재고목록 영향 0**(필터는 stock.category 기준). 잡곡 품종 드롭다운(`variety.category` 기준, misc-stock.ts:481)에서만 빠지고 벼 품종 드롭다운으로 이동 = 원물출고용 정상화.
- 발주서 매칭과 무관(가바흑미는 흑미 id18로 매칭). 이 작업은 발주서 본구현과 독립적으로 선행/병행 가능. **원물출고(Stock) 도메인 정리라 본 계획서 핵심 범위 밖** — 별도 처리 권장.

## 8. 구현 설계 (2026-06-09~ 작성 중, 의존순서대로 단계별)

> 결정 #1~#25를 코드 설계로 전개. UI 비주얼은 Claude Design 위임 → 본 설계는 *모델·Server Action 시그니처·화면별 데이터/상호작용 요구사항·작업순서*까지.
> 작성 진행: **[8.1 제품유형 마스터 — ✅ 구현 완료]** · **[8.2 발주서 파싱+모델 — ✍️ 작성완료 2026-06-22]** · **[8.3 Server Actions — ✍️ 작성완료]** · **[8.4 화면 요구사항 — ✍️ 작성완료]** · **[8.5 구현순서 — ✍️ 작성완료]**. → 설계 1차 완성, 사용자 검토/승인 대기.

### 8.1 제품유형(ProductType/SKU) 마스터 (§6.0 — 선행 1순위) — ✅ 구현 완료(2026-06-17)

> **✅ 완료**: 발주서 매칭의 선행 1순위였던 SKU 정규화 작업이 **단계 1~5 전부 끝남**(2026-06-17). 발주서 매칭 4키(품종+도정+규격+포장지)는 이제 단일 `ProductType` 엔티티로 정규화되어 `WHERE productTypeId=X` 1:1 매칭이 가능.
>
> - **상세 구현 계획서**: [plan-제품유형마스터.md](plan-제품유형마스터.md) (단계 1~5)
> - **결과보고서**: [report-제품유형마스터-단계5-2026-06-17.md](../report/report-제품유형마스터-단계5-2026-06-17.md)
> - **실제 구현 ≠ 아래 구 설계**: 관리 라우트 = **`/admin/product-types`**(구 안 `/settings/packaging` 폐기), 권한 = **`SALES_MANAGE`**(구 안 `MILLING_MANAGE` 폐기), `PackagingMapping` **폐기**(기본 포장지 = `ProductType.isDefault`), `millingType`·`packagingId`는 **NOT NULL + sentinel**(`'기타'`/`'매입포장'`).
> - **모델**: `Packaging`(name unique+active) / `ProductType`(varietyId+millingType+packageType+packagingId **@@unique 4키**, isDefault+active) / `MillingOutputPackage.productTypeId?` / `Variety.aliases`.
> - **시드·백필**(실 DB 반영): Packaging 9종 · ProductType 57개 · aliases 5종 · **백필 360건**(잔량 72 제외 = null). 등록 3경로 find-or-create 연동 완료(잡곡매입 `55b4941`·잡곡포장 `55b4941`+`5dfc206`·도정산 `c7b03d5`·UI 1행 `892b0d5`).
> - 발주서 매칭은 `PurchaseOrderItem.productTypeId` **1:1**(구 4키 조립 대체).

<details>
<summary>📜 구 설계(8.1.1~8.1.5) — 폐기·역사 기록 (펼치기). 2026-06-15 제품유형 카탈로그로 격상되며 폐기됨. 구현은 위 제품유형 계획서를 따랐음.</summary>

발주서 매칭 4키(품종+도정+규격+포장지)를 **단일 SKU 엔티티(ProductType)로 정규화**하는 선행 작업. 이게 없으면 발주서 매칭이 성립 안 함 → 전 작업의 기반.

#### 8.1.1 Prisma 모델 (3개 변경)

기존 `Variety`(schema.prisma:52)·`MillingOutputPackage`(:133)·enum 구조 확인 완료. 추가/변경:

```prisma
// (1) 신규 — 포장지 마스터
model Packaging {
  id        Int      @id @default(autoincrement())
  name      String   @unique          // '자연주의' | '아이담쌀' | 'PET' | '무지' …
  active    Boolean  @default(true)    // 폐기 대신 비활성(이력 보존). 목록/추천에서 제외
  mappings  PackagingMapping[]
  packages  MillingOutputPackage[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// (2) 신규 — 품종×중량 → 허용 포장지 매핑(기본값 지정, 결정 #7)
model PackagingMapping {
  id          Int       @id @default(autoincrement())
  varietyId   Int
  variety     Variety   @relation(fields: [varietyId], references: [id])
  packageType String                    // 중량 문자열('10kg' 등) — MillingOutputPackage.packageType과 동일 도메인
  packagingId Int
  packaging   Packaging @relation(fields: [packagingId], references: [id])
  isDefault   Boolean   @default(false)  // 포장 등록 시 자동추천 대상(결정 #8). 빈칸 발주서 매칭의 기본값(결정 #21)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([varietyId, packageType, packagingId])   // 같은 조합 중복 매핑 방지
  @@index([varietyId, packageType])                 // 추천 조회 키
}

// (3) 변경 — 제품재고에 포장지 정식 승격(결정 #2)
model MillingOutputPackage {
  // … 기존 필드 …
  packagingId Int?                        // 포장지(FIFO 매칭 키). nullable=매핑 밖 값/미지정 허용(결정 #8)
  packaging   Packaging? @relation(fields: [packagingId], references: [id])
}

// (4) 변경 — 품종 별칭(결정 #22, 8.2에서 본격 사용하나 마이그레이션은 여기서 함께)
model Variety {
  // … 기존 필드 …
  aliases String[] @default([])           // Postgres 배열. 현장통칭→행정품종명 매칭(#22)
}
```

- ⚠️ `isDefault`는 "품종×중량당 1개"가 자연스럽지만 **DB 제약으로 강제하지 않음**(부분 유니크 인덱스 = Prisma 비표준 → raw SQL 필요, 과설계). 대신 **Server Action에서 보장**(기본 지정 시 동일 조합 기존 기본 해제). 결정 #8 "강제 아님"과도 일관.
- `Packaging.active`: 포장지 단종 시 row 삭제하면 과거 재고 FK 깨짐 → soft(active=false). 기존 잡곡포장 soft 패턴과 일관.

#### 8.1.2 마이그레이션 + 백필 (결정 #10)

2-스텝(스키마 → 데이터). 둘 다 idempotent 권장:

1. **스키마 마이그레이션**: 위 4개 모델 반영. `packagingId`는 nullable이라 기존 row 무영향.
2. **시드 — 포장지·매핑 마스터 정비**: 발주서 실측 포장지(`자연주의`·`아이담쌀`·`PET` 등 §2.1)와 품종×중량 조합별 기본 포장지를 등록. **이게 백필의 선행조건**(기본값 없는 조합은 백필 불가).
3. **백필 스크립트**: 각 `MillingOutputPackage`(packagingId=null)에 대해 (varietyId or batch.stock.varietyId, packageType)로 `PackagingMapping.isDefault=true` 조회 → packagingId 주입.
   - ⚠️ **품종 해석 주의**: MILLED 포장은 `varietyId`가 null(batch.stock 경유) → 백필 시 `stock.varietyId`를 거쳐야 함. PURCHASED는 직접 `varietyId`. 백필 쿼리에서 두 경로 분기.
   - **누락 조합 사전 점검 스크립트**(결정 #10): 백필 전, 기본값 매핑이 없는 (품종×중량) 조합을 전수 리포트 → 사용자가 마스터 보완 후 백필 실행. 점검에서 0건 나와야 백필 진행.
4. `Variety.aliases` 시드: 서농22호=`['가바']`, 흑미=`['가바흑미']`, 발아현미=`['가바발아현미']`, 천지향1세=`['천지향']`, 백옥찰=`['찹쌀']`(결정 #22). ⚠️ 흑미·발아현미 id는 §6.1.1 확인값(18·47)이나 **시드 시 id 하드코딩 말고 name으로 조회**.

#### 8.1.3 Server Actions (포장지 마스터 도메인) — `app/actions/packaging.ts` 신규

| Action | 권한 | 역할 |
|---|---|---|
| `listPackagings()` | 공개 | 포장지 목록(active 우선) |
| `createPackaging(name)` | `MILLING_MANAGE` | 포장지 추가 |
| `togglePackagingActive(id)` | `MILLING_MANAGE` | 활성/비활성 토글(삭제 대신) |
| `listMappings(filter?)` | 공개 | 품종×중량 매핑 목록 |
| `upsertMapping({varietyId,packageType,packagingId,isDefault})` | `MILLING_MANAGE` | 매핑 추가/수정. **isDefault=true면 동일 조합 기존 기본 해제(트랜잭션)** |
| `deleteMapping(id)` | `MILLING_MANAGE` | 매핑 제거 |
| `suggestPackaging(varietyId, packageType)` | 공개 | 포장 등록용 — 해당 조합 기본 포장지 + 허용 목록 반환 |

- **마스터 변경 권한 = `MILLING_MANAGE`**(2026-06-09 확정, 매칭 권한 #14와 일관). permission-matrix.md에 포장지 마스터 항목 등록.
- 모든 변경 Action에 `recordAuditLog`, `revalidatePath('/settings/packaging')`.

#### 8.1.4 화면 요구사항 (비주얼은 Claude Design)

- **포장지 마스터 관리 화면 = `/settings/packaging`**(2026-06-09 확정 — **설정/관리 메뉴 신규**. 향후 품종·거래처 등 타 마스터도 이 설정 공간에 흡수 가능). 진입 = `MILLING_MANAGE`:
  - 포장지 목록 + 추가 + 활성토글
  - 품종×중량별 매핑 테이블: 조합마다 허용 포장지(다중) + 기본 1개 지정. **누락 조합 강조 표시**(백필 선행 점검과 연동)
  - ⚠️ 설정 메뉴 자체가 신규 → desktop-sidebar / mobile-nav 등록 + 라우트 신설 필요(작업순서 반영).
- **포장 등록 3곳 포장지 입력 추가**(결정 #8, 자동추천+자유선택):
  - [add-packaging-dialog.tsx](app/(dashboard)/milling/add-packaging-dialog.tsx) — 도정산
  - [misc-purchase-dialog.tsx](app/(dashboard)/packages/misc-purchase-dialog.tsx) — 잡곡 매입
  - [misc-package-dialog.tsx](app/(dashboard)/packages/misc-package-dialog.tsx) — 잡곡 포장
  - 셋 다: 품종·중량 선택되면 `suggestPackaging`로 기본값 자동선택, 드롭다운에서 전체 active 포장지 자유변경 가능. **빈 선택(null) 불가 — 포장지 항상 강제**(2026-06-09 확정). 기본추천이 있어 부담 적고 매칭 정합성↑. DB는 nullable 유지(기존 row·매핑밖 예외 대비), **입력단에서만 required 검증**(Zod). ⚠️기본추천 없는 조합(매핑 누락)에서 강제하면 등록 막힘 → 마스터 매핑 정비가 등록 강제의 선행조건(누락조합 점검과 연동).

#### 8.1.5 이 단계 작업 순서(8.5 전체 순서의 1블록)

1. schema.prisma 4개 변경 → `prisma migrate`
2. `app/actions/packaging.ts` Server Actions
3. 설정 메뉴 신설(`/settings` 라우트 + 사이드바/모바일내비 등록) → 포장지 마스터 관리 화면(`/settings/packaging`, 요구사항 → Claude Design 핸드오프 → 구현)
4. 시드(포장지·매핑·aliases) → **누락조합 점검**(0건 확인) → 백필 실행
5. 포장 등록 3곳에 입력 추가(포장지 강제 — 마스터 매핑 정비 완료가 선행). 증거 확인 후 완료선언

> **검토 포인트 — 2026-06-09 전부 확정**: ①관리 화면 경로 = **`/settings/packaging`(설정 메뉴 신규)** ②마스터 변경 권한 = **`MILLING_MANAGE`** ③포장 등록 시 포장지 = **강제(항상 선택)**. ⇒ 매핑 정비가 등록 강제의 선행조건이 됨(순서 4→5 반영).

</details>

---

### 8.2 발주서 파싱 + 도메인 모델 (✍️ 2026-06-22)

> 제품유형 마스터(§8.1)가 매칭 4키를 `ProductType` 1:1로 정규화했으므로, 발주서 라인은 **`productTypeId` 하나**로 재고와 연결된다(구 4키 조립 폐기). 본 절은 신규 3모델 + enum + 파싱·매칭 파이프라인을 확정한다.

#### 8.2.1 Prisma 모델 (신규 3개 + 역참조 1개 + enum 3개)

```prisma
// (1) 신규 — 업로드 묶음 (중복감지 #16 · 묶음목록 화면 · 감사 단위)
//     가벼운 헤더 엔티티. 한 파일 업로드 = 1 PurchaseOrderUpload, 그 안에 시트·행별 PurchaseOrder N개.
model PurchaseOrderUpload {
  id            Int             @id @default(autoincrement())
  fileName      String                              // 원본 파일명 (중복감지 키의 일부)
  orderDate     DateTime?                           // 발주서 대표 발주일(파일/시트에서 추출, 없으면 업로드일)
  orderCount    Int             @default(0)         // 적재된 PurchaseOrder 수(요약 표시·검증)
  uploadedById  String?                             // 업로더(User.id)
  uploadedName  String?                             // 업로더명(탈퇴 대비)
  orders        PurchaseOrder[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([fileName, orderDate])                    // 재업로드 중복 감지 조회(#16)
}

// (2) 신규 — 주문 1건 = 발주처 + 수령인 = 엑셀 한 행 (결정 #11)
model PurchaseOrder {
  id         Int                 @id @default(autoincrement())
  uploadId   Int?
  upload     PurchaseOrderUpload? @relation(fields: [uploadId], references: [id])
  channel    PurchaseChannel                         // DELIVERY(택배) | EMART(이마트) — 시트명으로 판별
  orderDate  DateTime?                               // 발주일(있으면)
  vendor     String                                  // 발주처 (이마트 시트는 '이마트' 고정)
  recipient  String                                  // 수령인 (이마트 시트는 지점: 여주/대구/시화)
  status     OrderStatus         @default(PENDING)   // 라인 집계 파생값(별도 수기관리 X, 결정 #12)
  items      PurchaseOrderItem[]
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt

  @@index([uploadId])
  @@index([vendor, recipient])                        // 중복감지 보조 키(#16)
}

// (3) 신규 — 품목 라인 = 엑셀 셀 1개 = (품종+도정+규격+포장지) 1조합 + 주문수량
model PurchaseOrderItem {
  id            Int           @id @default(autoincrement())
  orderId       Int
  order         PurchaseOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // --- 파싱 원본 스냅샷 (매칭 실패 시 수동지정·재매칭·감사에 필요) ---
  rawItemName   String                              // 원본 품목명 '유기농\n가바백미' (정규화 전 보존)
  packageType   String                              // 규격(중량) '10kg' — 파싱에서 직접 추출, 항상 존재
  rawPackaging  String?                             // 포장지 원본('자연주의' 등). 빈칸이면 null → 기본 포장지 적용(#21)
  orderedQty    Int                                 // 주문 수량(셀 값)

  // --- 매칭 결과 ---
  productTypeId Int?                                // 매칭 성공 시 SKU 1:1. 실패=null(=매칭실패, 포장담당 수동, #18)
  productType   ProductType?  @relation(fields: [productTypeId], references: [id])

  movements     PackageMovement[]                   // 이 라인을 실제 차감한 로트별 배분(type=SALE)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([orderId])
  @@index([productTypeId])
}

// (4) 신규 — 제품재고 차감 통합 모델 (결정 #19 — 세 경로 단일 테이블)
//     발주서 일괄 / 개별 판매 / 비판매 차감 모두 "MillingOutputPackage에서 count개 차감"
model PackageMovement {
  id          Int                  @id @default(autoincrement())
  packageId   Int
  package     MillingOutputPackage @relation(fields: [packageId], references: [id])
  count       Int                                   // 차감 개수(양수)
  type        MovementType                          // SALE | GIFT | LOST | DAMAGED | OTHER (판매=SALE)

  orderItemId Int?                                  // 발주서 경로만. 개별판매·비판매차감은 null
  orderItem   PurchaseOrderItem?   @relation(fields: [orderItemId], references: [id])

  customer    String?                               // 개별판매 거래처(자유 텍스트). 발주서는 order에서 파생되므로 null
  note        String?                               // 비판매 사유 메모 등
  occurredAt  DateTime             @default(now())  // 실제 차감/판매 발생일(사용자 입력 가능)

  createdById String?                               // 작업자(감사 보강 — 하드삭제라 movement 자체엔 이력 남지만 AuditLog 병행)
  createdName String?
  createdAt   DateTime             @default(now())

  // ※ 금액(단가·매출액) 필드 없음 — 수량 차감만(결정 #25)
  @@index([packageId])                              // 가용재고 SUM 조회 핵심 인덱스
  @@index([orderItemId])
}

// (5) 역참조 추가 — 기존 모델에 관계 한 줄씩
model ProductType {
  // … 기존 …
  orderItems PurchaseOrderItem[]   // 8.1 주석 'orderItems ... 발주서 단계에서 추가' 이행
}
model MillingOutputPackage {
  // … 기존 …
  movements PackageMovement[]
}

enum PurchaseChannel { DELIVERY  EMART }
enum OrderStatus     { PENDING  PARTIAL  COMPLETED }
enum MovementType    { SALE  GIFT  LOST  DAMAGED  OTHER }
```

- **가용재고 = `package.count - SUM(movement.count)`** — type 무관 전체 합산(판매·비판매 모두 실재고 차감, 결정 #19). `getPackages` 1달 cutoff(packages.ts:107-116 임시블록)는 이 도입 후 "가용수량 0 제외"로 대체·제거.
- **라인 충족 판정 = `orderedQty` vs `SUM(movement.count where orderItemId=this AND type=SALE)`** → 충족/부분/미결. `PurchaseOrder.status`는 자기 라인 집계 파생(전부충족=COMPLETED / 일부=PARTIAL / 0=PENDING).
- **`onDelete: Cascade`**(order→item): 업로드 취소(잘못 올린 건 삭제, #15) 시 item 동반 삭제. 단 **차감된 movement가 달린 item이 있으면 삭제 차단**(Server Action에서 선검사 — 이중차감/유령 movement 방지).
- **`millingType`·`packagingId`를 item에 중복 저장 안 함**: 매칭 성공 시 전부 `productType`에서 파생. 매칭 실패(null)일 때 수동지정에 필요한 건 `rawItemName`+`packageType`+`rawPackaging`(재파싱 가능)이라 그것만 보존.
- **`PurchaseOrderUpload` 신설 근거**(검토 포인트 ①): 묶음목록 화면(§6.1 화면후보)·중복감지(#16)·업로드 단위 감사·일괄삭제 앵커가 모두 묶음 헤더를 필요로 함 → 문자열 그룹키보다 가벼운 엔티티가 적절. *대안(uploadBatchId 문자열)도 가능하나 채택 안 함.*

#### 8.2.2 엑셀 파싱 전략 (§2.1 실측 → 코드화)

`xlsx`(SheetJS)의 `sheet_to_json`은 4줄 헤더·병합셀·피벗을 못 다룸 → **raw 셀 좌표 접근 전용 파서**를 `lib/purchase-order-parser.ts`(순수 함수, 'use server' 아님)로 분리. `app/actions/excel.ts`의 `importFarmers` 패턴(`XLSX.read(buffer)`)은 재사용하되 sheet_to_json은 안 씀.

파서 흐름(시트별 반복):
1. **channel 판별**: 시트명에 `'이마트'` 포함 → `EMART`, 아니면 `DELIVERY`.
2. **헤더 행 위치 자동 탐지**: A열 라벨로(`A2='농가명'`, `A3='포장지'`, `A4='중량'`, `A5='소계'`, `A6` 이하 데이터). 행 인덱스 하드코딩 회피(§2.1).
3. **규격 열 펼치기**: C열~마지막열. r0(품목명) 병합셀은 `ws['!merges']`로 펼쳐 각 규격 열에 품목명 채움. 각 규격 열 = `{ rawItemName(r0), rawPackaging(r2|null), packageType(r3) }`.
4. **데이터 행 순회**(r6~, 소계행 무시): 각 행 = 1 `PurchaseOrder`(vendor=A열, recipient=B열 / 이마트는 vendor='이마트' 고정·recipient=지점). 행×규격열 교차 셀의 값(수량)이 있으면 1 `PurchaseOrderItem`.
5. **정규화**: 모든 문자열 `/[\r\n]+/g`→공백, trim, 다중공백 단일화(CRLF 줄바꿈 #2.1).

파서 반환 = 순수 DTO 배열(`ParsedUpload { fileName, sheets: [{ channel, orders: [{ vendor, recipient, items: [{ rawItemName, packageType, rawPackaging, orderedQty }] }] }] }`). **DB·매칭은 파서가 안 함** — Server Action(§8.3)이 DTO를 받아 적재+매칭. 파서는 Zod로 출력 형태만 검증(시스템 경계).

#### 8.2.3 매칭 파이프라인 (결정 #23 — 라인 1개 → productTypeId 해석)

순수 함수 `lib/purchase-order-matcher.ts`. 입력=`{ rawItemName, packageType, rawPackaging }` + 마스터(Variety[]·ProductType[]·기본포장지). 단계:

```
① 정규화: rawItemName에서 인증/브랜드 접두(유기농·프로틴 라이스·자스민 라이스) 제거,
   도정유형 접미(백미/현미/오분도미/칠분도미) 분리 → (품종토큰, millingType?)
   ⚠️ '흑미'·'발아현미'는 도정 접미로 취급 안 함(#1·#24) — 품종토큰에 그대로 남김
② 품종 해석: Variety.name === 품종토큰 정확일치
   → 실패 시 Variety.aliases.has(품종토큰) (가바흑미/가바발아현미 구 전체도 여기서)
   → 실패 시 return { matched:false }  (매칭실패, productTypeId=null)
③ 포장지 해석: rawPackaging 있으면 Packaging.name 일치 / 없으면(빈칸) 그 (품종+millingType+규격) 기본 ProductType의 packagingId(#21)
④ SKU 해석: ProductType (varietyId + millingType['기타' 보정] + packageType + packagingId) @@unique 조회
   - 위탁가공품(흑미·발아현미)·잡곡은 millingType='기타' sentinel로 보정(#24b)
   - 단순도정 벼는 분리한 millingType 사용
   → 매칭되면 { matched:true, productTypeId }
```

- **find-or-create 안 함**(검토 포인트 ②): 발주서 매칭은 *재고 차감*이 목적 → 카탈로그에 없는 SKU는 애초에 재고도 0 → 굳이 빈 SKU 생성 안 하고 **매칭실패(수동)로 회송**. SKU 생성은 도정산/매입 등록 경로(§8.1)의 책임. *단 매칭 성공해도 가용재고 부족이면 PARTIAL(#4).*
- **수동지정 학습**(#22): 포장담당이 매칭실패 라인을 특정 품종으로 수동 확정하면, 그 품종토큰을 `Variety.aliases`에 append(append 시 중복·공백 가드). 다음 업로드부터 자동.

### 8.3 Server Actions (✍️ 2026-06-22)

> 신규 파일 **`app/actions/purchase-order.ts`**(발주서·매칭·차감) + **`app/actions/package-movement.ts`**(개별판매·비판매차감, 발주서 무관 공용). 모든 write에 `requirePermission` + `recordAuditLog` + `revalidatePath('/sales')`(차감은 `/packages`도).
>
> **⚠️ 권한 일괄 확정(2026-06-22 권한 단순화 완료)**: 아래 표의 모든 write Action 권한 = **`OPERATION_MANAGE`**(가공·판매). 구 `SALES_MANAGE`·`MILLING_MANAGE`는 폐기·통합됨 → 표 안의 옛 키 표기는 전부 `OPERATION_MANAGE`로 읽는다. 공개 조회(`list*`/`get*`/`exportPurchaseOrders`)는 그대로. #14의 "업로드=영업 / 매칭=포장" 역할 분리는 권한 통합으로 **소멸**(둘 다 가공·판매 권한). 참조: [plan-권한단순화.md](plan-권한단순화.md).

#### 8.3.1 발주서 (`app/actions/purchase-order.ts`)

| Action | 권한 | 역할·동작 |
|---|---|---|
| `uploadPurchaseOrder(formData)` | `SALES_MANAGE` | 파일검증(`validateExcelUpload`)→파서(§8.2.2)→**중복감지**(fileName+orderDate+vendor/recipient 대조, #16: 중복이면 `{ duplicate:true, conflicts }` 반환, 강제진행 플래그로 재호출)→트랜잭션 적재(Upload+Order+Item, status=PENDING)→각 라인 **자동매칭**(§8.2.3)+**FIFO 재고배분 미리계산은 안 함**(매칭=productTypeId만, 차감은 별도 확정). 반환=적재 요약(건수·매칭성공/실패 수) |
| `listPurchaseUploads(filter?)` | 공개 | 업로드 묶음 목록(최신순, 건수·상태 요약) |
| `listPurchaseOrders(uploadId?/filter)` | 공개 | 건 목록(상태·발주처·수령인·라인수·매칭실패수) |
| `getPurchaseOrderDetail(orderId)` | 공개 | 건 상세 — 라인별 {rawItemName, 매칭결과(productType), orderedQty, 차감현황 SUM, 가용재고, 부족분} |
| `autoMatchOrderItem(itemId)` | `MILLING_MANAGE` | 단일 라인 재매칭(업로드 후 마스터 보완했을 때). 결과 productTypeId 갱신 |
| `setOrderItemProductType(itemId, productTypeId, {learnAlias?})` | `MILLING_MANAGE` | 매칭실패/오매칭 **수동 지정**(#18). learnAlias=true면 품종토큰을 `Variety.aliases` append(#22 학습) |
| `confirmOrderItem(itemId, allocations[])` | `MILLING_MANAGE` | **차감 확정**(#12). allocations=[{packageId, count}](FIFO 자동추천을 사용자가 조정 가능, #3). 트랜잭션: 각 packageId **가용 재검증**(count-SUM≥요청)→`PackageMovement`(type=SALE, orderItemId) 생성→라인/건 status 재계산. 부족분 있으면 라인 부분충족·건 PARTIAL(#4) |
| `confirmOrder(orderId)` | `MILLING_MANAGE` | 건의 전체 라인을 FIFO 자동배분으로 일괄 확정(라인별 부분성공 허용, #12 UX). 내부적으로 라인별 `confirmOrderItem` 로직 재사용 |
| `cancelOrderItemMovements(itemId)` | `MILLING_MANAGE` | 차감 취소(#17) — 해당 라인 `PackageMovement`(type=SALE) **하드삭제**→가용 자동복원→status 재계산. `recordAuditLog` 필수(하드삭제 보완) |
| `deletePurchaseUpload(uploadId)` / `deletePurchaseOrder(orderId)` | `SALES_MANAGE` | 잘못 올린 업로드/건 삭제(#15). **차감된 movement 존재 시 차단**(선검사). Cascade로 item 동반삭제 |
| `exportPurchaseOrders(uploadId/filter)` | 공개(또는 `requireSession`) | 발주서 양식 복원 + **생산자명·로트번호 채움**(완료 건). `exportPackages`(packages.ts:1025) base64 패턴 재사용. movement→package→stock.farmer/lotNo 경유로 생산자·로트 주입 |

- **FIFO 자동추천**(#3): `confirm*` 내부 헬퍼 `suggestAllocation(productTypeId, qty)` = `MillingOutputPackage where productTypeId AND 가용>0` 을 `createdAt`(또는 incomingDate) 오름차순으로 필요수량까지 그리디 배분. 포장담당이 상세에서 로트 교체 가능(반환된 추천을 UI에서 편집 후 `confirmOrderItem`에 전달).
- **동시성**(리스크): 가용 재검증을 트랜잭션 내에서 하되 Prisma는 `SELECT FOR UPDATE` 미지원 → 동일 package 동시 차감 시 초과 위험. 차감은 포장담당 소수 작업이라 경합 낮음. 보강책 = 트랜잭션 직렬화 격리 또는 movement 생성 직후 가용 재검증해 음수면 롤백. **§8.5 리스크에 기록.**

#### 8.3.2 개별판매·비판매차감 (`app/actions/package-movement.ts`) — 발주서 무관 공용(#20)

| Action | 권한 | 역할 |
|---|---|---|
| `createSale({packageId, count, customer?, occurredAt?, note?})` | `SALES_MANAGE` | 개별 판매등록(type=SALE, orderItemId=null). 제품판매 탭 + `/packages` 행 진입. 가용 재검증 |
| `createNonSaleMovement({packageId, count, type, note, occurredAt?})` | `MILLING_MANAGE` | 비판매 차감(GIFT/LOST/DAMAGED/OTHER). `/packages` 행 진입. ⚠️원물(stock) 복원 안 함(#19) |
| `cancelMovement(movementId)` | type별(SALE=`SALES_MANAGE`/그 외=`MILLING_MANAGE`) | 단건 하드삭제+복원+`recordAuditLog`(#17) |
| `listMovements(packageId)` | 공개 | 특정 제품재고의 차감 이력(판매·비판매 통합) |

- **권한 = 전부 `OPERATION_MANAGE`**(2026-06-22 권한 단순화로 확정): 개별판매·비판매차감·취소 모두 가공·판매 권한 단일. (검토 포인트 ③의 "판매=SALES/비판매=MILLING 분리"안은 권한 통합으로 무효화 — 두 권한이 하나가 됨.)
- `getPackages` 수정: cutoff 임시블록 제거 + 각 package에 `available = count - SUM(movement.count)` 동봉, available=0은 목록 제외(백로그 §13 종료).

### 8.4 화면 요구사항 (✍️ 2026-06-22 — 비주얼은 Claude Design 위임)

> 본 절은 *화면 목록 + 각 화면이 담을 데이터·상호작용 요구사항*까지만(결정대로). 레이아웃·비주얼은 [[design_tool_claude_design]] 핸드오프. `/sales` 탭은 **제품판매 / 원물출고 2탭**(결정 #13, 기존 rice/misc 준비중 placeholder 제거).

| # | 화면 | 진입 | 데이터 | 핵심 상호작용 |
|---|---|---|---|---|
| 1 | **발주서 묶음 목록** | 제품판매 탭 | 업로드별 {파일명·발주일·건수·상태요약·매칭실패수} | 엑셀 업로드 버튼(SALES_MANAGE)·묶음 클릭→건목록·삭제 |
| 2 | **건 목록** | 묶음 드릴다운 | 발주처·수령인·채널·라인수·상태(PENDING/PARTIAL/COMPLETED)·부족표시 | 건 클릭→상세·일괄 완료처리·export |
| 3 | **건 상세(매칭·차감)** | 건 클릭 | 라인별 {품목명·매칭품종/SKU·규격·포장지·주문수량·가용재고·FIFO추천로트·부족분} | 라인 차감확정·로트교체·매칭실패 수동지정·차감취소 (전부 MILLING_MANAGE) |
| 4 | **발주서 업로드** | 묶음목록 버튼 | 파일선택 | 업로드→중복경고 모달(#16)→적재요약. SALES_MANAGE |
| 5 | **개별 판매등록** | 제품판매 탭 + `/packages` 행 | 제품재고 선택·수량·거래처·발생일 | 등록(createSale). SALES_MANAGE. 금액 입력 없음(#25) |
| 6 | **비판매 차감** | `/packages` 행 | 제품재고·수량·사유(type)·메모·발생일 | 등록(createNonSaleMovement). MILLING_MANAGE |
| 7 | **제품재고 목록 행 트리거** | `/packages` 각 행 | 가용재고(count-SUM)·차감이력 | 행 메뉴: 판매등록/비판매차감/이력보기 |
| 8 | 위 전체 **모바일** | — | 동일 | 카드형(폰트 키우지 말 것 [[mobile_card_font_no_increase]]) |

- 다운로드(export, #2/완료건): 발주서 원양식 + 생산자명·로트 채워진 상태(§1 4단계).
- 매칭실패 라인은 상세에서 **빨강 강조 + 수동지정 드롭다운**(품종→SKU). 재고부족 라인은 **부족분 배지 + PARTIAL**.

### 8.5 구현 순서 + 리스크 + 테스트 (✍️ 2026-06-22)

**전제**: §8.1(제품유형 마스터) ✅ 완료. 아래는 발주서 본구현(§8.2~8.4) 순서.

1. **스키마**: schema.prisma에 모델 3개(Upload/Order/Item)+PackageMovement+역참조 2개+enum 3개 → `prisma migrate`. (마이그레이션은 nullable·신규테이블이라 기존 row 무영향)
2. **파서·매처**: `lib/purchase-order-parser.ts`(raw셀)·`lib/purchase-order-matcher.ts`(파이프라인 #23) 순수함수 + Zod. **실파일(docs/resources/발주서.xlsx)로 단위테스트** — 18종 품목 매칭 결과 검증(§6.1.1 기대표와 대조).
3. **차감 공용 액션**: `app/actions/package-movement.ts`(createSale·createNonSale·cancel·list) + `getPackages` cutoff 제거·available 동봉. → 개별판매·비판매차감 먼저 동작(발주서와 독립 검증 가능).
4. **발주서 액션**: `app/actions/purchase-order.ts`(upload·list·detail·match·confirm·cancel·export). FIFO 헬퍼.
5. **권한 등록**: `permission-matrix.md`에 발주서/차감 항목 추가(업로드=SALES_MANAGE / 매칭·차감=MILLING_MANAGE / 비판매=MILLING_MANAGE / 판매=SALES_MANAGE). `/sales` 탭 placeholder 제거→제품판매 탭 골격.
6. **화면**(§8.4) Claude Design 핸드오프 → 구현. 모바일 동반.
7. **증거 기반 완료**: 실파일 업로드→매칭→차감→export 왕복을 실제 DB(Neon, [[deployment_db_infra]])에서 1건 검증 후 완료선언.

**리스크**
- **동시 차감 초과**(§8.3.1): Prisma FOR UPDATE 부재. 완화=트랜잭션 내 movement 생성 후 가용 재검증·음수면 롤백. 경합 낮음(포장담당 소수).
- **양식 변동**: 발주서 열/시트 구조 바뀌면 파서 깨짐. 완화=A열 라벨 기반 탐지(행 하드코딩 회피)·파싱 실패 시 행 단위 skip+리포트(`importFarmers` 패턴).
- **품종명 불일치 누적**: 신규 통칭 등장. 완화=수동지정 학습(#22 alias append)·매칭실패 리포트.
- **이중차감**: 재업로드 중복(#16 경고)·movement 달린 건 삭제차단·차감/취소 감사로그 필수(#17).
- **데이터 선결**: §6.1.1 후속확인(가바발아현미/흑미 재고 적재 검증)·§6.2(서농24호 RICE 환원)은 매칭 정확도 전제 → 본구현 전/병행 정리.

**테스트 방안**: ①파서/매처 순수함수 단위테스트(실파일 픽스처) ②액션은 가용재검증·status 파생·하드삭제 복원 경로 중심 ③왕복 통합검증(업로드→차감→export) 1건.

---

## 7. 원칙

- 800줄/함수 50줄 제한, 수술적 변경, 시스템 경계 Zod 검증, 불변성, 시크릿 환경변수
- 3개 이상 파일 변경 → 본 계획 승인 후 착수
