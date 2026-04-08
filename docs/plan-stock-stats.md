# 계획서: 재고분석 페이지 구축

> 작성일: 2026-04-03  
> 최종 수정: 2026-04-07  
> 작업명: stock-stats  
> 경로: `/statistics/stock`  
> 메뉴명: 재고분석

---

## 목표

생산자/작목반/품종별 입고 재고의 처리 현황(도정완료·미처리·직접출고)을 한눈에 파악하는 통계 페이지.

---

## 데이터 모델

| 모델 | 사용 필드 |
|------|-----------|
| `Stock` | weightKg, status(AVAILABLE/CONSUMED/RELEASED), productionYear, incomingDate, farmerId, varietyId |
| `Farmer` | name, farmerNo, groupId |
| `ProducerGroup` | name, certType, cropYear |
| `Variety` | name, type |

---

## 페이지 구조

```
[연산 ▼]  [작목반 ▼]  [품종 ▼(멀티)]  [생산자 텍스트입력]  [초기화] [검색]

[요약 카드 4개]

[탭: 품종별 | 작목반별 | 생산자별]
  [차트]
  [테이블]
```

---

## 필터

| 필터 | 설명 |
|------|------|
| 연산(productionYear) | Stock.productionYear 기준, 기본값 최신 연산 |
| 작목반 | ProducerGroup 기준, 선택 시 해당 그룹 생산자만 |
| 품종 | 다중 선택 가능 (체크박스 드롭다운) |
| 생산자 | 텍스트 입력, 쉼표(,) 구분, trim 처리 후 name in 필터 |

- 연산/작목반 변경 시 옵션 목록만 갱신, 데이터 조회는 **검색 버튼** 클릭 시
- 초기화 버튼: 모든 필터 초기값으로 리셋 후 즉시 조회

---

## 요약 카드 (4개)

| 카드 | 계산 | 색상 |
|------|------|------|
| 총 입고량 (kg) | 전체 weightKg 합계 | 파랑 `#00a2e8` |
| 도정완료 (kg) | status=CONSUMED 합계 | 초록 `#8dc540` |
| 미처리 재고 (kg) | status=AVAILABLE 합계 | 주황 `#f89c1e` |
| 생산자 수 | 검색 조건에 해당하는 고유 생산자 수 | 회색 `#94a3b8` |

---

## 탭별 차트 + 테이블

### 공통 차트 설정
- 가로 스택 막대 (Recharts `BarChart layout="vertical"`)
- 상위 **10개** → 나머지 "기타" 묶음
- 도정완료(초록) / 직접출고(보라) / 미처리(주황) 스택
- x축 틱 포인트에 수직 가이드라인 표시 (`CartesianGrid horizontal={false}`)

### 품종별 탭 (기본 탭)

**테이블 컬럼:**  
품종명 | 총 입고(kg) | 도정완료(kg) | 직접출고(kg) | 미처리(kg) | 처리율(%)

### 작목반별 탭

**테이블 컬럼:**  
작목반명 | 인증 | 생산자수 | 총 입고(kg) | 도정완료(kg) | 직접출고(kg) | 미처리(kg) | 처리율(%)

### 생산자별 탭

**테이블 컬럼:**  
생산자명 | 작목반 | 총 입고(kg) | 도정완료(kg) | 직접출고(kg) | 미처리(kg) | 처리율(%)

---

## 용어 정책

| 구 용어 | 신 용어 | 비고 |
|---------|---------|------|
| 농가 | 생산자 | UI 표시 전면 변경 |
| 농가번호 | 생산자번호 | 에러 메시지, 엑셀 헤더 |
| 농가명 | 생산자명 | 컬럼 헤더, 엑셀 헤더 |

> 변수명(`farmerId`, `farmerName`, `farmerMap` 등)과 Prisma 스키마(`farmer`, `farmerId`)는 변경하지 않음.

---

## 변경 파일

| 파일 | 구분 | 내용 |
|------|------|------|
| `app/actions/stock-statistics.ts` | NEW | Server Action + 타입 정의 |
| `app/(dashboard)/statistics/stock/page.tsx` | NEW | 서버 컴포넌트 (데이터 fetch) |
| `app/(dashboard)/statistics/stock/stock-stats-client.tsx` | NEW | 클라이언트 UI |
| `components/statistics/StockChart.tsx` | NEW | 가로 스택 막대 차트 |
| `components/desktop-sidebar.tsx` | 수정 | 재고분석 메뉴 항목 추가 |
| `components/mobile-nav.tsx` | 수정 | statsSubItems에 재고분석 추가 |
| `app/(dashboard)/milling/stock-list-dialog.tsx` | 수정 | 컬럼 헤더 농가명→생산자명 |
| `app/actions/admin.ts` | 수정 | 에러 메시지 용어 통일 |
| `app/actions/excel.ts` | 수정 | 엑셀 헤더·오류 메시지 용어 통일 |
| `app/actions/milling.ts` | 수정 | 주석 용어 통일 |

---

## 작업 순서

- [x] 1. `app/actions/stock-statistics.ts` — Server Action + 타입
- [x] 2. `app/(dashboard)/statistics/stock/page.tsx` — 서버 컴포넌트
- [x] 3. `app/(dashboard)/statistics/stock/stock-stats-client.tsx` — 클라이언트 UI
- [x] 4. `components/statistics/StockChart.tsx` — 가로 스택 막대
- [x] 5. `components/desktop-sidebar.tsx` — 메뉴 추가
- [x] 6. `components/mobile-nav.tsx` — 서브메뉴 추가
- [x] 7. 빌드 확인 (TypeScript 오류 없음, Next.js 빌드 성공)
- [x] 8. 탭 순서 변경 (품종별 → 작목반별 → 생산자별, 기본 탭: 품종별)
- [x] 9. 검색 필터 추가 (품종 멀티셀렉트, 생산자 텍스트 검색, 초기화/검색 버튼)
- [x] 10. 용어 통일 (농가 → 생산자, UI 전면 변경)
- [x] 11. 생산자 수 카드: 미처리 생산자 수 → 검색 조건 내 전체 생산자 수
- [x] 12. 차트 x축 가이드라인 추가, 최대 표시 개수 10개로 조정
- [x] 13. 테이블 헤더 구분 스타일, 작목반·품종 테이블에 직접출고 열 추가
- [x] 14. 서머리카드 "생산자수" → "재고율" (availableKg / totalKg × 100)
- [x] 15. 테이블 "처리율" → "재고율" (전체 탭), processRate → stockRate 필드명 변경
- [x] 16. 인증 뱃지 색상 구분 (유기농: 초록, 무농약: 파랑, 일반: 회색)
- [x] 17. Y축 라벨 너비 자동 계산 개선 (한글 기준 ×10, 최대 150px)
- [x] 18. 차트 데이터 포인트 10 → 20개, "기타" 집계 제거 (왜곡 방지)
- [x] 19. 레이아웃 개편: 차트(좌, 416px 고정+스크롤) + 서머리카드(우, md:w-48 수직)
- [x] 20. 수율분석 SummaryCards 디자인 재고분석 스타일로 통일 (흰 배경 + 컬러 탑바)
