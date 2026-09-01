// 차감 사유의 목록·라벨 — 'use server' 아님(클라이언트에서도 쓴다)
//
// 서버 액션(`app/actions/package-movement.ts`)과 화면(차감 다이얼로그의 사유 칩,
// 차감된 행의 「03-14 판매」, 이력 다이얼로그의 사유 배지)이 **함께** 쓴다.
// 액션 파일은 'use server'라 async 함수만 export할 수 있어 상수를 여기 뺐다 —
// 지점마다 손으로 쓰면 반드시 어긋난다(`lib/package-guard.ts`와 같은 이유).

/** 사람이 직접 만드는 차감 사유. REPACK은 재포장 흐름 전용이라 여기 없다. */
export const MANUAL_MOVEMENT_TYPES = ['SALE', 'GIFT', 'LOST', 'DAMAGED', 'OTHER'] as const
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number]

/**
 * 표시 문구의 단일 원천 — 감사로그·에러 문구·화면 배지가 함께 쓴다.
 * REPACK은 수동 사유가 아니지만 이력·차감된 행에 **표시는** 된다.
 */
export const MOVEMENT_TYPE_LABEL: Record<ManualMovementType | 'REPACK', string> = {
  SALE: '판매',
  GIFT: '증정',
  LOST: '분실',
  DAMAGED: '파손',
  OTHER: '기타',
  REPACK: '재포장',
}
