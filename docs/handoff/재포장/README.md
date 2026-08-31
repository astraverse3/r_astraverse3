# 제품재고 재포장 — UI 개선 핸드오프 (A안)

시안: `재포장-UI점검-시안.html` (프레임 1 A안 / 2 / 3 / 4 / 4-M)
대상: `app/(dashboard)/packages/`

## 개선 4건 요약

| # | 항목 | 결론 |
|---|---|---|
| 1 | 재포장 버튼 비중 | `outline → ghost` **한 단 내림** + 도구 그룹으로 이동, 모드 켜짐은 파랑 틴트 |
| 2 | 목록 행 높이 | `py-2.5 → py-3`, `12.5px → 13px` (행 36px → 44px) |
| 3 | 선택 바 위치 | `fixed` 중앙 정렬 → 목록 아래 **`sticky` 전폭 바** |
| 4 | 재포장 다이얼로그 | 720px 1열 → **940px 2열**, 계기판을 **푸터로 이동** |

> **1번에서 primary 승격안(세그먼트 컨트롤)은 채택하지 않았습니다.** 재포장은 사용빈도가 낮은데 지금 이미 `+ 포장 하기`와 똑같은 outline 버튼이라 **등록 버튼과 동급으로 튀어 보이는 것**이 문제입니다. 방향은 올리는 게 아니라 **한 단 내리는 것**입니다: outline → ghost, 위치는 도구 그룹으로. 새 어휘는 하나도 만들지 않습니다(ghost는 기존 `재포장 취소`에 이미 사용 중). `misc-package-panel.tsx` 주석(핸드오프 §3.4)에 「추가 버튼은 primary」가, `package-search-dialog.tsx` 주석에 「검색 버튼은 항상 blue-50」이 명문화돼 있어, 재포장을 상시 primary로 올리면 잡곡 탭에서 `+매입 등록`과 primary가 2개가 되고 파랑 틴트는 검색과 겹칩니다. A안은 기존 어휘를 하나도 바꾸지 않습니다.

---

## 1. 액션 라인 — 재포장 버튼 톤다운 + 모드 상태

### 규칙
```
[엑셀] [재포장] [검색]  │  [+포장하기]  [+매입 등록]
───────  도구  ───────      ────── 등록 ──────
```
- 재포장은 `outline` → **`ghost`** (테두리·배경 없이 `text-slate-500`). 아이콘은 그대로 남깁니다 — 모드 상태를 붙일 자리가 필요합니다.
- 새 데이터를 만드는 게 아니라 가진 재고를 다시 나누는 **도구**라, 구분선 **왼쪽(도구 그룹)** 에 둡니다.
- 재포장 **모드가 켜진 동안**: 재포장 버튼만 파랑 틴트(`bg-primary/10 border-primary/30 text-primary` — 필터 활성에 이미 쓰는 어휘), 나머지 버튼은 전부 `disabled`. primary를 안 쓰고도 모드가 분명하고, 모드 중 필터를 바꿔 선택이 날아가는 사고도 막힙니다.
- 버튼에 `min-w-[96px]`를 줘 라벨이 「재포장 → 재포장 중」으로 바뀔 때 **버튼이 움직이지 않게** 합니다.

### `repack-toggle-button.tsx` — 전체 교체

```tsx
'use client'

import { PackageOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 재포장 선택 모드 토글 — 액션 라인의 「도구」 그룹(구분선 왼쪽), 엑셀 다음.
 * 선택 상태 자체는 PackageListClient가 들고 있고, 이 버튼은 모드만 켜고 끈다.
 *  - 꺼짐: ghost (사용빈도가 낮아 등록 버튼보다 한 단 낮게 둔다)
 *  - 켜짐: 파랑 틴트 + X. 이 동안 같은 줄의 다른 버튼은 disabled 처리하므로
 *          틴트 하나만 살아있어 모드가 분명하다. min-w로 폭을 고정해 버튼이 움직이지 않는다.
 */
export function RepackToggleButton({
    active,
    onToggle,
}: {
    active: boolean
    onToggle: (next: boolean) => void
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(!active)}
            aria-pressed={active}
            className={cn(
                'h-8 min-w-[96px] justify-center gap-1.5 px-3 font-semibold',
                active
                    ? 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                    : 'text-slate-500 hover:text-slate-900',
            )}
        >
            <PackageOpen className="h-3.5 w-3.5" />
            {active ? (
                <>
                    <span>재포장 중</span>
                    <span className="mx-0.5 h-3.5 w-px bg-primary/35" />
                    <X className="h-3.5 w-3.5" />
                </>
            ) : (
                '재포장'
            )}
        </Button>
    )
}
```

