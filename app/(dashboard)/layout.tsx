import { MobileHeader } from "@/components/mobile-header"
import { MobileNav } from "@/components/mobile-nav"
import { DesktopSidebar } from "@/components/desktop-sidebar"

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
            <DesktopSidebar />

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
