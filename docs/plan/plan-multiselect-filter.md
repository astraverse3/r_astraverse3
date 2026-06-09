# 계획서: 검색필터 멀티셀렉트 및 생산자 다중검색

## 작업 목표

재고, 도정 목록, 생산자관리 페이지의 검색필터에서:
1. 년도, 인증, 품종 select box → 복수 선택 가능한 멀티셀렉트로 전환
2. 생산자 텍스트 검색 → 쉼표(`,`) 구분으로 여러 생산자 동시 검색
3. 모든 텍스트 검색 입력값 앞뒤 공백 자동 제거(trim)

---

## 변경 파일 목록 (9개)

| 파일 | 변경 내용 |
|---|---|
| `components/ui/multi-select.tsx` | **신규**: 멀티셀렉트 공통 컴포넌트 |
| `app/(dashboard)/stocks/stock-filters.tsx` | 년도·인증·품종 → 멀티셀렉트, 생산자 trim |
| `app/(dashboard)/stocks/active-filters.tsx` | 멀티값 배지 표시 |
| `app/(dashboard)/milling/milling-filters.tsx` | 품종 → 멀티셀렉트, 생산자·키워드 trim |
| `app/(dashboard)/milling/active-milling-filters.tsx` | 멀티값 배지 표시 |
| `app/(dashboard)/admin/farmers/farmer-filters.tsx` | 인증·년도 → 멀티셀렉트, 생산자·작목반 trim |
| `app/actions/stock.ts` | 멀티값·콤마 생산자 쿼리 처리 |
| `app/actions/milling.ts` | 멀티값·콤마 생산자 쿼리 처리 |
| `app/actions/admin.ts` | 멀티값·콤마 생산자 쿼리 처리 |

---

## 단계별 접근 방식

### 1단계: MultiSelect 컴포넌트 신규 생성

**파일:** `components/ui/multi-select.tsx`

- Popover + 체크박스 목록 패턴 (shadcn/ui 스타일)
- Props: `options`, `value: string[]`, `onValueChange`, `placeholder`
- 선택 없음(`[]`) = "전체"로 표시
- 선택 항목이 있으면 버튼에 `유기농, 무농약` 또는 `2개 선택`으로 표시
- 아이템 클릭 시 토글(추가/제거)

```tsx
// 사용 예시
<MultiSelect
  options={[
    { label: '유기농', value: '유기농' },
    { label: '무농약', value: '무농약' },
    { label: '일반', value: '일반' },
  ]}
  value={cert}              // string[]
  onValueChange={setCert}   // (val: string[]) => void
  placeholder="전체"
/>
```

---

### 2단계: URL 파라미터 규칙 (멀티셀렉트)

멀티셀렉트 값은 URL에서 쉼표로 구분:
- 전체(선택 없음): 파라미터 없음
- 단일 선택: `certType=유기농`
- 복수 선택: `certType=유기농,무농약`

State 타입 변경:
```
기존: const [cert, setCert] = useState<string>('ALL')
변경: const [cert, setCert] = useState<string[]>([])
```

URL 파라미터 읽기:
```ts
// 콤마로 분리해서 배열로 복원
const certParam = searchParams.get('certType') || ''
const cert = certParam ? certParam.split(',') : []
```

URL 파라미터 쓰기:
```ts
if (cert.length > 0) params.set('certType', cert.join(','))
```

---

### 3단계: 텍스트 검색 Trim + 콤마 생산자 검색

**Trim 처리** — `handleApply`에서 적용:
```ts
if (farmerName.trim()) params.set('farmerName', farmerName.trim())
```

**생산자 Input 플레이스홀더 변경:**
```
기존: "생산자명 검색"
변경: "예: 홍길동, 김철수"
```

---

### 4단계: 각 필터 페이지 State 변경

#### 재고 (`stock-filters.tsx`)
| 필드 | 기존 | 변경 |
|---|---|---|
| `year` | `string` ('ALL') | `string[]` ([]) |
| `variety` | `string` ('ALL') | `string[]` ([]) |
| `cert` | `string` ('ALL') | `string[]` ([]) |
| `farmerName` | `string` | `string` (trim 추가) |

#### 도정 (`milling-filters.tsx`)
| 필드 | 기존 | 변경 |
|---|---|---|
| `variety` | `string` ('ALL') | `string[]` ([]) |
| `farmerName` | `string` | `string` (trim 추가) |
| `keyword` | `string` | `string` (trim 추가) |

#### 생산자관리 (`farmer-filters.tsx`)
| 필드 | 기존 | 변경 |
|---|---|---|
| `certType` | `string` ('ALL') | `string[]` ([]) |
| `cropYear` | `string` ('ALL') | `string[]` ([]) |
| `farmerName` | `string` | `string` (trim 추가) |
| `groupName` | `string` | `string` (trim 추가) |