### `package-excel-buttons.tsx` — `disabled` prop 추가

```tsx
export function PackageExcelButtons({
    filters,
    disabled = false,
}: {
    filters: GetPackagesParams
    disabled?: boolean
}) {
```
그리고 버튼의 `disabled={exporting}` → `disabled={exporting || disabled}`.

### `package-search-dialog.tsx` — `disabled` prop 추가

```tsx
interface Props {
    category: PackageCategory
    varieties: { id: number; name: string }[]
    disabled?: boolean
}

export function PackageSearchDialog({ category, varieties, disabled = false }: Props) {
```
`DialogTrigger` 안의 `<Button>`에 `disabled={disabled}` 한 줄 추가. 스타일 className은 손대지 않습니다(shadcn Button이 `disabled:opacity-50`을 이미 갖고 있음).

### `rice-package-panel.tsx` — 액션 라인 교체

```tsx
            <section className="flex items-center justify-end gap-1.5 px-1">
                <PackageExcelButtons filters={filters} disabled={selectMode} />
                {canRepack && <RepackToggleButton active={selectMode} onToggle={setSelectMode} />}
                <PackageSearchDialog category="RICE" varieties={varieties} disabled={selectMode} />
            </section>
```

### `misc-package-panel.tsx` — 같은 규칙

```tsx
            <section className="flex items-center justify-end gap-1.5 px-1">
                <PackageExcelButtons filters={filters} disabled={selectMode} />
                {canMill && <RepackToggleButton active={selectMode} onToggle={setSelectMode} />}
                <PackageSearchDialog category="MISC_GRAIN" varieties={varieties} disabled={selectMode} />
                <span className="mx-1.5 h-5 w-px bg-slate-200" aria-hidden />
                {/* 핸드오프 §3.4: 추가 버튼은 primary. 잡곡은 분기가 둘이라 첫 번째는 보조(outline)로 톤다운 */}
                {canMill && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={selectMode}
                        onClick={() => setPackageOpen(true)}
                        className="h-8 px-3 font-semibold rounded-md"
                    >
                        + 포장<span className="hidden sm:inline">하기</span>
                    </Button>
                )}
                {canPurchase && (
                    <Button
                        size="sm"
                        disabled={selectMode}
                        onClick={() => setPurchaseOpen(true)}
                        className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-md"
                    >
                        + 매입<span className="hidden sm:inline"> 등록</span>
                    </Button>
                )}
            </section>
```

---

## 2. 목록 행 높이 — 44px로 통일

도정관리(`milling-table-row.tsx`)는 `py-3` + `text-sm`(14px)로 행 44px, 제품재고는 `py-2.5` + `text-[12.5px]`로 36px입니다. 셀은 전부 `truncate` 한 줄 고정이므로 **줄바꿈 위험은 없습니다** — 13px에서도 가장 빡빡한 총량 셀(`162,425kg` ≈ 72px)이 할당 154px 안에 넉넉히 들어갑니다.

`package-row.tsx`에서 4곳만 바꿉니다. 컬럼 그리드(`PKG_GRID`)는 건드리지 않습니다.

| 위치 | 현재 | 변경 |
|---|---|---|
| `PackageColumnHeader` | `px-4 py-2` | `px-4 py-2.5` |
| `PackageSingleRow` | `text-[12.5px] … py-2.5` | `text-[13px] … py-3` |
| `PackageSubRow` | `text-[12.5px] … py-2` | `text-[13px] … py-2.5` |
| `PackageGroupRow` 버튼 | `text-[12.5px] … py-2.5` | `text-[13px] … py-3` |

