/* global React, lucide */
// 대시보드 v2 — 카드 구성 + 차트 비주얼 옵션
const { useState: useStateDB } = React;
const VT = () => window.VARIETY_TOKENS || {};
const SetC = () => (window.MobileNavIconSets && window.MobileNavIconSets.C) || {};

// ============================================================
// 공통 모의 데이터
// ============================================================
const MOCK = {
  year: 2025,
  rice: { available: 845731, total: 1670273 },     // 벼 원곡
  grain: { available: 12480, total: 18900 },        // 잡곡 (신규)
  output: 464572,                                    // 총 도정
  outputByType: { uruchi: 411650, indica: 41900, glutinous: 11022, others: 0 },
  yields: { uruchi: 67.3, indica: 64.7, glutinous: 67.5 },
  yieldTarget: 65,
  sales: { thisMonth: 28430, lastMonth: 24210, delta: 17.4 },  // 판매 (예정)
};

// ============================================================
// 유틸: 작은 컴포넌트들
// ============================================================
function StatNumber({ value, unit = 'kg', size = 'lg' }) {
  const cls = size === 'lg' ? 'text-[28px]' : size === 'xl' ? 'text-[40px]' : 'text-[20px]';
  const unitCls = size === 'lg' ? 'text-[15px]' : size === 'xl' ? 'text-[20px]' : 'text-[13px]';
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className={`${cls} font-black text-slate-900 leading-none tracking-tight`}>{value.toLocaleString()}</span>
      {unit && <span className={`${unitCls} font-bold text-slate-500`}>{unit}</span>}
    </span>
  );
}

function YearChip({ year }) {
  return (
    <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono tracking-tight">{year}년산</span>
  );
}

function TrendArrow({ pct }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {up ? <path d="m6 17 6-6 4 4 6-8M16 7h4v4"/> : <path d="m6 7 6 6 4-4 6 8M16 17h4v-4"/>}
      </svg>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ============================================================
// CHART 옵션 1 — Refined Bar (라벨 위 + 목표선 점선)
// ============================================================
function ChartOption1({ title = '백미 평균 수율', compact = false }) {
  const T = VT();
  const yields = MOCK.yields;
  const target = MOCK.yieldTarget;
  const data = [
    { k: 'uruchi', label: '메벼', v: yields.uruchi },
    { k: 'indica', label: '인디카', v: yields.indica },
    { k: 'glutinous', label: '찰벼', v: yields.glutinous },
  ];
  const yMin = 50, yMax = 75;
  const ticks = [50, 55, 60, 65, 70, 75];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[13.5px] font-bold text-slate-800">{title}</h3>
        <span className="text-[10.5px] text-slate-400 font-mono">target {target}%</span>
      </div>
      <div className="flex-1 relative pl-9 pr-2 min-h-[120px]">
        {ticks.map(v => {
          const isTarget = v === target;
          return (
            <div key={v} className="absolute left-9 right-2 flex items-center" style={{ bottom: `${(v-yMin)/(yMax-yMin)*100}%` }}>
              <span className={`absolute -left-9 -top-[7px] w-8 text-right pr-1.5 text-[9.5px] tabular-nums ${isTarget ? 'font-bold text-emerald-600' : 'font-medium text-slate-400'}`}>{v}</span>
              <div className={`w-full border-t ${isTarget ? 'border-dashed border-emerald-400' : 'border-slate-100'}`} />
            </div>
          );
        })}
        <div className="absolute inset-y-0 left-9 right-2 flex items-end justify-between">
          {data.map(b => {
            const t = T[b.k];
            const clamped = Math.max(yMin, Math.min(yMax, b.v));
            const h = (clamped - yMin) / (yMax - yMin) * 100;
            const reached = b.v >= target;
            return (
              <div key={b.k} className="w-11 h-full flex flex-col items-center justify-end">
                <span className={`text-[12px] font-black tabular-nums mb-1 ${reached ? 'text-emerald-700' : 'text-slate-700'}`}>{b.v.toFixed(1)}</span>
                <div className="w-full rounded-t-[3px]" style={{ height: `${h}%`, background: `linear-gradient(to top, ${t.from}, ${t.to})` }} />
              </div>
            );
          })}
        </div>
        <div className="absolute left-9 right-2 bottom-0 h-[1.5px] bg-slate-300" />
      </div>
      <div className="flex justify-between pl-9 pr-2 mt-2">
        {data.map(b => <span key={b.k} className="w-11 text-center text-[10.5px] font-bold text-slate-500">{b.label}</span>)}
      </div>
    </div>
  );
}

