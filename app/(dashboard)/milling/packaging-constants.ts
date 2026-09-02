// 포장 다이얼로그가 쓰는 규격 어휘.
//
// 다이얼로그(add-packaging-dialog)와 규격별 합계 밴드(spec-summary)가 함께 쓴다.
// 어느 한쪽에 두면 다른 쪽이 그것을 import하고 그쪽이 다시 이쪽을 import해 순환이 된다.
//
// ⚠️ `add-form.tsx`에도 같은 이름의 배열이 있지만 **내용이 다르다**
// (톤백·3kg·잔량이 없다 — 도정 시작 화면이라 규격 어휘가 좁다). 통합하지 말 것.
//
// 서버(app/actions/milling.ts)의 PACKAGE_TYPE_* 는 별개다. 'use server' 파일은
// 상수를 export할 수 없어 각자 두고 있다(값은 같아야 한다).

// SKU 특례: 잔량=포장지 없음(SKU 미부여), 톤백=포장지 '톤백' 고정.
export const PKG_REMAINDER = '잔량'
export const PKG_TONBAG = '톤백'

/** 규격 버튼 목록이자 **정렬 기준**이다 (합계 밴드가 이 순서로 줄을 세운다). */
export const PACKAGE_TEMPLATES = [
    { label: '톤백', weight: 0 },
    { label: '20kg', weight: 20 },
    { label: '10kg', weight: 10 },
    { label: '8kg', weight: 8 },
    { label: '5kg', weight: 5 },
    { label: '4kg', weight: 4 },
    { label: '3kg', weight: 3 },
    { label: '1kg', weight: 1 },
    { label: '잔량', weight: 0 },
]
