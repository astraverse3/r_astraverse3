# 작업 결과보고서 — 사이드바 개편 + 관리자 설정 페이지
**날짜:** 2026-03-23

---

## 작업 목표
- PC 사이드바 메뉴 체계 개편
- 브레드크럼 업데이트
- 관리자 설정 페이지 신규 생성 (도정구분별 수율 기준값 설정)

---

## 변경 파일

| 파일 | 내용 |
|------|------|
| `components/desktop-sidebar.tsx` | 품종 관리 `Leaf` 아이콘, 생산자 관리 `Users` 아이콘 추가. 품종·생산자 관리를 서브메뉴에서 독립 메뉴로 올림. "관리자 설정" → "관리자 메뉴" 타이틀 변경. "관리자 설정" 서브메뉴 신규 추가 (`/admin/settings`) |
| `components/breadcrumb-display.tsx` | `settings → '관리자 설정'` 매핑 추가 |
| `prisma/schema.prisma` | `SystemConfig` 모델 추가 (key/value 형태, key unique) |
| `app/actions/settings.ts` | `getYieldRates`, `getYieldRate`, `saveYieldRates` 서버 액션 신규 생성 |
| `app/(dashboard)/admin/settings/page.tsx` | 관리자 설정 페이지 신규 생성 |
| `app/(dashboard)/admin/settings/settings-client.tsx` | 수율 설정 UI 클라이언트 컴포넌트 신규 생성 |

---

## DB 변경 사항
- `SystemConfig` 테이블 신규 생성 (`prisma db push` 완료)
- 수율 저장 키 형식: `yield_rate_백미`, `yield_rate_현미` 등
- DB에 값이 없으면 기본값 사용 (백미 68%, 현미 70%, 오분도미 69%, 칠분도미 69%, 찹쌀 68%, 기타 68%)

---

## 다음 할 일 (미완료)
- [ ] **개발 서버 재시작** — Prisma 클라이언트 generate가 dll 잠금으로 실패. 서버 재시작 시 자동 해결됨
- [ ] **수율값 실제 연동** — `lib/lot-generation.ts`의 `getYieldRate()`가 여전히 하드코딩 상태. 관리자 설정에서 저장한 값이 실제 도정 계산에 반영되도록 연동 작업 필요
