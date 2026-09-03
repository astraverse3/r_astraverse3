import type {
  FarmerStockRow,
  GroupStockRow,
  VarietyStockRow,
} from '@/app/actions/stock-statistics'
import { formatKg } from './utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ── 재고율 뱃지 ───────────────────────────────────────────────────────────

function StockRateBadge({ rate }: { rate: number }) {
  // 재고율이 낮을수록 좋음 (처리 완료)
  const color =
    rate <= 20 ? '#7db037' :
    rate <= 50 ? '#cc7b0c' :
    '#ef4444'
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {rate.toFixed(1)}%
    </span>
  )
}

// ── 인증 뱃지 ─────────────────────────────────────────────────────────────

function CertBadge({ certType }: { certType: string }) {
  const style =
    certType === '유기농' ? 'bg-green-100 text-green-700' :
    certType === '무농약' ? 'bg-blue-100 text-blue-700' :
    'bg-slate-100 text-slate-500'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${style}`}>{certType}</span>
  )
}

// ── 차트 범례 ─────────────────────────────────────────────────────────────

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#8dc540' }} />
        도정완료
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#8b5cf6' }} />
        직접출고
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f89c1e' }} />
        미처리
      </span>
    </div>
  )
}

// ── 테이블: 생산자별 ──────────────────────────────────────────────────────

export function FarmerTable({ rows }: { rows: FarmerStockRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full text-xs" style={{ minWidth: '560px' }}>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50">
            <TableHead className="text-left">생산자명</TableHead>
            <TableHead className="text-left">작목반</TableHead>
            <TableHead className="text-right">총 입고 (kg)</TableHead>
            <TableHead className="text-right">도정완료 (kg)</TableHead>
            <TableHead className="text-right">직접출고 (kg)</TableHead>
            <TableHead className="text-right">미처리 (kg)</TableHead>
            <TableHead className="text-right">재고율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.farmerId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <TableCell className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{r.farmerName}</TableCell>
              <TableCell className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{r.groupName}</TableCell>
              <TableCell className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatKg(r.totalKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7db037' }}>{formatKg(r.consumedKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7c3aed' }}>{formatKg(r.releasedKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#cc7b0c' }}>{formatKg(r.availableKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
                <StockRateBadge rate={r.stockRate} />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-400 text-sm">데이터가 없습니다</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── 테이블: 작목반별 ──────────────────────────────────────────────────────

export function GroupTable({ rows }: { rows: GroupStockRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full text-xs" style={{ minWidth: '620px' }}>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50">
            <TableHead className="text-left">작목반명</TableHead>
            <TableHead className="text-left">인증</TableHead>
            <TableHead className="text-right">생산자수</TableHead>
            <TableHead className="text-right">총 입고 (kg)</TableHead>
            <TableHead className="text-right">도정완료 (kg)</TableHead>
            <TableHead className="text-right">직접출고 (kg)</TableHead>
            <TableHead className="text-right">미처리 (kg)</TableHead>
            <TableHead className="text-right">재고율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.groupId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <TableCell className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{r.groupName}</TableCell>
              <TableCell className="py-2.5 px-3 whitespace-nowrap">
                <CertBadge certType={r.certType} />
              </TableCell>
              <TableCell className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap">{r.farmerCount}명</TableCell>
              <TableCell className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatKg(r.totalKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7db037' }}>{formatKg(r.consumedKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7c3aed' }}>{formatKg(r.releasedKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#cc7b0c' }}>{formatKg(r.availableKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
                <StockRateBadge rate={r.stockRate} />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-400 text-sm">데이터가 없습니다</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ── 테이블: 품종별 ────────────────────────────────────────────────────────

export function VarietyTable({ rows }: { rows: VarietyStockRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full text-xs" style={{ minWidth: '480px' }}>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50">
            <TableHead className="text-left">품종명</TableHead>
            <TableHead className="text-right">총 입고 (kg)</TableHead>
            <TableHead className="text-right">도정완료 (kg)</TableHead>
            <TableHead className="text-right">직접출고 (kg)</TableHead>
            <TableHead className="text-right">미처리 (kg)</TableHead>
            <TableHead className="text-right">재고율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.varietyId} className={`border-b border-slate-50 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
              <TableCell className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{r.varietyName}</TableCell>
              <TableCell className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatKg(r.totalKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7db037' }}>{formatKg(r.consumedKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#7c3aed' }}>{formatKg(r.releasedKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap" style={{ color: '#cc7b0c' }}>{formatKg(r.availableKg)}</TableCell>
              <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
                <StockRateBadge rate={r.stockRate} />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-slate-400 text-sm">데이터가 없습니다</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
