import Link from "next/link"
import { MobileHeader } from "@/components/mobile-header"
import { MobileNav } from "@/components/mobile-nav"
import {
    LayoutDashboard,
    Package,
    ClipboardList,
    Warehouse,
    Server
} from "lucide-react"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Mobile Header (Fixed Top) */}
            <MobileHeader />

            {/* Desktop Sidebar (Hidden on Mobile) */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 flex-col">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-10 px-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50 flex-shrink-0">
                            <Server className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap overflow-visible">
                                땅끝황토친환경
                            </span>
                            <span className="text-[10px] text-blue-400 font-medium tracking-wider">
                                IMS v2.4
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="px-3 text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Main Menu</p>
                        <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-white bg-slate-800 hover:bg-slate-800 transition-colors">
                            <LayoutDashboard className="w-4 h-4 text-blue-400" />
                            대시보드
                        </Link>
                        <Link href="/stocks" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                            <Package className="w-4 h-4" />
                            입고 관리
                        </Link>
                        <Link href="/milling" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                            <ClipboardList className="w-4 h-4" />
                            도정 공정
                        </Link>
                        <Link href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors opacity-50 cursor-not-allowed">
                            <Warehouse className="w-4 h-4" />
                            재고 현황
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen bg-slate-100 lg:pl-64 pt-16 pb-20 lg:pt-0 lg:pb-0">

                {/* Desktop Header (Hidden on Mobile) */}
                <header className="hidden lg:flex h-14 bg-white border-b border-slate-200 items-center justify-between px-6 z-40">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                        <span className="opacity-50">땅끝황토친환경</span>
                        <span className="opacity-30">/</span>
                        <span>도정관리시스템</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500 font-medium font-mono">
                            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
                        </span>
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <main className="flex-1 w-full">
                    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileNav />
        </>
    );
}
