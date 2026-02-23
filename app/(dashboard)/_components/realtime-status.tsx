'use client';

import { useEffect, useState } from 'react';

// Simple hook for counting up animation
const useCountUp = (end: number, duration: number = 2000) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            const easeOut = (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);

            setCount(Math.floor(end * easeOut(percentage)));

            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCount(end);
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [end, duration]);

    return count;
};

interface RealtimeStatusProps {
    availableStock: number;
    totalStock: number;
    millingProgress: number;
    totalOutput: number;
    outputsByType: {
        uruchi: number;
        glutinous: number;
        indica: number;
        others: number;
    };
    yields: { uruchi: number; indica: number };
    years: { target: number; current: number };
}

export function RealtimeStatus({
    availableStock,
    totalStock,
    millingProgress, // Retained for compatibility but milledPercent is calculated directly below for layout matching
    totalOutput,
    outputsByType,
    yields,
    years
}: RealtimeStatusProps) {
    const animatedAvailable = useCountUp(availableStock);
    const animatedOutput = useCountUp(totalOutput);

    const [animatedUruchi, setAnimatedUruchi] = useState(0);
    const [animatedIndica, setAnimatedIndica] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;
        const duration = 1500;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const easeOut = (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);

            setAnimatedUruchi(yields.uruchi * easeOut(percentage));
            setAnimatedIndica(yields.indica * easeOut(percentage));

            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setAnimatedUruchi(yields.uruchi);
                setAnimatedIndica(yields.indica);
            }
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [yields.uruchi, yields.indica]);

    // calculate percentages
    const remainingPercent = totalStock > 0 ? (availableStock / totalStock) * 100 : 0;
    const milledPercent = totalStock > 0 ? 100 - remainingPercent : 0;

    // calculate outputsByType percentages
    const totalOutputForTypes = outputsByType.uruchi + outputsByType.glutinous + outputsByType.indica + outputsByType.others;
    const uruchiOutPercent = totalOutputForTypes > 0 ? (outputsByType.uruchi / totalOutputForTypes) * 100 : 0;
    const glutinousOutPercent = totalOutputForTypes > 0 ? (outputsByType.glutinous / totalOutputForTypes) * 100 : 0;
    const indicaOutPercent = totalOutputForTypes > 0 ? (outputsByType.indica / totalOutputForTypes) * 100 : 0;
    const othersOutPercent = totalOutputForTypes > 0 ? (outputsByType.others / totalOutputForTypes) * 100 : 0;

    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Grain Inventory Card */}
                <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
                    <div className="mb-4 md:mb-0">
                        <h3 className="text-sm font-bold text-slate-500 mb-2 font-sans uppercase tracking-wider">
                            원곡 재고
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1.5 tracking-tight">({years.target}년산)</span>
                        </h3>
                        <div className="flex items-baseline mb-1">
                            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{animatedAvailable.toLocaleString()}</span>
                            <span className="text-lg sm:text-xl font-bold text-slate-600 tracking-tight ml-1.5">kg</span>
                        </div>
                        <div className="text-xs font-medium text-slate-400">현재 재고</div>
                    </div>

                    <div className="mt-auto">
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                            <div
                                className="bg-[#2EB85C] h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${remainingPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                            <span className="text-slate-700">전체 {totalStock.toLocaleString()} kg 중 {Math.round(remainingPercent)}%</span>
                            <span className="text-slate-400 font-medium">도정됨 {Math.round(milledPercent)}%</span>
                        </div>
                    </div>
                </div>

                {/* 2. Total Production Card */}
                <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
                    <div className="mb-4 md:mb-0">
                        <h3 className="text-sm font-bold text-slate-500 mb-2 font-sans uppercase tracking-wider">총 생산량</h3>
                        <div className="flex items-baseline mb-1">
                            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{animatedOutput.toLocaleString()}</span>
                            <span className="text-lg sm:text-xl font-bold text-slate-600 tracking-tight ml-1.5">kg</span>
                        </div>
                        <div className="text-xs font-medium text-slate-400">올해 누적 도정 생산량</div>
                    </div>

                    <div className="mt-auto">
                        <div className="w-full bg-slate-100 h-2 flex rounded-full overflow-hidden mb-2">
                            <div className="bg-[#2EB85C] h-full transition-all duration-1000 ease-out" style={{ width: `${uruchiOutPercent}%` }} title={`메벼: ${outputsByType.uruchi.toLocaleString()}kg`} />
                            <div className="bg-[#E74C3C] h-full transition-all duration-1000 ease-out" style={{ width: `${indicaOutPercent}%` }} title={`인디카: ${outputsByType.indica.toLocaleString()}kg`} />
                            <div className="bg-[#F6C000] h-full transition-all duration-1000 ease-out" style={{ width: `${glutinousOutPercent}%` }} title={`찰벼: ${outputsByType.glutinous.toLocaleString()}kg`} />
                            <div className="bg-[#95A5A6] h-full transition-all duration-1000 ease-out" style={{ width: `${othersOutPercent}%` }} title={`기타: ${outputsByType.others.toLocaleString()}kg`} />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#2EB85C]"></span>메벼</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>인디카</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F6C000]"></span>찰벼</div>
                            {outputsByType.others > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#95A5A6]"></span>기타</div>}
                        </div>
                    </div>
                </div>

                {/* 3. Average Yield Card */}
                <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-center min-h-[160px]">
                    <div className="w-full">
                        <h3 className="text-sm font-bold text-slate-500 mb-3 font-sans uppercase tracking-wider">백미 평균 수율</h3>
                        <div className="flex gap-3 w-full">
                            {/* Uruchi */}
                            <div className="flex-1 bg-[#EBF4FA] rounded-[16px] px-3 py-3 flex flex-col items-center justify-center border border-blue-50/50">
                                <span className="text-2xl font-black text-slate-800 mb-0.5">{animatedUruchi.toFixed(1)}%</span>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">메벼</span>
                            </div>
                            {/* Indica */}
                            <div className="flex-1 bg-[#F4F1EA] rounded-[16px] px-3 py-3 flex flex-col items-center justify-center border border-amber-50/50">
                                <span className="text-2xl font-black text-slate-800 mb-0.5">{animatedIndica.toFixed(1)}%</span>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">인디카</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
