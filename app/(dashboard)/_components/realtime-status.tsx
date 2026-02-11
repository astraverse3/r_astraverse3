'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, CheckCircle2, Factory, Warehouse, LayoutGrid } from 'lucide-react';

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
    averageYield: number;
    years: { target: number; current: number };
}

export function RealtimeStatus({
    availableStock,
    totalStock,
    millingProgress,
    totalOutput,
    averageYield,
    years
}: RealtimeStatusProps) {
    const animatedAvailable = useCountUp(availableStock);
    const animatedTotal = useCountUp(totalStock);
    const animatedOutput = useCountUp(totalOutput);

    const [animatedYield, setAnimatedYield] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;
        const duration = 1500;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const easeOut = (x: number) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);

            setAnimatedYield(averageYield * easeOut(percentage));

            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setAnimatedYield(averageYield);
            }
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [averageYield]);

    // Grid Calculation
    // 12x12 Grid = 144 units. Balanced density.
    const totalUnits = 144;
    const availablePercentage = totalStock > 0 ? (availableStock / totalStock) : 0;
    const activeUnits = Math.round(availablePercentage * totalUnits); // Green dots

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Raw Grain Stock Card - Dot Matrix / Grid Layout */}
            <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-stretch h-full relative z-10 gap-6">
                    {/* Left: Text Info */}
                    <div className="flex flex-col justify-between h-full flex-grow">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></span>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">원료곡 재고 ({years.target})</h3>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-900 tracking-tight">{animatedAvailable.toLocaleString()}</span>
                                <span className="text-sm font-bold text-slate-400">kg</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-400 font-medium">
                                총 입고 <span className="text-slate-600 font-bold">{animatedTotal.toLocaleString()} kg</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Graphic (Dot Matrix Grid) with Integrated Progress */}
                    <div className="relative flex flex-col items-center justify-center min-w-[120px]">
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-3 relative">
                            {/* 12x12 Grid with small dots */}
                            <div className="grid grid-cols-12 gap-[3px] w-fit">
                                {Array.from({ length: totalUnits }).map((_, i) => {
                                    const isConsumed = i < (totalUnits - activeUnits);

                                    return (
                                        <div
                                            key={i}
                                            className={`w-[4px] h-[4px] rounded-full transition-all duration-500 ease-in-out ${isConsumed
                                                    ? 'bg-slate-200/50 scale-75'
                                                    : 'bg-emerald-400 shadow-[0_0_2px_rgba(52,211,153,0.4)] scale-100'
                                                }`}
                                        />
                                    );
                                })}
                            </div>

                            {/* Overlay: Badge style progress */}
                            {/* Placed at the bottom-right or center? Center is cleanest. */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col items-center">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase leading-none mb-0.5 tracking-wider">PROCESS</span>
                                    <span className="text-sm font-black text-slate-800 leading-none tracking-tight">{millingProgress.toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Background Decor */}
                <LayoutGrid className="absolute -left-4 -bottom-4 w-24 h-24 text-emerald-50/50 -rotate-12 pointer-events-none" strokeWidth={1} />
            </div>

            {/* Production Output Card */}
            <div className="relative bg-white rounded-2xl p-5 shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-center h-full relative z-10 gap-6">
                    {/* Left: Text Info */}
                    <div className="flex flex-col justify-between h-full flex-grow">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ring-2 ring-blue-100"></span>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">도정 생산량 ({years.current})</h3>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-slate-900 tracking-tight">{animatedOutput.toLocaleString()}</span>
                                <span className="text-sm font-bold text-slate-400">kg</span>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">평균 수율</span>
                            <span className="text-lg font-black text-blue-600 flex items-baseline gap-0.5">
                                {animatedYield.toFixed(1)}<span className="text-xs text-blue-400">%</span>
                            </span>
                        </div>
                    </div>

                    {/* Right: Graphic (Circular Gauge) */}
                    <div className="w-24 h-24 flex items-center justify-center relative flex-shrink-0">
                        <div className="absolute inset-0 bg-blue-50 rounded-full scale-90 opacity-50"></div>
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-100"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 40}
                                strokeDashoffset={2 * Math.PI * 40 - (animatedYield / 100) * (2 * Math.PI * 40)}
                                className="text-blue-500 transition-all duration-1000 ease-out"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Factory className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
                        </div>
                    </div>
                </div>

                {/* Background Decor */}
                <CheckCircle2 className="absolute -left-4 -bottom-4 w-24 h-24 text-blue-50/50 -rotate-12 pointer-events-none" strokeWidth={1} />
            </div>
        </div>
    );
}