그룹 행의 부가 수치(`{item.rows.length}종 규격`, `totalQty`)는 `text-[11.5px] → text-[12px]`, 서브행 규격 셀도 동일.

```tsx
// PackageColumnHeader
<div className={`${selectMode ? PKG_GRID_SELECT : PKG_GRID} text-[10.5px] uppercase tracking-wider text-slate-400 font-bold px-4 py-2.5 bg-slate-50/60 border-b border-slate-200`}>

// PackageSingleRow
className={`${selection ? PKG_GRID_SELECT : PKG_GRID} text-[13px] text-slate-700 px-4 py-3 items-center ${selected ? 'bg-primary/5' : 'hover:bg-slate-50/70'}`}

// PackageSubRow
className={`${selection ? PKG_GRID_SELECT : PKG_GRID} text-[13px] text-slate-600 px-4 py-2.5 items-center border-t border-slate-200/60 ${selected ? 'bg-primary/5' : ''}`}

// PackageGroupRow
className={`w-full ${selection ? PKG_GRID_SELECT : PKG_GRID} text-[13px] px-4 py-3 items-center text-left transition-colors hover:bg-slate-50/70`}
```

> 폰트를 아예 안 건드리는 보수적 선택지도 있습니다 — `py-3`만 올려도 44px이 됩니다. 그 경우 도정관리와 밀도는 같아지고 글자 크기만 1.5px 작게 남습니다.

---

## 3. 선택 바 — `fixed` 중앙 → 목록 아래 `sticky` 전폭 바

현재 `fixed inset-x-0 … sm:justify-center`는 사이드바 256px을 포함한 **윈도우 전체 폭의 중앙**이라, 콘텐츠 중앙과 정확히 **128px** 어긋납니다. 게다가 `fixed`라 마지막 두 행을 덮습니다.

목록 바로 아래에 `sticky`로 두면 **콘텐츠 열 안에 들어가므로 정렬을 계산할 필요가 없고**(사이드바가 접혀도 자동 추종), 행을 덮지도 않습니다.

`package-list-client.tsx`의 선택 바 블록을 교체합니다.

```tsx
            {/* 선택 바 — 데스크톱: 목록 아래 sticky 전폭 바 (콘텐츠 열 기준이라 정렬 계산이 없다) */}
            {selectMode && selected.size > 0 && (
                <div className="hidden sm:block sticky bottom-4 z-40">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-white px-4 py-2.5 shadow-[0_-2px_12px_rgba(15,23,42,.07),0_6px_18px_rgba(15,23,42,.08)]">
                        <div className="flex items-baseline gap-2.5">
                            <span className="text-[13px] text-slate-700">
                                <b className="text-slate-900">{selected.size}건</b> 선택
                            </span>
                            <span className="text-slate-200">|</span>
                            <span className="text-[12.5px] text-slate-500">
                                최대 <b className="tabular-nums text-slate-800">{maxKg.toLocaleString()}kg</b>
                            </span>
                            {anchorLabel && (
                                <span className="text-[11.5px] text-slate-400">{anchorLabel}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-slate-500"
                                onClick={() => setSelected(new Map())}
                            >
                                선택 해제
                            </Button>
                            <Button size="sm" className="h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                                <PackageOpen className="h-3.5 w-3.5" />
                                재포장하기
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 모바일: 하단 탭바 위 floating pill (기존 유지) */}
            {selectMode && selected.size > 0 && (
                <div className="sm:hidden fixed inset-x-0 bottom-16 z-40 px-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
                        <span className="text-[12.5px] text-slate-600">
                            <b className="text-slate-900">{selected.size}건</b> 선택 ·{' '}
                            <span className="tabular-nums">최대 {maxKg.toLocaleString()}kg</span>
                        </span>
                        <Button size="sm" className="h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                            <PackageOpen className="h-3.5 w-3.5" />
                            재포장하기
                        </Button>
                    </div>
                </div>
            )}
```

