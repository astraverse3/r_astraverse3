# 작업 지시: SKU 카탈로그 품종별 그룹화 (A안 — 아코디언)

대상: `app/(dashboard)/admin/product-types/product-type-page-client.tsx`
시안: `card-layouts/제품유형-SKU-그룹화-시안.html` (A안)
전제: 색상은 "admin 다이얼로그 색상 정렬" 지시(별도 md)가 적용된 상태(`bg-primary` 등) 기준.

---

## 목표
현재 평면 테이블인 **제품유형(SKU) 카탈로그**를 **품종별 아코디언**으로 변경.
- 품종 헤더(접기/펼치기) + 그 아래 하위 SKU 행
- 헤더에 SKU 개수·활성 개수 집계, 곡종 배지
- 하위 테이블에서는 **품종 컬럼 제거**(헤더로 올라감), 나머지 컬럼(도정/규격/포장지/기본/상태/관리) 유지
- raw-stocks 생산자 그룹 아코디언과 동일한 UX 패턴

---

## 1. 그룹핑 로직 추가
컴포넌트 본문 상단(렌더 전)에 추가. `varieties` prop으로 곡종(type) 라벨 매핑.

```tsx
import { getVarietyTypeLabel } from '@/lib/variety-labels'

// varietyId → type 매핑 (곡종 배지용)
const varietyTypeMap = new Map(varieties.map((v) => [v.id, v.type]))

// 품종별 그룹 (품종명 가나다순)
const groups = (() => {
  const m = new Map<string, ProductTypeRow[]>()
  for (const row of productTypes) {
    const key = row.variety.name
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(row)
  }
  return [...m.entries()]
    .map(([name, rows]) => ({
      name,
      type: varietyTypeMap.get(rows[0].varietyId) ?? '',
      rows,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
})()
```

## 2. 아코디언 펼침 상태 (기본 전체 펼침)
```tsx
const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
const isOpen = (name: string) => openGroups[name] ?? true   // 기본 펼침
const toggleGroup = (name: string) =>
  setOpenGroups((s) => ({ ...s, [name]: !(s[name] ?? true) }))
```

## 3. 렌더 — 카탈로그 `<section>` 의 `<table>` 블록을 그룹 반복으로 교체

기존 `제품유형(SKU) 카탈로그` 섹션 헤더(등록 버튼 포함)는 그대로 두고, 그 아래 테이블을 아래로 교체:

```tsx
<div className="flex flex-col gap-2">
  {groups.map((g) => {
    const open = isOpen(g.name)
    const activeN = g.rows.filter((r) => r.active).length
    return (
      <div key={g.name} className="rounded-lg border border-slate-200 overflow-hidden">
        {/* 그룹 헤더 */}
        <button
          type="button"
          onClick={() => toggleGroup(g.name)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
            />
            <span className="font-bold text-[14px] text-slate-900">{g.name}</span>
            {g.type && (
              <span className="text-[10px] px-1.5 h-4 inline-flex items-center border border-slate-200 text-slate-500 bg-white rounded">
                {getVarietyTypeLabel(g.type)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>SKU <b className="text-slate-600">{g.rows.length}</b></span>
            <span className="text-slate-300">·</span>
            <span>활성 <b className="text-emerald-600">{activeN}</b></span>
          </div>
        </button>

        {/* 하위 SKU 테이블 (품종 컬럼 없음) */}
        {open && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[10px] text-slate-400 border-b border-slate-100 bg-white">
                <th className="py-1.5 px-3 font-medium">도정</th>
                <th className="py-1.5 px-2 font-medium">규격</th>
                <th className="py-1.5 px-2 font-medium">포장지</th>
                <th className="py-1.5 px-2 font-medium text-center">기본</th>
                <th className="py-1.5 px-2 font-medium text-center">상태</th>
                <th className="py-1.5 px-3 font-medium text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-50 last:border-0 hover:bg-primary/5 transition-colors ${row.active ? '' : 'opacity-50'}`}
                >
                  <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">{row.millingType}</td>
                  <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.packageType}</td>
                  <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.packaging.name}</td>
                  <td className="py-2 px-2 text-center">
                    {row.isDefault && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 inline" />}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {/* 기존 상태 토글 버튼 그대로 */}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {/* 기존 수정(ProductTypeDialog)·삭제 버튼 그대로 */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  })}

  {productTypes.length === 0 && (
    <p className="py-8 text-center text-xs text-slate-400">등록된 제품유형이 없어요.</p>
  )}
</div>
```

> 상태 토글 버튼·관리(수정/삭제) 셀 내용은 **현재 코드 그대로** 옮겨넣을 것. 핸들러(`handleToggleProductType`, `handleDeleteProductType`, `ProductTypeDialog`)는 변경 없음.

## 4. import 추가
```tsx
import { Plus, Trash2, Star, ChevronDown } from 'lucide-react'
```

---

## 선택 개선
- **전체 펼치기/접기** 토글 버튼을 섹션 헤더(등록 버튼 옆)에 추가 가능.
- 품종 많아지면 헤더에 검색/필터 추가 고려(이번 범위 밖).

## 검수 체크리스트
- [ ] 품종별로 묶이고 헤더 클릭 시 접힘/펼침
- [ ] 헤더 SKU 수·활성 수 집계 정확
- [ ] 곡종 배지 표시(메벼/찰벼/잡곡 등)
- [ ] 하위 행에 품종 컬럼 없음, 나머지 동작 동일(수정·삭제·상태토글)
- [ ] 비활성 SKU `opacity-50` 유지
- [ ] 빈 상태 정상
- [ ] 품종명 가나다순 정렬
