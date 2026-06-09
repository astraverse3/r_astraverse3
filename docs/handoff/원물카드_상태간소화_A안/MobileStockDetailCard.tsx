// =============================================================================
//  MobileStockDetailCard — A안 (테이블형 1행 + 상태칩 제거) 최종본
//  대상 파일: app/(dashboard)/raw-stocks/stock-list-client.tsx
//  교체 위치: 기존 function MobileStockDetailCard(...) { ... } 전체 (약 491~599행)
//
//  설계 의도
//   - 톤백번호(bagNo)가 목록에서 시선이 집중되는 "선택 핸들" → 고정폭 우측정렬
//     컬럼으로 빼서 위→아래로 한 열씩 정렬되게 함.
//   - 톤백번호와 무게(weightKg)는 한 쌍의 의미 → 같은 행에서 가까운 컬럼으로.
//   - 상태칩(Badge) 제거: 이 목록의 상태는 보관중(AVAILABLE)/소진됨(CONSUMED) 2종뿐이고
//     (stock-filters.tsx 의 필터 옵션 기준), 소진 행은 이미 카드 배경(bg-slate-50)+
//     흐림(opacity-60)으로 구분되므로 칩이 중복. 칩을 빼면 생산자/LOT 가변폭이 ~50px
//     늘어 긴 생산자명(예: "윤영식유기농영농조합법인")이 잘리지 않음.
//
//  주의
//   - import 는 기존 그대로. 단, 이 컴포넌트에서 <Badge> 사용이 사라지지만 같은 파일
//     상단 그룹 헤더(group.certType)에서 Badge 를 계속 쓰므로 import 는 유지할 것.
//   - IN_PRODUCTION(투입됨)은 이 목록에 노출되지 않지만, 혹시 들어와도 !isAvailable
//     분기에 의해 자동으로 흐림 처리되어 안전.
// =============================================================================

function MobileStockDetailCard({ stock, farmers, varieties, selected, onSelect, hideCheckbox, isInCart }: any) {
    const isCartBlocked = isInCart
    const isAvailable = stock.status === 'AVAILABLE'
    const [editOpen, setEditOpen] = useState(false)
    const { data: session } = useSession()
    // @ts-ignore
    const canManage = hasPermission(session?.user, 'STOCK_MANAGE')

    const handleDelete = async () => {
        if (confirm('정말 삭제하시겠습니까? (삭제 후 복구 불가)')) {
            const result = await deleteStock(stock.id)
            if (!result.success) {
                toast.error('삭제에 실패했습니다.')
            } else {
                toast.success('삭제되었습니다.')
            }
        }
    }

    const handleCardClick = () => {
        if (!hideCheckbox && isAvailable && !isCartBlocked) {
            onSelect(!selected)
        }
    }

    const isConsumed = stock.status === 'CONSUMED'
    const lotText = stock.farmer.group?.certType === '일반' ? '관행' : (stock.lotNo || '-')

    return (
        <div
            className={`relative flex items-center gap-2 py-2 px-2.5 rounded-lg border ${selected ? 'border-primary bg-blue-50 ring-1 ring-primary/20' : isConsumed ? 'border-slate-200 bg-slate-50' : 'border-slate-200/80 bg-white'} ${!isAvailable || isCartBlocked ? '' : 'cursor-pointer'} shadow-sm transition-all`}
            onClick={handleCardClick}
        >
            <div className={`flex items-center gap-2 w-full ${!isAvailable || isCartBlocked ? 'opacity-60' : ''}`}>

                {/* 1) 체크박스 (시각 16px, hit-area 44px 확장) */}
                {!hideCheckbox && (
                    <div onClick={(e) => e.stopPropagation()} className="relative flex shrink-0 items-center justify-center">
                        <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) => onSelect(checked as boolean)}
                            disabled={!isAvailable || isCartBlocked}
                            aria-label="개별 재고 선택"
                            className="w-4 h-4 rounded-sm border-slate-300"
                        />
                        <span aria-hidden className="absolute -inset-2.5" />
                    </div>
                )}

                {/* 2) 톤백번호 — 고정폭 우측정렬 컬럼 (목록 세로 정렬의 기준 · 시선 앵커) */}
                <span className="w-[34px] shrink-0 text-right font-mono font-black text-[14px] text-slate-900 tabular-nums leading-none">
                    <span className="text-[10px] font-bold text-slate-400">#</span>{stock.bagNo}
                </span>

                {/* 3) 생산자 + LOT (가변폭 2줄, 칩이 없어 폭 여유 확보) */}
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-[12.5px] text-slate-800 leading-tight truncate">
                        {stock.farmer.name}{stock.actualFarmer ? ` (${stock.actualFarmer})` : ''}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 leading-tight truncate mt-0.5">
                        {lotText}
                    </div>
                </div>

                {/* 4) 무게 — 고정폭 우측정렬 컬럼 (톤백번호와 짝) */}
                <span className="w-[52px] shrink-0 text-right font-mono font-bold text-[13px] text-slate-700 tabular-nums leading-none">
                    {stock.weightKg.toLocaleString()}<span className="text-[9px] font-bold text-slate-400 ml-px">kg</span>
                </span>

                {/* 5) 상태칩 없음 — 보관/소진은 카드 배경(bg-slate-50)+흐림(opacity-60)으로 구분 */}

                {/* 6) 점세개 관리메뉴 — 현행 그대로 (hit-area 44px 확장 유지) */}
                {canManage && (
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mr-1.5">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600 relative">
                                    <span aria-hidden className="absolute -inset-2.5" />
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[120px]">
                                <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2 cursor-pointer">
                                    <Edit className="h-4 w-4 text-slate-500" />
                                    <span>수정</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleDelete}
                                    disabled={stock.status === 'CONSUMED'}
                                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>삭제</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            <EditStockDialog
                stock={stock}
                open={editOpen}
                onOpenChange={setEditOpen}
                farmers={farmers}
                varieties={varieties}
                trigger={null}
            />
        </div>
    )
}
