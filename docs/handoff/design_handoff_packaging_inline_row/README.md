# Handoff: 포장 기록 다이얼로그 — 라인 1행 통합 (반응형)

## Overview

`add-packaging-dialog.tsx` 의 포장 목록 아이템이 현재 **2행 구조** (규격·수량·중량 / 포장지 select 별도 줄)로 되어 있어 다이얼로그가 세로로 길어집니다.
이 핸드오프는 각 규격 라인을 **1행으로 압축**하여 포장지 select를 인라인 통합하는 변경사항을 기술합니다. **모바일(좁은 폭)에서도 한 줄을 유지**하는 것이 핵심 목표입니다.

## About the Design Files

- `포장라인-1행-모바일-시안.html` — **모바일(375px) 기준** 레퍼런스. 실제 사용 화면이 모바일이므로 이쪽이 1차 기준입니다.
- `포장라인-1행-시안.html` — 데스크탑(500px) Before/After 비교 레퍼런스.

둘 다 HTML 디자인 레퍼런스이며 배포 코드가 아닙니다. 기존 Next.js / shadcn-ui / Tailwind 환경의 `add-packaging-dialog.tsx` 에 동일 레이아웃을 재구현하는 것이 목표입니다.

## Fidelity

**High-fidelity** — 컬러·타이포·간격·컬럼 폭을 실제 앱 스펙으로 작성했습니다. 픽셀 정확도로 재현해 주세요.

---

## 변경 대상 파일

```
app/(dashboard)/milling/add-packaging-dialog.tsx
```

`DialogContent` 는 `sm:max-w-[500px]` 이므로 **모바일에서는 화면 폭에 꽉 차고(좁음), 데스크탑(≥640px)에서는 500px** 입니다. → 그리드를 반응형으로 잡아야 합니다.

---

## 핵심 변경

### Before — 2행 구조

```tsx
<div className="px-3 py-1.5">
  {/* Row 1 */}
  <div className="grid grid-cols-[52px_1fr_92px_28px] items-center gap-1">
    <Badge>{o.packageType}</Badge>
    <div>{/* 수량 stepper */}</div>
    <div>{/* 중량 */}</div>
    <Button>{/* 삭제 */}</Button>
  </div>
  {/* Row 2 — 별도 줄 (삭제 대상) */}
  {o.packageType !== PKG_REMAINDER && (
    <div className="pl-[56px] pt-1">
      <select className="h-7 w-full max-w-[180px] ...">...</select>
    </div>
  )}
</div>
```

### After — 1행 통합 (반응형)

Row 2를 제거하고, 포장지를 Row 1 그리드의 **2번째 열**로 인라인 배치합니다.

```tsx
<div className="px-2 sm:px-3 py-1.5">
  {/* 모바일: 36px 1fr 64px 52px 22px / 데스크탑: 40px 140px 1fr 58px 24px */}
  <div className="grid grid-cols-[36px_1fr_64px_52px_22px] sm:grid-cols-[40px_140px_1fr_58px_24px] items-center gap-1">

    {/* 1. 규격 */}
    <Badge variant="secondary" className="w-full justify-center text-[11px] px-0">
      {o.packageType}
    </Badge>

    {/* 2. 포장지 — 모바일 1fr(말줄임) / 데스크탑 140px 고정 */}
    {o.packageType === PKG_TONBAG ? (
      <span className="text-[11px] text-stone-400 pl-0.5 truncate">포장지: 톤백</span>
    ) : o.packageType === PKG_REMAINDER ? (
      <span className="text-[11px] text-stone-300 pl-0.5">—</span>
    ) : (isClosed || !canManage) ? (
      <span className="text-[11px] text-stone-400 truncate">
        {packagings.find(p => p.id === o.packagingId)?.name ?? '미지정'}
      </span>
    ) : (
      <select
        value={o.packagingId ?? ''}
        onChange={(e) => setPackaging(i, e.target.value ? Number(e.target.value) : null)}
        className="h-7 w-full min-w-0 truncate rounded-md border border-stone-200 bg-white pl-2 pr-5 text-[11px] text-stone-600 appearance-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a8a29e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
        }}
      >
        <option value="">포장지 미지정</option>
        {packagings.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    )}

    {/* 3. 수량 stepper */}
    {(isClosed || !canManage) ? (
      <span className="text-[12px] font-mono font-bold text-stone-700 text-center">{o.count}</span>
    ) : (
      <div className="flex items-center justify-center">
        <Button variant="ghost" size="icon" className="h-[22px] w-[22px] shrink-0 text-stone-400" onClick={() => updateCount(i, -1)}>
          <Minus className="h-3 w-3" />
        </Button>
        <Input value={o.count} readOnly className="w-5 h-6 border-0 bg-transparent text-center text-[12px] font-bold p-0 font-mono" />
        <Button variant="ghost" size="icon" className="h-[22px] w-[22px] shrink-0 text-stone-400" onClick={() => updateCount(i, 1)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    )}

    {/* 4. 중량 */}
    <div className="flex items-center gap-0.5 justify-end">
      {(o.packageType === PKG_TONBAG || o.packageType === PKG_REMAINDER) ? (
        <>
          <Input
            type="number"
            value={o.weightPerUnit}
            onChange={(e) => setWeight(i, parseFloat(e.target.value) || 0)}
            className="h-6 w-9 text-right text-[11px] border-stone-200 rounded px-1"
          />
          <span className="text-[9px] text-stone-400">kg</span>
        </>
      ) : (
        <span className="text-[12px] font-bold text-stone-700 whitespace-nowrap">
          {(o.weightPerUnit * o.count).toLocaleString()}<span className="text-[9px] text-stone-400 ml-px">kg</span>
        </span>
      )}
    </div>

    {/* 5. 삭제 */}
    {(!isClosed && canManage) ? (
      <Button variant="ghost" size="icon" className="h-[22px] w-[22px] mx-auto text-stone-300 hover:text-red-500" onClick={() => removePackage(i)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    ) : <div />}
  </div>
</div>
```