바 안에 **동질성 기준**을 적어둡니다 — 지금은 왜 다른 행이 눌리지 않는지 툴팁을 봐야 압니다. `anchorKey` 옆에 라벨을 하나 더 계산하면 됩니다.

```tsx
    // 선택 바에 표시할 동질성 기준 라벨 (품종 · 도정구분 · 출처)
    const anchorLabel = useMemo(() => {
        const first = selected.values().next()
        if (first.done) return null
        const r = first.value
        return [r.variety, r.millingTypeLabel, r.source === 'PURCHASED' ? '매입' : '도정산']
            .filter(v => v && v !== '—')
            .join(' · ')
    }, [selected])
```

`sticky bottom-4`는 부모가 `overflow:hidden`이면 동작하지 않습니다. 선택 바는 데스크톱 테이블 `<section>`(= `overflow-hidden`) **밖**, `rice-package-panel`의 `grid gap-2` 컨테이너 직계 자식으로 두세요 — 지금 위치 그대로입니다.

---

## 4. 재포장 다이얼로그 — 940px 2열 + 계기판을 푸터로

### 문제
- 720px을 **한 열로만** 쓰면서 「쓸 재고 → 계기판 → 만들 규격 → 비고 → 저장」을 전부 쌓아, 3건만 골라도 `max-h-[90dvh]`를 넘겨 스크롤이 생깁니다.
- 가장 중요한 숫자(잔여 kg)가 `bg-slate-100` 회색 띠에 묻혀 정상인지 미완인지 안 읽힙니다.
- `blockingReason`은 「1번째 줄: 규격을 골라주세요」인데 **그 줄에는 아무 표시가 없습니다**.
- 닫기 X가 primary 저장 버튼과 시각적으로 경쟁합니다.
- 가용이 1개뿐인 잔량 행에도 「1 / 1개」 숫자 입력이 있습니다 — 고를 게 없습니다.
- 다이얼로그 전체(`max-h-[90dvh]`)와 쓸 재고 목록(`max-h-[30dvh]`)이 **이중 스크롤**입니다.

### 구조
```
┌ 헤더 ── 아이콘 · 재포장 · 새청무 · 백미 · 3건 21kg ────── ✕(ghost) ┐
├──────────────────┬───────────────────────────────────────────────┤
│ 쓸 재고 (340px)   │ 만들 규격 (1fr)                                │
│  · 카드 n건       │  · 줄 카드 n개 (칩 + 4필드)                     │
│                  │  · 비고                                        │
├──────────────────┴───────────────────────────────────────────────┤
│ 푸터(sticky) ── 딱 맞음 / 0kg ── 쓸 41 − 만들 41 ── 취소 · 재포장하기 │
└──────────────────────────────────────────────────────────────────┘
```
- 계기판을 **좌열이 아니라 푸터**에 둡니다. 모바일에서 1열이 되면 계기판이 스크롤로 사라져 규격을 입력하는 동안 잔여 kg을 볼 수 없게 되는데, 재포장은 잔여 kg을 보면서 개수를 맞추는 작업이라 치명적입니다. 데스크톱도 같은 구조로 통일합니다.
- 스크롤은 **본문 한 군데만**. 헤더·푸터는 고정.

### `repack-dialog.tsx` — 렌더 부분 교체

`sourceKg` / `resultKg` / `remainKg` / `blockingReason` / `submit` 로직은 그대로 둡니다. 바뀌는 것은 `return` 이하와 `blockingReason`의 반환 타입뿐입니다.

