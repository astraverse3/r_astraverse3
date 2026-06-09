# 사전조사 — 잡곡 재고관리 #8 매입 등록

작성일: 2026-05-07
선행: `docs/plan-잡곡재고관리-#8.md`
목적: `Variety.type='PURCHASED'` 신규 값을 추가했을 때, 다른 화면에서 매입 품종이 노출되지 않도록 호출부 전수조사

---

## 핵심 결론

**가장 큰 위험은 벼 입고 다이얼로그**. 현재 `getVarieties()`가 필터링 없이 모든 품종을 반환하므로 PURCHASED가 벼 선택지에 섞여 들어감. **잡곡 입고도 category 필터만 있어 type 추가 가드 필요**. 통계·lot 생성·품종관리는 이미 안전.

---

## 위험도별 정리

### 🔴 높음 — 벼 입고 다이얼로그 (`getVarieties` 무필터)

**경로**:
- `app/(dashboard)/raw-stocks/page.tsx:95` — `getVarieties()` 호출
- `app/(dashboard)/raw-stocks/add-stock-dialog.tsx:222` — varieties 그대로 map (필터 없음)
- `app/(dashboard)/raw-stocks/edit-stock-dialog.tsx:30` — 동일 패턴

**문제 코드** (`app/actions/admin.ts:20-31`):
```ts
export async function getVarieties() {
    await requireSession()
    const varieties = await prisma.variety.findMany({
        orderBy: { name: 'asc' }
    })
    return { success: true, data: varieties }
}
```
→ 전체 type 반환. PURCHASED 추가 시 벼 입고 Select에 노출됨.

**해결 방향 (안 A — 신규 함수)**:
- `getRiceVarieties()` 신설: `where: { category: 'RICE' }` 또는 `type IN ('URUCHI', 'GLUTINOUS', 'INDICA', 'OTHER')`
- `raw-stocks/page.tsx:95`만 변경

**해결 방향 (안 B — 기존 함수 시그니처 변경)**:
- `getVarieties({ category }: { category?: 'RICE' | 'MISC_GRAIN' })` 옵션 추가
- 기존 호출 전부 영향 (admin/varieties 페이지 등) → **권장 안 함**

→ **안 A 채택**. 전체 노출이 필요한 자리(`/admin/varieties`)는 기존 `getVarieties()` 그대로, 벼 화면만 신규 함수.

---

### 🔴 높음 — 잡곡 원물 입고 (category만 필터, type 미고려)

**경로**:
- `app/(dashboard)/raw-stocks/page.tsx:131` — `getMiscVarieties()` 호출
- `app/(dashboard)/raw-stocks/misc/misc-stock-panel.tsx:146` — varieties prop 전달
- `app/(dashboard)/raw-stocks/misc/add-misc-stock-dialog.tsx:390` — Select 매핑

**현재 함수** (`app/actions/misc-stock.ts:475-482`):
```ts
export async function getMiscVarieties() {
    await requireSession()
    const varieties = await prisma.variety.findMany({
        where: { category: 'MISC_GRAIN' },  // category 필터만
        orderBy: { name: 'asc' },
    })
    return { success: true, data: varieties }
}
```

**문제**: PURCHASED 품종을 plan에 따라 `category='MISC_GRAIN'`로 저장하면 → category 필터만으로는 잡곡 입고에서 노출됨.

**해결 방향**: `getMiscVarieties` where 절을 다음 중 하나로 변경:
- `{ category: 'MISC_GRAIN', type: { not: 'PURCHASED' } }` (간결, PURCHASED 명시 제외)
- `{ type: 'MISC_GRAIN' }` (type 기반, category 무시)

→ **첫 번째 채택**. category 분류는 큰 격리 유지, type 추가 가드.

---

### 🟢 안전 — 통계/대시보드 (이미 격리)

- `app/actions/output-statistics.ts:97-102` — `where: { batch: { ... } }`로 PURCHASED 자동 제외 (매입은 batchId=null)
- `app/actions/dashboard.ts:21-49` — 벼는 `category='RICE'` 명시 필터. PURCHASED(category=MISC_GRAIN)는 자동 제외

→ 추가 가드 불필요.

---

