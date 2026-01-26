import { getStocks } from '@/app/actions/stock'
import { AddMillingLogForm } from '../add-form'
import { prisma } from '@/lib/prisma'

export default async function NewMillingPage() {
    // Fetch available stocks directly or via action
    const stocksResult = await getStocks()
    const availableStocks = stocksResult.success && stocksResult.data
        ? stocksResult.data.filter((s: any) => s.status === 'AVAILABLE')
        : []

    return (
        <div className="container mx-auto py-10 space-y-6 px-4">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-stone-900">새 도정 작업 시작</h1>
                <p className="text-stone-500">도정에 투입할 원료곡(벼) 톤백을 선택해 주세요.</p>
            </div>

            <AddMillingLogForm availableStocks={availableStocks} />
        </div>
    )
}
