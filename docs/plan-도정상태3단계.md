# 도정 작업 상태 3단계 마이그레이션 — 작업 계획서

> 근거: [docs/handoff/status-migration.md](./handoff/status-migration.md)
> 기준일: 2026-05-20

---

## 1. 작업 목표

기존 코드에서 혼용되던 도정 작업 상태 라벨을 3단계로 통일한다. **데이터 모델 변경 없이** `isClosed: boolean` + `outputs[].length` 조합으로 3단계를 도출한다.

| 구분 | 현재 (혼용) | 변경 후 (통일) |
|---|---|---|
| `isClosed === true` | "완료"(대시보드) / "마감"(목록·다이얼로그·엑셀) | **마감됨** |
| `isClosed === false` | "포장"(단일) | **도정중**(outputs 0) / **포장중**(outputs 1+) |

판정식:
```ts
function getMillingStatus(batch: { isClosed: boolean; outputs: { length: number } }) {
  if (batch.isClosed) return 'closed'      // 마감됨
  if (batch.outputs.length > 0) return 'packaging'  // 포장중
  return 'milling'                          // 도정중
}
```

라벨 매핑(`MILLING_STATUS`)은 [docs/handoff/components/status-system.jsx:7-41](./handoff/components/status-system.jsx) 시안 그대로 채택:
- `milling`: sky-50 / sky-700 / sky-200 / sky-500 dot
- `packaging`: amber-50 / amber-700 / amber-200 / amber-500 dot + `animate-pulse`
- `closed`: emerald-50 / emerald-700 / emerald-200 / emerald-500 dot

**액션 버튼 동사형은 변경 없음**: "마감완료", "마감 해제", "작업 마감"은 동작 표현이라 그대로 유지.

---

## 2. 변경 파일 (10개)

### A. 신규 (1)
- `components/ui/milling-status-badge.tsx` — 공통 배지 컴포넌트
  - Props: `{ isClosed: boolean; hasOutputs: boolean; size?: 'sm' | 'md' }`
  - 3가지 상태를 자동 판정해 렌더

### B. 표시 교체 (5)
- [app/(dashboard)/_components/recent-logs-list.tsx](./../app/(dashboard)/_components/recent-logs-list.tsx) — 모바일 L98-102 / PC L182-186 인라인 배지
- [app/(dashboard)/milling/milling-table-row.tsx](./../app/(dashboard)/milling/milling-table-row.tsx) — L195-200 인라인 배지
- [app/(dashboard)/milling/mobile-milling-card.tsx](./../app/(dashboard)/milling/mobile-milling-card.tsx) — L141 부근 인라인 배지
- [app/(dashboard)/milling/active-milling-filters.tsx](./../app/(dashboard)/milling/active-milling-filters.tsx) — L26 `statusLabel` 매핑 3개로 확장
- [app/(dashboard)/milling/milling-filters.tsx](./../app/(dashboard)/milling/milling-filters.tsx) — L246-247 SelectItem 2개 → 3개

### C. 쿼리 분기 (2)
- [app/actions/milling.ts](./../app/actions/milling.ts) — L163 인터페이스 주석 + L182-189 status 분기
- [app/actions/milling-excel.ts](./../app/actions/milling-excel.ts) — L21-24 where 분기 + L103 `statusStr` 3분기

### D. 검증 (2)
- [app/(dashboard)/milling/close-batch-button.tsx](./../app/(dashboard)/milling/close-batch-button.tsx) — 동사형 라벨만 사용 확인
- [app/(dashboard)/milling/add-packaging-dialog.tsx](./../app/(dashboard)/milling/add-packaging-dialog.tsx) — 동사형 라벨만 사용 확인

---

## 3. 단계별 접근

### Step 1. 공통 배지 컴포넌트 신설 [0.5h]
`components/ui/milling-status-badge.tsx` 작성. `MILLING_STATUS` 상수와 `MillingStatusBadge` 컴포넌트를 한 파일에 둠. 시안 코드를 TS+shadcn 스타일로 리라이트.

### Step 2. 표시 교체 [1.0h]
A그룹 5개 파일에서 인라인 `<Badge>` / `<span>` 을 `<MillingStatusBadge isClosed={...} hasOutputs={...} />` 호출로 일괄 교체. 색상 코드(`#00a2e8`, `#8dc540`)는 자연스럽게 사라짐.

### Step 3. 필터 옵션 확장 [0.5h]
- `milling-filters.tsx` SelectItem 3개로:
  - `milling`(도정중) / `packaging`(포장중) / `closed`(마감)