```tsx
    const head = sources[0]

    // 잔여 상태를 한 곳에서 정하고 푸터가 그대로 쓴다
    const balance =
        remainKg === 0
            ? { tone: 'ok' as const, label: '딱 맞음', value: '0kg' }
            : remainKg > 0
              ? { tone: 'warn' as const, label: '남는 양은 손실로 기록돼요', value: `${remainKg.toLocaleString()}kg` }
              : { tone: 'bad' as const, label: '만들 양이 더 많아요', value: `${Math.abs(remainKg).toLocaleString()}kg` }

    const balanceCls = {
        ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warn: 'border-slate-200 bg-slate-50 text-slate-600',
        bad: 'border-red-200 bg-red-50 text-red-700',
    }[balance.tone]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[940px] max-h-[92dvh] gap-0 overflow-hidden p-0">
                {/* 헤더 */}
                <DialogHeader className="shrink-0 flex-row items-start gap-2.5 space-y-0 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <PackageOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="text-[15px] font-bold text-slate-900">재포장</DialogTitle>
                        <DialogDescription className="mt-0.5 text-[12px]">
                            {head
                                ? `${head.varietyName} · ${head.millingType} · ${sources.length}건 ${sourceKg.toLocaleString()}kg을 다시 나눠 담습니다`
                                : '쓸 재고와 만들 규격을 정해주세요.'}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[12.5px]">재고를 확인하는 중…</span>
                    </div>
                ) : loadError ? (
                    <div className="flex flex-col items-center gap-2 py-14 text-center">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <p className="text-[12.5px] text-slate-600">{loadError}</p>
                    </div>
                ) : (
                    <>
                        {/* 본문 — 스크롤은 여기 한 군데만 */}
                        <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[340px_minmax(0,1fr)] sm:overflow-hidden">
                            {/* 좌 · 쓸 재고 */}
                            <section className="flex flex-col gap-1.5 border-b border-slate-100 bg-slate-50/50 p-4 sm:overflow-y-auto sm:border-b-0 sm:border-r">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                        쓸 재고 {sources.length}건
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        {sources.every(s => Number(takeCounts[s.packageId]) === s.available)
                                            ? '전량 사용 중'
                                            : '일부 사용'}
                                    </span>
                                </div>
                                {sources.map(s => (
                                    <div
                                        key={s.packageId}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-[12.5px] font-semibold text-slate-800">
                                                {s.packageType} · {s.weightPerUnit.toLocaleString()}kg
                                                <span className="ml-1.5 font-normal text-slate-500">{s.producer}</span>
                                            </span>
                                            <span className="truncate font-mono text-[10.5px] text-slate-400">
                                                {s.lotNo ?? '매입(로트 없음)'}
                                            </span>
                                        </div>
                                        {/* 가용이 1개면 고를 게 없다 — 입력을 없애고 값만 보여준다 */}
                                        {s.available === 1 ? (
                                            <span className="shrink-0 text-[11.5px] font-semibold text-slate-500">
                                                1개 전부
                                            </span>
                                        ) : (
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <Input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min="1"
                                                    max={s.available}
                                                    value={takeCounts[s.packageId] ?? ''}
                                                    onChange={e =>
                                                        setTakeCounts(prev => ({
                                                            ...prev,
                                                            [s.packageId]: e.target.value,
                                                        }))
                                                    }
                                                    className="h-10 w-16 text-right text-[12.5px] tabular-nums sm:h-8"
                                                />
                                                <span className="text-[11.5px] text-slate-400">/ {s.available}개</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </section>

                            {/* 우 · 만들 규격 */}
                            <section className="flex flex-col gap-2 p-4 sm:overflow-y-auto">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                        만들 규격
                                    </h3>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 text-[11.5px] text-primary"
                                        onClick={() =>
                                            setResults(prev => [
                                                ...prev,
                                                emptyResultDraft(
                                                    `r${Date.now()}`,
                                                    lotOptions.length === 1 ? lotOptions[0].packageId : 0,
                                                ),
                                            ])
                                        }
                                    >
                                        <Plus className="h-3.5 w-3.5" />줄 추가
                                    </Button>
                                </div>
                                {results.map((r, i) => (
                                    <RepackResultRow
                                        key={r.key}
                                        draft={r}
                                        index={i}
                                        packagings={packagings}
                                        lotOptions={lotOptions}
                                        canRemove={results.length > 1}
                                        error={rowError?.index === i ? rowError : null}
                                        onChange={next =>
                                            setResults(prev => prev.map(x => (x.key === r.key ? next : x)))
                                        }
                                        onRemove={() => setResults(prev => prev.filter(x => x.key !== r.key))}
                                    />
                                ))}

                                <label className="mt-1 flex flex-col gap-1">
                                    <span className="text-[10.5px] font-bold text-slate-400">비고 (선택)</span>
                                    <Input
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        maxLength={500}
                                        placeholder="예) 톤백 열어 소분"
                                        className="h-10 text-[12.5px] sm:h-8"
                                    />
                                </label>

                                {lossPrompt && (
                                    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                                        <p className="flex items-start gap-2 text-[12.5px] text-amber-900">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <span>
                                                만들 양이 쓸 양보다{' '}
                                                <b className="tabular-nums">{lossPrompt.lossKg.toLocaleString()}kg</b>{' '}
                                                적어요. 이 차이는 손실로 기록돼요. 그대로 진행할까요?
                                            </span>
                                        </p>
                                        <div className="flex justify-end">
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="h-8"
                                                disabled={saving}
                                                onClick={() => {
                                                    setLossConfirmed(true)
                                                    void submit(true)
                                                }}
                                            >
                                                손실 인정하고 진행
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* 푸터 — 계기판 + 액션. 모바일에서도 항상 보인다 */}
                        <div className={`shrink-0 border-t px-4 py-3 sm:px-5 ${balanceCls}`}>
                            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-baseline justify-between gap-4 sm:justify-start">
                                    <div>
                                        <div className="text-[11px] font-bold">{balance.label}</div>
                                        <div className="mt-0.5 text-[11.5px] tabular-nums opacity-80">
                                            쓸 양 {sourceKg.toLocaleString()}kg − 만들 양 {resultKg.toLocaleString()}kg
                                        </div>
                                    </div>
                                    <span className="text-[22px] font-extrabold leading-none tabular-nums">
                                        {balance.value}
                                    </span>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-11 flex-none bg-white sm:h-8"
                                        onClick={() => onOpenChange(false)}
                                        disabled={saving}
                                    >
                                        취소
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-11 flex-1 gap-1.5 sm:h-8 sm:flex-none"
                                        disabled={!!blockingReason || saving}
                                        onClick={() => void submit(lossConfirmed)}
                                    >
                                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                        재포장하기
                                    </Button>
                                </div>
                            </div>
                            {blockingReason && (
                                <p className="mt-2 text-[11.5px] font-semibold text-red-600">{blockingReason}</p>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
```

