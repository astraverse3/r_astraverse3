# 계획서 — 발주서 화면 용어 정리

- 작성: 2026-09-21 · 상태: **결정 완료 · 구현 미착수** (내일 이어서)
- 발단: 실기기 확인 중 사용자 지적 — 「묶음 삭제」는 **「시트 삭제」**라야 인식이 빠르다

## 1. 확정된 결정

| 바꿀 말 | 바꿀 결과 | 범위 |
|---|---|---|
| **묶음 → 시트** | 발주서 화면 **전부**(설정 화면 2곳 포함) | 16곳 |
| **FIFO → 오래된 것부터** | 내부어를 화면에서 뺀다 | 2곳 |
| **라인 → 품목** | 엑셀 행을 가리키는 내부어 | 화면 문자열 약 30곳 |
| ~~매트릭스~~ | **그대로 둔다** — 사용자 판단 | — |

## 2. 교체 대상 (주석·타입 주석 제외, 화면에 뜨는 문자열만)

### 묶음 → 시트 (16곳)
```
admin/settings/page.tsx:21                    "발주서 묶음의 배송업체 목록입니다"
admin/settings/shipping-vendor-section.tsx:204 "과거 발주서 묶음에는 그대로 남습니다"
sales/sheet-row.tsx:165                       "이 묶음에 그대로 저장됩니다"
sales/upload-dialog.tsx:168,210,211,281       토스트 · 안내문 · 요약
sales/upload-row-menu.tsx:52,53,64,74,96      ⋮ 메뉴 · 확인 · 토스트 · sr-only  ← 발단
sales/upload-table.tsx:185,192                빈 상태 · 하단 안내
actions/purchase-order-matrix.ts:128          "묶음을 찾을 수 없습니다."
actions/purchase-order-upload.ts:400          "묶음 목록에서 기존 묶음을 삭제해 주세요."
```

### FIFO (2곳)
```
cell-allocation-popover.tsx:216   "FIFO 추천 · 오래된 로트부터"  → "오래된 로트부터 추천"
order-detail-panel.tsx:249        "n라인 FIFO 일괄차감"          → ⚠️ §3 참조
```

### 라인 → 품목 (화면 문자열)
`matrix-client.tsx` 5 · `order-detail-panel.tsx` 6 · `order-list-mobile.tsx` 1 ·
`review-gate-dialog.tsx` 8 · `unmatched-popover.tsx` 1 · `sheet-row.tsx` 1 ·
`upload-dialog.tsx` 3 · `upload-row-menu.tsx` 2 · 액션 에러 메시지 11

## 3. 🔴 구현 전 정할 것 — 푸터 버튼 글자 수

`order-detail-panel.tsx:249`는 **모바일 푸터 버튼**이고 옆에 「다음 건」이 붙는다.
점검 항목 **B-3(360px에서 버튼 2개가 한 줄에 들어가는지)**이 아직 미확인인 채로
글자가 늘어나면 바로 깨진다.

```
현재    31라인 FIFO 일괄차감        14자
A안     31품목 일괄차감              8자   ← 짧지만 차감 순서 단서가 사라진다
B안     31품목 오래된 것부터 차감    16자  ← 늘어난다. 360px 확인 필수
```

→ **A안 + 순서 단서는 다른 자리**(버튼 위 요약 줄이나 게이트 안)를 제안한다.
셀 팝오버에는 이미 「오래된 로트부터」가 있다.

## 4. 🔴 범위에서 뺀 것

- **감사로그 `description`** 3곳(`purchase-order-assign.ts:240` · `purchase-order-batch.ts:330` ·
  `purchase-order-upload.ts:431`) — 과거 기록이 「라인」으로 쌓여 있어 **형식을 바꾸면
  검색이 갈린다.** 화면 문자열과 성격이 다르다
- **주석·타입 주석** — 개발자가 읽는 자리다. 도메인 결정 #30(「묶음 = 시트 1장」)의
  근거 주석은 그대로 둔다
- **다른 화면의 「묶음」** — `deduct-dialog.tsx:240`(제품재고, 다른 의미) ·
  `misc-stock-*`(그룹 묶음 톤) · `nav-trace`(내부)
- **변수·타입·DB 필드명** — `bundleDuplicateKey`, `UploadSummaryRow` 등은 안 건드린다.
  수술적 변경: 화면 문자열만

## 5. 검증

- `tsc` · `eslint` · `test`
- 🔴 **360px에서 푸터 버튼 2개**(점검 B-3과 같이 본다)
- ⋮ 메뉴 · 업로드 모달 2단계 · 빈 상태 · 에러 토스트를 실제로 띄워 볼 것
