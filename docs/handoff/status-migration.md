# 상태 라벨 마이그레이션 — 영향 분석

## 1. 변경 요지

| 구분 | 현재 (혼용) | 변경 후 (통일) |
|---|---|---|
| `isClosed === true` | "완료" (대시보드) / "마감" (목록·다이얼로그·엑셀) | **마감됨** |
| `isClosed === false` | "포장" (단일) | **도정중** (outputs 0개) / **포장중** (outputs 1개 이상) |

판정식:
```ts
function getMillingStatus(batch) {
  if (batch.isClosed) return 'closed'   // 마감됨
  if (batch.outputs.length > 0) return 'packaging'  // 포장중
  return 'milling'                                  // 도정중
}
```

데이터 모델 변경 **없음** — `MillingBatch.isClosed`(boolean) + `outputs[]` 존재만으로 3단계 도출 가능.

---

## 2. 영향 받는 파일

### A. 표시 (Display) — 라벨/배지 변경 필요

| 파일 | 위치 | 현재 표시 | 변경 후 |
|---|---|---|---|
| `app/(dashboard)/_components/recent-logs-list.tsx` | L98, L116, L182 | "완료" / "포장" | `<StatusBadge>` 컴포넌트 사용 |
| `app/(dashboard)/milling/milling-table-row.tsx` | L196 | "마감" 배지 | 같은 컴포넌트 사용 |
| `app/(dashboard)/milling/mobile-milling-card.tsx` | L141 | "마감" 배지 | 같은 컴포넌트 사용 |
| `app/(dashboard)/milling/active-milling-filters.tsx` | L26 | `'open' → '진행중'` | `'milling' / 'packaging' / 'closed'` 3개 |
| `app/(dashboard)/milling/milling-filters.tsx` | L246-247 | Select 2개 (`open` / `closed`) | Select 3개 |
| `app/actions/milling-excel.ts` | L103 | `'완료' / '진행중'` (string) | `'마감됨' / '포장중' / '도정중'` |

### B. 데이터 (Query) — outputs 카운트 필요

```ts
// 필터 'milling' (도정중) — outputs 없음
where: { isClosed: false, outputs: { none: {} } }

// 필터 'packaging' (포장중) — outputs 1개 이상
where: { isClosed: false, outputs: { some: {} } }

// 필터 'closed' (마감)
where: { isClosed: true }
```

`app/actions/milling.ts` L185-187, `app/actions/milling-excel.ts` L22-24 의 where 조건 분기 추가.

### C. 변경 불필요 — 핵심 로직

- `app/actions/milling.ts:489 updateMillingBatchStatus` — `isClosed` boolean만 다루므로 그대로
- `add-packaging-dialog.tsx` 의 액션 버튼 — `"마감완료"`, `"마감 해제"`, `"작업 마감"` 은 동사형이므로 **그대로 유지** (상태 배지만 마감됨)
- `actions/milling.ts:507-514` audit log — "마감/진행중" 표기 그대로 (로그 호환성 유지)
- prisma migration / DB 스키마 — 변경 없음

---

## 3. 작업 단계 (권장 순서)

1. **공통 컴포넌트 추출** — `components/ui/milling-status-badge.tsx` 신설  
   `props: { isClosed: boolean, hasOutputs: boolean, size?: 'sm' | 'md' }` → 3가지 배지 자동 렌더
2. **표시 교체** — A 그룹 6개 파일에서 인라인 배지를 컴포넌트 사용으로 교체
3. **필터 옵션 변경** — `milling-filters.tsx` SelectItem 3개로 확장, `active-milling-filters.tsx` 라벨 매핑 확장
4. **쿼리 분기 추가** — `actions/milling.ts`, `actions/milling-excel.ts` where 조건
5. **엑셀 export 라벨** — `milling-excel.ts:103` `statusStr` 3분기로 변경
6. **회귀 점검**
   - 마감 / 마감 해제 동작 (`close-batch-button.tsx`, `add-packaging-dialog.tsx`)
   - 권한 매트릭스 영향 없음 확인 (`docs/permission-matrix.md`)

---

## 4. 마이그레이션 시 주의

- **기존 URL/쿼리 파라미터 호환** — `?status=open` 으로 북마크된 링크는 `milling+packaging` 묶음으로 리다이렉트 (또는 `open`을 별칭으로 유지)
- **audit log 표기** — DB에 이미 저장된 `"진행중"` 로그는 그대로 두고, 신규 변경분부터 세분화 (또는 변경 안 해도 무방)
- **엑셀 export 호환** — 외부 양식에서 "진행중" 컬럼을 참조한다면 한 차례 공지 필요

---

## 5. 작업량 추정

| 항목 | 추정 |
|---|---|
| 공통 배지 컴포넌트 + 단위 테스트 | 0.5h |
| 표시 교체 (6개 파일) | 1.0h |
| 필터/쿼리 분기 | 1.0h |
| 엑셀/audit 조정 | 0.5h |
| QA (3가지 상태 × 데스크탑/모바일) | 1.0h |
| **합계** | **약 4시간** |

비교적 가벼운 작업. 데이터 마이그레이션 없이 표시 + 분기만 추가.
