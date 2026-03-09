'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { MillingStockListDialog } from '@/app/(dashboard)/milling/stock-list-dialog';
import { AddPackagingDialog } from '@/app/(dashboard)/milling/add-packaging-dialog';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

interface RecentLogsListProps {
    logs: any[];
}

export function RecentLogsList({ logs }: RecentLogsListProps) {
    const [selectedInputLog, setSelectedInputLog] = useState<any | null>(null);
    const [packagingOpenLog, setPackagingOpenLog] = useState<any | null>(null);
    const { data: session } = useSession();
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'MILLING_MANAGE');

    return (
        <div className="w-full">
            {/* Table Header - Styled (Hidden on Mobile) */}
            <div className="hidden md:flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/80 rounded-lg py-2.5 px-3 mb-1 uppercase tracking-wider">
                <div className="w-[12%]">등록일자</div>
                <div className="w-[22%]">품종 및 분류</div>
                <div className="w-[14%]">생산자</div>
                <div className="w-[13%] text-right">투입량</div>
                <div className="w-[13%] text-right">생산량</div>
                <div className="w-[13%] text-right">수율</div>
                <div className="w-[13%] text-right px-2">상태</div>
            </div>

            {/* Table Body */}
            <div className="flex flex-col gap-2 md:gap-0">
                {logs.slice(0, 10).map((log: any, index: number) => {
                    const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
                    const yieldRate = log.totalInputKg > 0 ? (productionSum / log.totalInputKg) * 100 : 0;
                    const dateStr = format(new Date(log.date), 'yyyy-MM-dd');

                    const varietyNames = Array.from(new Set((log.stocks || []).map((s: any) => s.variety?.name).filter(Boolean))) as string[];
                    const varietySummary = varietyNames.length > 1
                        ? `${varietyNames[0]} 외 ${varietyNames.length - 1}종`
                        : varietyNames[0] || '-';

                    const farmerNames = Array.from(new Set((log.stocks || []).map((s: any) => s.farmer?.name).filter(Boolean))) as string[];
                    const farmerSummary = farmerNames.length > 1
                        ? `${farmerNames[0]} 외 ${farmerNames.length - 1}명`
                        : farmerNames[0] || '알 수 없음';

                    return (
                        <div key={log.id} className={`flex flex-col md:flex-row md:items-center justify-between py-3 md:py-2 px-3 md:border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group bg-slate-50 md:bg-transparent rounded-xl md:rounded-none gap-2 md:gap-0 cursor-pointer ${index >= 7 ? 'hidden lg:flex' : ''}`}
                            onClick={() => setSelectedInputLog(log)}
                        >

                            {/* Mobile View */}
                            <div className="flex flex-col md:hidden w-full gap-1.5">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-1.5 max-w-[70%]">
                                        <span className="font-bold text-slate-800 text-[12px] truncate">
                                            {varietySummary} <span className="font-normal text-slate-500 text-[11px]">({farmerSummary})</span>
                                        </span>
                                        <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-500 whitespace-nowrap">{log.millingType}</span>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); setPackagingOpenLog(log); }}>
                                        {log.isClosed ? (
                                            <span className="text-[10px] font-bold text-[#7db037] bg-[#8dc540]/10 px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-pointer hover:bg-[#8dc540]/20 transition-colors border border-[#8dc540]/20">완료</span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-[#008cc9] bg-[#00a2e8]/10 px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-pointer hover:bg-[#00a2e8]/20 transition-colors border border-[#00a2e8]/20 animate-pulse">포장</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between w-full">
                                    <span className="text-[11px] font-semibold text-slate-400 font-mono tracking-tight">{dateStr.replace(/-/g, '').slice(2)}</span>

                                    <div className="flex items-center text-[11px] shrink-0">
                                        <div className="w-[55px] text-right font-semibold text-slate-500 shrink-0">
                                            {log.totalInputKg.toLocaleString()}kg
                                        </div>
                                        <div className="w-[16px] flex justify-center shrink-0 mx-0.5">
                                            <ArrowRight className="w-3 h-3 text-slate-300" />
                                        </div>
                                        {log.isClosed ? (
                                            <>
                                                <div className="w-[55px] text-right font-black text-slate-800 shrink-0">
                                                    {productionSum.toLocaleString()}kg
                                                </div>
                                                <div className="w-[42px] text-right font-bold text-[#00a2e8] shrink-0">
                                                    ({(Math.round(yieldRate * 10) / 10).toFixed(1)}%)
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-[55px] text-center text-slate-300 font-medium shrink-0">
                                                    -
                                                </div>
                                                <div className="w-[42px] shrink-0"></div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Desktop View */}
                            <div className="hidden md:flex items-center justify-between w-full text-[13px]">
                                <div className="w-[12%] font-semibold text-slate-500 flex items-center">{dateStr}</div>
                                <div className="flex w-[22%] items-center gap-2 pr-2">
                                    <span className="font-bold text-slate-800 text-[13px] truncate">{varietySummary}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 whitespace-nowrap">{log.millingType}</span>
                                </div>
                                <div className="flex w-[14%] items-center pr-2">
                                    <span className="font-medium text-slate-700 text-[13px] truncate">{farmerSummary}</span>
                                </div>
                                <div className="w-[13%] font-semibold text-slate-600 block items-end text-right">
                                    <div>{log.totalInputKg.toLocaleString()} <span className="text-[11px] text-slate-400 ml-0.5">kg</span></div>
                                </div>
                                <div className="w-[13%] font-black text-slate-800 block items-end text-right">
                                    <div>
                                        {log.isClosed ? (
                                            <>{productionSum.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold ml-0.5">kg</span></>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </div>
                                </div>
                                <div className="w-[13%] font-black text-slate-800 block items-end text-right">
                                    <div>
                                        {log.isClosed ? (
                                            <span className="text-[#00a2e8] bg-[#00a2e8]/5 px-1.5 py-0.5 rounded-md">{(Math.round(yieldRate * 10) / 10).toFixed(1)}%</span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden md:flex w-[13%] text-right px-2 justify-end" onClick={(e) => { e.stopPropagation(); setPackagingOpenLog(log); }}>
                                    {log.isClosed ? (
                                        <span className="text-[11px] font-bold text-[#7db037] bg-[#8dc540]/10 px-2.5 py-1 rounded-full whitespace-nowrap border border-[#8dc540]/20 cursor-pointer hover:bg-[#8dc540]/20 transition-colors">완료</span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-[#008cc9] bg-[#00a2e8]/10 px-2.5 py-1 rounded-full whitespace-nowrap border border-[#00a2e8]/20 cursor-pointer hover:bg-[#00a2e8]/20 transition-colors animate-pulse">포장</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {!logs.length && (
                    <div className="py-10 text-center text-slate-400 text-sm">
                        기록된 작업이 없습니다.
                    </div>
                )}
            </div>

            {/* Input Details Dialog (Standard) */}
            {selectedInputLog && (
                <MillingStockListDialog
                    batchId={selectedInputLog.id}
                    millingType={selectedInputLog.millingType}
                    date={selectedInputLog.date}
                    remarks={selectedInputLog.remarks}
                    stocks={(selectedInputLog.stocks || []).map((s: any) => ({
                        id: s.id,
                        bagNo: s.bagNo,
                        weightKg: s.weightKg,
                        farmerName: s.farmer?.name || 'Unknown',
                        variety: {
                            name: s.variety?.name || 'Unknown',
                            type: s.variety?.type || 'UNKNOWN'
                        },
                        certType: s.farmer?.group?.certType || 'Unknown'
                    }))}
                    varieties={[...new Set((selectedInputLog.stocks || []).map((s: any) => s.variety?.name || 'Unknown'))].join(', ')}
                    canDelete={!selectedInputLog.isClosed && canManage}
                    open={!!selectedInputLog}
                    onOpenChange={(open) => !open && setSelectedInputLog(null)}
                />
            )}

            {/* Output Details Dialog (Standard Packaging Dialog) */}
            {packagingOpenLog && (
                <AddPackagingDialog
                    batchId={packagingOpenLog.id}
                    millingType={packagingOpenLog.millingType}
                    totalInputKg={packagingOpenLog.totalInputKg}
                    isClosed={packagingOpenLog.isClosed}
                    initialOutputs={packagingOpenLog.outputs || []}
                    open={!!packagingOpenLog}
                    onOpenChange={(open) => !open && setPackagingOpenLog(null)}
                    trigger={<></>}
                />
            )}
        </div>
    );
}
