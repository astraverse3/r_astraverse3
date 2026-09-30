# 계획서 — 포장 다이얼로그 서버 왕복 줄이기 (백로그 §57 ①②)

작성 2026-09-30

## 목표

도정 포장 다이얼로그(`add-packaging-dialog.tsx`)를 열 때 서버 액션이 **4개가 한 줄로** 선다
(Next는 한 탭의 서버 액션을 하나씩 처리한다). 개발 서버에서는 한 번 여는 데 4~5초, 새로고침 직후엔 10초 넘게 걸린다.

| 지금 | 하는 일 | 바꾼 뒤 |
|---|---|---|
| `getYieldRate(millingType)` | 예상 생산량에 쓸 수율 | **왕복 없음** — layout이 이미 내려주는 `useYieldRates()` |
| `getBatchOutputs(batchId)` | 최신 포장 내역(P3 재조회) | 새 액션 **하나로** 묶고 안에서 `Promise.all` |
| `listPackagings()` | 포장지 드롭다운 | ↑ |
| `listSkuSpecs(...)` (`useSkuSpecButtons`) | 만들 규격 버튼 | ↑ |

4번 줄 서던 게 1번으로 줄어든다. 개발 서버 기준 1초대 예상.

덤으로 **인디카 예상치 결함(①)이 같이 풀린다.** 지금은 도정구분 하나로만 수율을 읽어서
인디카(CJ6, 실적 1위) 배치도 61% 대신 68%로 계산해 예상치가 부풀려진다.
`useYieldRates()` 맵에는 품종축 키가 들어 있고, 판정 함수 `getYieldTarget(millingType, rates, varietyType)`이 이미 있다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `app/actions/milling.ts` | 새 액션 `getPackagingDialogData(batchId, varietyIds, millingType)` 추가 |
| `app/(dashboard)/milling/add-packaging-dialog.tsx` | effect 3개 + 수율 effect → effect 하나. 수율은 컨텍스트에서. 규격 버튼은 받아 온 값으로 |

`use-sku-spec-buttons.ts`와 재포장 다이얼로그는 **건드리지 않는다**(재포장은 그대로 훅을 쓴다).

## 단계

### 1. 묶음 액션 (`milling.ts`)

```ts
export async function getPackagingDialogData(batchId, varietyIds, millingType) {
    const [outputs, packagings, specs] = await Promise.all([
        getBatchOutputs(batchId),
        listPackagings(),
        listSkuSpecs(varietyIds, millingType),
    ])
    return { outputs, packagings, specs }
}
```

- **기존 액션 3개를 그대로 부른다.** 서버 안에서는 그냥 함수 호출이라 왕복이 없다.
  - `getBatchOutputs`의 select는 「`getMillingLogs`와 정확히 같아야 한다」는 경고가 붙어 있다. 쿼리를 복사하지 않고 그대로 불러서 이 약속을 지킨다
  - 각자 `{ success, ... }`를 돌려주니 **부분 실패가 지금처럼 따로 처리된다.** 포장 내역을 못 받으면 쓰기를 막고, 포장지를 못 받으면 「불러오지 못함」, 규격을 못 받으면 고정 목록만 보여준다
- 세션 확인은 안쪽 3개가 각자 한다(병렬). 바깥에 가드를 하나 더 두면 세션 확인이 한 번 더 **직렬로** 붙어서 두지 않는다. 안쪽이 전부 `try` 안에서 막으니 새 경로는 생기지 않는다. 주석으로 적어 둔다

### 2. 다이얼로그

- **수율**: `useState`와 `getYieldRate` effect를 지운다 → `const yieldRates = useYieldRates()`
  - `LotGroup`에 `varietyType`을 추가한다(`computeLotGroups`가 이미 `stock.variety?.type`을 읽는다)
  - 예상치: `group.totalInputKg * getYieldTarget(millingType, yieldRates, group.varietyType) / 100`
  - 그룹마다 품종이 다를 수 있어서 **그룹별**로 계산한다(목록 배지는 배치 대표 품종 하나로 판정하지만, 여기는 그룹 단위라 더 정확하게 할 수 있다)
- **열 때 재조회**: `[open, batchId]` effect 하나에서 `getPackagingDialogData`를 부르고, 결과 셋을 지금 쓰는 state에 나눠 담는다
  - 포장 내역 처리(P3: 실패하면 쓰기 막기·토스트)는 **지금 코드 그대로** 옮긴다
  - 포장지 처리(`packagingsState`)도 그대로
  - 규격: `specsByVariety` state → `specsOf = (id) => mergeSpecButtons(PACKAGE_TEMPLATES, specsByVariety[id] ?? [])`
  - 호출 전체가 실패하면(`settle` 실패) 셋 다 실패로 처리한다
- `getYieldRate`·`listPackagings`·`getBatchOutputs`·`useSkuSpecButtons` import는 안 쓰게 되면 지운다

### 3. 검증

- `npx tsc --noEmit` · `npx eslint .`(0/0 유지) · `npm test`
- 화면은 네가 개발 서버에서 확인 ↓
  1. 포장 다이얼로그를 여는 데 걸리는 시간 (전: 4~5초)
  2. 포장지 드롭다운이 정상적으로 나오는지, 「…」에서 멈추지 않는지
  3. 규격 버튼에 SKU 규격(IPS 백미 907g 등)이 뜨는지
  4. 인디카 배치 예상치가 61% 기준으로 나오는지 (메벼는 그대로 68%)
  5. 저장 후 다시 열었을 때 최신 내역이 뜨는지 (P3)

## 범위 밖 / 주의

- **§57 ③ 포장지 목록을 페이지당 한 번만 받아 공유하기**는 안 한다. 묶음 액션에 들어가서 추가 왕복이 없으니 이득이 작다
- 새 줄을 추가할 때 부르는 `suggestProductType`은 그대로 둔다(열 때가 아니라 줄 추가 때 부른다)
- `settings.ts`의 `getYieldRate`는 호출처가 0이 된다. 읽기 전용이라 해가 없어서 지우지 않고 백로그 §56(죽은 코드)에 적는다
- 규격 버튼은 지금은 품종 구성이 바뀌면 다시 받는데, 바꾼 뒤엔 **열 때만** 받는다. 한 배치의 투입 재고는 다이얼로그가 열려 있는 동안 바뀌지 않아서 차이가 없다. 이것 때문에 포장 내역까지 다시 받으면 입력 중인 값을 덮어쓴다(P3 주석 경고)
- 다이얼로그 파일은 지금 872줄이다(§76). 이번 변경으로 조금 줄어들지만 분할은 따로 한다
