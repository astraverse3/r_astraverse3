import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link"
import { PWAInstallGuard } from "@/components/pwa-install-guard"
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Warehouse,
  FileText,
  PieChart,
  LogOut,
  Search,
  Menu,
  Server
} from "lucide-react"

export const metadata: Metadata = {
  title: "땅끝황토친환경 - 도정 일지",
  description: "영농조합법인 땅끝황토친환경 도정 관리 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "땅끝황토",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex bg-slate-100 font-sans text-slate-900 selection:bg-blue-100 overflow-hidden">
        <PWAInstallGuard>
          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 transform -translate-x-full lg:translate-x-0 transition-transform duration-300 flex flex-col">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
                  <Server className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">IMS <span className="text-blue-400 text-xs font-normal">v2.4</span></span>
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

                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase mt-8 mb-2 tracking-wider">Reports</p>
                <Link href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors opacity-50 cursor-not-allowed">
                  <FileText className="w-4 h-4" />
                  일일 보고서
                </Link>
                <Link href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors opacity-50 cursor-not-allowed">
                  <PieChart className="w-4 h-4" />
                  통계 분석
                </Link>
              </div>
            </div>

            <div className="mt-auto p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold ring-2 ring-slate-800">AD</div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold truncate text-slate-200">관리자(Admin)</p>
                  <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                  </p>
                </div>
                <button className="text-slate-500 hover:text-white transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 lg:pl-64 h-screen overflow-hidden bg-slate-50 transition-all duration-300">
            {/* Top Header */}
            <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 z-40">
              <div className="flex items-center gap-4">
                <button className="lg:hidden text-slate-500">
                  <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span className="opacity-50">시스템</span>
                  <span className="opacity-30">/</span>
                  <span>대시보드</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative hidden sm:block group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="검색어를 입력하세요..."
                    className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-xs w-64 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  />
                </div>
                <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
                <span className="text-xs text-slate-500 font-medium font-mono hidden sm:block">
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
                </span>
              </div>
            </header>

            {/* Page Content Scroll Area */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
              <div className="max-w-7xl mx-auto space-y-6">
                {children}
              </div>
            </main>
          </div>
        </PWAInstallGuard>
      </body>
    </html>
  );
}
