# 잡곡 제품재고 목록 — 도정구분 열 빼기

작성 2026-10-01

## 발단

사용자: 「잡곡 제품재고 목록에 도정구분 필요없는 것 같은데.」

## 지금

- 벼·잡곡 탭이 같은 목록 컴포넌트(`PackageListClient` → `package-row.tsx`)와 같은 그리드(`PKG_GRID`)를 쓴다.
- 잡곡 포장은 도정 배치 없이 만들어진다(`app/actions/packages.ts:424·879` `batchId: null`). 그래서 잡곡 줄의 도정구분은 **항상 「—」**다(`getPackages`의 `millingTypeLabel`). 열을 빼도 잃는 정보가 없다.
- 모바일 카드는 「—」면 이미 비워 둔다. 엑셀에는 원래 도정구분 열이 없다. → **PC 목록만** 고치면 된다.

## 변경

| 파일 | 내용 |
|---|---|
| `app/(dashboard)/packages/package-row.tsx` | 그리드를 `pkgGrid(select, showMilling)` 함수 하나로 만든다(지금 상수 2개 → 4가지 조합). 헤더·낱개·서브행·그룹 행에서 `showMilling`이 false면 도정구분 칸을 그리지 않는다 |
| `app/(dashboard)/packages/package-list-client.tsx` | `showMillingType?: boolean`(기본 true) prop을 받아 아래로 넘긴다 |
| `app/(dashboard)/packages/misc-package-panel.tsx` | `showMillingType={false}` |

- 벼 탭은 그대로다(기본값 true).
- 재포장 동질성 판정(`identityKey`)은 화면 표시가 아니라 `millingType` 값을 쓰므로 영향이 없다.

## 검증

`npm test` · `tsc` · `eslint .` → 🖐 사용자 브라우저 확인: 잡곡 탭에 도정구분 열이 없고 칸이 어긋나지 않는지(선택 모드 포함), 벼 탭은 그대로인지
