import Link from "next/link";
import { ArrowRight, Package, ClipboardList, Warehouse, TrendingUp, History } from "lucide-react";
import { getDashboardStats } from "@/app/actions/dashboard";

export default async function Home() {
  const statsResponse = await getDashboardStats();
  const stats = statsResponse.success ? statsResponse.data : null;

  return (
    <div className="container mx-auto px-4 max-w-5xl py-8 md:py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/5 mb-4 animate-in fade-in zoom-in duration-700">
          <Warehouse className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-stone-900 tracking-tight mb-2 animate-in slide-in-from-bottom duration-700">
          영농조합법인 <span className="text-gradient">땅끝황토친환경</span>
        </h1>
        <p className="text-stone-500 text-sm md:text-base font-medium animate-in slide-in-from-bottom duration-1000">
          실시간 도정 현항 및 재고 대시보드
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <div className="glass p-6 rounded-2xl border border-white/40 shadow-sm">
          <div className="flex items-center gap-3 text-stone-400 mb-3">
            <Warehouse className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">현재 가용 재고</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-stone-900">{(stats?.availableStockKg || 0).toLocaleString()}</span>
            <span className="text-sm font-bold text-stone-400">kg</span>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl border border-white/40 shadow-sm">
          <div className="flex items-center gap-3 text-stone-400 mb-3">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">총 누적 생산량</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-stone-900">{(stats?.totalOutputKg || 0).toLocaleString()}</span>
            <span className="text-sm font-bold text-stone-400">kg</span>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl border border-white/40 shadow-sm">
          <div className="flex items-center gap-3 text-stone-400 mb-3">
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">누적 도정 횟수</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-stone-900">{(stats?.totalBatches || 0).toLocaleString()}</span>
            <span className="text-sm font-bold text-stone-400">회</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Navigation Links */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] px-2 mb-4 flex items-center gap-2">
            Quick Actions
          </h3>
          <Link href="/stocks" className="block group">
            <div className="glass p-5 rounded-2xl border border-white/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <Package className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-stone-900">입고 관리</div>
                <div className="text-[11px] text-stone-400">톤백 재고 및 현황</div>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
          <Link href="/milling" className="block group">
            <div className="glass p-5 rounded-2xl border border-white/40 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-stone-900">도정 일지</div>
                <div className="text-[11px] text-stone-400">작업 등록 및 생산기록</div>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        </div>

        {/* Recent Logs Table */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between px-2 mb-4">
            <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <History className="w-3 h-3" />
              최근 도정 내역
            </h3>
            <Link href="/milling" className="text-[10px] font-bold text-stone-400 hover:text-primary transition-colors flex items-center gap-1">
              전체보기 <ArrowRight className="w-2 h-2" />
            </Link>
          </div>

          <div className="glass rounded-2xl border border-white/40 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="px-4 py-3 font-bold text-stone-400">날짜</th>
                  <th className="px-4 py-3 font-bold text-stone-400">작업명</th>
                  <th className="px-4 py-3 font-bold text-stone-400 text-right">투입(kg)</th>
                  <th className="px-4 py-3 font-bold text-stone-400 text-right">생산(kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {stats?.recentLogs.map((log: any) => {
                  const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
                  return (
                    <tr key={log.id} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-4 py-4 text-stone-500 font-medium">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-stone-900">{log.title}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-stone-600">
                        {log.totalInputKg.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-primary">{productionSum.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
                {!stats?.recentLogs.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-stone-400 font-medium italic">
                      진행된 도정 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