---

## 그리드 컬럼 스펙

| 열 | 모바일 (`<640px`) | 데스크탑 (`sm:`) | 비고 |
|---|---|---|---|
| 규격 | `36px` | `40px` | Badge, 11px |
| **포장지** | **`1fr` (말줄임)** | **`140px` 고정** | 모바일은 좁아 truncate, 데스크탑은 전체 표시 |
| 수량 stepper | `64px` | `1fr` | −/숫자/+ |
| 중량 | `52px` | `58px` | 고정중량: 숫자+kg / 톤백·잔량: input `w-9` + kg |
| 삭제 | `22px` | `24px` | 아이콘 |

```text
grid-cols-[36px_1fr_64px_52px_22px] sm:grid-cols-[40px_140px_1fr_58px_24px]
```

### 폭 계산 근거

**모바일 (375px 기기 기준)**
```
viewport 375 → dialog(거의 풀폭) → 내부 패딩/카드 보더 차감 → item grid area ≈ 299px
고정 합계 36+64+52+22 = 174px,  gap-1 ×4 = 16px
→ 포장지 1fr ≈ 299 − 174 − 16 = 109~115px  (말줄임)
"땅끝에서보냅니다"(최장, 약 131px)는 여기서 … 처리, select 펼치면 전체 표시
```

**데스크탑 (500px dialog)**
```
500 − DialogContent px-6(48) − card mx-3(24) − item px-3(24) = 404px
고정 40+140+58+24 = 262px,  gap ×4 = 16px
→ stepper 1fr = 404 − 262 − 16 = 126px
"땅끝에서보냅니다" 131px < 140px 칸 → 전체 표시
```

---

## 포장지 열 동작 규칙

| 규격 | 포장지 열 표시 | 중량 열 |
|---|---|---|
| 일반 규격 (20kg, 10kg, 8kg …) | `<select>` (편집) / 텍스트 (읽기전용) | `중량×수량` 계산값 표시 |
| 톤백 (`PKG_TONBAG`) | 고정 텍스트 `포장지: 톤백` | input 직접 입력 |
| 잔량 (`PKG_REMAINDER`) | `—` (SKU 미부여) | input 직접 입력 |

---

## 제거 대상

```tsx
// Row 2 블록 전체 삭제
{o.packageType !== PKG_REMAINDER && (
  <div className="pl-[56px] pt-1"> ... </div>
)}
```

---

## Design Tokens

| 토큰 | 값 |
|---|---|
| Primary | `#2563eb` |
| 텍스트 기본 | `text-stone-700` `#44403c` / `text-stone-600` `#57534e` |
| 텍스트 약함 | `text-stone-400` `#a8a29e` / 대시 `text-stone-300` `#d6d3d1` |
| 보더 | `border-stone-200` `#e7e5e4` |
| 뱃지 배경 | `bg-stone-100` `#f5f5f4` / 잔량 `bg-yellow-100 text-yellow-700` |
| 로트번호 | `font-mono text-[11.5px] text-stone-600` (기존보다 키움) |
| Select 높이 | `h-7` (28px) |
| Stepper 버튼 | `h-[22px] w-[22px]` |
| 중량 input | `h-6 w-9` |

---

## 체크리스트

- [ ] Row 2(`pl-[56px]`) 제거, 포장지를 Row 1 2번째 열로 이동
- [ ] 반응형 그리드 `grid-cols-[36px_1fr_64px_52px_22px] sm:grid-cols-[40px_140px_1fr_58px_24px]`
- [ ] 모바일 select 에 `truncate min-w-0` 적용 (긴 이름 말줄임)
- [ ] 톤백 → `포장지: 톤백` 텍스트 / 잔량 → `—`
- [ ] 톤백·잔량 중량 input `w-9` (숫자 안 잘리게)
- [ ] 로트번호 폰트 `text-[11.5px]` 로 상향

---

## Files

| 파일 | 설명 |
|---|---|
| `포장라인-1행-모바일-시안.html` | 모바일 375px 레퍼런스 (1차 기준) |
| `포장라인-1행-시안.html` | 데스크탑 500px Before/After 비교 |
| `README.md` | 이 문서 |
