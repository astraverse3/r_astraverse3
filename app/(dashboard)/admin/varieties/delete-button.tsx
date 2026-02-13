'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteVariety } from '@/app/actions/admin'
import { toast } from 'sonner'

export function DeleteVarietyButton({ id }: { id: number }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm('정말 이 품종을 삭제하시겠습니까?')) return

        setLoading(true)
        const result = await deleteVariety(id)
        if (result.success) {
            router.refresh()
        } else {
            toast.error(result.error || '삭제에 실패했습니다.')
        }
        setLoading(false)
    }

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
            title="삭제"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    )
}
