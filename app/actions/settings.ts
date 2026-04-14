'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { DEFAULT_YIELD_RATES } from "@/lib/settings-constants";
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

    const result: Record<string, number> = { ...DEFAULT_YIELD_RATES };
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
    revalidatePath('/admin/settings');
}
