# LOT 번호 통일 마이그레이션 — 윤영식 유기농 (92건) — 작업 계획서

> **기준일**: 2026-05-20
> **범위**: 일회성 데이터 정정 (정책 코드 변경 없음)
> **승인자**: 사용자

---

## 1. 작업 목표

검색조건 **IPS + 윤영식 + 유기농** 으로 조회되는 원물 재고 92건의 lotNo를 "가장 빠른 incomingDate" 기준으로 통일한다. 도정 진행/마감건 포함 모든 연결 데이터의 lotNo를 일관되게 갱신한다.

### 사용자 결정 사항 (요약)

| 항목 | 결정 |
|---|---|
| 기준 일자 | 92건 중 가장 빠른 `incomingDate` (자동 산출) |
| `Stock.incomingDate` 필드 | **같이 통일** (lot 첫 6자리와 일치시킴) |
| 마감된 배치(`isClosed=true`)의 outputs | **모두 수정** (마감/진행 구분 없이) |
| 정책 코드 변경 | **하지 않음** (이번 92건만 일회성 SQL/스크립트로 정정) |

---

## 2. 영향 범위

### 2.1 직접 변경 대상

| 테이블 | 컬럼 | 조건 | 예상 건수 |
|---|---|---|---|
| `Stock` | `lotNo`, `incomingDate` | 매칭 조건 만족 | 92건 |
| `MillingOutputPackage` | `lotNo` | 위 Stock 중 `outputs.length > 0` 인 행에 연결된 패키지 | 사전 카운트 필요 |

### 2.2 사전 카운트 항목 (스크립트 dry-run으로 확인)

- 92건 중 `outputs.length > 0` 인 Stock 수
- 그에 연결된 `MillingOutputPackage` 총 수
- 그 중 `MillingBatch.isClosed = true` 인 패키지 수
- 매칭 조건으로 실제로 92건이 나오는지 검증

---

## 3. 매칭 조건 (확정)

사용자 확정: **IPS = 품종명, 곡종 = 인디카(RICE 카테고리)**.

```ts
where: {
  category: 'RICE',
  variety: { name: 'IPS', type: 'INDICA' },
  farmer: {
    name: '윤영식',
    group: { certType: '유기농' },
  },
}
```

Step 0 dry-run에서 92건이 정확히 나오는지 검증.

---

## 4. 단계별 접근

### Step 0. 매칭 조건 확정 & 사전 조사 [0.5h]

스크립트 작성 전 **DB 직접 쿼리**로:

1. "IPS + 윤영식 + 유기농" 조건으로 정확히 92건이 나오는 where 절 확정
2. 그 92건의 다음 필드 추출:
   - `id`, `incomingDate`, `lotNo`, `outputs.length`, `batch.isClosed`
3. 사용자에게 표 출력해서 확인 → **승인 후 다음 단계**

### Step 1. 백필 스크립트 작성 [1.0h]

`scripts/backfill-lot-yoonyoungsik-organic.js` 생성. 구조:

```
1. 매칭 조건으로 92건 Stock 조회 (farmer/variety/group 포함)
2. 가장 빠른 incomingDate 산출 → targetDate
3. generateLotNo({ incomingDate: targetDate, ... }) 로 새 lotNo 계산
4. 변경 전/후 diff 출력
   - Stock: id, oldLot → newLot, oldDate → newDate
   - Package: id, oldLot → newLot
5. --dry-run 플래그 (기본값)일 땐 출력만, --commit 플래그일 때만 실제 UPDATE
6. 트랜잭션으로 일괄 UPDATE
   - Stock 92건: lotNo, incomingDate
   - MillingOutputPackage N건: lotNo
7. auditLog 1건 기록 (요약: "lot 통일 — 윤영식 유기농 92건, 기준일 YYYY-MM-DD")
```

### Step 2. Dry-run 실행 & 검수 [0.3h]

