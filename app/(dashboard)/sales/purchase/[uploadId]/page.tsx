import { notFound } from 'next/navigation'
import { getUploadMatrix } from '@/app/actions/purchase-order-matrix'
import { MatrixClient } from './matrix-client'

// 발주서 매트릭스 화면 (계획서 D2b)
//
// 묶음(시트 1장)을 발주서 원본 그대로의 2D 피벗으로 펼친다.
// 조회는 서버에서 한 번에 끝내고(`getUploadMatrix`), 피벗·정렬·차감 후 갱신은 클라이언트가 맡는다 —
// 전부 순수 계산이라 서버를 다시 왕복할 이유가 없다(Neon 왕복 ~200ms, D2c 결정 C).

export default async function PurchaseMatrixPage({
    params,
}: {
    params: Promise<{ uploadId: string }>
}) {
    const { uploadId } = await params
    const id = Number(uploadId)
    if (!Number.isInteger(id) || id <= 0) notFound()

    const result = await getUploadMatrix(id)

    if (!result.success) {
        return (
            <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-200 bg-card px-5 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">{result.error}</p>
                </div>
            </div>
        )
    }

    return <MatrixClient header={result.header} input={result.input} />
}
