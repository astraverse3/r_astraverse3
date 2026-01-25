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
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">운영 현황 대시보드</h1>
          <p className="text-xs text-slate-500 mt-1">실시간 원료곡 재고 및 공정 진행 상태를 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center shadow-sm">
            <Download className="w-3 h-3 mr-1" /> 엑셀 내보내기
          </button>
          <Link href="/stocks" className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-700 shadow-sm transition-colors flex items-center">
            <Plus className="w-3 h-3 mr-1" /> 입고 신규 등록
          </Link>
        </div>
      </div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Stock */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">총 원료곡 재고</span>
            <Warehouse className="w-4 h-4" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-800">{(stats?.availableStockKg || 0).toLocaleString()}</span>
            <span className="text-sm text-slate-500 font-medium pb-1">kg</span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 가용 재고
          </div>
        </div>

        {/* Total Output */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">누적 생산량</span>
            <Package className="w-4 h-4" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-800">{(stats?.totalOutputKg || 0).toLocaleString()}</span>
            <span className="text-sm text-slate-500 font-medium pb-1">kg</span>
          </div>
          <div className="mt-2 text-[10px] text-blue-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 정상 생산 완료
          </div>
        </div>

        {/* Milling Batches */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">도정 작업 횟수</span>
            <ClipboardList className="w-4 h-4" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-800">{(stats?.totalBatches || 0).toLocaleString()}</span>
            <span className="text-sm text-slate-500 font-medium pb-1">회</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-medium">
            최근 작업: {stats?.recentLogs[0] ? new Date(stats.recentLogs[0].date).toLocaleDateString() : '-'}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2 text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">시스템 상태</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-emerald-600">Normal</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 font-medium uppercase">
            Last Sync: {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Variety Statistics Section */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Stock by Variety Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">품종별 재고 현황</h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-500 font-semibold">
                <tr>
                  <th className="px-5 py-2">품종명</th>
                  <th className="px-5 py-2 text-right">보유량 (kg)</th>
                  <th className="px-5 py-2 text-right">비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {stats?.stockByVariety.map((item: any, idx: number) => {
                  const percent = stats.availableStockKg > 0 ? (item._sum.weightKg / stats.availableStockKg) * 100 : 0;
                  return (
                    <tr key={item.variety} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                        {item.variety}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        {item._sum.weightKg.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {percent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                {!stats?.stockByVariety.length && (
                  <tr><td colSpan={3} className="px-5 py-4 text-center text-slate-400 italic">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Milled by Variety Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">품종별 도정 투입 현황 (누적)</h3>
          </div>
          <div className="p-0">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-500 font-semibold">
                <tr>
                  <th className="px-5 py-2">품종명</th>
                  <th className="px-5 py-2 text-right">투입량 (kg)</th>
                  <th className="px-5 py-2 text-right">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {stats?.milledByVariety.map((item: any, idx: number) => (
                  <tr key={item.variety} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-700 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                      {item.variety}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">
                      {item._sum.weightKg.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                        Process
                      </span>
                    </td>
                  </tr>
                ))}
                {!stats?.milledByVariety.length && (
                  <tr><td colSpan={3} className="px-5 py-4 text-center text-slate-400 italic">데이터 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Logs Table (Main Data Card) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-800 italic">LATEST <span className="text-blue-600">MILLING LOGS</span></h3>
          <div className="flex gap-2">
            <Link href="/milling" className="text-xs text-slate-500 hover:text-blue-600 font-medium flex items-center gap-1 transition-colors">
              전체 보기 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b-2 border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">작업 ID</th>
                <th className="px-5 py-3">작업일자</th>
                <th className="px-5 py-3">작업명 (Title)</th>
                <th className="px-5 py-3 text-right">투입 중량(kg)</th>
                <th className="px-5 py-3 text-right">생산 중량(kg)</th>
                <th className="px-5 py-3 text-center">상태</th>
                <th className="px-5 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100">
              {stats?.recentLogs.map((log: any) => {
                const productionSum = log.outputs.reduce((sum: number, out: any) => sum + out.totalWeight, 0);
                // Calculate yield rate roughly for status pill
                const yieldRate = log.totalInputKg > 0 ? (productionSum / log.totalInputKg) * 100 : 0;

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-4 font-mono font-bold text-slate-400">#{log.id.toString().padStart(4, '0')}</td>
                    <td className="px-5 py-4 text-slate-600 font-medium">
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-800">
                      {log.title}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-600">
                      {log.totalInputKg.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {productionSum.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold border ${log.isClosed ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {log.isClosed ? '마감완료' : '진행중'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button className="text-slate-400 hover:text-blue-600 transition-colors p-1 hover:bg-slate-100 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!stats?.recentLogs.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium italic">
                    등록된 도정 작업이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
          <span>Showing {stats?.recentLogs.length || 0} recent items</span>
          <div className="flex gap-1 opacity-50 cursor-not-allowed">
            <button className="w-6 h-6 flex items-center justify-center border rounded bg-white hover:bg-slate-50">1</button>
            <button className="w-6 h-6 flex items-center justify-center border rounded bg-white hover:bg-slate-50">2</button>
          </div>
        </div>
      </div>
    </>
  );
}