> `DialogContent`에 `p-0`을 주었으므로 shadcn 기본 닫기 X 버튼의 위치(`right-4 top-4`)가 그대로 맞습니다. X가 primary와 경쟁하지 않게 `[&>button]:text-slate-400`를 추가하거나, `components/ui/dialog.tsx`의 close 버튼 색을 slate로 맞춰두세요.

### 오류를 해당 줄에 인라인으로

`blockingReason`은 이미 줄 번호를 알고 있으니, 문자열 하나만 반환하지 말고 **줄 인덱스와 필드를 같이** 돌려주면 됩니다.

```tsx
    type RowError = { index: number; field: 'spec' | 'weight' | 'count' | 'lot'; message: string }

    const { blockingReason, rowError } = useMemo<{
        blockingReason: string | null
        rowError: RowError | null
    }>(() => {
        const err = (index: number, field: RowError['field'], message: string) => ({
            blockingReason: `${index + 1}번째 줄: ${message}`,
            rowError: { index, field, message },
        })

        if (sources.length === 0) return { blockingReason: '쓸 재고가 없어요.', rowError: null }
        for (const s of sources) {
            const n = Number(takeCounts[s.packageId])
            if (!Number.isInteger(n) || n <= 0)
                return { blockingReason: '쓸 개수를 1개 이상 넣어주세요.', rowError: null }
            if (n > s.available)
                return { blockingReason: `가용 재고(${s.available}개)보다 많이 쓸 수 없어요.`, rowError: null }
        }
        if (results.length === 0)
            return { blockingReason: '만들 규격을 한 줄 이상 넣어주세요.', rowError: null }
        for (const [i, r] of results.entries()) {
            if (!r.packageType) return err(i, 'spec', '규격을 골라주세요.')
            if (!(Number(r.weightPerUnit) > 0)) return err(i, 'weight', '자루당 kg을 넣어주세요.')
            const c = Number(r.count)
            if (!Number.isInteger(c) || c <= 0) return err(i, 'count', '개수를 1개 이상 넣어주세요.')
            if (!r.inheritFromPackageId) return err(i, 'lot', '로트를 골라주세요.')
        }
        if (remainKg < 0)
            return {
                blockingReason: `만들 양이 쓸 양보다 ${Math.abs(remainKg).toLocaleString()}kg 많아요.`,
                rowError: null,
            }
        return { blockingReason: null, rowError: null }
    }, [sources, takeCounts, results, remainKg])
```

