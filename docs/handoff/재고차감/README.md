# 재고차감 — Claude Design 시안 요청 스펙

작성일: 2026-09-01 · 기준 커밋: `47b77ad` (서버 D1~D3 반영 완료)
계획서: `docs/plan/plan-재고차감.md` · 디자인 시스템: `docs/handoff/디자인시스템/`

> 🔴 **이 문서가 현재 코드의 단일 원천이다.** 시안이 낡은 스냅샷 기준으로 나온 사고가
> 두 번 있었다(벼탭·재포장). 여기 적힌 실측과 다른 가정을 하지 말 것.
> 구현 시에도 이 문서 ↔ 시안 ↔ 실제 코드 전수 대조가 필수다.

---

## 1. 요청 범위 — 시안 **2개만**

| # | 시안 | 내용 |
|---|---|---|
| 1 | **차감 다이얼로그** | 사유 선택 + 판매 시 거래처 + 발생일 + 행별 개수 목록 + 확인 단계 |
| 2 | **차감 이력 다이얼로그 + 차감된 행 표시** | 이력 목록·되돌리기 + 목록에서 차감된 행이 보이는 모양 + 「차감된 재고 보기」 스위치 |

### 그리지 **않는** 것 (전부 기존 재포장 인프라 재사용)
- 목록 테이블·모바일 카드·체크박스 열 — 재포장 선택 모드 그대로 (`PKG_GRID_SELECT`)
- 하단 선택 바(데스크탑 sticky / 모바일 floating pill) — **문구·버튼만 분기**, 틀은 동일
- 토글 버튼 — `repack-toggle-button.tsx`를 본뜬 「차감」 버튼. 새 어휘 없음

---

## 2. 기능 배경 (협의 확정 N1~N7)

- 이름 = **재고차감**. 사유 = **판매 / 증정 / 분실 / 파손 / 기타** — 과거 판매분 정리도 판매로 넣는다
- 일상 차감(1건)과 대량 정리(최대 수백 행)가 **같은 흐름 하나**. 다중선택 일괄이 기본형
- 첫 실행이 **605행 규모의 과거분 정리**다 — 발생일 소급 입력이 핵심 동선
- 확인 단계 **항상** (되돌릴 수 있어도 대량 오조작 비용이 크다)
- 되돌리기 진입점 = 제품재고 목록의 **「차감된 재고 보기」 스위치** (탭 신설 아님)
- 벼·잡곡 패널 **둘 다** 차감 버튼
- 재포장과 달리 **동질성 제약 없음** — 아무 행이나 함께 고를 수 있다

---

## 3. 디자인 시스템 (요약 — 세부는 `docs/handoff/디자인시스템/`)

- Primary `#2563eb`(blue-600) · Neutral = slate · shadcn/ui + lucide-react · Tailwind v4
- 매입 칩: amber-50/amber-700 테두리 amber-200 · LOT 칩: mono slate-100
- 위험(삭제·차단): red-600, `focus:bg-red-50` · 경고 박스: amber-50/amber-200
- 확인(공용): `confirmDialog()` — AlertDialog 기반, `destructive` 옵션 있음

---

## 4. 현행 코드 실측 (2026-09-01)

### 4.1 다이얼로그 관습 — `repack-dialog.tsx`가 기준
- `DialogContent`: `sm:max-w-[720px] max-h-[92dvh] gap-0 overflow-hidden p-0`
- 헤더: 좌측 30px 아이콘 타일(`bg-primary/10 text-primary` rounded-lg) + 볼드 15px 제목
  + 12px 설명(선택 요약: 「N건 M,MMMkg을 …합니다」) · `border-b border-slate-100 px-4 py-3.5 sm:px-5`
- **스크롤은 본문 한 군데만** (이중 스크롤 회피). 헤더·요약줄·푸터는 `shrink-0`
- 푸터: `border-t` + 좌측 상태/계기판 + 우측 버튼 2개.
  버튼 높이 **모바일 h-11 / 데스크탑 h-8** (`h-11 sm:h-8`), 취소=outline·실행=primary
