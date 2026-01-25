'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteStock } from '@/app/actions/stock'

interface Props {
    stockId: number
    stockTitle: string
    isConsumed: boolean
}

export function DeleteStockButton({ stockId, stockTitle, isConsumed }: Props) {
    const [isLoading, setIsLoading] = useState(false)

    const handleDelete = async () => {
        let message = `[${stockTitle}] 정보를 정말 삭제하시겠습니까?`
        if (isConsumed) {
            message = `[${stockTitle}]는 이미 도정 작업에 사용되었습니다. 삭제하면 도정 일지의 투입 데이터와 불일치가 발생할 수 있습니다. 그래도 삭제하시겠습니까?`
        }

        if (!confirm(message)) return

        setIsLoading(true)
        const result = await deleteStock(stockId)
        setIsLoading(false)

        if (!result.success) {
            alert('삭제 실패: ' + result.error)
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isLoading || isConsumed}
            className={`h-8 w-8 ${isConsumed ? 'text-stone-200 cursor-not-allowed' : 'text-stone-400 hover:text-red-600 hover:bg-red-50'}`}
            title={isConsumed ? '도정 완료된 데이터는 삭제할 수 없습니다.' : '삭제'}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    )
}
