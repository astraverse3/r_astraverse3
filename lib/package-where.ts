// 제품재고 조회 필터의 where 조립 — 'use server' 아님(테스트 가능)
//
// 계획서 docs/plan/plan-제품재고-검색필터확장.md.
//
// `getPackages`(목록)와 `exportPackages`(엑셀)가 **같은 where를 두 벌 복붙**해 갖고 있었다.
// 필터가 3개일 땐 버텼지만 6개가 되면 한쪽만 고치는 사고가 확정이다 —
// 화면과 엑셀 결과가 조용히 달라지는, 알아채기 가장 어려운 종류의 어긋남이다.
// `app/actions/packages.ts`는 'use server'라 동기 헬퍼를 export 할 수 없어 여기로 뺐다.
//
// DB 접근은 하지 않는다. 순수하게 where 객체만 만든다.

import type { Prisma } from '@prisma/client'
import { kstDayRange, kstYearRange } from './kst-date'

export type PackageSource = 'MILLED' | 'PURCHASED'
export type PackageCategory = 'RICE' | 'MISC_GRAIN'

/** 조회·엑셀이 공유하는 필터. 정렬·「차감된 재고 보기」는 where 밖이라 여기 없다. */
export type PackageFilterParams = {
    category: PackageCategory
    /** 콤마 구분 다중값 가능 (예: "1,2,3") */
    varietyId?: string
    /** 콤마 구분 다중값 가능 (예: "2025,2024") */
    productionYear?: string
    /** 콤마 구분 다중값 가능 (예: "MILLED,PURCHASED") */
    source?: string
    /** 생산자·실농가·매입처 부분일치. 콤마 구분 다중값은 OR */
    farmerName?: string
    /** 인증구분 멀티값 (유기농·무농약·일반). 벼 탭에서만 쓴다 — 매입 잡곡엔 인증 정보가 없다 */
    certType?: string
    /** 포장일자 시작 (yyyy-mm-dd, 당일 포함) */
    packedFrom?: string
    /** 포장일자 종료 (yyyy-mm-dd, 당일 포함) */
    packedTo?: string
}

const splitMulti = (s: string | undefined): string[] =>
    s ? s.split(',').map(x => x.trim()).filter(Boolean) : []

/**
 * 제품재고 목록/엑셀 공용 where.
 *
 * 포장일자는 **목록의 「포장일자」 컬럼과 같은 기준**으로 건다:
 *   MILLED → createdAt / PURCHASED → incomingDate (없으면 createdAt)
 * 이게 어긋나면 "보이는 날짜로 검색했는데 안 나온다"가 된다.
 */
export function buildPackageWhere(
    params: PackageFilterParams,
): Prisma.MillingOutputPackageWhereInput {
    const { category, varietyId, productionYear, source, farmerName, certType, packedFrom, packedTo } = params

    const where: Prisma.MillingOutputPackageWhereInput = { category }
    const and: Prisma.MillingOutputPackageWhereInput[] = []

    const sourceList = splitMulti(source).filter(
        (s): s is PackageSource => s === 'MILLED' || s === 'PURCHASED',
    )
    if (sourceList.length === 1) where.source = sourceList[0]
    else if (sourceList.length > 1) where.source = { in: sourceList }

    // 품종: MILLED는 stock 경유, PURCHASED는 직접 참조
    const varietyIdList = splitMulti(varietyId)
        .map(v => parseInt(v, 10))
        .filter(n => !Number.isNaN(n))
    if (varietyIdList.length > 0) {
        and.push({
            OR: [
                { varietyId: { in: varietyIdList } },
                { stock: { varietyId: { in: varietyIdList } } },
            ],
        })
    }

    const yearList = splitMulti(productionYear)
        .map(y => parseInt(y, 10))
        .filter(n => !Number.isNaN(n))
    if (yearList.length > 0) {
        and.push({
            OR: yearList.flatMap(py => [
                { stock: { productionYear: py } },
                // PURCHASED는 productionYear 개념 없음 → incomingDate 연도 비교
                { incomingDate: kstYearRange(py) },
            ]),
        })
    }

    // 생산자 — 목록의 「생산자」 컬럼에 보이는 값 그대로 찾는다.
    // MILLED는 farmer.name·actualFarmer, PURCHASED는 매입처명.
    const nameList = splitMulti(farmerName)
    if (nameList.length > 0) {
        const nameOr = (n: string): Prisma.MillingOutputPackageWhereInput => ({
            OR: [
                { stock: { farmer: { name: { contains: n } } } },
                { stock: { actualFarmer: { contains: n } } },
                { purchaseVendor: { contains: n } },
            ],
        })
        if (nameList.length === 1) and.push(nameOr(nameList[0]))
        else and.push({ OR: nameList.map(nameOr) })
    }

    // 인증구분 — stock → farmer → group 경로로만 알 수 있다.
    // 매입(PURCHASED)은 stock이 없어 이 조건에 걸리면 결과에서 빠진다.
    // 그래서 UI는 벼 탭에서만 이 필터를 노출한다(잡곡은 매입이 섞여 있다).
    const certList = splitMulti(certType)
    if (certList.length === 1) {
        and.push({ stock: { farmer: { group: { certType: certList[0] } } } })
    } else if (certList.length > 1) {
        and.push({ stock: { farmer: { group: { certType: { in: certList } } } } })
    }

    // 포장일자 기간 — 종료일은 당일 포함이라 다음날 미만(lt)으로 건다.
    // KST 하루로 건다 — 목록 표시(`toKstDate`)와 같은 기준이어야 「보이는 날짜로 검색했는데 안 나온다」가 없다.
    // 🔴 로컬 자정(`new Date(y, m, d)`)은 개발 PC(KST)와 실서버(UTC)에서 서로 다른 범위가 된다(§39).
    const from = kstDayRange(packedFrom)
    const to = kstDayRange(packedTo)
    if (from || to) {
        const range: { gte?: Date; lt?: Date } = {}
        if (from) range.gte = from.gte
        if (to) range.lt = to.lt
        and.push({
            OR: [
                { source: 'MILLED', createdAt: range },
                { source: 'PURCHASED', incomingDate: range },
                // 매입인데 매입일이 비어 있는 행 — 목록도 createdAt으로 떨어뜨린다
                { source: 'PURCHASED', incomingDate: null, createdAt: range },
            ],
        })
    }

    if (and.length > 0) where.AND = and
    return where
}
