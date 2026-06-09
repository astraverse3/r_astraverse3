# 계획서: 관행 농가 로트번호 처리 개선

작성일: 2026-03-25

## 배경 및 목적

관행(certType = '일반') 농가는 인증이 없으므로 로트번호 자체가 의미 없음.
현재 포장 저장 시 `generateLotNo()`를 무조건 호출하여 `251118-18---9915` 같은
잘못된 로트번호가 생성됨 (관행 그룹 certNo가 `-`이어서 하이픈 3개 발생).

**원칙**: 관행 농가는 로트번호를 생성하지 않고 null 저장, UI/엑셀에서 "관행"으로 표시.

---

## 현황 파악

### 불일치 현황

| 레벨 | 현재 동작 | 문제 |
|------|---------|------|
| Stock 저장 (`stock.ts`) | certType === '일반'이면 lotNo = null | ✅ 정상 |
| 포장 저장 (`milling.ts`) | 항상 `generateLotNo()` 호출 | ❌ 버그 |
| 엑셀 내보내기 (`milling-excel.ts`) | 로트번호 컬럼 없음 | ⚠️ 추가 필요 |
| UI 표시 | `{lotNo ?? '-'}` 단순 표시 | ⚠️ "관행" 표시 필요 |

### 잘못 생성된 기존 데이터

포장(MillingOutputPackage) 7건에 `---` 포함된 잘못된 lotNo 존재:
- id: 277, 278, 279, 370, 375, 376, 377

---

## 변경 파일 및 내용

### Step 1 — 포장 저장 버그 수정 (핵심)

**`app/actions/milling.ts`** — 2개 함수

`addPackagingLog()` (L323):
```
현재: 항상 generateLotNo() 호출
변경: certType === '일반'이면 lotNo = null, 그 외 generateLotNo()
```

`updatePackagingLogs()` (L392):
```
현재: 항상 generateLotNo() 호출
변경: 동일하게 certType 체크 후 null or generateLotNo()
```

### Step 2 — 엑셀 내보내기 로트번호 컬럼 추가

**`app/actions/milling-excel.ts`** — 도정 엑셀 내보내기

현재 컬럼: 도정일자, 진행상태, 품종, 도정분류, 생산자명, 작목반, 톤백번호, 톤백무게, 총 투입량, 총 생산량, 수율, 비고

변경: `'로트번호'` 컬럼 추가
```
certType === '일반' → '관행'
lotNo 있음 → 로트번호 표시
lotNo없음 (미완료 등) → '-'
```

### Step 3 — UI 표시 수정

**`components/statistics/MillingTable.tsx`** — 통계 페이지 포장 팝업 (L111)
```
현재: {o.lotNo ?? '-'}
변경: lotNo가 없고 관행이면 '관행', 그 외 로트번호 또는 '-'
단, statistics 쿼리에 certType 추가 필요 여부 확인
```

**`app/(dashboard)/stocks/stock-table-row.tsx`** — 재고 목록 (L108)
```
현재: 유기농/무농약일 때만 lotNo 표시, 관행은 아무것도 안 보임
변경: 관행이면 "관행" 텍스트 표시
```

**`app/(dashboard)/stocks/stock-list-client.tsx`** — 재고 목록 모바일/인라인 (L496)
```
현재: ({stock.lotNo || '-'})
변경: 관행이면 '관행' 표시
```

### Step 4 — 기존 잘못된 DB 데이터 정리

MillingOutputPackage 7건 lotNo → null 업데이트
```
id IN (277, 278, 279, 370, 375, 376, 377)
```

---

### Step 5 — 포장 다이얼로그 그룹핑 수정

**`app/(dashboard)/milling/add-packaging-dialog.tsx`** — `computeLotGroups()` 함수

관행 농가(certType === '일반')는 작목반코드 99가 동일하므로
farmerNo(생산자 일련번호)로 그룹핑해야 함.

```
현재: generateLotNo() 결과를 Map 키로 사용 → 관행이면 잘못된 키 생성
변경:
  - certType === '일반' → groupKey = `관행-${farmerNo}`, displayLotNo = '관행'
  - 그 외 → 기존 generateLotNo() 결과를 키 및 표시값으로 사용
```

`LotGroup` 타입에 `isConventional?: boolean` 또는 `displayLotNo: string` 추가하여
UI에서 "관행" 텍스트로 렌더링.

---

## 범위 제외 (이번 작업 안 함)

- `stock-excel.ts` 임포트 로직 — 이미 관행 처리 정상
- `release-excel.ts` — lotNo 미사용

---

## 변경 파일 요약

| 파일 | 변경 이유 |
|------|---------|
| `app/actions/milling.ts` | 포장 저장 시 관행 lotNo = null 처리 |
| `app/actions/milling-excel.ts` | 로트번호 컬럼 추가 + 관행 표시 |
| `components/statistics/MillingTable.tsx` | 관행 "관행" 표시 |
| `app/(dashboard)/stocks/stock-table-row.tsx` | 관행 "관행" 표시 |
| `app/(dashboard)/stocks/stock-list-client.tsx` | 관행 "관행" 표시 |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | 관행 농가 farmerNo 기준 그룹핑 |
| DB 데이터 정리 | 기존 7건 잘못된 lotNo → null |

총 6개 파일 + DB 정리
