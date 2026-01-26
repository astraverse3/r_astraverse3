'use client';

export function MobileHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-center z-40 lg:hidden">
            <div className="flex items-center gap-2 w-full justify-center">
                <img src="/logo-full.png" alt="MILL LOG" className="h-10 w-auto object-contain" />
            </div>
        </header>
    );
}
