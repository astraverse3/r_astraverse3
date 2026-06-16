# 구현 계획서: 찰벼 도정유형 정리 (millingType 정규화 — 입력은 백미/현미, 표시만 찹쌀/찰현미)

> **작성**: 2026-06-16 · **상태**: 승인 대기
> **계기**: 제품유형(ProductType) 마스터 단계 4 백필 중 발견. 백옥찰(찰벼)이 `millingType`='백미'(14건)·'찹쌀'(12건)·'현미'(2건)로 갈려 저장 → 같은 제품이 다른 SKU로 쪼개짐. 백필 **선행 정리** 필요.
> **방향 A 확정**(2026-06-16 사용자): millingType=순수 도정 정도(백미/현미/…)로 통일, 곡종(찰/메)은 `Variety.type`에서 파생해 **표시만** 찹쌀/찰현미로.

---

## 1. 문제

`millingType`이 **두 의미를 혼재**:
- 도정 *정도*: 백미 / 현미 / 오분도미 / 칠분도미
- 곡종 *표현*: 찹쌀(= 찰벼의 백미)

도정 입력 버튼(`['백미','현미','오분도미','칠분도미','찹쌀','기타']`)에 '찹쌀'이 섞여 있어, 백옥찰 백미 도정을 작업자가 '백미' 또는 '찹쌀'로 제각각 저장. '찰현미'는 옵션조차 없음. → millingType이 매칭 4키 중 하나라 **ProductType SKU가 분리**되고 발주서 매칭도 모호.

찰벼 품종은 2개(다온누리찰 id9·백옥찰 id12), 재고 있는 건 **백옥찰뿐**. 정규화 대상은 **백옥찰/찹쌀 12건**(다온누리찰은 재고 없음).

## 2. 현황 (조사 완료)

- **표시 변환은 이미 구현**: `milling-table-row.tsx`·`mobile-milling-card.tsx`·`recent-logs-list.tsx`에 `GLUTINOUS+백미→'찹쌀'`, `+현미→'찰현미'` 인라인 로직 존재(동일 코드 3중복). 색상맵에도 '찹쌀'/'찰현미' 준비됨.
- **입력 3곳**에 '찹쌀' 버튼 하드코딩: `start-milling-dialog.tsx`(131)·`stock-list-dialog.tsx`(221)·`add-form.tsx`(131). 세 곳 모두 투입 stock의 `variety.type` 접근 가능 → 라벨 동적화 가능.
- **필터**: `milling-filters.tsx` `MILLING_TYPE_OPTIONS`에 '찹쌀' 포함(저장값 기준 필터). 정규화 후 '찹쌀' 값이 사라지므로 옵션에서 제거.
- **통계** `components/statistics/MillingTable.tsx`(170): `row.millingType` 직접 렌더, **품종 정보 없음**(TableRow 타입에 varietyType 부재) → 본 작업 **범위 제외**(저장값 기준 집계라 '백미'로 표시, 별도 후속).
- `MILLING_TYPES`(lib/settings-constants.ts:10)에서 '찹쌀' 사용처: `admin/settings`·`product-type-dialog`.
- MillingBatch는 다품종 투입 가능하나 표시 로직은 `stocks[0]` 기준(기존 관행 유지).

## 3. 방향 A 설계

1. **저장값** = 도정 정도만(백미/현미/오분도미/칠분도미/기타). '찹쌀' 폐기.
2. **표시값** = 파생. 공용 헬퍼 `lib/milling-type-display.ts`:
   ```ts
   export function getDisplayMillingType(millingType: string, varietyType?: string | null): string {
     if (varietyType === 'GLUTINOUS') {
       if (millingType === '백미') return '찹쌀'
       if (millingType === '현미') return '찰현미'
     }
     return millingType
   }
   ```
3. **입력 라벨 동적화**: 투입 품종이 모두 찰벼면 '백미'→'찹쌀'·'현미'→'찰현미' 라벨로 표시(저장값은 백미/현미). '찹쌀' 버튼 제거.

## 4. 변경 범위 (파일 단위)

### 신규
| 파일 | 내용 |
|---|---|
| `lib/milling-type-display.ts` | `getDisplayMillingType(millingType, varietyType)` 공용 헬퍼 |
| `scripts/normalize-glutinous-milling-type.ts` | `millingType='찹쌀'` MillingBatch → '백미' 정규화(멱등, 사전 점검 출력 + 감사로그) |

### 변경
| 파일 | 변경 |
|---|---|
| `app/(dashboard)/raw-stocks/start-milling-dialog.tsx` | 도정 버튼에서 '찹쌀' 제거 + 찰벼 투입 시 백미/현미 라벨 동적화 |
| `app/(dashboard)/milling/stock-list-dialog.tsx` | 동일(편집 모드 버튼) |
| `app/(dashboard)/milling/add-form.tsx` | 동일 |
| `app/(dashboard)/milling/milling-table-row.tsx` | 인라인 변환 → 헬퍼 호출로 교체 |
| `app/(dashboard)/milling/mobile-milling-card.tsx` | 동일 |
| `app/(dashboard)/_components/recent-logs-list.tsx` | 동일 |
| `app/(dashboard)/milling/milling-filters.tsx` | `MILLING_TYPE_OPTIONS`에서 '찹쌀' 제거 |
| `lib/settings-constants.ts` | `MILLING_TYPES`에서 '찹쌀' 제거(저장값 아님). `DEFAULT_YIELD_RATES['찹쌀']`은 무해하므로 유지 |

> **3파일 이상 = HARD-GATE.** 본 계획서 승인 후 착수.

## 5. 단계

1. **데이터 정규화 먼저**: `normalize-glutinous-milling-type.ts` 실행 → '찹쌀' batch를 '백미'로. 실행 전 대상 건수 출력, 실행 후 잔존 0 확인.
2. **헬퍼 + 표시 교체**: `lib/milling-type-display.ts` 신규 → 표시 3곳 인라인 제거하고 헬퍼로.
3. **입력 UI 정리**: 입력 3곳 '찹쌀' 버튼 제거 + 찰벼 라벨 동적화.
4. **필터/상수 정리**: `MILLING_TYPE_OPTIONS`·`MILLING_TYPES`에서 '찹쌀' 제거.
5. **검증**: `tsc`·신규/변경 파일 eslint. 정규화 후 `millingType='찹쌀'` DB 잔존 0 확인.

## 6. ProductType 백필과의 관계
- 단계 1(정규화)이 **백필 선행 필수** — 안 하면 백옥찰/백미·백옥찰/찹쌀이 다른 SKU로 굳음.
- 정규화 완료 후 → 보류했던 ProductType 단계 4(시드→점검→백필) 재개. 백옥찰 조합이 백미/현미로 통합돼 시드/백필이 깔끔.

## 7. 검증 (증거 기반)
- 정규화: 실행 전후 건수 리포트, 잔존 0
- 빌드: tsc + eslint(신규/변경분) 통과
- 도정내역 화면에서 백옥찰 백미=찹쌀·현미=찰현미 표시 유지(회귀 없음)

## 8. 원칙
- 수술적 변경(통계 MillingTable 등 범위 밖은 손대지 않음), 멱등 스크립트, 감사로그, 단계별 커밋 + worklog
