'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteVarieties } from '@/app/actions/admin'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'

export function useBulkDeleteVarieties(varieties: { id: number; name: string; aliases: string[] }[] = []) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleBulkDelete = async () => {
        setIsDeleting(true)
        const result = await deleteVarieties(Array.from(selectedIds))
        setIsDeleting(false)
        setShowDeleteDialog(false)

        if (result.success && result.data) {
            const { success, failed } = result.data
            if (success.length > 0) {
                toast.success(`${success.length}개 품종이 삭제되었습니다.`)
            }
            if (failed.length > 0) {
                const lines = failed.map(f => f.reason).join('\n')
                toast.error(`삭제 실패 (${failed.length}개)\n${lines}`)
            }
            triggerDataUpdate()
            setSelectedIds(new Set())
        } else {
            toast.error(result.error || '삭제 실패')
        }
    }

    // 🔴 별칭은 품종 행에 얹혀 있어서 품종을 지우면 같이 사라진다(단건 삭제와 같은 경고)
    const losingAliases = varieties.filter(v => selectedIds.has(v.id) && v.aliases.length > 0)

    const DeleteDialog = () => (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>품종 일괄 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                        선택한 {selectedIds.size}개의 품종을 삭제하시겠습니까?
                        <br /><br />
                        <span className="text-amber-600 font-medium">
                            ⚠️ 재고 · 포장 · 제품유형에 사용된 품종은 삭제되지 않아요.
                        </span>
                        {losingAliases.length > 0 && (
                            <>
                                <br /><br />
                                <span className="text-red-600 font-medium">
                                    🔴 별칭도 함께 사라집니다 —{' '}
                                    {losingAliases.map(v => `${v.name}(${v.aliases.join(', ')})`).join(' · ')}
                                    <br />그 이름으로 오던 발주서 품목이 매칭실패로 돌아갑니다.
                                </span>
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isDeleting ? '삭제 중...' : '삭제'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )

    return {
        selectedIds,
        setSelectedIds,
        showDeleteDialog: () => setShowDeleteDialog(true),
        DeleteDialog
    }
}
