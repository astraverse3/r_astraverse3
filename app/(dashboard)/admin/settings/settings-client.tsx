'use client';

import { useState, useTransition } from 'react';
import { saveYieldRates } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { SettingSection } from './setting-section';
import {
    VARIETY_YIELD_TYPES,
    VARIETY_YIELD_MILLING_TYPES,
    VARIETY_TYPE_LABELS,
    DEFAULT_VARIETY_YIELD_RATES,
    varietyYieldKey,
} from '@/lib/settings-constants';

interface Props {
    initialRates: Record<string, number>;
    millingTypes: string[];
    defaultRates: Record<string, number>;
}

/** 기준값 입력 한 칸. 기본값과 다르면 초기화 버튼이 붙는다. */
function RateInput({
    label,
    value,
    defaultValue,
    onChange,
    onReset,
}: {
    label: string;
    value: number;
    defaultValue: number;
    onChange: (value: string) => void;
    onReset: () => void;
}) {
    const changed = value !== defaultValue;
    return (
        <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[12.5px] font-semibold text-slate-700">{label}</span>
            <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-[30px] w-[62px] border border-slate-300 rounded-lg px-2 text-[12.5px] font-semibold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400">
                % <span className="text-slate-300">({defaultValue})</span>
            </span>
            {changed && (
                <button
                    onClick={onReset}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                >
                    초기화
                </button>
            )}
        </div>
    );
}

export function SettingsClient({ initialRates, millingTypes, defaultRates }: Props) {
    const [rates, setRates] = useState<Record<string, number>>(initialRates);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    function handleChange(key: string, value: string) {
        const num = parseFloat(value);
        setRates(prev => ({ ...prev, [key]: isNaN(num) ? prev[key] : num }));
        setSaved(false);
    }

    function handleReset(key: string, defaultValue: number) {
        setRates(prev => ({ ...prev, [key]: defaultValue }));
        setSaved(false);
    }

    function handleSave() {
        startTransition(async () => {
            await saveYieldRates(rates);
            setSaved(true);
        });
    }

    return (
        <SettingSection
            title="수율 기준값"
            description="도정 작업 시 기대 수율(%)입니다. 괄호는 기본값."
            action={
                <div className="flex items-center gap-2">
                    {saved && <span className="text-[11px] text-green-600 font-medium">저장됨</span>}
                    <Button onClick={handleSave} disabled={isPending} size="sm" className="h-[30px]">
                        {isPending ? '저장 중...' : '저장'}
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                {millingTypes.map((type) => (
                    <RateInput
                        key={type}
                        label={type}
                        value={rates[type] ?? defaultRates[type]}
                        defaultValue={defaultRates[type]}
                        onChange={(v) => handleChange(type, v)}
                        onReset={() => handleReset(type, defaultRates[type])}
                    />
                ))}
            </div>

            {/* 품종 축 — 인디카는 도정구분이 아니라 품종 타입이라 별도 구역으로 둔다.
                인디카 벼도 millingType은 '백미'로 저장되므로, 위 도정구분 기준만으로는
                기준값을 가를 수 없다(인디카 백미 실적 61.3% vs 메벼 67.2%). */}
            {VARIETY_YIELD_TYPES.map((varietyType) => (
                <div key={varietyType} className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-baseline gap-2 mb-2">
                        <h3 className="text-[12.5px] font-bold text-slate-700">
                            {VARIETY_TYPE_LABELS[varietyType] ?? varietyType}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            품종이 {VARIETY_TYPE_LABELS[varietyType] ?? varietyType}면 위 도정구분 기준 대신 이 값을 씁니다.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                        {VARIETY_YIELD_MILLING_TYPES.map((millingType) => {
                            const key = varietyYieldKey(varietyType, millingType);
                            const defaultValue = DEFAULT_VARIETY_YIELD_RATES[key];
                            return (
                                <RateInput
                                    key={key}
                                    label={millingType}
                                    value={rates[key] ?? defaultValue}
                                    defaultValue={defaultValue}
                                    onChange={(v) => handleChange(key, v)}
                                    onReset={() => handleReset(key, defaultValue)}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
        </SettingSection>
    );
}
