import Link from "next/link";
import {
  ArrowRight,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { getDashboardStats } from "@/app/actions/dashboard";
import { RealtimeStatus } from "@/app/(dashboard)/_components/realtime-status";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const statsResponse = await getDashboardStats();
  const stats = statsResponse.success ? statsResponse.data : null;
  const currentYear = stats?.productionYear || new Date().getFullYear();
  const targetYear = stats?.targetYear || new Date().getFullYear();

  return (
    <>
      <div className="flex flex-col gap-3 pb-12 max-w-[1400px] mx-auto w-full px-2 sm:px-4 lg:px-6">
        {/* Remove the wrapper for RealtimeStatus as it handles its own card containers now */}
        <RealtimeStatus
          availableStock={stats?.availableStockKg || 0}
          totalStock={stats?.totalStockKg || 0}
          millingProgress={stats?.millingProgressRate || 0}
          totalOutput={stats?.totalOutputKg || 0}
          outputsByType={stats?.outputsByType || { uruchi: 0, glutinous: 0, indica: 0, others: 0 }}
          yields={{ uruchi: stats?.uruchiYield || 0, indica: stats?.indicaYield || 0, glutinous: stats?.glutinousYield || 0 }}
          years={{ target: stats?.targetYear || currentYear, current: currentYear }}
        />

        {/* 2-Column Layout for Desktop (Logs & Inventory) */}
        {/* Adjusted to 7:3 ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 items-stretch">

          {/* Left Column: Recent Logs List (Max 7) */}
          <section className="bg-white sm:rounded-[24px] shadow-sm border border-slate-100 p-5 sm:p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <h2 className="text-base font-bold text-slate-800 font-sans">
                최근 도정 내역
              </h2>
              <Link href="/milling" className="text-slate-400 p-1.5 hover:bg-slate-50 transition-colors rounded-full"><ArrowRight className="w-4 h-4" /></Link>
            </div>

            <div className="w-full">
              {/* Table Header - Styled */}
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/80 rounded-lg py-2.5 px-3 mb-1 uppercase tracking-wider">
                <div className="w-[14%]">등록일자</div>
                <div className="w-[26%]">품종 및 분류</div>
                <div className="w-[15%] text-right">투입량</div>
                <div className="w-[15%] text-right">생산량</div>
                <div className="w-[15%] text-right">수율</div>
                <div className="w-[15%] text-right px-2">상태</div>
              </div>

              {/* Table Body */}
              <div className="flex flex-col">
                {stats?.recentLogs.slice(0, 10).map((log: any) => {
                  const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
                  const yieldRate = log.totalInputKg > 0 ? (productionSum / log.totalInputKg) * 100 : 0;
                  const dateStr = format(new Date(log.date), 'yyyy-MM-dd');

                  const varietyNames = Array.from(new Set((log.stocks || []).map((s: any) => s.variety?.name).filter(Boolean))) as string[];
                  const varietySummary = varietyNames.length > 1
                    ? `${varietyNames[0]} 외 ${varietyNames.length - 1}종`
                    : varietyNames[0] || '-';

                  return (
                    <div key={log.id} className="flex items-center justify-between py-2 px-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                      {/* Date */}
                      <div className="w-[14%] text-[13px] font-semibold text-slate-500">
                        {dateStr}
                      </div>
                      {/* Variety & Type */}
                      <div className="w-[26%] flex items-center gap-2 pr-2">
                        <span className="font-bold text-slate-800 text-[13px] truncate">{varietySummary}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 whitespace-nowrap">{log.millingType}</span>
                      </div>
                      {/* Input */}
                      <div className="w-[15%] text-[13px] font-semibold text-slate-600 text-right">
                        {log.totalInputKg.toLocaleString()} <span className="text-[11px] text-slate-400 ml-0.5">kg</span>
                      </div>
                      {/* Output */}
                      <div className="w-[15%] text-[13px] font-black text-slate-800 text-right">
                        {log.isClosed ? (
                          <>{productionSum.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold ml-0.5">kg</span></>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>
                      {/* Yield */}
                      <div className="w-[15%] text-[13px] font-black text-slate-800 text-right">
                        {log.isClosed ? (
                          <span className="text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-md">{(Math.round(yieldRate * 10) / 10).toFixed(1)}%</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>
                      {/* Status */}
                      <div className="w-[15%] text-right px-2 flex justify-end">
                        {log.isClosed ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full whitespace-nowrap border border-emerald-100/50">완료</span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full whitespace-nowrap border border-amber-100/50">진행중</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!stats?.recentLogs.length && (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    기록된 작업이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right Column: All Variety Stock */}
          <section className="bg-white sm:rounded-[24px] shadow-sm border border-slate-100 p-5 sm:p-6 h-full flex flex-col">
            <div className="mb-4 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-slate-800 font-sans">
                품종별 재고 비율 & 백미수율
              </h2>
            </div>

            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-y-auto pr-2 pb-2 -mr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="flex flex-col gap-4">
                  {stats?.stockByVariety.map((item: any) => {
                    const availableWeight = item.currentWeight;
                    const totalWeight = item.totalWeight || 1;
                    const relativePercent = (availableWeight / totalWeight) * 100;

                    return (
                      <div key={item.variety} className="flex flex-row items-center gap-4 group shrink-0">
                        {/* Left: Stock Bar (Flex-1) */}
                        <div className="flex flex-col gap-1.5 flex-1">
                          <div className="flex flex-row justify-between items-end">
                            <span className="text-[13px] font-bold text-slate-700 truncate pr-2">{item.variety}</span>
                            <div className="flex flex-row items-baseline gap-1 shrink-0">
                              <span className="text-[13px] font-black text-slate-800">{availableWeight.toLocaleString()}</span>
                              <span className="text-[11px] font-bold text-slate-400">kg</span>
                            </div>
                          </div>

                          {/* Simple Progress Bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#2B6CB0] h-full rounded-full transition-all duration-700 ease-out opacity-90 group-hover:opacity-100"
                              style={{ width: `${Math.min(relativePercent, 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Right: Yield Badge (Fixed width) */}
                        <div className="shrink-0 w-[52px]">
                          {item.yieldRate > 0 ? (
                            <div className="bg-blue-50/80 px-2 py-1.5 rounded-lg flex flex-col items-center justify-center border border-blue-100/50 h-[38px]">
                              <span className="text-[12px] font-black text-blue-600 leading-none">{(Math.round(item.yieldRate * 10) / 10).toFixed(1)}%</span>
                            </div>
                          ) : (
                            <div className="bg-slate-50/80 px-2 py-1.5 rounded-lg flex flex-col items-center justify-center border border-slate-100/50 h-[38px]">
                              <span className="text-[11px] font-bold text-slate-400 leading-none uppercase">-</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!stats?.stockByVariety.length && (
                    <div className="w-full text-center text-slate-400 text-sm py-12 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      등록된 재고가 없습니다 ({targetYear})
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
