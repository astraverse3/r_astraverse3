'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { closeMillingBatch } from '@/app/actions/milling'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

interface Props {
    batchId: number
}

export function CloseBatchButton({ batchId }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'MILLING_MANAGE')

    const handleClose = async () => {
        if (!confirm('정말 마감하시겠습니까? 마감된 기록은 더 이상 수정할 수 없습니다.')) return

        setIsLoading(true)
        const result = await closeMillingBatch(batchId)
        setIsLoading(false)

        if (!result.success) {
            toast.error(result.error || '마감 실패')
        }
    }

    if (!canManage) return null

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isLoading}
            className="text-stone-400 hover:text-red-600 hover:bg-red-50"
        >
            <Lock className="h-4 w-4 mr-1" /> 마감
        </Button>
    )
}
