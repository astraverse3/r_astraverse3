import Link from "next/link";
import { ArrowRight, Package, ClipboardList, Warehouse } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto px-4 max-w-4xl py-12 md:py-20">
      <div className="text-center mb-12 md:mb-20">
        <div className="inline-flex items-center justify-center p-3 md:p-4 rounded-3xl bg-primary/5 mb-6 md:mb-8 animate-in fade-in zoom-in duration-700">
          <Warehouse className="w-8 h-8 md:w-12 md:h-12 text-primary" />
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-stone-900 tracking-tight mb-4 md:mb-6 animate-in slide-in-from-bottom duration-700">
          영농조합법인 <br className="md:hidden" />
          <span className="text-gradient">땅끝황토친환경</span>
        </h1>
        <p className="text-stone-500 text-base md:text-xl font-medium max-w-2xl mx-auto leading-relaxed animate-in slide-in-from-bottom duration-1000">
          최고급 유기농 쌀의 수매와 도정, <br className="md:hidden" />
          모든 과정을 투명하고 체계적으로 관리합니다.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-8">
        <Link href="/stocks" className="group">
          <div className="glass rounded-2xl md:rounded-[32px] p-6 md:p-10 border border-white/40 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/5">
            <div className="flex items-center justify-between mb-8 md:mb-12">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                <Package className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-stone-300 transition-all group-hover:text-primary group-hover:translate-x-1" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 mb-2 md:mb-3">입고 관리</h2>
            <p className="text-stone-500 text-sm md:text-base leading-relaxed">
              농가별 수매 현황과 톤백 재고를 <br />
              실시간으로 파악하고 관리합니다.
            </p>
          </div>
        </Link>

        <Link href="/milling" className="group">
          <div className="glass rounded-2xl md:rounded-[32px] p-6 md:p-10 border border-white/40 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/5">
            <div className="flex items-center justify-between mb-8 md:mb-12">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                <ClipboardList className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-stone-300 transition-all group-hover:text-primary group-hover:translate-x-1" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-stone-900 mb-2 md:mb-3">도정 일지</h2>
            <p className="text-stone-500 text-sm md:text-base leading-relaxed">
              도정 작업 계획을 수립하고 <br />
              생산된 규격별 제품 수량을 기록합니다.
            </p>
          </div>
        </Link>
      </div>

      <div className="mt-12 md:mt-20 text-center animate-in fade-in duration-1000 delay-500">
        <p className="text-[10px] md:text-xs font-bold text-stone-300 uppercase tracking-[0.2em] mb-4">
          Core Management System
        </p>
        <div className="h-px w-12 md:w-16 bg-stone-100 mx-auto"></div>
      </div>
    </div>
  );
}