### `repack-result-row.tsx` — 오류 표시 + 모바일 터치 규격

props에 `error`를 받고, 카드 테두리·헤더 문구·해당 필드에 표시합니다. 칩은 `py-1`(26px) → `py-2`(34px), 입력은 `h-8` → `h-10 sm:h-8`로 올립니다.

```tsx
interface Props {
    draft: ResultDraft
    index: number
    packagings: { id: number; name: string; active: boolean }[]
    lotOptions: RepackLotOption[]
    onChange: (next: ResultDraft) => void
    onRemove: () => void
    canRemove: boolean
    /** 이 줄에서 막힌 이유 — 다이얼로그의 blockingReason과 같은 판정이다 */
    error?: { field: 'spec' | 'weight' | 'count' | 'lot'; message: string } | null
}
```

```tsx
    const bad = (f: NonNullable<Props['error']>['field']) => error?.field === f
    const fieldCls = (f: NonNullable<Props['error']>['field']) =>
        bad(f) ? 'border-red-300 focus-visible:ring-red-400' : ''

    return (
        <div
            className={`flex flex-col gap-2 rounded-lg border p-2.5 ${
                error ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold ${error ? 'text-red-600' : 'text-slate-400'}`}>
                    {index + 1}번째 줄
                </span>
                <div className="flex items-center gap-2">
                    {error ? (
                        <span className="text-[11px] font-semibold text-red-600">{error.message}</span>
                    ) : (
                        lineKg > 0 && (
                            <span className="text-[11.5px] tabular-nums text-slate-500">
                                {lineKg.toLocaleString()}kg
                            </span>
                        )
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-red-600 disabled:opacity-30"
                        onClick={onRemove}
                        disabled={!canRemove}
                        aria-label={`${index + 1}번째 줄 삭제`}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* 규격 템플릿 — 모바일 터치 34px */}
            <div className="flex flex-wrap gap-1">
                {REPACK_SPECS.map(s => (
                    <button
                        key={s.label}
                        type="button"
                        onClick={() => pickSpec(s.label, s.weight)}
                        className={`rounded-md border px-2 py-2 text-[11.5px] transition-colors sm:py-1 ${
                            draft.packageType === s.label
                                ? 'border-primary bg-primary/10 font-bold text-primary'
                                : bad('spec')
                                  ? 'border-red-200 text-slate-600 hover:bg-white'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>
            …
```

아래 4개 필드는 `className`에 `h-10 sm:h-8`과 `fieldCls('weight')` / `fieldCls('count')` / `fieldCls('lot')`을 각각 덧붙이고, 로트 라벨은 「로트」 → **「로트 승계」**로 바꿉니다(무엇을 고르는지 명확해짐).

---

## 확인 사항 / 순서

1. **1번 → 2번** 먼저(파일 5개, 저위험). 잡곡 탭에서 재포장 모드 켠 채 `+매입 등록`이 비활성되는지 확인.
2. **3번**: 사이드바 접었을 때 / 잡곡 탭 / 모바일 세 경우에서 바 정렬 확인. `sticky`가 안 먹으면 조상 중 `overflow-hidden`을 찾으세요.
3. **4번**: 소스 1건 / 6건, 로트 1개 / 여러 개, 잔량 포함, 손실 확인 프롬프트까지 네 경우. 모바일 실기기에서 푸터 계기판이 키보드에 가리지 않는지 확인(iOS Safari).
4. 서버 액션(`repack.ts`)과 권한 판정은 **일절 변경 없음**. 전부 표시 계층입니다.
