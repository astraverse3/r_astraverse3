# 잡곡 재고관리 #6 — 제품재고 페이지 신설 (`/packages`)

> **상위 계획서**: [plan-잡곡재고관리.md](plan-잡곡재고관리.md) §작업 단계 #6
> **착수 전제**: #5 완료 (잡곡 입고 등록 + 원물재고 잡곡 탭, 2026-05-04 머지)
> **작성일**: 2026-05-04

## 1. 작업 목표
`/packages` 라우트를 신설해 **포장된 제품재고**를 한 곳에서 조회한다. 벼/잡곡 2탭 구조이며, 벼 탭은 기존 도정관리에서 생성된 `MillingOutputPackage`(`source=MILLED, category=RICE`) 데이터를 그대로 보여준다. 잡곡 탭은 동일 모델의 `category=MISC_GRAIN` 레코드를 보여주되, **포장/매입 다이얼로그는 본 단계 범위 외**(#7·#8) — 빈 상태에서도 페이지가 동작해야 한다.

## 2. 본 단계 범위 / 범위 밖

### 범위 내
- `/packages` 라우트 + 벼/잡곡 탭 (raw-stocks 패턴 답습)
- `app/actions/packages.ts` 신규 — 목록 조회 + 품종 그룹핑(서버 사이드)
- 핸드오프 §4.2 품종 그룹 펼침 테이블 (벼·잡곡 공통 컴포넌트)
- 핸드오프 §4.3 모바일 2줄 품종 카드
- 핸드오프 §3.4 헤더 액션(검색·추가) + §4.6 검색 다이얼로그
- 사이드바·모바일 네비에 **임시** 진입점 추가 (#9에서 디자인 교체 예정이라 라벨/아이콘은 최소만)
- **백로그 §3 처리**: 대시보드 원곡재고 차트 라벨 "원곡재고" → "벼 원곡 재고"

### 범위 밖 (다른 단계로 이월)
- **#7**: 잡곡 포장 다이얼로그 (잡곡 탭 [+ 포장하기] 버튼 활성화)
- **#8**: 잡곡 매입 등록 다이얼로그 (잡곡 탭 [+ 매입 등록] 버튼 활성화)
- **#9**: 사이드바·모바일 네비 디자인 전면 교체(번들 §3.1·§3.2), `/sales` 라우트 신설
- **#10**: 헤더 업로드/다운로드 버튼 (엑셀 import/export)
- 벼 탭 [+ 포장하기]는 도정관리 페이지로 링크만 (벼는 배치 기반이라 별도 다이얼로그 만들지 않음 — 계획서 §279)

### 본 단계에서 placeholder 처리할 것
- 잡곡 탭 헤더 액션 `[+ 포장하기]` `[+ 매입 등록]` — 비활성 버튼 + 툴팁 "준비중" (#7·#8 머지 시 활성)
- 두 탭 헤더 액션 `[↑업로드]` `[↓다운로드]` — 본 단계에선 노출하지 않음 (#10에서 추가)

## 3. 핵심 설계 결정

### 3.1 데이터 구조 — 그룹/낱개 혼합 (`InventoryItem`)
핸드오프 §4.2.1 스펙 그대로 따름. 한 품종에 규격이 2개 이상이면 `type:'group'`, 1개뿐이면 `type:'single'`.

```ts
// app/actions/packages.ts
export type PackageRow = {
  id: number
  spec: string         // packageType ('5kg', '1kg', '500g' …)
  qty: number          // count
  producer: string     // MILLED: stock.farmer.name / PURCHASED: purchaseVendor
  lot: string | null   // lotNo (PURCHASED는 항상 null)
  date: string         // ISO yyyy-mm-dd (createdAt 또는 incomingDate)
  sub: number          // totalWeight
  source: 'MILLED' | 'PURCHASED'
}

export type PackageItem =
  | { type: 'group'; variety: string; total: number; rows: PackageRow[] }
  | ({ type: 'single'; variety: string } & PackageRow)
```

**서버에서 그룹핑하는 이유**: 클라이언트에서 `useMemo` 그룹핑은 #5에서 검증된 패턴이지만, 제품재고는 향후 검색·페이지네이션과 결합되므로 서버 grouping이 자연스럽다. (재검토 트리거: 데이터가 5천 건 초과 시 lazy 패턴 검토 — `getPackagesByVariety` 분리.)

### 3.2 카테고리·source 기본 필터
- 벼 탭: `category: 'RICE'` (`source`는 MILLED·PURCHASED 모두 — 매입 잡곡 외엔 거의 MILLED)
- 잡곡 탭: `category: 'MISC_GRAIN'` (`source` 무관 — MILLED+PURCHASED 모두 노출)
- 정렬 기본값: 최신순 (`createdAt desc` 또는 `incomingDate desc` — 매입 케이스 우선)

### 3.3 producer 컬럼 분기
- `MILLED` 행: `stock.farmer.name`. 다농장 배치(stock 여러 개)는 첫 농가 + "외 N명" — 기존 milling 페이지 패턴 차용
- `PURCHASED` 행: `purchaseVendor`
- 그룹 헤더의 producer 컬럼은 핸드오프 §4.2.5대로 `—` (그룹 단계에선 단일 값 없음)

### 3.4 source 뱃지
서브행·낱개 행에서 source 구분이 필요하다 (도정산/매입). 핸드오프 §4.2 컬럼 스펙에는 source 컬럼이 없는데, **lot 컬럼 옆에 inline 미니 칩**으로 표시한다 (`bg-slate-100 text-[10px]`). 매입 행은 lot이 `—` 자리이므로 시각적으로 구분됨.
- 도정산: `bg-blue-50 text-blue-600` "도정산"
- 매입: `bg-amber-50 text-amber-700` "매입"

### 3.5 신규 페이지의 메뉴 진입점
사이드바·모바일 네비 디자인 전면 교체는 #9 단계라 **본 단계에서는 사이드바·네비 코드를 건드리지 않는다**. 대신 검수용 임시 진입점만 둠:
- **홈 대시보드(`app/(dashboard)/page.tsx`)에 임시 링크 카드 1개** 추가 — 제품재고 페이지로 이동. #9에서 사이드바·모바일 네비 정리 시 함께 제거
- 아이콘은 lucide `Package` 임시 — Set C 듀오톤 컴포넌트 적용은 #9

## 4. 변경 파일 목록 (예상)

### 신규
- `app/(dashboard)/packages/page.tsx` — 서버 컴포넌트, 탭 분기
- `app/(dashboard)/packages/packages-tabs.tsx` — `벼/잡곡` F안 탭 (raw-stocks-tabs.tsx 차용)
- `app/(dashboard)/packages/rice-package-panel.tsx` — 벼 탭 셸 (헤더 액션 + 필터 칩 + 목록)
- `app/(dashboard)/packages/misc-package-panel.tsx` — 잡곡 탭 셸 (동일 구조)
- `app/(dashboard)/packages/package-list-client.tsx` — 클라이언트 컴포넌트, 펼침 토글 상태 관리
- `app/(dashboard)/packages/package-group-row.tsx` — 그룹 헤더 행 + 펼침 서브행
- `app/(dashboard)/packages/package-single-row.tsx` — 낱개 행
- `app/(dashboard)/packages/mobile-package-card.tsx` — 모바일 2줄 카드 (헤더 + 펼침 상세)
- `app/(dashboard)/packages/package-search-dialog.tsx` — 핸드오프 §4.6 검색 다이얼로그
- `app/(dashboard)/packages/active-package-filters.tsx` — 적용 필터 칩 요약
- `app/(dashboard)/packages/header-actions.tsx` — 4버튼 세트 (검색·추가, 업/다운로드는 추후)
- `app/actions/packages.ts` — `getPackages`, `getPackageGroups` (선택), 매입처 distinct 등 (벼/잡곡 통합)

### 수정
- `app/(dashboard)/page.tsx`(또는 홈 대시보드 컴포넌트) — 제품재고 페이지로 이동하는 **임시 링크 카드** 추가 (#9에서 제거)
- `components/breadcrumb-display.tsx` — `/packages` path 매핑 추가 (#0.5 패턴 따라)
- 대시보드 차트 컴포넌트 (위치 추후 확인) — "원곡재고" → "벼 원곡 재고" 라벨 변경 [백로그 §3]

### 손대지 않음 (#9에서 일괄 처리)
- `components/desktop-sidebar.tsx` / `components/mobile-nav.tsx`

### 변경 없음
- `prisma/schema.prisma` — #1에서 이미 확장 완료
- 기존 `milling/*` — 도정관리는 그대로

## 5. 작업 단계 (커밋 단위)

### #6a — 데이터 액션 + 라우트 셸
- `app/actions/packages.ts` 신규: `getPackages({ category, varietyId, productionYear, source, status?, sort? })` 구현
  - Prisma 쿼리: `millingOutputPackage.findMany` + `include: { stock: { include: { farmer, variety } }, batch: { include: { stocks: …(다농장 표시) } }, variety: true }`
  - 서버에서 품종별 그룹핑 → `PackageItem[]` 반환
- `/packages/page.tsx` — 서버 컴포넌트, `?tab=rice|misc` 분기
- `packages-tabs.tsx` — F안 탭 (raw-stocks-tabs 그대로 차용)
- `rice-package-panel.tsx`, `misc-package-panel.tsx` — 빈 셸(헤더 + "데이터 없음" placeholder)
- breadcrumb 매핑 추가 (`/packages` → "제품재고" + Set C `PackageIcon`)
- **홈 대시보드 임시 진입점 카드 1개** ("제품재고로 이동" 등)

**검증**: `/packages?tab=rice` 진입 시 헤더·탭만 보이고 빈 상태. 잡곡 탭도 동일.

### #6b — 품종 그룹 펼침 테이블 + 모바일 카드
- `package-list-client.tsx`: `useState<Set<string>>` 으로 펼침 상태 관리 (key: variety name)
- `package-group-row.tsx` / `package-single-row.tsx` / `mobile-package-card.tsx` 구현
  - 핸드오프 §4.2.3~§4.2.7 스펙 준수
  - source 뱃지(도정산/매입) inline 칩
- 두 탭 모두 작동하는지 확인 (벼는 실데이터, 잡곡은 0건 빈 상태)

**검증**: 벼 탭에서 도정관리에서 만든 포장 레코드들이 품종별로 묶여 보임. 펼침/접힘 동작.

### #6c — 검색 다이얼로그 + 헤더 액션
- `package-search-dialog.tsx`: 년도 / 품종 다중 선택 / source 필터 / 정렬
- 정렬 옵션 초안: **최신순 / 오래된순 / 재고중량 많은순** (#6 윤곽 보고 재조정)
- `active-package-filters.tsx`: 적용 필터 칩
- `header-actions.tsx`: 검색 버튼(필터 카운트 배지) + [+ 추가]
  - 벼 탭: **[+] 버튼 숨김** (도정관리 페이지에서 만드는 거라 진입점 통합)
  - 잡곡 탭: [+ 포장하기] / [+ 매입 등록] 비활성 + "준비중" 툴팁 (#7·#8 머지 시 활성)
- URL 쿼리 → server action 파라미터 연동

**검증**: 검색 다이얼로그에서 필터 적용 → URL 업데이트 → 목록 갱신. 적용 필터 칩 표시.

### #6d — 백로그 §3 차트 라벨
- 대시보드 원곡재고 차트 라벨 "원곡재고" → "벼 원곡 재고"
- 별개 잡곡 차트 추가는 본 작업 범위 외 (통계 단계에서 처리)

**검증**: 대시보드에서 라벨 변경 확인.

## 6. 위험 요소

- **사이드바·네비 임시 추가**: #9에서 전면 교체 예정인데 #6에서 임시로 손대면 #9에서 충돌 가능. → 임시 추가는 **단순 메뉴 항목 1개**에 한정, 디자인 교체는 #9 그대로
- **`MillingOutputPackage` 호출부 누락**: #1에서 호출부 11곳에 `category: 'RICE'`, `source: 'MILLED'` 기본 필터 주입했지만, 신규 액션 `getPackages`는 **양쪽 카테고리·양쪽 source 모두**를 다루므로 기본 필터를 **요청 단위로 명시** 필요. zod 검증 권장
- **다농장 배치(`batch.stocks` 여러 개)**: producer 컬럼에서 `farmer.name`만 보여주면 정보 손실 → 첫 농가 + "외 N명" 패턴 (milling 페이지 동일)
- **품종 그룹핑 키**: `variety.name`만으로 묶으면 같은 이름의 RICE/MISC_GRAIN 충돌 가능성 (현재는 없지만 안전하게 `variety.id` 기준 그룹핑 후 표시는 name)
- **빈 상태 디자인**: 잡곡 탭은 #6 머지 시점에 0건 → §5.3 "아직 등록된 재고가 없어요" + 비활성 [+] 버튼 안내. 벼 탭도 신규 환경에서 0건 가능
- **검색 다이얼로그 필터 키**: `?varietyId=`, `?productionYear=` 등 raw-stocks와 키 컨벤션 통일 — 서로 코드 복붙 시 호환

## 7. 산출물
- 본 계획서 (`docs/plan-잡곡재고관리-#6.md`)
- 4개 커밋 (#6a / #6b / #6c / #6d) — 각 커밋 후 `docs/worklog.md` 업데이트
- 결과보고서 `docs/report-잡곡재고관리-#6-2026-05-XX.md`

## 8. 확정 사항 (2026-05-04 사용자 확인 완료)

1. **메뉴 진입점**: 사이드바·모바일 네비는 #9에서 일괄 정리. **#6에서는 홈 대시보드에 임시 링크 카드 1개**만 둠
2. **벼 탭 [+] 버튼**: **숨김**
3. **검색 다이얼로그 정렬 옵션**: 최신순 / 오래된순 / 재고중량 많은순 — #6 윤곽 보고 추가 결정
4. **커밋 단위**: 4커밋(#6a/b/c/d) 그대로 진행
