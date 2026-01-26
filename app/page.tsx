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

export default async function Home() {
  const statsResponse = await getDashboardStats();
  const stats = statsResponse.success ? statsResponse.data : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 pb-24">
        {/* Dashboard Summary */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">실시간 현황</h2>
            <span className="text-xs text-slate-400 font-medium">
              {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">현재 재고 (조곡)</p>
              <p className="text-xl font-bold text-slate-800">
                {(stats?.availableStockKg || 0).toLocaleString()}<span className="text-sm font-medium ml-1">kg</span>
              </p>
              <div className="mt-2 text-[10px] text-green-500 font-bold flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" /> 가용 재고
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">금일 생산량</p>
              <p className="text-xl font-bold text-slate-800">
                {(stats?.totalOutputKg || 0).toLocaleString()}<span className="text-sm font-medium ml-1">kg</span>
              </p>
              <div className="mt-2 text-[10px] text-blue-500 font-bold flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1" /> 정상 완료
              </div>
            </div>
          </div>
        </section>

        {/* Stock Levels Horizontal Scroll */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">품목별 재고</h2>
            <Link href="/stocks" className="text-sm text-blue-600 font-semibold">관리</Link>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
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
                <div key={item.variety} className={`flex-shrink-0 w-32 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center border-l-4 ${color.bar.replace('bg-', 'border-')}`}>
                  <div className={`w-10 h-10 rounded-full ${color.bg} flex items-center justify-center ${color.text} mb-2`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{item.variety}</span>
                  <span className="text-[10px] text-slate-400 mt-1">{item._sum.weightKg.toLocaleString()} kg</span>
                  <div className="w-full bg-slate-100 h-1 rounded-full mt-3">
                    <div className={`${color.bar} h-full rounded-full`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
            {!stats?.stockByVariety.length && (
              <div className="w-full text-center text-slate-400 text-xs py-4 bg-white rounded-2xl italic">재고 데이터가 없습니다</div>
            )}
          </div>
        </section>

        {/* Recent Logs List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">최근 도정 기록</h2>
            <Link href="/milling" className="text-slate-400"><ArrowRight className="w-5 h-5" /></Link>
          </div>

          <div className="space-y-3">
            {stats?.recentLogs.map((log: any) => {
              const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
              const yieldRate = log.totalInputKg > 0 ? ((productionSum / log.totalInputKg) * 100).toFixed(1) : '0.0';
              const isToday = new Date(log.date).toDateString() === new Date().toDateString();
              const timeStr = new Date(log.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

              return (
                <div key={log.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between ${!log.isClosed ? 'border-l-4 border-blue-500' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border ${log.isClosed ? 'bg-slate-50 border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                      <span className={`text-[9px] font-bold leading-none ${log.isClosed ? 'text-slate-400' : 'text-blue-400'}`}>
                        {isToday ? '오늘' : '이전'}
                      </span>
                      <span className={`text-sm font-bold ${log.isClosed ? 'text-slate-700' : 'text-blue-700'}`}>{timeStr}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {log.title} <span className="text-[11px] text-slate-400 font-normal ml-1">{log.totalInputKg.toLocaleString()} kg</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {log.isClosed ? `수율 ${yieldRate}% (백미 ${productionSum.toLocaleString()} kg)` : <span className="text-blue-600 font-medium animate-pulse">현재 작업 진행 중...</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight ${log.isClosed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
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

      {/* Floating Action Button (FAB) */}
      <Link href="/milling" className="fixed bottom-24 right-5 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/30 active:scale-95 transition-transform z-30 lg:hidden">
        <Plus className="w-7 h-7" />
      </Link>
    </>
  );
}
