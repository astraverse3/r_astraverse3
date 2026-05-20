# LOT 번호 통일 마이그레이션 — 윤영식 유기농 IPS — 결과 보고서

> **일자**: 2026-05-20
> **기준 계획**: [docs/plan-lot번호통일-윤영식유기농.md](./plan-lot번호통일-윤영식유기농.md)
> **유형**: 일회성 데이터 정정 (코드 변경 없음)

---

## 1. 작업 요약

검색조건 **IPS + 윤영식 + 유기농** 으로 매칭되는 원물 재고 92건의 `lotNo` / `incomingDate`를 가장 빠른 입고일(`2025-10-20`) 기준으로 통일했다. 연결된 도정 패키지 lot도 함께 갱신.

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| Stock incomingDate 분포 | 2025-10-20(12) / 10-21(26) / 10-22(44) / 11-04(9) / 2026-01-20(1) | **2025-10-20 (92건 통일)** |
| Stock lotNo 분기 수 | **5개** | **1개** (`251020-18-15102443-11`) |
| 변경된 Stock | — | **80건** (12건은 이미 일치) |
| 변경된 MillingOutputPackage | — | **2건** (4건은 이미 일치) |
| auditLog | — | 1건 기록 |

---

## 2. 매칭 조건

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

- 농가: 윤영식 (farmerNo=1, group.code=1)
- 품종: IPS (type=INDICA, 백미 productCode=18)
- 인증: 유기농 (certNo=15102443)

---

## 3. 변경 명세

### 3.1 Stock 80건 (incomingDate + lotNo)

| 변경 전 lotNo | 건수 | 변경 후 lotNo |
|---|---|---|
| `251021-18-15102443-11` | 26 | `251020-18-15102443-11` |
| `251022-18-15102443-11` | 44 | `251020-18-15102443-11` |
| `251104-18-15102443-11` | 9 | `251020-18-15102443-11` |
| `260120-18-15102443-11` | 1 | `251020-18-15102443-11` |
| **합계** | **80건** | — |

### 3.2 MillingOutputPackage 2건

| pkgId | stockId | batchId | productCode | 변경 전 → 변경 후 |
|---|---|---|---|---|
| 371 | 1855 | 108 | 18 | `251021-18-15102443-11` → `251020-18-15102443-11` |
| 372 | 1848 | 110 | 18 | `251021-18-15102443-11` → `251020-18-15102443-11` |

batch 108·110은 마감 상태(`isClosed=true`). 사용자 요구사항대로 마감건 포함 갱신.

### 3.3 변경 알고리즘

기존 lot의 4-segment 구조(`YYMMDD-productCode-certNo-personalNo`)에서 **첫 segment(YYMMDD)만 교체**. 나머지 보존. → 백미(18)/현미(19) 같은 productCode 차이는 그대로 유지됨.

---

## 4. 검증 결과

`scripts/inspect-lot-yoonyoungsik-ips.js` 재실행 결과:

```
매칭 Stock: 92건
[현재 incomingDate / lotNo 분포]
  2025-10-20 | 251020-18-15102443-11 → 92건
```

- ✅ 92건 모두 단일 lot으로 통합
- ✅ incomingDate도 모두 `2025-10-20`
- ✅ 도정 미연결 78 / 진행중 5 / 마감됨 9 — 배치 연결 구조 변화 없음
- ✅ auditLog 1건 기록 (`UPDATE` / `Stock` / script 메타데이터 포함)

---

## 5. 주요 결정 사항

| 항목 | 결정 | 사용자 확정 |
|---|---|---|
| 기준일 | 가장 빠른 incomingDate (자동) | ✅ |
| Stock.incomingDate 필드도 통일 | YES | ✅ |
| 마감 배치의 outputs lotNo 수정 | YES | ✅ |
| 정책 코드 변경 | NO (일회성만) | ✅ |
| DB 백업 | /admin/backup 메뉴 사용 | ✅ |

---

## 6. 짚어둘 사항 & 후속

### 6.1 ⚠️ incomingDate 통일의 부수효과
92건이 모두 `2025-10-20`로 모임. 월별/일별 입고 통계에서 다음과 같이 보임:
- 2025-10-20 입고량 +80건치 (12→92건)
- 2025-10-21 입고량 -26건
- 2025-10-22 입고량 -44건
- 2025-11-04 입고량 -9건
- 2026-01-20 입고량 -1건

→ 의도된 변경이지만, 외부 보고서/분석에서 입고일 기준 집계 시 영향 있음. 필요시 별도 안내.

### 6.2 ⚠️ 외부 출하 라벨/송장
마감된 배치(108·110)의 패키지 2건은 이미 외부 출하/판매됐을 가능성. 시스템 lot은 `251020-...`로 변경됐지만 실물 라벨이 `251021-...`로 나갔다면 불일치. **사용자 측에서 외부 라벨 재발행 여부 별도 판단.**

### 6.3 ⚠️ 정책 코드 미변경 — 재발 가능
이번 작업은 일회성 데이터 정정. `createStock`/`createMiscStock`은 여전히 `incomingDate`별로 lot을 새로 생성한다. **다음에 윤영식·IPS·유기농 조합으로 입고 등록 시 입고일자만 다르면 또 다른 lot 생성됨.**

→ 운영 가이드: 입고 등록 시 기존 lot 확인 후 같은 incomingDate로 수동 입력 필요.
→ 후속 plan 검토 가능: `generateLotNo` 호출 전 "같은 (farmer, variety, certNo) 조합 lot 존재 시 첫 입고일 재사용" 로직 추가 (별도 논의)

---

## 7. 변경 파일 & 산출물

### 신규
- `scripts/inspect-lot-yoonyoungsik-ips.js` — 사전 조사 (read-only)
- `scripts/backfill-lot-yoonyoungsik-ips.js` — 백필 스크립트 (dry-run / --commit)
- `docs/plan-lot번호통일-윤영식유기농.md` — 계획서
- `docs/report-lot번호통일-윤영식유기농-2026-05-20.md` — 본 보고서

### 수정
- `docs/worklog.md` — 2026-05-20 항목 추가

### DB 변경 (직접)
- `Stock` 80건 update (lotNo, incomingDate)
- `MillingOutputPackage` 2건 update (lotNo)
- `AuditLog` 1건 insert (script 메타)

---

## 8. 작업량 (실제 vs 추정)

| 단계 | 추정 | 실제 |
|---|---|---|
| Step 0. 매칭 조건 확정 + 사전 조사 | 0.5h | ~0.3h |
| Step 1. 백필 스크립트 작성 | 1.0h | ~0.4h |
| Step 2. Dry-run 검수 | 0.3h | ~0.1h |
| Step 3. 백업 + 실행 | 0.3h | ~0.2h |
| Step 4. 검증 + 보고서 | 0.4h | ~0.3h |
| **합계** | **2.5h** | **~1.3h** |

기존 `backfill-multi-farmer-packages.js` 패턴을 참고해 빠르게 작성 가능했음.