---

### 5단계: Active Filters 배지 표시 업데이트

멀티값 배지 표시:
```tsx
// 기존 (단일값)
{cert && cert !== 'ALL' && <Badge>{cert}</Badge>}

// 변경 (멀티값 - URL에서 콤마 분리해서 각각 배지)
{certTypes.map(c => <Badge key={c}>{c}</Badge>)}
```

---

### 6단계: 백엔드 쿼리 수정

#### `getStocks` (stock.ts)

```ts
// 멀티 certType (콤마 → OR 조건)
if (params?.certType) {
  const certList = params.certType.split(',').map(s => s.trim()).filter(Boolean)
  if (certList.length === 1) {
    where.farmer.group = { certType: certList[0] }
  } else if (certList.length > 1) {
    // Prisma OR 조건
    where.OR = certList.map(c => ({ farmer: { group: { certType: c } } }))
  }
}

// 멀티 productionYear (콤마 → in 조건)
if (params?.productionYear) {
  const years = params.productionYear.split(',').map(s => parseInt(s.trim())).filter(Boolean)
  where.productionYear = years.length === 1 ? years[0] : { in: years }
}

// 멀티 varietyId (콤마 → in 조건)
if (params?.varietyId) {
  const ids = params.varietyId.split(',').map(s => parseInt(s.trim())).filter(Boolean)
  where.varietyId = ids.length === 1 ? ids[0] : { in: ids }
}

// 콤마 생산자 검색
if (params?.farmerName) {
  const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
  if (names.length === 1) {
    where.farmer = { name: { contains: names[0] } }
  } else {
    where.OR = names.map(n => ({ farmer: { name: { contains: n } } }))
  }
}
```

#### `getMillingLogs` (milling.ts)

```ts
// 멀티 variety (콤마 → OR 조건)
if (params?.variety) {
  const varieties = params.variety.split(',').map(s => s.trim()).filter(Boolean)
  andConditions.push({
    OR: varieties.map(v => ({
      stocks: { some: { variety: { name: { contains: v } } } }
    }))
  })
}

// 콤마 생산자 검색
if (params?.farmerName) {
  const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
  andConditions.push({
    OR: names.map(n => ({
      stocks: { some: { farmer: { name: { contains: n } } } }
    }))
  })
}
```

#### `getFarmersWithGroups` (admin.ts)

```ts
// 멀티 certType
if (params?.certType) {
  const certList = params.certType.split(',').map(s => s.trim()).filter(Boolean)
  if (certList.length > 0) {
    where.group = { ...where.group, certType: { in: certList } }
  }
}

// 멀티 cropYear
if (params?.cropYear) {
  const years = params.cropYear.split(',').map(s => parseInt(s.trim())).filter(Boolean)
  if (years.length > 0) {
    where.group = { ...where.group, cropYear: { in: years } }
  }
}

// 콤마 생산자 검색 (farmerName)
if (params?.farmerName) {
  const names = params.farmerName.split(',').map(s => s.trim()).filter(Boolean)
  if (names.length === 1) {
    where.name = { contains: names[0] }
  } else if (names.length > 1) {
    where.OR = names.map(n => ({ name: { contains: n } }))
  }
}
```

---

## activeFilterCount 계산 변경

```ts
// 기존
year !== 'ALL'     // boolean

// 변경
year.length > 0    // boolean (배열)
```

---

## 주의사항

1. **재고 페이지**: `productionYear` 기본값 로직 유지 (10월 이전 → 전년도, 11월 이후 → 올해). URL에 `productionYear` 없으면 `[defaultYear]`로 초기화. 초기화 버튼 시 `productionYear=defaultYear`로 push (기존 동일)
2. **milling 페이지 status 필터**: 'open'/'closed' 2개 항목만 있어 멀티셀렉트 효용 낮음 → 그대로 단일 셀렉트 유지
3. **Prisma OR + AND 충돌 주의**: 기존 코드에서 `where.farmer` 객체에 직접 추가하는 패턴이 있는데, OR 조건으로 전환 시 구조 변경 필요

---

## 작업 순서

1. `components/ui/multi-select.tsx` 생성
2. `stock-filters.tsx` 수정
3. `active-filters.tsx` 수정
4. `app/actions/stock.ts` 수정
5. `milling-filters.tsx` 수정
6. `active-milling-filters.tsx` 수정
7. `app/actions/milling.ts` 수정
8. `farmer-filters.tsx` 수정
9. `app/actions/admin.ts` 수정
