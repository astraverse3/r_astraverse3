// 도정유형 표시 변환 (방향 A — 계획서 docs/plan/plan-찰벼도정유형정리.md)
//
// 저장값(millingType)은 순수 도정 정도(백미/현미/오분도미/칠분도미/기타).
// 곡종(찰/메)은 Variety.type에서 파생 → 찰벼(GLUTINOUS)는 표시만 찹쌀/찰현미로 변환.
//   - 찰벼 + 백미 → '찹쌀'(찰백미)
//   - 찰벼 + 현미 → '찰현미'
//   - 그 외(메벼/인디카/잡곡 등)는 저장값 그대로

export function getDisplayMillingType(
  millingType: string,
  varietyType?: string | null,
): string {
  if (varietyType === 'GLUTINOUS') {
    if (millingType === '백미') return '찹쌀'
    if (millingType === '현미') return '찰현미'
  }
  return millingType
}