`node scripts/backfill-lot-yoonyoungsik-organic.js` 실행.

**사용자 확인 항목**:
- 92건 매칭 정확한지
- 새 lotNo 형식 OK 인지 (`YYMMDD-productCode-certNo-personalNo`)
- 마감된 배치의 outputs 패키지 변경 건수 합리적인지

### Step 3. 백업 & 실행 [0.3h]

1. **DB 백업** — `/admin/backup` 페이지 사용 또는 `pg_dump` 1회
2. `--commit` 플래그로 실제 실행
3. 결과 로그 저장 → `docs/report-lot번호통일-윤영식유기농-2026-05-20.md`

### Step 4. 검증 [0.4h]

- [ ] 92건 Stock의 lotNo가 모두 동일한지 SQL 확인
- [ ] 연결된 MillingOutputPackage lotNo도 동일한지 확인
- [ ] 도정 진행중 배치 화면에서 lot 표시 정상
- [ ] 마감 배치의 포장 라벨/엑셀 다운로드 lot 정상
- [ ] auditLog 기록 확인

---

## 5. 위험 요소 & 완화

| 위험 | 완화 방법 |
|---|---|
| **외부 출하 라벨/송장과 lot 불일치** | 사용자가 "마감건 포함 모두 수정"으로 결정 — 외부 라벨 재발행 필요 여부는 별도 확인 |
| 매칭 조건 잘못 → 다른 데이터 변경 | Step 0에서 사용자 직접 확인 + dry-run 출력 |
| **`incomingDate` 변경으로 월별 통계 왜곡** | 92건이 모두 한 날짜로 몰리게 됨. 사용자 결정사항이므로 진행. 보고서에 영향 명시 |
| 트랜잭션 중 실패 | Prisma `$transaction`으로 묶음 — 부분 실패 시 자동 롤백 |
| 신규 입고 시 같은 문제 재발 | **정책 코드 미변경**이므로 재발 가능. 다음 입고 때 사용자가 입고일자를 수동으로 첫 입고일에 맞춰야 함 |

---

## 6. 변경 파일 (1개 + 보고서)

### 신규
- `scripts/backfill-lot-yoonyoungsik-organic.js` — 백필 스크립트 (일회성)
- `docs/report-lot번호통일-윤영식유기농-2026-05-20.md` — 결과 보고서

### 수정
- 없음 (코드 변경 없는 데이터 마이그레이션)

### worklog
- `docs/worklog.md` — 2026-05-20 항목에 추가

---

## 7. 작업량 추정

| 단계 | 시간 |
|---|---|
| Step 0. 매칭 조건 확정 | 0.5h |
| Step 1. 스크립트 작성 | 1.0h |
| Step 2. Dry-run 검수 | 0.3h |
| Step 3. 백업 & 실행 | 0.3h |
| Step 4. 검증 | 0.4h |
| **합계** | **약 2.5h** |

---

## 8. 후속 결정 사항 (작업 외)

이번 작업으로 92건은 정정되지만, **앞으로 같은 농가/품종/인증 조합으로 입고될 때마다 같은 문제 재발**한다. 두 가지 옵션:

1. **운영 가이드만 추가** — 입고 등록 시 이전 lot 확인 후 같은 incomingDate로 입력 (사람 책임)
2. **시스템 정책 변경** — `generateLotNo` 호출 전 "같은 (farmer, variety, certNo) 조합 lot 존재 시 첫 입고일 재사용" 로직 추가 (별도 plan)

→ **이번 작업 완료 후 별도 논의**.

---

## 9. 작업 후 산출물

- `scripts/backfill-lot-yoonyoungsik-organic.js`
- `docs/report-lot번호통일-윤영식유기농-2026-05-20.md`
- `docs/worklog.md` 항목 추가
- 단일 커밋: `chore: 윤영식 유기농 92건 lot 번호 통일 마이그레이션 (#YYYY-MM-DD)`