- `active-milling-filters.tsx` `statusLabel` 매핑 3개로 확장
- **URL 호환**: 기존 북마크된 `?status=open` 은 서버 액션에서 `milling`+`packaging` 둘 다 매칭하도록 매핑 (또는 deprecated alias)

### Step 4. 쿼리 분기 [1.0h]
- `actions/milling.ts:163` `status?: string` 주석 갱신: `'milling' | 'packaging' | 'closed' | 'open'(legacy)`
- L182-189 where 분기:
  ```ts
  if (params.status === 'milling')      where = { isClosed: false, outputs: { none: {} } }
  else if (params.status === 'packaging') where = { isClosed: false, outputs: { some: {} } }
  else if (params.status === 'closed')    where = { isClosed: true }
  else if (params.status === 'open')      where = { isClosed: false } // legacy
  ```
- `actions/milling-excel.ts:21-24` 동일 분기 추가

### Step 5. 엑셀 라벨 [0.3h]
`milling-excel.ts:103` `statusStr`:
```ts
const statusStr = batch.isClosed
  ? '마감됨'
  : batch.outputs.length > 0 ? '포장중' : '도정중'
```
+ 엑셀 헤더 키 `'진행상태'` → `'도정상태'` 로 변경 (해당 키가 사용되는 모든 rows 객체).

### Step 6. 회귀 검증 [1.0h]
- [ ] 마감 / 마감 해제 동작 정상
- [ ] 도정중 → 포장 등록 시 자동으로 "포장중"으로 표시 전환되는지
- [ ] 마감됨 배지 클릭 시 포장내역 다이얼로그 열림 (recent-logs-list 의 hover 동작 유지)
- [ ] URL `?status=open` 으로 직접 접근해도 작동
- [ ] 엑셀 다운로드 후 "진행상태" 컬럼 세분화 확인
- [ ] [docs/permission-matrix.md](./permission-matrix.md) 영향 없음

---

## 4. 사전 확인 사항

### 4.1 status 키 매핑 검증
실제 코드에서 status 값 흐름:
- **URL/UI(`SelectItem value`)**: `'open' / 'closed'` ([milling-filters.tsx:246-247](./../app/(dashboard)/milling/milling-filters.tsx))
- **`active-milling-filters.tsx:26`**: `'open' / 'closed'` 로 라벨 매핑
- **서버 액션 인터페이스(`actions/milling.ts:163`)**: 주석은 `'active' | 'completed'`
- **서버 액션 분기(`actions/milling.ts:184-188`)**: `'active' / 'completed'` 로 매칭
- **이슈**: URL `'open'` → 액션 `'active'` 변환이 어디서 일어나는지 명확하지 않음. **작업 시작 시 호출부 추적 후 보정** (만약 변환이 없다면 status 필터가 실제로는 동작하지 않고 있을 가능성).

### 4.2 outputs 카운트 SELECT 비용
새 분기 `outputs: { none: {} } / { some: {} }`는 Prisma의 `_count` 서브쿼리로 변환되어 N+1 없이 한 번에 처리됨. 추가 인덱스 필요 없음.

### 4.3 audit log 표기
DB의 `auditLog` 테이블에 이미 저장된 `"진행중"` 표기는 그대로 두고, **신규 변경분부터 세분화 적용**. 백필 불요.

---

## 5. 작업량 추정

| 단계 | 시간 |
|---|---|
| Step 1. 배지 컴포넌트 | 0.5h |
| Step 2. 표시 교체 (5파일) | 1.0h |
| Step 3. 필터 옵션 | 0.5h |
| Step 4. 쿼리 분기 | 1.0h |
| Step 5. 엑셀 라벨 | 0.3h |
| Step 6. QA | 1.0h |
| **합계** | **약 4.3h** |

데이터 마이그레이션 없이 표시 + 분기만 추가하는 가벼운 작업.

---

## 6. 작업 후 산출물

- 변경 파일 10개 + 신규 1개
- `docs/report-도정상태3단계-2026-05-20.md` (결과보고서)
- `docs/worklog.md` 항목 추가
- 커밋 단위: 단일 커밋 (`feat: 도정 상태 3단계 통일 — 도정중/포장중/마감됨`)

---

## 7. 결정 사항 (2026-05-20 사용자 확정)

1. **배지 색상**: status-system.jsx 시안 그대로 — sky-도정중 / amber-포장중(animate-pulse) / emerald-마감됨
2. **URL legacy alias**: 유지 — `?status=open` 은 `milling+packaging` 묶음으로 매칭 (북마크/외부 링크 호환)
3. **엑셀 컬럼명**: 컬럼 헤더 `진행상태` → **`도정상태`** 로 변경 + 값도 3분기 세분화 (`도정중 / 포장중 / 마감됨`)
