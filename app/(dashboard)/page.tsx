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
            <h2 className="text-lg font-bold">실시간 현황</h2>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : '--:--'} 기준
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                현재 재고량 ({targetYear})
              </p>
              <div>
                <p className="text-xl font-bold text-slate-800">
                  {(stats?.availableStockKg || 0).toLocaleString()}<span className="text-sm font-medium ml-1">kg</span>
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-28">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                현재 생산량 ({currentYear})
              </p>
              <div>
                <p className="text-xl font-bold text-slate-800">
                  {(stats?.totalOutputKg || 0).toLocaleString()}<span className="text-sm font-medium ml-1">kg</span>
                </p>
                <div className="mt-1 text-[10px] text-blue-600 font-bold flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  수율 {stats?.yieldPercentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stock Levels Horizontal Scroll */}
        {/* Stock Levels Vertical List */}
        <section className="bg-white p-3 -mx-4 sm:mx-0 sm:rounded-2xl sm:shadow-sm sm:border sm:border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">품종별 재고 ({targetYear})</h2>
            <Link href="/stocks" className="text-xs text-blue-600 font-semibold px-2 py-1 bg-blue-50 rounded-lg">관리</Link>
          </div>

          <div className="space-y-2">
            {stats?.stockByVariety.map((item: any, idx: number) => {
              const total = stats.availableStockKg || 1;
              const percent = (item._sum.weightKg / total) * 100;
              const colors = [
                { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
                { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
                { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' }
              ];
              const color = colors[idx % colors.length];

              return (
                <div key={item.variety} className={`bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center ${color.text} flex-shrink-0`}>
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">{item.variety}</p>
                      <p className="text-[10px] text-slate-400">{percent.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">{item._sum.weightKg.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">kg</span></p>
                    <div className="w-16 bg-slate-100 h-1 rounded-full mt-1 ml-auto">
                      <div className={`${color.bar} h-full rounded-full`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!stats?.stockByVariety.length && (
              <div className="w-full text-center text-slate-400 text-xs py-6 italic bg-slate-50 rounded-xl">등록된 재고가 없습니다 ({targetYear})</div>
            )}
          </div>
        </section>

        {/* Recent Logs List */}
        <section className="bg-white p-3 -mx-4 sm:mx-0 sm:rounded-2xl sm:shadow-sm sm:border sm:border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">최근 도정 기록</h2>
            <Link href="/milling" className="text-slate-400 p-1 bg-slate-100 rounded-full"><ArrowRight className="w-3 h-3" /></Link>
          </div>

          <div className="space-y-2">
            {stats?.recentLogs.map((log: any) => {
              const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
              const yieldRate = log.totalInputKg > 0 ? ((productionSum / log.totalInputKg) * 100).toFixed(1) : '0.0';
              const isToday = new Date(log.date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }) === new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
              const timeStr = new Date(log.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });

              return (
                <div key={log.id} className={`bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between ${!log.isClosed ? 'border-l-4 border-blue-500' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border ${log.isClosed ? 'bg-slate-50 border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                      <span className={`text-[8px] font-bold leading-none ${log.isClosed ? 'text-slate-400' : 'text-blue-400'}`}>
                        {isToday ? '오늘' : '이전'}
                      </span>
                      <span className={`text-xs font-bold ${log.isClosed ? 'text-slate-700' : 'text-blue-700'}`}>{timeStr}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {log.title} <span className="text-[10px] text-slate-400 font-normal ml-1">{log.totalInputKg.toLocaleString()} kg</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {log.isClosed ? `수율 ${yieldRate}% (백미 ${productionSum.toLocaleString()} kg)` : <span className="text-blue-600 font-medium animate-pulse">현재 작업 진행 중...</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight ${log.isClosed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {log.isClosed ? '완료' : '진행'}
                  </span>
                </div>
              );
            })}
            {!stats?.recentLogs.length && (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-sm">
                기록된 작업이 없습니다.
              </div>
            )}

            <Link href="/milling" className="block w-full mt-4 py-4 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-200 rounded-2xl text-center hover:bg-slate-50 transition-colors">
              이전 도정 기록 더보기
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
