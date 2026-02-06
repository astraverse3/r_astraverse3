'use client'

import { Loader2 } from 'lucide-react'

interface FullScreenLoaderProps {
    message?: string
}

export function FullScreenLoader({ message = '데이터 처리 중입니다...' }: FullScreenLoaderProps) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4 max-w-sm w-full mx-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <div className="text-center space-y-1">
                    <p className="font-bold text-lg text-slate-900">{message}</p>
                    <p className="text-sm text-slate-500">페이지를 닫거나 이동하지 마세요.</p>
                </div>
            </div>
        </div>
    )
}