### 🟢 안전/의도된 노출 — 품종 관리 (`/admin/varieties`)

- `app/(dashboard)/admin/varieties/page.tsx:7` — `getVarieties()` 전체 조회
- 관리자 입장에서 모든 type 표시 필요 (plan §"품종 격리" 매트릭스 일치)

→ 현행 유지. **#8c 단계에서 `variety-dialog.tsx` 라디오에 "매입" 항목만 추가**.

---

### 🟢 안전 — Lot 생성 (PURCHASED는 호출 안 됨)

- `lib/lot-generation.ts:73-93` — `generateLotNo` / `getProductCode` 호출 자리는 모두 도정/잡곡 입고 흐름. PURCHASED는 Stock 경유 안 하므로 호출 자체가 발생 안 함
- 혹시 실수로 호출되면 `getProductCode`가 미지정 type에 대해 fallback 동작 (`'00'` 반환) → 안전

→ 추가 방어 불필요.

---

## `Variety.name @unique` 충돌 정책

### 시나리오
```
DB:
  - id=1, name='보리', type='MISC_GRAIN'

매입에서 '보리' 입력 → 시도:
  prisma.variety.findFirst({ where: { name: '보리', type: 'PURCHASED' } })
    → 0건 (type 미매칭)
  prisma.variety.create({ name: '보리', type: 'PURCHASED', ... })
    → ❌ UNIQUE 제약 위반 (name 전역 유니크)
```

### 처리 (사용자 결정 — 등록 차단 + 안내)
`createMiscPurchase` / `updateMiscPurchase` 내부 흐름:
```ts
// 1) 같은 type 매칭 우선 (재사용)
let variety = await prisma.variety.findFirst({
    where: { name: varietyName, type: 'PURCHASED' }
})

// 2) 같은 type 없으면 — 다른 type으로 충돌하는지 확인
if (!variety) {
    const conflict = await prisma.variety.findFirst({
        where: { name: varietyName }
    })
    if (conflict) {
        const typeLabel = TYPE_LABELS[conflict.type] ?? conflict.type
        return {
            success: false,
            error: `이미 '${typeLabel}' 곡종으로 등록된 품종이에요. 다른 이름을 사용해주세요.`
        }
    }
    // 3) 충돌 없음 — 신규 생성
    variety = await prisma.variety.create({
        data: { name: varietyName, type: 'PURCHASED', category: 'MISC_GRAIN' }
    })
}
```

### TYPE_LABELS 매핑 (한글)
```ts
const TYPE_LABELS: Record<string, string> = {
    URUCHI: '메벼',
    GLUTINOUS: '찰벼',
    INDICA: '인디카',
    MISC_GRAIN: '잡곡',
    OTHER: '기타',
    PURCHASED: '매입',
}
```

→ `lib/`에 두기 적절 (`lib/variety-labels.ts` 신규 또는 `app/actions/packages.ts` 내부 인라인).

---

## 수정해야 할 호출부 정리 (#8 본 작업과 함께)

| 우선순위 | 파일 | 변경 내용 |
|---------|------|----------|
| 🔴 #8a | `app/actions/admin.ts` | `getRiceVarieties()` 신설 |
| 🔴 #8a | `app/actions/misc-stock.ts:475` | `getMiscVarieties` where에 `type: { not: 'PURCHASED' }` 추가 |
| 🔴 #8a | `app/(dashboard)/raw-stocks/page.tsx:95` | `getVarieties()` → `getRiceVarieties()` 교체 |
| 🟢 #8c | `app/(dashboard)/admin/varieties/variety-dialog.tsx` | `PURCHASED` 라디오 추가 |

→ #8a actions 단계에서 "벼/잡곡 분리 가드" 변경도 같이 처리해야 안전. plan-#8.md §#8a 보강 필요.

---

## 추가 발견 사항

- `app/(dashboard)/admin/varieties/variety-list-client.tsx`도 type 라벨 매핑이 자체적으로 있을 가능성 → "매입" 라벨 표시 위해 매핑 보완 필요할 수 있음 (#8c에서 함께 점검)
- `getMiscFarmers()` 같은 패턴 액션이 잡곡 전용으로 이미 분리되어 있어 일관성 OK