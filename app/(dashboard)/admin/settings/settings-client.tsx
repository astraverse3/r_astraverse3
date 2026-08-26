'use client';

import { useState, useTransition } from 'react';
import { saveYieldRates } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { SettingSection } from './setting-section';

interface Props {
    initialRates: Record<string, number>;
    millingTypes: string[];
    defaultRates: Record<string, number>;
}

export function SettingsClient({ initialRates, millingTypes, defaultRates }: Props) {
    const [rates, setRates] = useState<Record<string, number>>(initialRates);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);

    function handleChange(millingType: string, value: string) {
        const num = parseFloat(value);
        setRates(prev => ({ ...prev, [millingType]: isNaN(num) ? prev[millingType] : num }));
        setSaved(false);
    }

    function handleSave() {
        startTransition(async () => {
            await saveYieldRates(rates);
            setSaved(true);
        });
    }

    function handleReset(millingType: string) {
        setRates(prev => ({ ...prev, [millingType]: defaultRates[millingType] }));
        setSaved(false);
    }

    return (
        <SettingSection
            title="도정구분별 수율 기준값"
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
                {millingTypes.map((type) => {
                    const changed = rates[type] !== defaultRates[type];
                    return (
                        <div key={type} className="flex items-center gap-2">
                            <span className="w-14 shrink-0 text-[12.5px] font-semibold text-slate-700">{type}</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={rates[type] ?? defaultRates[type]}
                                onChange={(e) => handleChange(type, e.target.value)}
                                className="h-[30px] w-[62px] border border-slate-300 rounded-lg px-2 text-[12.5px] font-semibold text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-400">
                                % <span className="text-slate-300">({defaultRates[type]})</span>
                            </span>
                            {changed && (
                                <button
                                    onClick={() => handleReset(type)}
                                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                                >
                                    초기화
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </SettingSection>
    );
}
