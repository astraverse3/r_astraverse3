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
    yields: { uruchi: number; indica: number; glutinous: number };
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
    const [animatedGlutinous, setAnimatedGlutinous] = useState(0);

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
            setAnimatedGlutinous(yields.glutinous * easeOut(percentage));

            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setAnimatedUruchi(yields.uruchi);
                setAnimatedIndica(yields.indica);
                setAnimatedGlutinous(yields.glutinous);
            }
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [yields.uruchi, yields.indica, yields.glutinous]);

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
            <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3">
                {/* Left section: Stock & Production sharing the 7fr space */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Grain Inventory Card */}
                    <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-start min-h-[160px]">
                        <div className="mb-0">
                            <h3 className="text-sm font-bold text-slate-500 mb-2 font-sans uppercase tracking-wider">
                                원곡 재고
                                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1.5 tracking-tight">({years.target}년산)</span>
                            </h3>
                            <div className="flex items-baseline flex-wrap gap-x-2">
                                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{animatedAvailable.toLocaleString()}</span>
                                <span className="text-base sm:text-lg font-bold text-slate-600 tracking-tight">kg</span>
                                <span className="text-[11px] md:text-xs font-medium text-slate-400 ml-1">/ 총 {totalStock.toLocaleString()}kg 중</span>
                            </div>
                        </div>

                        <div className="mt-5">
                            <div className="w-full bg-[#f1f5f9] shadow-inner h-6 md:h-8 rounded-full overflow-hidden relative border border-slate-200/60">
                                <div
                                    className="bg-gradient-to-r from-[#00a2e8] to-[#007cb3] shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15),inset_0_4px_6px_rgba(255,255,255,0.25)] border border-black/10 h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-center px-4"
                                    style={{ width: `${Math.max(remainingPercent, 12)}%` }}
                                >
                                    <span className="text-[11px] md:text-xs font-bold text-white drop-shadow-sm tracking-wide">{Math.round(remainingPercent)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Total Production Card */}
                    <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-start min-h-[160px]">
                        <div className="mb-0">
                            <h3 className="text-sm font-bold text-slate-500 mb-2 font-sans uppercase tracking-wider">
                                총 도정 생산량
                                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1.5 tracking-tight">({years.target}년산)</span>
                            </h3>
                            <div className="flex items-baseline flex-wrap gap-x-2">
                                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{animatedOutput.toLocaleString()}</span>
                                <span className="text-base sm:text-lg font-bold text-slate-600 tracking-tight">kg</span>
                            </div>
                        </div>

                        <div className="mt-5">
                            <div className="w-full bg-[#f1f5f9] shadow-inner h-6 md:h-8 flex rounded-full overflow-hidden border border-slate-200/60 relative">
                                {uruchiOutPercent > 0 && (
                                    <div className="bg-gradient-to-r from-[#00a2e8] to-[#007cb3] shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15),inset_0_4px_6px_rgba(255,255,255,0.25)] border-y border-r border-black/10 h-full transition-all duration-1000 ease-out flex items-center justify-center px-1 md:px-2 overflow-hidden" style={{ width: `${Math.max(uruchiOutPercent, 18)}%` }} title={`메벼: ${outputsByType.uruchi.toLocaleString()}kg`}>
                                        <span className="text-[10px] md:text-[11px] font-bold text-white whitespace-nowrap drop-shadow-md tracking-wide">메벼 {Math.round(uruchiOutPercent)}%</span>
                                    </div>
                                )}
                                {indicaOutPercent > 0 && (
                                    <div className="bg-gradient-to-r from-[#8dc540] to-[#6da12c] shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15),inset_0_4px_6px_rgba(255,255,255,0.25)] border-y border-r border-black/10 h-full transition-all duration-1000 ease-out flex items-center justify-center px-1 md:px-2 overflow-hidden" style={{ width: `${Math.max(indicaOutPercent, 18)}%` }} title={`인디카: ${outputsByType.indica.toLocaleString()}kg`}>
                                        <span className="text-[10px] md:text-[11px] font-bold text-white whitespace-nowrap drop-shadow-md tracking-wide">인디카 {Math.round(indicaOutPercent)}%</span>
                                    </div>
                                )}
                                {glutinousOutPercent > 0 && (
                                    <div className="bg-gradient-to-r from-[#f89c1e] to-[#cc7b0c] shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15),inset_0_4px_6px_rgba(255,255,255,0.25)] border-y border-r border-black/10 h-full transition-all duration-1000 ease-out flex items-center justify-center px-1 md:px-2 overflow-hidden" style={{ width: `${Math.max(glutinousOutPercent, 18)}%` }} title={`찰벼: ${outputsByType.glutinous.toLocaleString()}kg`}>
                                        <span className="text-[10px] md:text-[11px] font-bold text-white whitespace-nowrap drop-shadow-md tracking-wide">찰벼 {Math.round(glutinousOutPercent)}%</span>
                                    </div>
                                )}
                                {othersOutPercent > 0 && (
                                    <div className="bg-gradient-to-r from-[#94a3b8] to-[#475569] shadow-[inset_0_-6px_8px_rgba(0,0,0,0.15),inset_0_4px_6px_rgba(255,255,255,0.25)] border-y border-r border-black/10 h-full transition-all duration-1000 ease-out flex items-center justify-center px-1 md:px-2 overflow-hidden" style={{ width: `${Math.max(othersOutPercent, 18)}%` }} title={`기타: ${outputsByType.others.toLocaleString()}kg`}>
                                        <span className="text-[10px] md:text-[11px] font-bold text-white whitespace-nowrap drop-shadow-md tracking-wide">기타</span>
                                    </div>
                                )}
                                {/* Empty State fallback if all percentages are 0 */}
                                {uruchiOutPercent === 0 && indicaOutPercent === 0 && glutinousOutPercent === 0 && othersOutPercent === 0 && (
                                    <div className="w-full flex items-center justify-center h-full">
                                        <span className="text-[10px] md:text-xs font-bold text-slate-400">데이터 없음</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right section: Yield card taking the 3fr space to match bottom layout */}
                {/* 3. Average Yield Card */}
                <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px]">
                    <h3 className="text-sm font-bold text-slate-500 font-sans uppercase tracking-wider relative z-10 shrink-0">
                        백미 평균 수율
                        <span className="text-[11px] font-medium text-slate-400 normal-case ml-2 tracking-tight">(기준 65%)</span>
                    </h3>

                    <div className="flex-1 w-full flex flex-col justify-end mt-[-26px]">
                        {/* Chart Area */}
                        <div className="relative h-[105px] w-full max-w-[280px] mx-auto border-b-[1.5px] border-slate-300 pb-0">
                            {/* Y-axis Labels & Grid Lines (50, 55, 60, 65) */}
                            {[50, 55, 60, 65].map(val => (
                                <div
                                    key={`label-${val}`}
                                    className={`absolute left-[32px] right-0 z-0 flex items-center ${val === 65 ? 'border-t-[1.5px] border-slate-300 shadow-sm' : ''}`}
                                    style={{ bottom: `${(val - 50) / 30 * 100}%` }}
                                >
                                    <span className={`absolute -top-[7px] -left-[36px] w-[34px] ${val === 65 ? 'text-[9.5px] font-bold text-slate-500 -top-[9px]' : 'text-[8.5px] font-medium text-slate-400'} bg-white tracking-tighter text-right pr-1.5`}>
                                        {val}
                                    </span>
                                    {val > 50 && val !== 65 && (
                                        <div className="w-full border-t border-slate-100" />
                                    )}
                                </div>
                            ))}

                            <div className="absolute inset-0 flex justify-between items-end z-10 pl-[46px] pr-2 md:pr-4">
                                {[
                                    { label: '메벼', value: animatedUruchi, color: 'bg-gradient-to-t from-[#008cc9] via-[#00a2e8] to-[#33c9ff] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-4px_6px_rgba(0,0,0,0.15)] border-x border-t border-black/10', overColor: 'bg-black/15' }, // Blue
                                    { label: '인디카', value: animatedIndica, color: 'bg-gradient-to-t from-[#6da12c] via-[#8dc540] to-[#aae35f] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-4px_6px_rgba(0,0,0,0.15)] border-x border-t border-black/10', overColor: 'bg-black/15' }, // Green
                                    { label: '찰벼', value: animatedGlutinous, color: 'bg-gradient-to-t from-[#cc7b0c] via-[#f89c1e] to-[#ffb44d] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-4px_6px_rgba(0,0,0,0.15)] border-x border-t border-black/10', overColor: 'bg-black/15' }, // Orange
                                ].map(item => {
                                    // Scale: 50% ~ 80%
                                    const clampedValue = Math.max(50, Math.min(80, item.value));
                                    const heightPct = (clampedValue - 50) / 30 * 100;
                                    const isOver = item.value > 65;
                                    const coloredPct = isOver ? ((item.value - 65) / (clampedValue - 50) * 100) : 0;
                                    const displayValue = (Math.round(item.value * 10) / 10).toFixed(1);

                                    return (
                                        <div key={item.label} className="flex flex-col items-center justify-end h-full w-[40px] md:w-[46px]">
                                            {/* Bar Container */}
                                            {item.value > 0 ? (
                                                <div
                                                    className={`w-full rounded-t-[4px] overflow-hidden flex flex-col items-center relative group transition-all ${item.color}`}
                                                    style={{ height: `${heightPct}%` }}
                                                >
                                                    {/* Text inside Bar (at bottom) */}
                                                    <div className="absolute bottom-[2px] left-0 right-0 flex justify-center z-20 pointer-events-none">
                                                        <span className="text-[11px] sm:text-[11.5px] font-black text-white drop-shadow-sm">
                                                            {displayValue}
                                                        </span>
                                                    </div>

                                                    {isOver && (
                                                        <div className={`w-full ${item.overColor} z-10 relative border-b border-black/10`} style={{ height: `${coloredPct}%` }} />
                                                    )}
                                                    {/* Base bar color */}
                                                    <div className={`w-full flex-1 z-0 relative`} />
                                                </div>
                                            ) : (
                                                <div className="w-full h-0 flex items-end justify-center">
                                                    <span className="text-[10px] font-medium text-slate-300 pb-1">-</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* X Axis Labels */}
                        <div className="flex justify-between items-center w-full max-w-[280px] mx-auto mt-2 shrink-0 pl-[46px] pr-2 md:pr-4">
                            <div className="text-[11px] font-bold text-slate-500 tracking-wider text-center w-[40px] md:w-[46px] whitespace-nowrap">메벼</div>
                            <div className="text-[11px] font-bold text-slate-500 tracking-wider text-center w-[40px] md:w-[46px] whitespace-nowrap">인디카</div>
                            <div className="text-[11px] font-bold text-slate-500 tracking-wider text-center w-[40px] md:w-[46px] whitespace-nowrap">찰벼</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
