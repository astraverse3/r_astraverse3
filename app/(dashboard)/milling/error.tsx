'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Milling Page Error:', error)
    }, [error])

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
            <h2 className="text-xl font-semibold">도정 내역을 불러오는 중 오류가 발생했습니다.</h2>
            <p className="text-sm text-slate-500 max-w-md text-center">
                {error.message || '알 수 없는 오류가 발생했습니다.'}
            </p>
            {error.digest && (
                <p className="text-xs text-slate-400 font-mono">Digest: {error.digest}</p>
            )}
            <div className="flex gap-2">
                <Button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                >
                    다시 시도
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    새로고침
                </Button>
            </div>
        </div>
    )
}
