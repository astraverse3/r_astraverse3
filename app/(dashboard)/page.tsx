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
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">실시간 현황</h2>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }) : '--:--'} 기준
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-auto min-h-[100px]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                현재 재고량 ({targetYear})
              </p>
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-slate-900">
                  {(stats?.availableStockKg || 0).toLocaleString()}<span className="text-base font-bold text-slate-500 ml-1">kg</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-auto min-h-[100px]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                현재 생산량 ({currentYear})
              </p>
              <div className="mt-2">
                <p className="text-3xl font-extrabold text-slate-900">
                  {(stats?.totalOutputKg || 0).toLocaleString()}<span className="text-base font-bold text-slate-500 ml-1">kg</span>
                </p>
                <div className="mt-1 text-xs text-blue-600 font-bold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  수율 {stats?.yieldPercentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stock Levels Vertical List */}
        <section className="bg-white p-5 -mx-4 sm:mx-0 sm:rounded-3xl sm:shadow-md sm:border sm:border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">품종별 재고 ({targetYear})</h2>
          </div>

          <div className="flex flex-col">
            {stats?.stockByVariety.map((item: any, idx: number) => {
              const availableWeight = item.currentWeight;
              const totalVarietyWeight = item.totalWeight;

              // Calculate remaining percentage
              const remainingPercent = totalVarietyWeight > 0
                ? (availableWeight / totalVarietyWeight) * 100
                : 0;

              const colors = [
                { bar: 'bg-blue-300' },
                { bar: 'bg-amber-300' },
                { bar: 'bg-emerald-300' }
              ];
              const color = colors[idx % colors.length];

              return (
                <div key={item.variety} className="flex flex-col py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base font-bold text-slate-700">{item.variety}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-slate-900">{availableWeight.toLocaleString()}</span>
                      <span className="text-sm font-medium text-slate-400 mx-1">/</span>
                      <span className="text-sm font-bold text-slate-500">{totalVarietyWeight.toLocaleString()}</span>
                      <span className="text-xs font-medium text-slate-400 ml-0.5">kg</span>
                    </div>
                  </div>
                  {/* Progress Bar (Remaining Ratio) */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${color.bar} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${remainingPercent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {!stats?.stockByVariety.length && (
              <div className="w-full text-center text-slate-400 text-sm py-8 italic bg-slate-50 rounded-2xl">등록된 재고가 없습니다 ({targetYear})</div>
            )}
          </div>
        </section>

        {/* Recent Logs List */}
        <section className="bg-white p-5 -mx-4 sm:mx-0 sm:rounded-3xl sm:shadow-md sm:border sm:border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-slate-800">최근 도정 기록</h2>
            <Link href="/milling" className="text-slate-400 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><ArrowRight className="w-4 h-4" /></Link>
          </div>

          <div className="space-y-3">
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
                        {varieties || log.title || '미지정'} <span className="text-xs text-slate-500 font-medium ml-1 bg-slate-100 px-1.5 py-0.5 rounded-md">{log.totalInputKg.toLocaleString()} kg</span>
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
