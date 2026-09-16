import { MobileHeader } from "@/components/mobile-header"
import { MobileNav } from "@/components/mobile-nav"
import { NavTrace } from "@/components/nav-trace"
import { DesktopSidebar } from "@/components/desktop-sidebar"
import { BreadcrumbDisplay } from "@/components/breadcrumb-display"
import { HeaderUserProfile } from "@/components/header/header-user-profile"
import { MillingCartProvider } from "./raw-stocks/milling-cart-context"
import { LastUpdated } from "@/components/last-updated"
import { YieldRatesProvider } from "./yield-rates-context"
import { getYieldRates } from "@/app/actions/settings"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 도정구분별 수율 기준값 — 소비 화면(대시보드·도정목록·통계)이 모두 이 그룹 안이라
    // 여기서 한 번만 읽어 내려준다. middleware가 전 경로를 막고 있어 세션은 보장된다.
    const yieldRates = await getYieldRates();

    return (
        <>
            <YieldRatesProvider rates={yieldRates}>
            <MillingCartProvider>
                {/* Mobile Header (Fixed Top) */}
                <MobileHeader />

                {/* Desktop Sidebar (Hidden on Mobile) */}
                <DesktopSidebar />

                {/* Main Content Area */}
                {/* pb = nav h-[60px] + mb-4(16px) + env(safe) + 8px breathing = 84px + safe (mobile-nav.tsx와 동기화) */}
                <div className="flex-1 flex flex-col min-h-screen bg-transparent lg:pl-64 pt-[44px] pb-[calc(60px+env(safe-area-inset-bottom)+1.5rem)] lg:pt-0 lg:pb-0">

                    {/* Desktop Header (Hidden on Mobile) — handoff.md §3.3: h-12 1줄 브레드크럼 */}
                    <header className="hidden lg:flex h-12 bg-white border-b border-slate-200 items-center justify-between gap-4 px-6 z-40">
                        <BreadcrumbDisplay />
                        <HeaderUserProfile />
                    </header>

                    {/* Scrollable Page Content */}
                    <main className="flex-1 w-full flex flex-col">
                        <div className="w-full px-0 pt-1.5 pb-0 sm:px-6 sm:pt-6 sm:pb-8 flex-1 flex flex-col">
                            {children}

                            {/* Bottom Right Update Timestamp (Desktop flow) */}
                            <div className="hidden md:flex justify-end pt-4 pb-4">
                                <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-200/50 inline-block">
                                    <LastUpdated />
                                </div>
                            </div>
                        </div>
                    </main>
                </div>

                {/* Mobile Bottom Navigation */}
                <MobileNav />

                {/* 네비게이션 덫 — UI 없음. 원인 확정 후 제거(plan-네비게이션-덫.md §7) */}
                <NavTrace />
            </MillingCartProvider>
            </YieldRatesProvider>
        </>
    );
}
