# 계획서: 재고분석 페이지 모바일 UI 개선

> 작성일: 2026-04-07  
> 작업명: stock-stats-mobile  
> 경로: `/statistics/stock`

---

## 배경 및 목표

재고분석 페이지는 PC 중심으로 구현되어 모바일에서 필터 UI가 지저분하게 쌓이고,
차트가 `h-[416px]` 고정으로 화면을 지나치게 많이 차지한다.
수율분석(`milling-stats-client.tsx`)에서 완성된 패턴을 그대로 적용한다.

---

## 현재 문제점

| 영역 | 문제 |
|------|------|
| 필터 바 | `flex flex-wrap` 방식 - 드롭다운 5개가 모바일에서 3~4줄로 쌓임 |
| 차트 | `h-[416px]` 고정 - 모바일에서 너무 높아 스크롤이 많이 필요함 |
| 탭 바 | 모바일 필터 접근 버튼 없음 |
| 칩 표시 | `hasActiveFilters` 조건부라 초기 상태에선 칩 행 자체가 없음 |

---

## 설계 (수율분석 패턴 적용)

### 1. 탭 바 우측 - 모바일 필터 버튼 (`md:hidden`)

```tsx
// 탭 바 오른쪽 영역 (현재 빈 div)
<div className="ml-auto flex items-center gap-1 pr-2">
  {isPending && <RefreshCw className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
  {/* 모바일 전용 필터 버튼 */}
  <button
    onClick={() => setShowFilter(true)}
    className={`md:hidden flex items-center gap-1.5 h-8 px-2 rounded-lg border text-xs font-semibold ${
      activeFilterCount > 0
        ? 'bg-[#00a2e8]/10 text-[#00a2e8] border-[#00a2e8]/30'
        : 'text-slate-600 border-slate-200 hover:bg-slate-50'
    }`}
  >
    <SlidersHorizontal className="w-4 h-4" />
    {activeFilterCount > 0 && (
      <span className="h-5 px-1.5 bg-[#00a2e8]/20 text-[#008cc9] ml-0.5 rounded-full text-[10px] flex items-center">
        {activeFilterCount}
      </span>
    )}
  </button>
</div>
```

### 2. PC 인라인 필터 - `hidden md:block` 래퍼

현재 `<div className="px-4 py-3 flex flex-wrap ...">` 필터 전체를 `hidden md:block` div로 감싼다.

### 3. 모바일 칩 표시 영역 - `md:hidden`

현재 조건부 칩 행을 항상 표시되는 모바일 전용 칩 행으로 교체.

```
mobile: 항상 보임 (연산년산 칩 + 활성 필터 칩들)
PC: 기존 `hasActiveFilters` 조건부 칩 행 유지
```

### 4. 바텀시트 팝업 (`showFilter` 상태 추가)

수율분석과 동일한 위치/크기:
```
fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+8px)] left-3 right-3 z-50
```

**팝업 내 필터 섹션:**
- **연산** - 버튼 그룹 (productionYears)
- **인증구분** - 버튼 그룹 (유기농/무농약/일반)
- **작목반** - 버튼 그룹 (groupOptions, 많을 경우 `flex-wrap`)
- **품종** - 버튼 그룹 (varietyOptions, `flex-wrap`)
- **생산자** - 텍스트 입력 (쉼표 구분)

**하단 버튼:** 초기화 / 검색

> 단, 연산 변경과 인증구분 변경 시 옵션만 새로 로드하는 로직은 팝업 내에서도 동작해야 함.
> 팝업이 열려있는 동안 연산/인증구분/작목반 변경은 **옵션 갱신만** 하고, 검색 버튼 클릭 시 데이터 조회.

### 5. 차트 높이 반응형

```tsx
// 변경 전
<div className="flex-1 bg-white ... flex flex-col h-[416px]">

// 변경 후
<div className="flex-1 bg-white ... flex flex-col h-[260px] md:h-[416px]">
```

### 6. 활성 필터 카운트 계산

```ts
const activeFilterCount = [
  year !== (productionYears[0] ?? initYear),  // 기본 연산과 다를 때
  selectedCertTypes.length > 0,
  selectedGroupIds.length > 0,
  selectedVarietyIds.length > 0,
  farmerNameInput.trim().length > 0,
].filter(Boolean).length
```

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `app/(dashboard)/statistics/stock/stock-stats-client.tsx` | 모바일 바텀시트 팝업, PC 인라인 필터 분리, 차트 높이 반응형 |

---

## 작업 순서

- [x] 1. `showFilter` 상태 및 `activeFilterCount` 계산 추가 (2026-04-07)
- [x] 2. 탭 바 우측에 모바일 필터 버튼 추가 (`md:hidden`) (2026-04-07)
- [x] 3. 기존 필터 바를 `hidden md:block` 래퍼로 감싸기 (2026-04-07)
- [x] 4. 모바일 칩 표시 영역 (`md:hidden`) 추가 (2026-04-07)
- [x] 5. 바텀시트 팝업 구현 (연산·인증·작목반·품종·생산자) (2026-04-07)
- [x] 6. 차트 높이 `h-[260px] md:h-[416px]`로 변경 (2026-04-07)
- [ ] 7. 빌드 확인
