import { Wheat, Sprout } from 'lucide-react'

export function ComingSoonPanel({ category }: { category: '벼' | '잡곡' }) {
    const Icon = category === '벼' ? Wheat : Sprout

    return (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-slate-400" strokeWidth={1.8} />
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">{category} 판매관리</h2>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                곧 제공될 기능이에요. 현재는 <span className="font-medium text-slate-700">출고 탭</span>에서 대량판매·출고 내역을 관리할 수 있어요.
            </p>
        </div>
    )
}
