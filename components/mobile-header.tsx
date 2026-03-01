'use client';

import Link from "next/link"
import { Settings, Users, Wheat, Tractor, LogOut } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function MobileHeader() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === 'ADMIN'

    return (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 h-11 flex items-center justify-between z-40 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
                <img src="/logo-full.png" alt="MILL LOG" className="h-[22px] w-auto object-contain" />
            </Link>

            <DropdownMenu>
                <DropdownMenuTrigger className="p-2 text-slate-400 hover:text-slate-600 focus:outline-none">
                    <Settings className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    {isAdmin ? (
                        <>
                            <DropdownMenuItem asChild>
                                <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer">
                                    <Users className="w-4 h-4 text-slate-500" />
                                    <span>사용자 관리</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/admin/farmers" className="flex items-center gap-2 cursor-pointer">
                                    <Tractor className="w-4 h-4 text-slate-500" />
                                    <span>농가 관리</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/admin/varieties" className="flex items-center gap-2 cursor-pointer">
                                    <Wheat className="w-4 h-4 text-slate-500" />
                                    <span>품종 관리</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    ) : (
                        <div className="px-2 py-1.5 text-xs text-slate-500 text-center">
                            일반 사용자<br />(설정 권한 없음)
                        </div>
                    )}

                    <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                    >
                        <LogOut className="w-4 h-4" />
                        <span>로그아웃</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
