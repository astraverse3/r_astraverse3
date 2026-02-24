'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import { importStocks, exportStocks } from '@/app/actions/stock-excel'
import { formatImportResult, ExcelImportResult } from '@/lib/excel-utils'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FullScreenLoader } from '@/components/ui/full-screen-loader'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/permissions'

export function StockExcelButtons({ filters }: { filters?: any }) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [importing, setImporting] = useState(false)
    const [exporting, setExporting] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'STOCK_MANAGE')

    // Preview State
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewResult, setPreviewResult] = useState<ExcelImportResult | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleExport = async () => {
        setExporting(true)
        const result = await exportStocks(filters)

        if (result.success && result.daa) {
            const base64Data = result.daa
            const link = document.createElement('a')
            link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64Data}`
            link.download = result.fileName || 'stocks.xlsx'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } else {
            toast.error(result.error)
        }
        setExporting(false)
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setSelectedFile(file)
        setImporting(true)

        // 1. Dry Run (Preview)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const result = await importStocks(formData, { dryRun: true })
            setPreviewResult(result)
            setPreviewOpen(true)
        } catch (error) {
            toast.error('파일 분석 중 오류가 발생했습니다.')
            if (fileInputRef.current) fileInputRef.current.value = ''
        } finally {
            setImporting(false)
        }
    }

    const handleConfirmUpload = async () => {
        if (!selectedFile) return

        setImporting(true) // Show loading
        setPreviewOpen(false) // Close preview

        const formData = new FormData()
        formData.append('file', selectedFile)

        try {
            // 2. Actual Import (Commit)
            const result = await importStocks(formData, { dryRun: false })

            if (result.success) {
                toast.success(formatImportResult(result))
            } else {
                toast.error(result.message || '업로드에 실패했습니다.')
            }
        } catch (e) {
            toast.error('업로드 중 오류가 발생했습니다.')
        } finally {
            setImporting(false)
            setSelectedFile(null)
            setPreviewResult(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleCancelPreview = () => {
        setPreviewOpen(false)
        setSelectedFile(null)
        setPreviewResult(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // Navigation Guard (Prevent Tab Close)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (importing || exporting) {
                e.preventDefault()
                e.returnValue = '' // Chrome requires returnValue to be set
                return ''
            }
        }

        if (importing || exporting) {
            window.addEventListener('beforeunload', handleBeforeUnload)
        }

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [importing, exporting])

    return (
        <>
            {(importing || exporting) && <FullScreenLoader message={importing ? "데이터 업로드 및 분석 중..." : "데이터 다운로드 중..."} />}

            <div className="flex gap-1 items-center">
                {canManage && (
                    <>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".xlsx, .xls"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-400 transition-colors"
                            onClick={handleImportClick}
                            disabled={importing}
                            title="엑셀 등록"
                        >
                            <Upload className="w-4 h-4" />
                        </Button>
                    </>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-slate-200 bg-slate-50 text-slate-500 hover:bg-green-100 hover:text-green-700 hover:border-green-400 transition-colors"
                    onClick={handleExport}
                    disabled={exporting}
                    title="엑셀 다운로드"
                >
                    <Download className="w-4 h-4" />
                </Button>
            </div>

            {/* Preview Dialog */}
            <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <AlertDialogContent className="max-w-[500px] max-h-[80vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>엑셀 업로드 미리보기</AlertDialogTitle>
                        <AlertDialogDescription asChild className="space-y-4 pt-2">
                            <div>
                                {previewResult && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-3 rounded-lg">
                                            <div>
                                                <div className="text-xs text-slate-500">총 데이터</div>
                                                <div className="font-bold">{previewResult.counts.total}건</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-green-600">등록 가능</div>
                                                <div className="font-bold text-green-700">{previewResult.counts.success}건</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-amber-500">누락/제외</div>
                                                <div className="font-bold text-amber-600">{previewResult.counts.skipped}건</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-red-500">오류</div>
                                                <div className="font-bold text-red-600">{previewResult.counts.failed}건</div>
                                            </div>
                                        </div>

                                        {(previewResult.counts.skipped > 0 || previewResult.counts.failed > 0) && (
                                            <div className="bg-red-50 border border-red-100 rounded-md p-3 text-xs space-y-2">
                                                <p className="font-bold text-red-700 mb-1">⚠️ 다음 데이터는 등록되지 않습니다:</p>
                                                <ul className="list-disc pl-4 space-y-1 text-red-600 max-h-[150px] overflow-y-auto">
                                                    {previewResult.errors.map((err, idx) => (
                                                        <li key={idx}>[{err.row}행] {err.reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="text-sm font-medium text-slate-700 text-center">
                                            {previewResult.counts.success > 0
                                                ? `${previewResult.counts.success}건의 데이터를 등록하시겠습니까?`
                                                : "등록할 수 있는 데이터가 없습니다."
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancelPreview}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmUpload}
                            disabled={!previewResult || previewResult.counts.success === 0}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {previewResult && (previewResult.counts.skipped > 0 || previewResult.counts.failed > 0)
                                ? '오류 제외하고 등록'
                                : '등록'
                            }
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

