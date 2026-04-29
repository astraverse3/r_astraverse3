# 잡곡 재고관리 #3 — 포장단위 g 옵션 사전조사

> **작성일**: 2026-04-29 (정책 변경 반영 — 같은 날 갱신)
> **대상 작업**: `plan-잡곡재고관리.md` §작업 단계 #3 (포장단위 g 옵션)
> **결론 요약**: 벼·잡곡 옵션 셋이 달라 **공용화 폐기**. #3은 코드 변경 거의 없는 "정책 확정" 단계로 축소되고, 잡곡 옵션은 #7 잡곡 포장 다이얼로그에서 인라인 정의.

---

## 1. 정책 (2026-04-29 사용자 확정)

### 벼 포장 (현행 유지)
```
톤백  20kg  10kg  8kg  5kg  4kg  3kg  1kg  잔량  기타
```
- 변경 없음. [add-packaging-dialog.tsx:42-52](../app/(dashboard)/milling/add-packaging-dialog.tsx#L42-L52) `PACKAGE_TEMPLATES` 그대로
- g 단위는 벼 포장에서 자주 쓰이지 않음 → "기타" 직접입력으로 대응

### 잡곡 포장 (#7에서 신규 다이얼로그)
```
10kg  5kg  1kg  800g  500g  420g  기타
```
- **톤백 없음** (잡곡은 톤백 단위로 포장하지 않음)
- **잔량 없음** (잡곡은 잔량 처리 케이스 없음 — 필요 시 "기타"로)
- 6 고정 + 기타 = 7칸 → `grid-cols-7` 한 줄, 모바일도 무리 없음

---

## 2. 작업 본질 재정의

당초 #3은 "벼 포장 화면에 g 옵션 추가 + 공용화" 의도였으나, 옵션 셋이 카테고리별로 다르므로 **공용 상수 도입은 부적합**.

→ #3 단계 자체는 사실상 다음 두 가지로 축소:
1. 정책 문서화: `plan-잡곡재고관리.md`의 작업 단계 #3 항목 / "변경 파일 예상" §3.5 / "포장 정보(공통)" §137 의 packageType 예시값을 정책에 맞게 갱신
2. 코드 변경 0건 — 잡곡 PACKAGE_TEMPLATES 인라인 정의는 #7에서 잡곡 포장 다이얼로그를 신설할 때 그 자리에서 추가

---

## 3. 영향 범위

| 파일 | 변경 | 비고 |
| --- | --- | --- |
| [app/(dashboard)/milling/add-packaging-dialog.tsx](../app/(dashboard)/milling/add-packaging-dialog.tsx) | **변경 없음** | 벼 전용 유지 |
| [app/(dashboard)/packages/misc/...](#) (#7에서 신설) | 신규 인라인 `PACKAGE_TEMPLATES_MISC` | #7 단계에서 처리 |
| [docs/plan-잡곡재고관리.md](plan-잡곡재고관리.md) §작업 단계 #3 / §139 / §306 | 정책 반영 문구 갱신 | 본 #3 단계 산출물 |

### 검증 — 통계·표시 라인은 영향 없음
- [components/statistics/MillingTable.tsx:111](../components/statistics/MillingTable.tsx#L111) `톤백/잔량` 분기 — 잡곡은 두 옵션 자체가 없어서 영향 없음
- [components/statistics/OutputChart.tsx:18-22](../components/statistics/OutputChart.tsx#L18-L22) `PKG_LABEL` — 신규 g 키들은 매핑 없이도 fallback `?? d.packageType`으로 정상 표시
- `MillingOutputPackage.packageType`은 `String` 자유 텍스트 → 스키마 변경 0건

---

## 4. 단위 일관성 결정

- `MillingOutputPackage.weightPerUnit Float`은 **kg 기준 저장 관례** 유지
- 잡곡 800g 포장 → `weightPerUnit: 0.8`, `totalWeight: 0.8 × count`
- "기타" 직접입력의 단위 라벨 `kg` 고정 ([L399](../app/(dashboard)/milling/add-packaging-dialog.tsx#L399)) — 잡곡 다이얼로그(#7)에서도 동일 정책 적용. g 단위 입력은 사용자가 0.8 등으로 환산해 입력하거나 고정 버튼(800g/500g/420g)으로 처리

---

## 5. #7 잡곡 포장 다이얼로그 시 적용 사항 (선반영 메모)

#7에서 잡곡 포장 다이얼로그를 신설할 때 본 정책을 그대로 반영:

```ts
// app/(dashboard)/packages/misc/_components/add-misc-packaging-dialog.tsx (예정)
const PACKAGE_TEMPLATES_MISC = [
    { label: '10kg', weight: 10 },
    { label: '5kg', weight: 5 },
    { label: '1kg', weight: 1 },
    { label: '800g', weight: 0.8 },
    { label: '500g', weight: 0.5 },
    { label: '420g', weight: 0.42 },
]
// 톤백/잔량 분기(addToGroup의 weight=0 특수 처리)는 잡곡 다이얼로그에 없음
```

벼 다이얼로그의 `addToGroup` L203 `template.label === '톤백' || template.label === '잔량'` 분기는 잡곡 다이얼로그에 **이식하지 않음**. 잡곡은 모든 템플릿이 정상 weight를 가짐.

---

## 6. 부수 발견 (본 범위 외)

본 사전조사 중 발견된 dead code / 미스매치는 [docs/리팩토링-백로그.md](리팩토링-백로그.md) §1, §2로 이관. 본 #3 PR과 분리 처리.

---

## 7. 다음 액션

1. ✅ 본 사전조사 갱신 완료 (정책 반영)
2. 사용자 확인 — 본 #3 단계가 "정책 문서화 + 계획서 갱신"으로 축소되는 게 맞는지
3. 맞으면 `plan-잡곡재고관리.md` 해당 항목 갱신 후 #3 종결, **#4 (`/stocks` → `/raw-stocks` 라우팅 이동)** 사전조사로 이동