// ============================================================
// CHART 옵션 2 — Horizontal Lollipop + 전월대비
// ============================================================
function ChartOption2({ title = '백미 평균 수율' }) {
  const T = VT();
  const target = MOCK.yieldTarget;
  // 이전월 대비 가상치
  const data = [
    { k: 'uruchi', label: '메벼', v: MOCK.yields.uruchi, prev: 65.8 },
    { k: 'indica', label: '인디카', v: MOCK.yields.indica, prev: 65.2 },
    { k: 'glutinous', label: '찰벼', v: MOCK.yields.glutinous, prev: 64.9 },
  ];
  const xMin = 55, xMax = 72;
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[13.5px] font-bold text-slate-800">{title}</h3>
        <span className="text-[10.5px] text-slate-400 font-mono">target {target}% · 전월대비</span>
      </div>
      <div className="flex-1 flex flex-col justify-around gap-3 py-2">
        {data.map(b => {
          const t = T[b.k];
          const pct = (b.v - xMin) / (xMax - xMin) * 100;
          const targetPct = (target - xMin) / (xMax - xMin) * 100;
          const delta = b.v - b.prev;
          const reached = b.v >= target;
          return (
            <div key={b.k}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11.5px] font-bold text-slate-700">{b.label}</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-[16px] font-black tabular-nums ${reached ? 'text-emerald-700' : 'text-slate-800'}`}>{b.v.toFixed(1)}<span className="text-[11px] ml-0.5">%</span></span>
                  <TrendArrow pct={delta} />
                </div>
              </div>
              <div className="relative h-1.5 bg-slate-100 rounded-full overflow-visible">
                <div className="absolute top-0 bottom-0 left-0 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${t.from}, ${t.to})` }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-[2px] border-white shadow" style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', background: t.mid }} />
                <div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-emerald-400/70 rounded-full" style={{ left: `${targetPct}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[9.5px] text-slate-400 tabular-nums">
                <span>{xMin}</span>
                <span className="font-semibold text-emerald-600">{target}</span>
                <span>{xMax}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// CHART 옵션 3 — Radial Gauge per variety
// ============================================================
function GaugeArc({ color, value, max = 75, min = 50 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 38;
  const c = 2 * Math.PI * r;
  // semi-circle (only top half) — arc length is c/2
  const visibleLen = c / 2;
  const filled = visibleLen * pct;
  return (
    <svg viewBox="0 0 100 56" className="w-full">
      <defs>
        <linearGradient id={`g-${color.replace('#','')}`} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      {/* track */}
      <path d={`M 12 50 A 38 38 0 0 1 88 50`} stroke="#f1f5f9" strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* fill */}
      <path d={`M 12 50 A 38 38 0 0 1 88 50`} stroke={`url(#g-${color.replace('#','')})`} strokeWidth="8" fill="none" strokeLinecap="round"
        strokeDasharray={`${filled} ${visibleLen}`} />
    </svg>
  );
}

function ChartOption3({ title = '백미 평균 수율' }) {
  const T = VT();
  const target = MOCK.yieldTarget;
  const data = [
    { k: 'uruchi', label: '메벼', v: MOCK.yields.uruchi },
    { k: 'indica', label: '인디카', v: MOCK.yields.indica },
    { k: 'glutinous', label: '찰벼', v: MOCK.yields.glutinous },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[13.5px] font-bold text-slate-800">{title}</h3>
        <span className="text-[10.5px] text-slate-400 font-mono">target {target}%</span>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2 items-center">
        {data.map(b => {
          const t = T[b.k];
          const reached = b.v >= target;
          return (
            <div key={b.k} className="flex flex-col items-center text-center">
              <div className="w-full max-w-[90px] relative">
                <GaugeArc color={t.mid} value={b.v} />
                <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                  <span className={`text-[18px] font-black tabular-nums leading-none ${reached ? 'text-emerald-700' : 'text-slate-800'}`}>{b.v.toFixed(1)}</span>
                  <span className="text-[8.5px] font-bold text-slate-400 mt-0.5">/ {target}%</span>
                </div>
              </div>
              <div className="text-[11px] font-bold text-slate-600 mt-1">{b.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.ChartOption1 = ChartOption1;
window.ChartOption2 = ChartOption2;
window.ChartOption3 = ChartOption3;

// ============================================================
// KPI 미니 카드 (재사용)
// ============================================================
function MiniKPI({ icon: Icon, label, year, value, unit, total, accentFrom, accentTo, sub, footer }) {
  const pct = total ? Math.round(value / total * 100) : null;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col h-full min-h-[140px]">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" active />}
        <h3 className="text-[12.5px] font-bold text-slate-500 tracking-wide">{label}</h3>
        {year && <YearChip year={year} />}
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <StatNumber value={value} unit={unit} size="lg" />
        {sub && <span className="text-[11px] text-slate-400 ml-1">{sub}</span>}
      </div>
      {total != null && (
        <div className="mt-auto">
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${accentFrom}, ${accentTo})` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10.5px] text-slate-400 tabular-nums">총 {total.toLocaleString()}{unit}</span>
            <span className="text-[10.5px] font-bold tabular-nums" style={{ color: accentFrom }}>잔여 {pct}%</span>
          </div>
        </div>
      )}
      {footer && <div className="mt-auto pt-2">{footer}</div>}
    </div>
  );
}

// ============================================================
// LAYOUT A — 4 카드 균등 KPI 행 + 차트 행
// ============================================================
function LayoutA() {
  const T = VT();
  const C = SetC();
  return (
    <div className="bg-slate-50 p-5 h-full flex flex-col gap-3">
      <div className="text-[10.5px] font-bold text-slate-400 tracking-[0.18em] uppercase">Option A · Quad KPI Row</div>
      <div className="grid grid-cols-4 gap-3">
        <MiniKPI icon={C.Raw} label="벼 원곡 재고" year={MOCK.year} value={MOCK.rice.available} unit="kg" total={MOCK.rice.total}
          accentFrom={T.uruchi.from} accentTo={T.uruchi.to} />
        <MiniKPI icon={C.Raw} label="잡곡 원물 재고" year={MOCK.year} value={MOCK.grain.available} unit="kg" total={MOCK.grain.total}
          accentFrom={T.indica.from} accentTo={T.indica.to} />
        <MiniKPI icon={C.Mill} label="총 도정 생산량" year={MOCK.year} value={MOCK.output} unit="kg"
          footer={
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
              <div className="h-full" style={{ width: '89%', background: `linear-gradient(to right, ${T.uruchi.from}, ${T.uruchi.to})` }} />
              <div className="h-full" style={{ width: '9%', background: `linear-gradient(to right, ${T.indica.from}, ${T.indica.to})` }} />
              <div className="h-full" style={{ width: '2%', background: `linear-gradient(to right, ${T.glutinous.from}, ${T.glutinous.to})` }} />
            </div>
          } />
        <MiniKPI icon={C.Sales} label="이번 달 판매" value={MOCK.sales.thisMonth} unit="kg"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] text-slate-400 tabular-nums">전월 {MOCK.sales.lastMonth.toLocaleString()}kg</span>
              <TrendArrow pct={MOCK.sales.delta} />
            </div>
          } />
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-3 flex-1">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <ChartOption1 />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-[13.5px] font-bold text-slate-800 mb-3">판매 추이 <span className="text-[10.5px] text-slate-400 font-normal">(예정)</span></h3>
          <div className="flex-1 flex items-end gap-1.5">
            {[18,22,19,28,24,28].map((h,i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-[3px]" style={{ height: `${h*3}px`, background: i === 5 ? T.uruchi.mid : '#cbd5e1' }} />
                <span className="text-[9px] text-slate-400">{['12','1','2','3','4','5'][i]}월</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LAYOUT B — Hero stat + 보조 tiles
// ============================================================
function LayoutB() {
  const T = VT();
  const C = SetC();
  const pctRice = Math.round(MOCK.rice.available / MOCK.rice.total * 100);
  return (
    <div className="bg-slate-50 p-5 h-full flex flex-col gap-3">
      <div className="text-[10.5px] font-bold text-slate-400 tracking-[0.18em] uppercase">Option B · Hero + Tiles</div>
      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        {/* Hero: 벼 재고 상태 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            {C.Raw && <C.Raw className="w-4 h-4 text-slate-500" active />}
            <h3 className="text-[13px] font-bold text-slate-500 tracking-wide">벼 원곡 재고 현황</h3>
            <YearChip year={MOCK.year} />
          </div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <StatNumber value={MOCK.rice.available} unit="kg" size="xl" />
              <div className="text-[12px] text-slate-500 mt-1">잔여 · 입고 {MOCK.rice.total.toLocaleString()}kg</div>
            </div>
            <div className="text-right">
              <div className="text-[36px] font-black tabular-nums leading-none" style={{ color: T.uruchi.mid }}>{pctRice}<span className="text-[20px]">%</span></div>
              <div className="text-[10.5px] text-slate-400 mt-1">잔여율</div>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pctRice}%`, background: `linear-gradient(to right, ${T.uruchi.from}, ${T.uruchi.to})` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">도정 완료</div>
              <div className="text-[15px] font-black text-slate-800 tabular-nums mt-0.5">{(MOCK.rice.total - MOCK.rice.available).toLocaleString()}<span className="text-[10px] font-bold text-slate-400 ml-0.5">kg</span></div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">총 생산</div>
              <div className="text-[15px] font-black text-slate-800 tabular-nums mt-0.5">{MOCK.output.toLocaleString()}<span className="text-[10px] font-bold text-slate-400 ml-0.5">kg</span></div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">백미 수율</div>
              <div className="text-[15px] font-black text-emerald-700 tabular-nums mt-0.5">66.5%</div>
            </div>
          </div>
        </div>
        {/* 보조 tiles 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <MiniKPI icon={C.Raw} label="잡곡 원물" year={MOCK.year} value={MOCK.grain.available} unit="kg" total={MOCK.grain.total}
            accentFrom={T.indica.from} accentTo={T.indica.to} />
          <MiniKPI icon={C.Pkg} label="제품 재고" value={87420} unit="kg" total={120000}
            accentFrom={T.glutinous.from} accentTo={T.glutinous.to} />
          <MiniKPI icon={C.Sales} label="이번 달 판매" value={MOCK.sales.thisMonth} unit="kg"
            footer={<div className="flex items-center gap-1.5"><span className="text-[10.5px] text-slate-400 tabular-nums">전월비</span><TrendArrow pct={MOCK.sales.delta} /></div>} />
          <MiniKPI icon={C.Stats} label="평균 수율" value={66.5} unit="%"
            footer={<div className="text-[10.5px] text-slate-500">목표 65% · <span className="font-bold text-emerald-700">+1.5</span></div>} />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1">
        <ChartOption2 />
      </div>
    </div>
  );
}

// ============================================================
// LAYOUT C — Compact stat strip + 콘텐츠
// ============================================================
function LayoutC() {
  const T = VT();
  const C = SetC();
  return (
    <div className="bg-slate-50 p-5 h-full flex flex-col gap-3">
      <div className="text-[10.5px] font-bold text-slate-400 tracking-[0.18em] uppercase">Option C · Stat Strip + Tabs</div>
      {/* Compact strip */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex divide-x divide-slate-100">
        {[
          { Icon: C.Raw, label: '벼 원곡', val: MOCK.rice.available, unit: 'kg', sub: `잔여 51% · ${MOCK.year}년산`, color: T.uruchi.mid },
          { Icon: C.Raw, label: '잡곡 원물', val: MOCK.grain.available, unit: 'kg', sub: `잔여 66% · ${MOCK.year}년산`, color: T.indica.mid },
          { Icon: C.Mill, label: '도정 생산', val: MOCK.output, unit: 'kg', sub: '메벼 89% · 인디카 9% · 찰벼 2%', color: T.uruchi.mid },
          { Icon: C.Pkg, label: '제품 재고', val: 87420, unit: 'kg', sub: '잔여 73% · 14 SKU', color: T.glutinous.mid },
          { Icon: C.Sales, label: '5월 판매', val: MOCK.sales.thisMonth, unit: 'kg', sub: `전월 대비 +17.4%`, color: '#0ea5e9', trend: 17.4 },
        ].map((s, i) => (
          <div key={i} className="flex-1 px-5 py-4 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              <span className="text-[11px] font-bold text-slate-500 tracking-wide">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-1 tabular-nums mb-1">
              <span className="text-[22px] font-black text-slate-900 leading-none">{s.val.toLocaleString()}</span>
              <span className="text-[12px] font-bold text-slate-500">{s.unit}</span>
              {s.trend != null && <span className="ml-1"><TrendArrow pct={s.trend} /></span>}
            </div>
            <div className="text-[10.5px] text-slate-400 truncate">{s.sub}</div>
          </div>
        ))}
      </div>
      {/* tabbed analytics */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1 flex flex-col">
        <div className="flex items-center gap-1 mb-4 border-b border-slate-100 -mx-5 px-5 pb-0">
          {[
            { k: 'yield', label: '수율 분석', active: true },
            { k: 'sales', label: '판매 추이' },
            { k: 'stock', label: '재고 추이' },
          ].map(t => (
            <button key={t.k} className={`relative px-3.5 py-2.5 text-[12.5px] font-semibold transition ${t.active ? 'text-slate-900' : 'text-slate-400'}`}>
              {t.label}
              {t.active && <span className="absolute left-2 right-2 bottom-[-1px] h-[2.5px] bg-slate-900 rounded-full" />}
            </button>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-6 pt-1">
          <ChartOption1 />
          <ChartOption3 />
        </div>
      </div>
    </div>
  );
}

window.LayoutA = LayoutA;
window.LayoutB = LayoutB;
window.LayoutC = LayoutC;
