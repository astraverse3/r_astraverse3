import type { PackageSort } from '@/app/actions/packages'

/**
 * 제품재고 목록 정렬 — 단일 진실 원천.
 *
 * 🔴 기본값 리터럴을 화면·액션에 흩뿌리지 말 것. 예전에 `'weight_desc'`가
 * 4파일 8곳에 박혀 있었고, 하나라도 어긋나면 「기본값인데 URL에 `sort=`가 붙는다」
 * 「기본값인데 활성 필터 배지가 뜬다」로 **조용히** 틀어진다.
 * `lib/package-where.ts`·`lib/production-year.ts`와 같은 단일 원천 패턴이다.
 */

/**
 * 기본 정렬 = **오래된순**.
 * 오래 묵은 재고를 먼저 소진해야 하므로(선입선출) 목록도 그 순서로 연다.
 * 기준 날짜는 매입=입고일 / 도정산=포장 등록일이며, 묶음은 대표일을 min으로 잡는다
 * (`app/actions/packages.ts`의 `repDate`).
 */
export const DEFAULT_PACKAGE_SORT: PackageSort = 'oldest'

/** 정렬 선택지. 기본값을 맨 위에 둔다. */
export const PACKAGE_SORT_OPTIONS: { value: PackageSort; label: string }[] = [
    { value: 'oldest', label: '오래된순' },
    { value: 'latest', label: '최신순' },
    { value: 'weight_desc', label: '재고량 많은순' },
]

export const PACKAGE_SORT_VALUES: PackageSort[] = PACKAGE_SORT_OPTIONS.map(o => o.value)

/** URL·화면 값이 기본값과 같은지. 같으면 URL에 싣지 않고 배지도 띄우지 않는다. */
export const isDefaultPackageSort = (sort: string | null | undefined): boolean =>
    !sort || sort === DEFAULT_PACKAGE_SORT
