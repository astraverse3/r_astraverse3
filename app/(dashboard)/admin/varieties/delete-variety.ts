'use client'

// 품종 단건 삭제 — 확인 다이얼로그 + 액션 호출을 한 벌로 묶는다.
//
// 🔴 별칭 동반 소멸 경고(883cd43)가 여기 들어 있다. 수정 다이얼로그 푸터의 삭제 버튼과
//    목록 행 ⋯ 메뉴의 삭제가 **같은 함수**를 부르게 해서 경고 문구가 두 벌이 되지 않게 한다.
//    (2026-09-16 행 메뉴 도입 전까지 경고 없는 옛 `delete-button.tsx`가 죽은 채 남아 있었다)

import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { deleteVariety } from '@/app/actions/admin'
import { triggerDataUpdate } from '@/components/last-updated'

export interface DeletableVariety {
    id: number
    name: string
    aliases?: string[]
}

/** 확인 → 삭제. 실제로 지웠으면 true. 호출부가 `router.refresh()`를 맡는다. */
export async function confirmAndDeleteVariety(variety: DeletableVariety): Promise<boolean> {
    // 🔴 별칭은 품종 행에 얹혀 있어서 품종을 지우면 같이 사라진다.
    //    그 이름으로 오던 발주서 품목은 다음 업로드부터 조용히 매칭실패가 된다.
    //    겁을 주는 게 목적이 아니라 **무엇이 같이 사라지는지** 알려 주는 게 목적이다.
    const saved = variety.aliases ?? []
    const description = saved.length > 0
        ? `「${variety.name}」 품종을 삭제할까요?\n\n별칭 ${saved.length}개(${saved.join(', ')})도 함께 사라져요.\n그 이름으로 들어오던 발주서 품목은 다음부터 품종을 다시 이어 줘야 해요.`
        : `「${variety.name}」 품종을 삭제할까요?`

    const ok = await confirmDialog({
        title: '품종 삭제',
        description,
        destructive: true,
        confirmText: '삭제',
    })
    if (!ok) return false

    const result = await deleteVariety(variety.id)
    if (!result.success) {
        toast.error(result.error || '삭제하지 못했어요.')
        return false
    }

    triggerDataUpdate()
    return true
}
