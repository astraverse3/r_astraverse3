# Handoff: 포장 기록 다이얼로그 — 라인 1행 통합

## Overview

`add-packaging-dialog.tsx` 의 포장 목록 아이템이 현재 **2행 구조** (규격·수량·중량 / 포장지 select 별도 줄)로 되어 있어 다이얼로그가 길어지는 문제가 있습니다.  
이 핸드오프는 각 규격 라인을 **1행으로 압축**하여, 포장지 select를 인라인으로 통합하는 변경사항을 기술합니다.

## About the Design Files

`포장라인-1행-시안.html` 은 **HTML 디자인 레퍼런스**입니다. 실제 배포 코드가 아니며, 기존 Next.js / shadcn-ui / Tailwind 환경의 `add-packaging-dialog.tsx` 에 동일한 레이아웃을 재구현하는 것이 목표입니다.

## Fidelity

**High-fidelity** — 컬러, 타이포그래피, 간격, 컬럼 폭이 실제 앱 스펙과 동일하게 작성되었습니다. 픽셀 정확도로 재현해 주세요.

---

## 변경 대상 파일

```
app/(dashboard)/milling/add-packaging-dialog.tsx
```

---

## 변경 내용 상세

### 1. 기존 구조 (Before)

각 `groupOutputs` 아이템이 **2개의 div**로 렌더링됩니다.

```tsx
<div className="px-3 py-1.5">
  {/* Row 1: 규격 / 수량 / 중량 / 삭제 */}
  <div className="grid grid-cols-[52px_1fr_92px_28px] items-center gap-1">
    <Badge>...</Badge>
    <div className="stepper">...</div>
    <div className="weight">...</div>
    <Button>삭제</Button>
  </div>

  {/* Row 2: 포장지 — 잔량 제외, 별도 줄 */}
  {o.packageType !== PKG_REMAINDER && (
    <div className="pl-[56px] pt-1">
      <select className="h-7 w-full max-w-[180px] ...">...</select>
    </div>
  )}
</div>
```

### 2. 변경 구조 (After)

**Row 2를 제거**하고, 포장지 select를 Row 1 그리드의 두 번째 열로 인라인 배치합니다.

```tsx
<div className="px-3 py-[5px]">
  <div className="grid grid-cols-[40px_140px_1fr_58px_24px] items-center gap-1">
    {/* 1. 규격 badge — 40px */}
    <Badge variant="secondary" className="...justify-center text-[11px]">
      {o.packageType}
    </Badge>

    {/* 2. 포장지 — 140px 고정 */}
    {o.packageType === PKG_TONBAG ? (
      <span className="text-[11px] text-stone-400 pl-0.5">포장지: 톤백</span>
    ) : o.packageType === PKG_REMAINDER ? (
      <span className="text-[11px] text-stone-200 pl-0.5">—</span>
    ) : isClosed || !canManage ? (
      <span className="text-[11px] text-stone-400 truncate">
        {packagings.find(p => p.id === o.packagingId)?.name ?? '미지정'}
      </span>
    ) : (
      <select
        value={o.packagingId ?? ''}
        onChange={(e) => setPackaging(i, e.target.value ? Number(e.target.value) : null)}
        className="h-[26px] w-full rounded-md border border-stone-200 bg-white px-1.5 pr-5 text-[11px] text-stone-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a8a29e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
        }}
      >
        <option value="">포장지 미지정</option>
        {packagings.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    )}

    {/* 3. 수량 stepper — 1fr ≈ 126px (내용 76px, 센터 정렬) */}
    {isClosed || !canManage ? (
      <span className="text-[12px] font-mono font-bold text-stone-600 text-center">{o.count}개</span>
    ) : (
      <div className="flex items-center justify-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 ..." onClick={() => updateCount(i, -1)}>
          <Minus className="h-3 w-3" />
        </Button>
        <Input ... className="w-9 h-6 text-center ..." />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 ..." onClick={() => updateCount(i, 1)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    )}

    {/* 4. 중량 — 58px */}
    <div className="flex items-center gap-1 justify-end w-full">
      {(o.packageType === '톤백' || o.packageType === '잔량') ? (
        /* 직접 입력 input: 38px + "kg" 단위 */
        <>
          <Input
            type="number"
            value={o.weightPerUnit}
            onChange={(e) => setWeight(i, parseFloat(e.target.value))}
            className="h-6 w-[38px] text-right text-[11px] border-stone-200 rounded px-1"
          />
          <span className="text-[10px] text-stone-400">kg</span>
        </>
      ) : (
        <span className="text-[12px] font-bold text-stone-600 whitespace-nowrap">
          {(o.weightPerUnit * o.count).toLocaleString()} kg
        </span>
      )}
    </div>

    {/* 5. 삭제 — 24px */}
    {!isClosed && canManage ? (
      <Button variant="ghost" size="icon" className="h-6 w-6 ..." onClick={() => removePackage(i)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    ) : <div />}
  </div>
</div>
```

---

## 그리드 컬럼 스펙

| 열 | 기존 | 변경 후 | 비고 |
|---|---|---|---|
| 규격 | `52px` | `40px` | Badge, 텍스트 11px |
| 포장지 | _(별도 2행)_ | **`140px` 고정** | 최장 "땅끝에서보냅니다" 131px 기준 |
| 수량 stepper | `1fr` | **`1fr`** | 내용 76px, 나머지 공간 흡수 |
| 중량 | `92px` | **`58px`** | 고정 중량: 숫자+kg / 톤백·잔량: input 38px + "kg" |
| 삭제 | `28px` | **`24px`** | 아이콘 버튼 |

**다이얼로그 폭 계산 기준:**
```
dialog max-w-[500px]
  └─ DialogContent px-6 (24px × 2) → 452px
       └─ group card margin 12px × 2 → 428px
            └─ item px-3 (12px × 2) → grid area 404px
                 └─ gap-1 (4px × 4) = 16px
                      └─ stepper 1fr = 404 - 40 - 140 - 58 - 24 - 16 = 126px
```

---

## 포장지 select 동작 규칙 (기존과 동일)

| 규격 | 포장지 열 표시 |
|---|---|
| 일반 규격 (20kg, 10kg 등) | `<select>` 드롭다운 (편집 가능) / 텍스트 (읽기 전용) |
| 톤백 | 고정 텍스트 `"포장지: 톤백"` |
| 잔량 | `—` (SKU 미부여, 빈 공간 처리) |

---

## 제거 대상

```tsx
// 아래 블록 전체 삭제
{o.packageType !== PKG_REMAINDER && (
  <div className="pl-[56px] pt-1">
    ...
  </div>
)}
```

---

## Design Tokens

| 토큰 | 값 |
|---|---|
| Primary | `#2563eb` |
| 텍스트 (기본) | `text-stone-600` = `#57534e` |
| 텍스트 (약함) | `text-stone-400` = `#a8a29e` |
| 보더 | `border-stone-200` = `#e7e5e4` |
| 배경 (뱃지) | `bg-stone-100` = `#f5f5f4` |
| Select 높이 | `h-[26px]` |
| Select 폰트 | `text-[11px]` |
| 아이템 세로 패딩 | `py-[5px]` (기존 `py-1.5` → 약간 줄임) |

---

## Files

| 파일 | 설명 |
|---|---|
| `포장라인-1행-시안.html` | Before / After 비교 디자인 레퍼런스 |
| `README.md` | 이 문서 |