- 인라인 경고(손실 인정 패턴): amber 박스 + 그 안에 진행 버튼 — 별도 confirm을 띄우지 않고
  다이얼로그 안에서 해결하는 관습

### 4.2 선택 모드 (list-client, 현행은 재포장 전용 → 2종화 예정)
- 데스크탑 선택 바: 목록 아래 `sticky bottom-4` 우측 정렬, 흰 카드
  `border-primary/25 rounded-xl px-4 py-2.5` — 「**N건** 선택 | 최대 M,MMMkg · (기준 라벨)」
  + ghost「선택 해제」+ primary「재포장하기」
- 모바일: `fixed bottom-16`(탭바 위) floating pill — 요약 + 실행 버튼 1개
- 안내 문구(목록 위, 11.5px slate-500): 「합칠·나눌 재고를 고르세요. …」→ 차감용 문구 필요
- 토글 버튼: 꺼짐 ghost(slate-500) / 켜짐 `bg-primary/10 text-primary` 틴트 + X · `min-w-[96px]`
- 그룹 헤더 행은 선택 불가(빈 셀) — 안의 서브행만 체크

### 4.3 목록 행 (데스크탑 `package-row.tsx` / 모바일 `mobile-package-card.tsx`)
- 컬럼: 품종 / 도정구분 / 생산자 / 로트번호 / 규격 / 개수 / 총량 / 포장일자 / ⋮(36px)
- 선택 모드 시 맨 앞 28px 체크박스 열이 덧붙음
- ⋮ 메뉴: 현재 수정(연필)·삭제(빨강 휴지통) 2항목, `w-[120px]` — **벼 탭은 콜백 미전달로 메뉴
  자체가 없음**(빈 셀). 이력 진입을 ⋮로 하려면 벼 탭에도 메뉴가 생기는 것임을 유의
- 모바일 카드: 3-col grid `[auto_1fr_auto]`, 체크박스·⋮ 터치 영역 44px 확장
- 🔴 **모바일 카드 폰트 키우지 말 것** — 줄 넘침이 더 큰 문제(메모리 확정 사항)

### 4.4 필터 줄 — `active-package-filters.tsx` (스위치가 들어갈 곳)
- 한 줄: 좌 「검색결과 N건」 12px + 우측 활성 필터 Badge들(outline slate). 가로 스크롤 허용
- 「차감된 재고 보기」 스위치는 이 줄에 얹는다. URL 파라미터로 유지(새로고침 생존)

---

## 5. 서버 계약 (확정 — `47b77ad`)

### 5.1 차감 실행 — `createBulkMovements` (다이얼로그 #1이 부른다)
```ts
input: {
  items: { packageId: number; count: number }[]   // 1~500행
  type: 'SALE' | 'GIFT' | 'LOST' | 'DAMAGED' | 'OTHER'
  customer?: string      // SALE일 때만 저장됨 (최대 100자)
  note?: string          // 최대 500자
  occurredAt?: Date      // 미지정 = 오늘
}
→ { success: true; rows: number; totalCount: number } | { success: false; error: string }
```
- 사유 라벨: 판매·증정·분실·파손·기타 (`MOVEMENT_LABEL`)
- 가용 초과 시 에러는 **여러 줄 문자열** — 「가용 재고를 초과했습니다.\n  · 20kg — 가용 2개, 요청 3개」
  형태이므로 에러 표시는 줄바꿈 보존(`whitespace-pre-line`) 필요
- 발생일은 **묶음당 1개** — 행마다 다르게 주려면 나눠서 실행(계획서 §8)

### 5.2 행 데이터 — `PackageRow` (다이얼로그·목록이 받는 것)
```ts
{ id, variety, spec, weightPerUnit, millingTypeLabel, qty,
  available,            // 가용 개수 — 차감 입력 상한
  producer, lot, date, sub, source,
  deductedAt: string | null,   // 마지막 차감일. includeDeducted 조회에서만 채워짐
  deductedTypes: string[] }    // 걸린 사유들(예: ['SALE','REPACK']). 위와 동일 조건
```
- **차감 완료 판정 = `available <= 0`** (별도 플래그 없음)
- 부분 차감 행(가용 1 이상)은 평소 목록에도 그대로 나온다 — 「차감됨」 표시는 완료 행에만

