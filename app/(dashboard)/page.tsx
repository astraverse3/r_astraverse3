import Link from "next/link";
import {
  ArrowRight,
  Package,
  ClipboardList,
  Warehouse,
  TrendingUp,
  History,
  Download,
  Plus,
  Clock,
  CheckCircle2,
  MoreHorizontal
} from "lucide-react";
import { getDashboardStats } from "@/app/actions/dashboard";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const statsResponse = await getDashboardStats();
  const stats = statsResponse.success ? statsResponse.data : null;
  const currentYear = stats?.productionYear || new Date().getFullYear();
  const targetYear = stats?.targetYear || new Date().getFullYear();

  return (
    <>
      <div className="grid grid-cols-1 gap-6 pb-24">
        {/* Dashboard Summary */}
        <section className="bg-white -mx-4 sm:mx-0 sm:rounded-3xl shadow-md border-y sm:border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-slate-800 rounded-full inline-block"></span>
              실시간 현황
            </h2>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-slate-200 shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }) : '--:--'} 기준
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between h-auto min-h-[100px] hover:bg-white hover:shadow-sm transition-all duration-300">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                원료곡 재고량 ({targetYear})
              </p>
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {(stats?.availableStockKg || 0).toLocaleString()}<span className="text-base font-bold text-slate-400 ml-1">kg</span>
                </p>
                <div className="mt-1.5 text-xs text-emerald-600 font-bold flex items-center bg-emerald-50 w-fit px-2 py-0.5 rounded-full border border-emerald-100">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  도정 진행률 {(stats?.millingProgressRate || 0).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between h-auto min-h-[100px] hover:bg-white hover:shadow-sm transition-all duration-300">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                도정 생산량 ({currentYear})
              </p>
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {(stats?.totalOutputKg || 0).toLocaleString()}<span className="text-base font-bold text-slate-400 ml-1">kg</span>
                </p>
                <div className="mt-1.5 text-xs text-blue-600 font-bold flex items-center bg-blue-50 w-fit px-2 py-0.5 rounded-full border border-blue-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  평균 수율 {stats?.yieldPercentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stock Levels Grid Layout */}
        <section className="bg-white -mx-4 sm:mx-0 sm:rounded-3xl shadow-md border-y sm:border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-slate-800 rounded-full inline-block"></span>
              품종별 재고 ({targetYear})
            </h2>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats?.stockByVariety.map((item: any, idx: number) => {
                const availableWeight = item.currentWeight;
                const totalVarietyWeight = item.totalWeight;

                // Calculate remaining percentage
                const remainingPercent = totalVarietyWeight > 0
                  ? (availableWeight / totalVarietyWeight) * 100
                  : 0;

                const colorProfiles = [
                  { bar: 'bg-blue-400', bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-700' },
                  { bar: 'bg-amber-400', bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-700' },
                  { bar: 'bg-emerald-400', bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-700' },
                  { bar: 'bg-indigo-400', bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-700' },
                  { bar: 'bg-rose-400', bg: 'bg-rose-50/50', border: 'border-rose-100', text: 'text-rose-700' },
                ];
                const color = colorProfiles[idx % colorProfiles.length];

                return (
                  <div key={item.variety} className={`p-4 rounded-2xl border ${color.border} ${color.bg} transition-all duration-300 hover:shadow-sm`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-base font-black ${color.text} truncate pr-2`}>{item.variety}</span>
                      <span className="text-[10px] font-bold bg-white/80 px-2 py-0.5 rounded-full border border-white shadow-sm text-slate-500">
                        {Math.round(remainingPercent)}% 잔여
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mb-3">
                      <div className="text-xl font-black text-slate-900">
                        {availableWeight.toLocaleString()}
                        <span className="text-xs font-bold text-slate-400 ml-0.5">kg</span>
                      </div>
                      <div className="text-xs font-bold text-slate-400 italic">
                        / {totalVarietyWeight.toLocaleString()}kg
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden border border-white/50">
                      <div
                        className={`${color.bar} h-full rounded-full transition-all duration-700 ease-out shadow-sm`}
                        style={{ width: `${remainingPercent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!stats?.stockByVariety.length && (
              <div className="w-full text-center text-slate-400 text-sm py-12 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">등록된 재고가 없습니다 ({targetYear})</div>
            )}
          </div>
        </section>

        {/* Recent Logs List */}
        <section className="bg-white -mx-4 sm:mx-0 sm:rounded-3xl shadow-md border-y sm:border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-slate-800 rounded-full inline-block"></span>
              최근 도정 기록
            </h2>
            <Link href="/milling" className="text-slate-400 p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm"><ArrowRight className="w-4 h-4" /></Link>
          </div>

          <div className="px-5 pb-5 pt-5 space-y-3">
            {stats?.recentLogs.map((log: any) => {
              const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
              const yieldRate = log.totalInputKg > 0 ? ((productionSum / log.totalInputKg) * 100).toFixed(1) : '0.0';
              const isToday = new Date(log.date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }) === new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
              const timeStr = new Date(log.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });

              const varieties = [...new Set((log.stocks || []).map((s: any) => s.variety))].join(', ');

              return (
                <div key={log.id} className={`bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between ${!log.isClosed ? 'border-l-4 border-blue-500' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border ${log.isClosed ? 'bg-slate-50 border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                      <span className={`text-[10px] font-bold leading-none ${log.isClosed ? 'text-slate-500' : 'text-blue-500'}`}>
                        {isToday ? '오늘' : '이전'}
                      </span>
                      <span className={`text-sm font-bold mt-0.5 ${log.isClosed ? 'text-slate-700' : 'text-blue-700'}`}>{timeStr}</span>
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">
                        {varieties || log.remarks || '미지정'} <span className="text-xs text-slate-500 font-medium ml-1 bg-slate-100 px-1.5 py-0.5 rounded-md">{log.totalInputKg.toLocaleString()} kg</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        {log.isClosed ? `수율 ${yieldRate}% (생산 ${productionSum.toLocaleString()} kg)` : <span className="text-blue-600 font-bold animate-pulse">현재 작업 진행 중...</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${log.isClosed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {log.isClosed ? '완료' : '진행'}
                  </span>
                </div>
              );
            })}
            {!stats?.recentLogs.length && (
              <div className="bg-white p-10 rounded-2xl text-center text-slate-400 text-sm">
                기록된 작업이 없습니다.
              </div>
            )}

            <Link href="/milling" className="block w-full mt-6 py-4 text-slate-500 text-sm font-bold border-2 border-dashed border-slate-200 rounded-2xl text-center hover:bg-slate-50 transition-colors">
              이전 도정 기록 더보기
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
