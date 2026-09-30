# 결과보고서 — 제품유형 규격순 정렬 · 첫 SKU 자동 기본 (백로그 §88 · §89)

작성 2026-09-30 · 계획서 `docs/plan/plan-SKU-규격정렬-첫기본.md`

## 변경 사항 요약

| 파일 | 내용 |
|---|---|
| `lib/package-spec.ts` | `compareSpec(a, b)` 신규 — **톤백 → 무게 내림차순 → 무게 못 읽는 규격(가나다) → 잔량**. 무게는 기존 `specWeightKg` 한 벌 |
| `lib/package-spec.test.ts` | `compareSpec` 테스트 2개(문자열 정렬이면 틀리는 입력 · 표기만 다른 같은 무게 `1kg`=`1 kg`) |
| `app/(dashboard)/admin/product-types/product-type-page-client.tsx` | `visibleTypes`를 한 번 정렬(품종 → 도정 → 규격 → 기본 먼저 → 포장지). 벼 탭 그룹은 이 순서를 물려받고, 잡곡 표는 품종명만 보던 정렬을 지우고 그대로 씀 |
| `app/(dashboard)/milling/spec-summary.tsx` | 합계 밴드 정렬: `PACKAGE_TEMPLATES` 인덱스(없으면 99) → `compareSpec`. 907g 같은 SKU 규격이 **잔량 뒤**에 붙던 것(§21 ⑥) 해소 |
| `app/(dashboard)/milling/packaging-constants.ts` | 주석만 — 「합계 밴드 정렬 기준」이 더는 사실이 아니라 고침 |
| `app/actions/product-type.ts` | `upsertProductType` **신규 생성**: 체크 안 해도 그 조합에 **활성 기본이 없고** 새 SKU가 활성이면 기본으로. 기존 「옛 기본 해제」 코드를 그대로 탄다 |

## 주요 결정

- **정렬 방향 = 규격 버튼과 같은 내림차순**(톤백 먼저, 잔량 끝). 화면마다 방향이 다르면 또 헷갈린다
- **서버 `orderBy`는 그대로**, 정렬은 화면에서. DB는 `907g`의 무게를 모른다
- **§89는 신규만.** 수정은 사용자가 일부러 끈 기본일 수 있어 건드리지 않는다
- 「활성」 기본 기준 — 포장 다이얼로그 추천(`suggestProductType`, `product-type.ts:360`)이 `isDefault && active`로 찾기 때문. 비활성 기본만 남은 조합에 새 SKU를 넣으면 새 SKU가 기본이 되고 비활성 기본은 해제된다(조합당 기본 1개 유지)
- 도정 포장 경로(`findOrCreateProductType`)는 활성 여부를 안 본다 — 두 경로가 이 점에서 약간 다르다. 비활성 기본만 남은 조합은 드물어 이번엔 손대지 않았다

## 검증

- `npm test` 525/525 통과 · `npx tsc --noEmit` 0 · `npx eslint .` 0/0
- `compareSpec` 테스트는 새 함수라 옛 코드로는 돌릴 수 없다 — 대신 입력을 **문자열 정렬이면 순서가 달라지는 값**으로 골랐다

## 확인이 필요한 사항 (브라우저)

- 제품유형 관리 → 벼 탭 한 품종 펼치기: 규격이 톤백 → 20kg → 10kg → … → 1kg → 잔량 순인지, 같은 규격이면 기본(별)이 위인지
- 잡곡 탭 표도 같은 순서인지
- 기본이 없는 조합에 SKU를 **체크 없이** 추가 → 별이 켜지는지. 이미 기본이 있는 조합에 추가하면 안 켜지는지
- 포장 다이얼로그 합계 밴드: 여러 생산자 배치에서 규격 순서(907g 같은 SKU 규격이 있으면 1kg 뒤·잔량 앞)
