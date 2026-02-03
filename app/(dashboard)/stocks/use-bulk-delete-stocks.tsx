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
import { deleteStocks } from '@/app/actions/stock'

export function useBulkDeleteStocks() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleBulkDelete = async () => {
        setIsDeleting(true)
        const result = await deleteStocks(Array.from(selectedIds))
        setIsDeleting(false)
        setShowDeleteDialog(false)

        if (result.success && result.data) {
            const { success, failed } = result.data
            let message = `${success.length}개 재고가 삭제되었습니다.`
            if (failed.length > 0) {
                message += `\n\n삭제 실패 (${failed.length}개):\n${failed.map(f => f.reason).join('\n')}`
            }
            alert(message)
            setSelectedIds(new Set())
        } else {
            alert(result.error || '삭제 실패')
        }
    }

    const DeleteDialog = () => (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>재고 일괄 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                        선택한 {selectedIds.size}개의 재고를 삭제하시겠습니까?
                        <br /><br />
                        <span className="text-amber-600 font-medium">
                            ⚠️ 도정 완료된 재고는 삭제되지 않습니다.
                        </span>
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
