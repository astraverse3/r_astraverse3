import Link from "next/link"
import { Settings } from "lucide-react"

export function MobileHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 h-16 flex items-center justify-center z-40 lg:hidden">
            <div className="flex items-center gap-2 w-full justify-center relative">
                <img src="/logo-full.png" alt="MILL LOG" className="h-10 w-auto object-contain" />
                <Link href="/admin/varieties" className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">
                    <Settings className="w-5 h-5" />
                </Link>
            </div>
        </header>
    );
}