### 5.3 이력 — `listMovements(packageId)` (다이얼로그 #2가 그린다)
```ts
MovementRow: {
  id, count,
  type: 'SALE'|'GIFT'|'LOST'|'DAMAGED'|'OTHER'|'REPACK',
  customer: string | null,     // SALE 거래처
  note: string | null,
  occurredAt: string,          // 'yyyy-mm-dd'
  createdName: string | null,  // 작업자
  fromOrder: boolean,          // 발주서 경로
  fromRepack: boolean,         // 재포장 경로
  cancellable: boolean }       // 🔴 화면은 이 값만 본다. false면 되돌리기 대신 사유 문구
```
- `cancellable: false`의 사유 문구(서버 거부 문구와 동일해야 함):
  - 재포장: 「재포장으로 나간 차감은 취소할 수 없어요. 되돌리려면 재포장으로 만든 재고를
    다시 재포장해 원래 규격으로 합쳐주세요.」(`REPACK_CANCEL_BLOCKED`)
  - 발주서: 「발주서 차감은 발주서 상세에서 취소해주세요.」
- 되돌리기 = `cancelMovement(id)` — 하드삭제, 가용 자동 복원

---

## 6. 시안 #1 — 차감 다이얼로그 요구사항

1. **사유 선택** 5종(판매/증정/분실/파손/기타). **판매를 고르면 거래처 입력칸 노출**
2. **발생일** — 기본 오늘. 과거분 정리가 첫 사용례라 **소급 입력이 눈에 띄어야 함**
3. **사유 메모**(note) — 기타 선택 시 사실상 필수임을 안내
4. **선택 행 목록**: 품종 · 규격 · 로트 · 가용 · **차감개수 입력(기본=전량)**
   - 최대 수백 행 → 스크롤 영역 + 「전량으로 초기화」 버튼
   - 개수 0으로 두면 그 행은 제외
   - 가용 1개 행은 입력 대신 「1개 전부」 텍스트(재포장 관습 §4.1)
5. **확인 단계 항상** — 실행 전 요약 「N행 · M개 · 사유」. 인라인 확인(손실 인정 패턴)이든
   2단계 화면이든 다이얼로그 안에서 해결할 것
6. 합계 표시: 선택 바가 「N건 · M개」를 이미 보여주므로 다이얼로그 푸터는
   재포장의 계기판 자리에 차감 요약을 놓는 것을 검토

## 7. 시안 #2 — 이력 다이얼로그 + 차감된 행 표시

1. **「차감된 재고 보기」 스위치** — 필터 줄(§4.4)에. 켜면 URL 파라미터 유지
2. **차감된 행**(available ≤ 0): 흐린 처리 + 「차감됨」 배지(기존 칩 문법: 매입=amber, LOT=mono slate
   와 구별되는 톤), 체크박스 비활성. `deductedAt`·`deductedTypes` 요약 표시
   - 데스크탑 행과 모바일 카드 **둘 다** 필요
3. **차감 이력 다이얼로그** — 행 ⋮ → 「차감 이력」으로 진입
   - 목록: 사유 배지 · 개수 · 발생일 · 거래처(SALE) · 메모 · 작업자
   - `cancellable`이면 「되돌리기」(확인 = 공용 `confirmDialog`, destructive 아님 — 복원 동작)
   - 아니면 §5.3 사유 문구
   - 규모: 대부분 1~3건, 최대 수십 건
4. 그룹 합계는 서버가 이미 차감 완료 행을 빼고 준다 — 화면에서 재계산하지 말 것

---

## 8. 새 어휘 금지 원칙

- 토글 켜짐 = primary 틴트, 위험 = red-600, 경고 = amber 박스, 배지 = 기존 Badge/칩 문법
- 확인 = `confirmDialog()` 또는 인라인(손실 인정 패턴). **새 confirm UI 만들지 말 것**
- 버튼 높이·폭 관습(§4.1) 유지. 아이콘은 lucide 라인만
