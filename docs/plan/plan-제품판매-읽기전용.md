# 계획서 — 제품판매 탭 읽기 전용 (백로그 §60)

작성 2026-09-30

## 목표

가공·판매 권한(`OPERATION_MANAGE`)이 **없는** 사람도 제품판매 탭(발주서 목록·시트 매트릭스·주문 상세)을 **볼 수 있게** 하고, 누르면 실패하는 버튼은 **안 보이게** 한다. 원물출고 탭과 같은 방식이다(사용자 결정 9/30 「읽기 전용」).

- 지금 해당하는 계정: 11명 중 **4명**(9/30 읽기 전용 조회). 이 4명은 시트를 누르면 매트릭스 대신 「이 작업을 할 권한이 없어요」 카드만 보이고, 발주서 등록·⋮ 메뉴·상차 셀 수정은 보이는데 누르면 실패한다
- 📌 원칙: **UI 노출 조건과 서버 가드는 한 쌍**([[permission_system_2way]]). 보이는 건 서버도 허용하고, 서버가 막는 건 안 보인다

## 읽기 전용 사용자가 할 수 있는 것 / 없는 것

| 된다 | 안 보인다 |
|---|---|
| 발주서 목록 · 채널 · 진행률 · 매칭실패 배지 · 비고 · 상차 표시 | 발주서 등록(PC 버튼 · 모바일 아이콘) |
| ⋮ 메뉴의 **엑셀 다운로드** | ⋮ 메뉴의 비고 수정 · 시트 삭제 |
| 시트 매트릭스(셀 수량 · 상태 색 · 소계 · 가용 띠 · 정렬) | 상차 셀 편집(연필 · 「+ 배차 미정」 버튼 → 글자만) |
| 이름 클릭 → **주문 상세** 패널(진행률 · 품목 목록 · 다음 건) | 행 체크박스 · 전체선택 · 선택 바 · 일괄차감 게이트 |
| 모바일 목록(상태 칩 · 필터 · 정렬 · 펼침 · 다음 건) | 셀 클릭(차감 팝오버) · 품목 카드 클릭(차감 시트) |
| | 재매칭 버튼(PC 헤더 · 모바일) · 「작업필요 N건 검토」 · 「N품목 일괄차감」(모바일 · 상세 패널 하단) |

**셀 클릭은 막는다.** 차감 팝오버는 「이미 차감한 로트」 정보도 보여주지만 편집 화면이라, 읽기 모드를 따로 만드는 대신 이번엔 진입 자체를 없앤다. 주문 상세 패널의 품목 카드로 진행 상태는 볼 수 있다. 필요하면 나중에 별건으로.

## 변경 파일

**서버 (1)**
| 파일 | 내용 |
|---|---|
| `app/actions/purchase-order-matrix.ts` | `getUploadMatrix` 가드 `requirePermission('OPERATION_MANAGE')` → `requireSession()` (순수 조회. 위 주석 :74-79 「작업 화면이라 가드」도 고침). 나머지 조회 액션(`getCellAllocation` 등)은 **그대로 둔다** — 진입 버튼이 숨으니 쌍이 맞는다 |

**권한 계산 — 서버 컴포넌트에서 한 번, 아래로 prop** (`getServerSession` + `hasPermission`, `admin/notices/page.tsx:10-14`와 같은 방식. 첫 렌더부터 정확하다)

**목록 (5)**
| 파일 | 내용 |
|---|---|
| `sales/page.tsx` | `canManage` 계산 · 권한 없으면 모바일 등록 아이콘(`rightSlot`) 안 넘김(탭이 전체 폭으로 알아서 펴진다) · `ProductSalesSection`에 전달 |
| `sales/product-sales-section.tsx` | PC 「발주서 등록」 버튼 숨김 · `UploadTable`에 전달 |
| `sales/upload-table.tsx` | `LoadingCell`(PC·모바일 2곳) · `UploadRowMenu`에 전달 |
| `sales/loading-cell.tsx` | 권한 없으면 팝오버 없이 `LoadingLabel`만(연필 없음 · 미정은 점선 버튼 대신 회색 글자) |
| `sales/upload-row-menu.tsx` | 권한 없으면 엑셀 다운로드만 |

**매트릭스 (6)**
| 파일 | 내용 |
|---|---|
| `sales/purchase/[uploadId]/page.tsx` | `canManage` 계산 → `MatrixClient`에 전달 |
| `matrix-client.tsx` | 체크박스 칸은 **폭 그대로 두고 비운다**(sticky `left` 상수와 한 쌍 — [[sticky_column_width_pair]]) · 셀 `onClick`·`cursor-pointer`·호버 링 끔 · 헤더/모바일/상세 패널에 재매칭·게이트·품목 열기 콜백을 안 넘김 |
| `matrix-head.tsx` | 전체선택 체크박스 → 빈 칸 |
| `matrix-header.tsx` | 재매칭 버튼 숨김(`onRematch` 없으면 안 그림). 「매칭실패 N품목」 배지는 유지 |
| `matrix-bits.tsx` | 범례 「셀 클릭 = 차감」 → 권한 없으면 빼고 「이름 클릭 = 주문 상세」만 |
| `order-list-mobile.tsx` | 재매칭 · 「작업필요 N건 검토」 · 인라인 「N품목 일괄차감」 숨김, `LineCard`에 `onOpen` 안 넘김(카드가 일반 칸으로 그려진다 — `order-line-card.tsx:23-26` 기존 동작) |
| `order-detail-panel.tsx` | `LineCard` `onOpen` 안 넘김 · 하단 일괄차감 버튼 숨김(요약 줄은 유지) |

**문서 (1)**
| 파일 | 내용 |
|---|---|
| `docs/permission-matrix.md` | 9/21 이후 낡은 부분 정리 — 빠진 가드(`repack`·`purchase-order-upload/matrix/assign/batch`·`shipping-vendor`·`audit`) 추가, 지운 액션(`getPurchaseOrderDetail`·`listPurchaseOrders`·`autoMatchOrderItem`·`confirmOrder`·`createSale`) 삭제, 이번 `getUploadMatrix` 변경 반영. 코드와 grep 대조 |

코드 12파일 + 문서. 🔴 **표시층만** — 차감·게이트·팝오버 로직은 안 건드린다. 콜백을 `undefined`로 넘겨 진입점만 끊는다.

## 하지 않는 것

- 차감 팝오버 읽기 모드 · 모바일/PC 진입 불일치 정리
- 다른 탭(도정·제품재고 등)의 같은 문제 — 발견하면 백로그에 번호
- §83(가입 승인제)은 별건

## 확인 방법

- `npm test` · `npx tsc --noEmit` · `npx eslint .` 0/0
- 브라우저(사용자) — 권한 있는 계정: **지금과 똑같이** 보이고 동작하는지(회귀가 더 위험). 권한 없는 계정(4명 중 한 명 폰으로): 목록·매트릭스·상세가 열리고 누를 버튼이 안 보이는지. ADMIN은 늘 권한이 있어서 내 계정으로는 이쪽을 볼 수 없다
