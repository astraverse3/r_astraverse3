# 작업계획서 — 잡곡 재고관리 #8 (잡곡 매입 등록)

작성일: 2026-05-07
선행: #7c 완료(`afd39da`), #7d 모바일 UI 정리 완료(`4e2615b`)
단일 진실 원천: `docs/plan-잡곡재고관리.md` §"잡곡 매입 등록 다이얼로그" / §"`MillingOutputPackage` 확장"

---

## 작업 목표

외부매입한 잡곡 소포장 완제품을 `MillingOutputPackage`에 직접 등록하는 흐름 구축. 등록·수정·삭제 + 행 메뉴 PURCHASED 활성화까지 한 묶음으로 완결.

- **등록 진입점**: 제품재고 잡곡 탭 헤더 `[+ 매입 등록]` 버튼 (현재 `disabled` 상태 활성화)
- **수정·삭제**: PURCHASED 행의 `...` 메뉴 활성화 (#7c에서 깔아둔 자리)
- **저장 형태**: `source=PURCHASED, batchId=null, stockId=null, lotNo=null, category=MISC_GRAIN`, `purchaseVendor/varietyId/incomingDate` 필수

---

## 핵심 설계 (plan-잡곡재고관리.md 인용)

### 입력 필드
- **매입처명** (필수): 자동완성 드롭다운 (`getPurchaseVendors()` 이미 존재 — #7에서 깔아둔 자리)
- **품종**: `varietyId`, MISC_GRAIN만 필터
- **매입일**: 기본 오늘 (`new Date().toISOString().slice(0,10)`)
- **포장단위**: 잡곡 7칸 그리드 (`10/5/1kg + 800/500/420g + 기타`) — 잡곡 포장 다이얼로그와 동일 셋
- **개수**: 양의 정수
- **(자동)** weightPerUnit · totalWeight · packageType

### DB 저장
```ts
prisma.millingOutputPackage.create({
  data: {
    source: 'PURCHASED',
    category: 'MISC_GRAIN',
    batchId: null,
    stockId: null,
    varietyId,           // 필수
    purchaseVendor,      // 필수
    incomingDate,        // 필수
    packageType,
    weightPerUnit,
    count,
    totalWeight,
    lotNo: null,         // 매입은 로트 개념 없음
    productCode: null,
  },
})
```

### CHECK 제약 자동 검증
DB 레벨 `pkg_purchased_required_fields` 제약이 다음을 강제:
```sql
source = 'PURCHASED' →
  purchaseVendor IS NOT NULL AND
  varietyId      IS NOT NULL AND
  incomingDate   IS NOT NULL AND
  batchId        IS NULL AND
  stockId        IS NULL
```
→ Server Action 레벨에서도 zod로 동일 조건 검증해서 사용자 피드백 명확화.

### 매입은 "취소" 단순
- Stock 참조가 없으므로 삭제 시 잔량 복원 같은 후처리 불필요 → **단순 `delete`**
- 수정도 한도 검증 불필요 (다른 포장 합 같은 개념 없음). zod 검증만 통과하면 OK.

---

## 품종 관리 정책 (D안 — 사용자 결정 2026-05-07)

매입은 신규 품종 비율이 높아 **텍스트 입력 + 백엔드 findOrCreate** 방식 채택. 단, 데이터 일관성 + 다른 화면 노출 분리를 위해 **`Variety.type`에 새 플래그 `PURCHASED`("매입") 추가**.

### `Variety.type` 값 (현재 → 신규)
- 현재: `URUCHI`(메벼) / `GLUTINOUS`(찰벼) / `INDICA`(인디카) / `MISC_GRAIN`(잡곡) / `OTHER`(기타)
- 신규: 위 + **`PURCHASED`(매입)**
- `Variety.type`은 String 컬럼이라 **enum 마이그레이션 불필요**. seed/시드 변경 없음. 신규 값을 사용 시점부터 자연스럽게 추가.

### 노출 분기 (매입 품종은 격리)
| 화면 | 노출 조건 |
|------|----------|
| 매입 등록·수정 다이얼로그 (자동완성) | `type = 'PURCHASED'` 만 |
| 잡곡 원물 입고 다이얼로그 (`add-misc-stock-dialog`) | `type = 'MISC_GRAIN'` 만 (현행 유지) |
| 벼 도정 / Stock 관련 화면 | `type IN ('URUCHI', 'GLUTINOUS', 'INDICA', 'OTHER')` (현행 유지) |
| 품종 관리 화면 (`/admin/varieties`) | 전체. 라디오에 "매입" 항목 추가 |

→ **잡곡 입고·벼 품종 선택 등에서는 PURCHASED 품종이 절대 노출 안 됨**. 사용자 결정 명시 사항.

### findOrCreate 흐름
- 매입 등록 시 입력 텍스트 → 액션 내부에서 `prisma.variety.findFirst({ where: { name, type: 'PURCHASED' } })`
- 없으면 `create({ name, type: 'PURCHASED', category: 'MISC_GRAIN' })`
- 받은 id로 `MillingOutputPackage` 생성

### 오타 방지 안내
- 다이얼로그 입력 박스 아래 실시간 안내:
  - 입력값이 자동완성 목록에 매칭되면: `'기존 품종 사용'` 회색 텍스트
  - 매칭 안 되면: `'새 품종 'XX' 으로 등록돼요'` 노란색(amber) 작은 텍스트
- 저장 클릭 시 신규 품종이면 한 번 더 `confirm("새 품종 'XX'을(를) 추가하고 매입 등록할게요. 계속할까요?")` 마지막 안전장치

---

## 사전조사 필요 항목 (구현 전)

다음 호출부가 매입 품종(`type='PURCHASED'`)을 의도치 않게 노출하지 않는지 grep 전수조사:

1. **잡곡 원물 입고**: `app/(dashboard)/raw-stocks/misc/add-misc-stock-dialog.tsx` — varieties prop 어떻게 받고 있나? `type='MISC_GRAIN'` 필터링되어 있는지
2. **벼 관련 화면**: 벼 품종 선택 자리들 — 기존에 `type !== 'MISC_GRAIN'` 같은 분기가 있을 듯, PURCHASED도 같이 제외되는지 확인
3. **품종 통계**: `output-statistics.ts` 등에서 type별 집계 — 매입이 별도 그룹으로 빠져야 자연스러움
4. **품종 관리 목록**: `/admin/varieties` 페이지에서 PURCHASED 품종도 보여줄지 (관리자 입장 — 보여주는 게 맞을 듯)
5. **공급처 자동완성**: 기존 `Variety.name`은 `@unique` (전역 유니크). 즉 `('보리', PURCHASED)` 와 `('보리', MISC_GRAIN)`이 동시 존재 불가. 매입 시 `findFirst`가 type 무관하게 매칭될 위험 → 매입에서 신규 등록 시 동일 name이 다른 type으로 이미 존재하면 → 가드(에러 반환 또는 사용자 안내)

→ #8-pre 단계로 분리해서 사전조사 결과 별도 문서화 (`docs/research-잡곡재고관리-#8.md`).

---

## 작업 단계 (4단계 분리)

### #8-pre — 사전조사
- `varieties` prop 흐름과 type 필터링 위치 grep 전수조사
- `Variety.name @unique` 충돌 케이스 정리 (매입 신규 시 동일명 다른 type 존재 처리 정책)
- 품종 관리 목록 노출 정책 결정
- 결과: `docs/research-잡곡재고관리-#8.md` (호출부 위험도별 정리)

### #8a — 격리 인프라 + Server Actions
**파일**: `lib/variety-labels.ts` (신규), `app/actions/admin.ts` (수정), `app/actions/misc-stock.ts` (수정), `app/(dashboard)/raw-stocks/page.tsx` (수정), `app/actions/packages.ts` (수정)

#### 격리 인프라 (사전조사 결과 반영)

- `lib/variety-labels.ts` 신규 — `TYPE_LABELS` 매핑 (URUCHI=메벼, GLUTINOUS=찰벼, INDICA=인디카, MISC_GRAIN=잡곡, OTHER=기타, PURCHASED=매입). 헬퍼 `getVarietyTypeLabel(type: string)`.
- `app/actions/admin.ts` — `getRiceVarieties()` 신설: `where: { category: 'RICE' }`. 벼 화면 전용
- `app/actions/misc-stock.ts:475` — `getMiscVarieties` where에 `type: { not: 'PURCHASED' }` 추가 (블랙리스트 — type 더 안 늘어날 것 사용자 결정 2026-05-07)
- `app/(dashboard)/raw-stocks/page.tsx:95` — `getVarieties()` → `getRiceVarieties()` 교체
- 기존 `getVarieties()`(전체 반환)는 `/admin/varieties` 전용으로 유지

#### 매입 Server Actions (`app/actions/packages.ts` 확장)

- `getPurchaseVarieties()`:
  - `prisma.variety.findMany({ where: { type: 'PURCHASED' }, select: { id: true, name: true }, orderBy: { name: 'asc' } })`
  - 매입 다이얼로그 자동완성 후보용
- `createMiscPurchase(input)`:
  - zod: `purchaseVendor(min1, max100)`, `varietyName(min1, max50)`, `incomingDate(YYYY-MM-DD)`, `packageType(min1, max20)`, `weightPerUnit(positive)`, `count(int positive)`
  - **품종 findOrCreate**: `findFirst({ name, type: 'PURCHASED' })` → 없으면 동일 name이 다른 type으로 존재하는지 확인 (`@unique` 위반 방지) → 충돌 시 `error: '이미 다른 곡종으로 등록된 품종이에요'`. 충돌 없으면 `create({ name, type: 'PURCHASED', category: 'MISC_GRAIN' })`
  - 받은 varietyId로 `prisma.millingOutputPackage.create` (source=PURCHASED, batchId=null, stockId=null, lotNo=null)
  - 응답에 `varietyCreated: boolean` 포함 → 클라이언트에서 toast `"새 품종 'XX' 등록 + 매입 등록 완료"` 분기
  - audit log + revalidatePath(`/packages`)
- `getMiscPurchaseEditContext(id)`:
  - 매입 레코드 단건 조회 + variety include
  - source=PURCHASED, category=MISC_GRAIN 가드
  - `MiscPurchaseEditContext { id, purchaseVendor, varietyId, varietyName, incomingDate, packageType, weightPerUnit, count }` 반환
- `updateMiscPurchase(id, input)`:
  - 품종 변경 가능 → 동일 findOrCreate 흐름 적용
  - zod 동일 셋 + variety findOrCreate
  - `prisma.millingOutputPackage.update` — source/category/batchId/stockId/lotNo는 그대로 (변경 X)
  - revalidatePath(`/packages`)
- `deleteMiscPurchase(id)`:
  - source=PURCHASED, category=MISC_GRAIN 가드 후 단순 `delete`
  - 사용 안 되는 PURCHASED 품종 삭제는 **안 함** (다른 매입 건이 참조 중일 수 있고, 향후 재사용 가능). 향후 별도 cleanup 작업으로
  - revalidatePath(`/packages`)

**검증**: `npx tsc --noEmit` 통과.

### #8b — 매입 등록 다이얼로그 + 패널 연결
**파일**: `app/(dashboard)/packages/misc-purchase-dialog.tsx` (신규), `misc-package-panel.tsx` (수정)

- `misc-purchase-dialog.tsx`:
  - `Dialog` shadcn, `sm:max-w-[500px]`, `max-h-[80vh] overflow-y-auto px-1` (모바일 fit 패턴 — #7d에서 정착)
  - **매입처**: `<Input list="vendors">` HTML datalist 자동완성. open 시 `getPurchaseVendors()` lazy fetch
  - **품종**: `<Input list="varieties">` HTML datalist 자동완성. open 시 `getPurchaseVarieties()` lazy fetch
    - 입력 박스 아래 실시간 안내:
      - 매칭됨: 회색 `'기존 품종 사용'`
      - 매칭 안됨: amber `'새 품종 'XX' 으로 등록돼요'`
    - 빈 입력은 안내 없음
  - **매입일**: `<Input type="date">`, default 오늘 (`new Date().toISOString().slice(0,10)`)
  - **포장단위**: 7칸 그리드 (`10/5/1kg + 800/500/420g + 기타`) — 잡곡 포장 다이얼로그와 동일 셋, 인라인 정의
  - **"기타" 선택 시**: 규격 라벨 + 단중(kg) 입력 두 칸
  - **개수**: 140px 고정폭 (#7d 정착 패턴)
  - **총 포장중량 미리보기**: 우측 상단 큰 폰트
  - **액션**: `취소` / `매입 등록`
  - **저장 시 신규 품종이면 confirm 한 번**: `"새 품종 'XX'을(를) 추가하고 매입 등록할게요. 계속할까요?"`
  - **저장 후 toast 분기**:
    - 신규 품종 자동 등록: `"새 품종 '흑보리' 등록 + 매입 등록 완료"`
    - 기존 품종: `"매입이 등록되었습니다."`
- `misc-package-panel.tsx`:
  - `+ 매입 등록` `disabled` 제거 + onClick에서 dialog open
  - `MiscPurchaseDialog` 마운트, varieties prop은 **불필요** (다이얼로그 내부에서 fetch)
  - `onSuccess`에서 `router.refresh()` + `triggerDataUpdate()`

**검증**: 신규 품종 매입 1건 등록 → Variety에 PURCHASED 레코드 추가 확인 / 잡곡 입고 다이얼로그 열어서 매입 품종이 노출 안 되는지 / 제품재고 잡곡 탭에 "매입" 뱃지로 노출 확인.

### #8c — 수정 다이얼로그 + 행 메뉴 활성화 + 품종 관리 UI 보완
**파일**: `app/(dashboard)/packages/edit-misc-purchase-dialog.tsx` (신규), `misc-package-panel.tsx`/`mobile-package-card.tsx`/`package-row.tsx` (수정), `app/(dashboard)/admin/varieties/variety-dialog.tsx` (수정)

- `edit-misc-purchase-dialog.tsx`:
  - 등록 다이얼로그와 거의 동일 구조 + open 시 `getMiscPurchaseEditContext(id)` lazy fetch + prefill
  - 입력 필드 모두 편집 가능 (매입처/품종/매입일/포장/개수)
  - 품종 변경 시 동일 findOrCreate 흐름 (신규 품종이면 confirm 안내)
- `misc-package-panel.tsx`:
  - `handleEditRow`에서 `row.source === 'PURCHASED'` 분기 추가 → 매입 수정 다이얼로그 open
  - `handleDeleteRow`에서 PURCHASED 분기 추가 → `deleteMiscPurchase` 호출 (확인 메시지 매입처/품종/규격 표시)
- `mobile-package-card.tsx`, `package-row.tsx`:
  - `purchased` 분기에서 `disabled` 조건 제거 (콜백만 있으면 자동 활성화)
  - "매입 행 수정/삭제는 #8에서 활성화" 툴팁 제거
- `variety-dialog.tsx` (관리자 품종 관리):
  - 라디오에 `PURCHASED` ("매입") 항목 추가 (관리자가 수동 등록·관리 가능하게)
  - 라디오 그리드 5개 → 6개로 확장

**검증**: 매입 수정 → 제품재고 갱신 / 매입 삭제 → 목록에서 사라짐 / 품종 관리 화면에서 "매입" 라디오 동작.

---

## 변경 파일 예상

| 단계 | 파일 | 종류 |
|------|------|------|
| #8-pre | `docs/research-잡곡재고관리-#8.md` | 신규 (사전조사) |
| #8a | `app/actions/packages.ts` | 수정 (액션 5개 신규: getPurchaseVarieties + create/update/delete/edit-context) |
| #8b | `app/(dashboard)/packages/misc-purchase-dialog.tsx` | 신규 |
| #8b | `app/(dashboard)/packages/misc-package-panel.tsx` | 수정 |
| #8c | `app/(dashboard)/packages/edit-misc-purchase-dialog.tsx` | 신규 |
| #8c | `app/(dashboard)/packages/misc-package-panel.tsx` | 수정 |
| #8c | `app/(dashboard)/packages/mobile-package-card.tsx` | 수정 |
| #8c | `app/(dashboard)/packages/package-row.tsx` | 수정 |
| #8c | `app/(dashboard)/admin/varieties/variety-dialog.tsx` | 수정 (PURCHASED 라디오 추가) |

---

## 결정사항 (2026-05-07)

1. ✅ **자동완성 컴포넌트**: 매입처·품종 모두 HTML datalist (가볍고 키보드/터치 호환 OK)
2. ✅ **품종 입력 방식**: D안 (텍스트 입력 + 백엔드 findOrCreate). type=`PURCHASED` 자동 부여
3. ✅ **품종 격리**: `Variety.type='PURCHASED'` 플래그로 매입 다이얼로그에서만 노출. 잡곡 입고·벼 품종 선택에서 제외
4. ✅ **오타 방지**: 입력 박스 아래 실시간 안내(매칭/신규) + 저장 시 신규면 confirm 한 번
5. **매입 행 수율 표시**: 매입은 수율 개념 없음 — 본 #8 범위 외 변경 없음
6. **벼 매입**: 본 #8은 잡곡(`category=MISC_GRAIN`)만. 벼 매입 흐름은 본 plan 범위 외
7. **권한**: 현재 `STOCK_MANAGE`로 통합 운영 중. 매입 분리(`PURCHASE_MANAGE`)는 #9.5에서 일괄 결정 (메모리 기존 결정)
8. **PURCHASED 품종 자동 cleanup**: 안 함. 매입 삭제 시 Variety 레코드는 그대로 보존 (재사용 / 다른 매입 참조 가능)
9. ✅ **`Variety.name @unique` 충돌 정책**: **등록 불가 + 안내**. 매입에서 신규 품종 등록 시 이미 다른 type으로 같은 name이 존재하면 곡종 정보를 포함한 안내 메시지로 차단
   - 예: 잡곡 '보리' 이미 등록 + 매입에서 '보리' 신규 등록 시도 → `"이미 '잡곡' 곡종으로 등록된 품종이에요. 다른 이름을 사용해주세요."` 토스트 + 저장 차단
   - 곡종 라벨 매핑: URUCHI=메벼, GLUTINOUS=찰벼, INDICA=인디카, MISC_GRAIN=잡곡, OTHER=기타, PURCHASED=매입

---

## 위험 / 주의

- **CHECK 제약**: 신규 매입 저장 시 zod 검증 → 안전. 단 마이그레이션 시점에 `pkg_purchased_required_fields` 제약 위반 케이스가 prod에 남아있는지는 #1 단계에서 확인 완료(통과). 추가 위험 없음.
- **자동완성 fetch 타이밍**: 다이얼로그 open 시 `getPurchaseVendors()` 1회 fetch. 매입처 데이터 규모 작아 캐시 불필요.
- **품종 필터링**: `varieties.filter(v => v.category === 'MISC_GRAIN')` — page에서 props로 받을 때 카테고리 필터 누락 시 RICE 품종이 매입에 들어갈 수 있음. panel 레벨에서 한 번 더 가드.

---

## 다음 진행 흐름

1. 본 계획 사용자 승인
2. #8a 구현 → 타입체크 → 커밋
3. #8b 구현 → 등록 1건 검수 → 커밋
4. #8c 구현 → 수정/삭제 검수 → 커밋
5. 메모리 갱신 (`#8 완료, 다음 #9 사이드바/모바일 네비`) + worklog 갱신
