'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Lock, Package, AlertCircle, Trash2, Info } from 'lucide-react'
// ... existing imports ...

// ... inside MillingTableRow ...

{/* 3. Variety (Previously Title/Variety mixed) */ }
<TableCell className="py-2 px-2 text-xs font-bold text-slate-800 w-[100px]">
    <div className="flex items-center gap-1">
        <span className="truncate max-w-[90px]">{varieties}</span>
        {/* Small info icon for stock list details */}
        <MillingStockListDialog
            stocks={log.stocks || []}
            varieties={varieties}
            trigger={<Info className="h-3 w-3 text-slate-300 hover:text-blue-500 transition-colors" />}
        />
    </div>
</TableCell>

{/* 4. Tonbag Count */ }
<TableCell className="py-2 px-2 text-right text-xs font-mono text-slate-400">
    {tonbagCount}백
</TableCell>

{/* 5. Input Weight */ }
<TableCell className="py-2 px-2 text-right text-xs font-bold text-slate-600">
    {log.totalInputKg.toLocaleString()}
</TableCell>

{/* 6. Output Weight */ }
<TableCell className="py-2 px-2 text-right text-xs font-bold text-blue-600">
    {totalRiceKg > 0 ? totalRiceKg.toLocaleString() : '-'}
</TableCell>

{/* 7. Yield */ }
<TableCell className="py-2 px-2 text-center text-xs font-mono font-bold text-slate-500">
    {totalRiceKg > 0 ? `${Math.round(yieldRate)}%` : '-'}
</TableCell>

{/* 8. Remarks (Title) */ }
<TableCell className="py-2 px-2 text-left text-xs text-slate-400 truncate max-w-[120px]">
    {log.title}
</TableCell>

{/* 9. Actions */ }
<TableCell className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-slate-600">
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">관리 메뉴</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPackagingOpen(true)} className="gap-2 text-xs">
                <Package className="h-3.5 w-3.5" />
                포장 관리
            </DropdownMenuItem>
            {!log.isClosed && (
                <>
                    <DropdownMenuItem onClick={handleCloseBatch} className="gap-2 text-xs text-amber-600 focus:text-amber-700 focus:bg-amber-50">
                        <Lock className="h-3.5 w-3.5" />
                        작업 마감
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDeleteBatch} className="gap-2 text-xs text-red-600 focus:text-red-700 focus:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                        작업 삭제
                    </DropdownMenuItem>
                </>
            )}
        </DropdownMenuContent>
    </DropdownMenu>
</TableCell>
            </TableRow >

    <AddPackagingDialog
        batchId={log.id}
        batchTitle={log.title}
        isClosed={log.isClosed}
        initialOutputs={log.outputs}
        open={packagingOpen}
        onOpenChange={setPackagingOpen}
        trigger={<></>}
    />
        </>
    )
}
