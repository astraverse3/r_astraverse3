'use client';

import { useState, useTransition } from 'react';
import { saveYieldRates } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';

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
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
                {millingTypes.map((type) => (
                    <div key={type} className="flex items-center gap-4">
                        <span className="w-24 text-sm font-medium text-slate-700 shrink-0">{type}</span>
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={rates[type] ?? defaultRates[type]}
                                onChange={(e) => handleChange(type, e.target.value)}
                                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-500">%</span>
                            <span className="text-xs text-slate-400 ml-1">(기본: {defaultRates[type]}%)</span>
                            {rates[type] !== defaultRates[type] && (
                                <button
                                    onClick={() => handleReset(type)}
                                    className="text-xs text-slate-400 hover:text-slate-600 underline ml-1"
                                >
                                    초기화
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    size="sm"
                >
                    {isPending ? '저장 중...' : '저장'}
                </Button>
                {saved && (
                    <span className="text-xs text-green-600 font-medium">저장되었습니다.</span>
                )}
            </div>
        </div>
    );
}
