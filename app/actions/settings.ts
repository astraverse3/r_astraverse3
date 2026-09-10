'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { DEFAULT_YIELD_RATES, DEFAULT_VARIETY_YIELD_RATES } from "@/lib/settings-constants";
import { requireAdmin, requireSession } from "@/lib/auth-guard";

function yieldKey(millingType: string) {
    return `yield_rate_${millingType}`;
}

/** 전체 도정구분별 수율 기준값 조회 (DB 값 없으면 기본값 사용) */
export async function getYieldRates(): Promise<Record<string, number>> {
    await requireSession();
    const configs = await prisma.systemConfig.findMany({
        where: { key: { startsWith: 'yield_rate_' } },
    });

    // 도정구분 키(`yield_rate_백미`)와 품종축 키(`yield_rate_INDICA_백미`)는 접두사가 같아
    // 같은 맵에 담긴다. 판정 시 getYieldTarget이 품종축을 먼저 본다.
    const result: Record<string, number> = { ...DEFAULT_YIELD_RATES, ...DEFAULT_VARIETY_YIELD_RATES };
    for (const config of configs) {
        const millingType = config.key.replace('yield_rate_', '');
        const parsed = parseFloat(config.value);
        if (!isNaN(parsed)) {
            result[millingType] = parsed;
        }
    }
    return result;
}

/** 특정 도정구분 수율값 조회 */
export async function getYieldRate(millingType: string): Promise<number> {
    await requireSession();
    const config = await prisma.systemConfig.findUnique({
        where: { key: yieldKey(millingType) },
    });
    if (config) {
        const parsed = parseFloat(config.value);
        if (!isNaN(parsed)) return parsed;
    }
    return DEFAULT_YIELD_RATES[millingType] ?? 68;
}

/** 도정구분별 수율 기준값 저장 (upsert) */
export async function saveYieldRates(rates: Record<string, number>) {
    await requireAdmin();
    await Promise.all(
        Object.entries(rates).map(([millingType, rate]) =>
            prisma.systemConfig.upsert({
                where: { key: yieldKey(millingType) },
                update: { value: String(rate) },
                create: { key: yieldKey(millingType), value: String(rate) },
            })
        )
    );
    // 기준값은 (dashboard) layout에서 읽어 화면 전체에 공급된다(YieldRatesProvider).
    // 설정 페이지만 revalidate하면 대시보드·도정목록·통계가 낡은 기준값을 계속 쓴다.
    revalidatePath('/', 'layout');
}
