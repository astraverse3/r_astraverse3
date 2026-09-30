/* 포장 다이얼로그 — PC(sm 이상, 500px) 현재 vs 제안 */
const DK_GROUPS = [
  { name: '박오주', lot: '251016-11-15107943-501', variety: '새청무', input: 1240, expect: 893, rows: [{ t: '톤백', ton: true, n: 1, w: 812 }, { t: '10kg', pk: '친환경 10kg 지대', n: 6, w: 10 }, { t: '잔량', rem: true, n: 1, w: 13 }] },
  { name: '김영식', lot: '251016-11-15107943-502', variety: '새청무', input: 1164, expect: 838, rows: [{ t: '20kg', pk: '일반 20kg 지대', n: 38, w: 20 }, { t: '4kg', pk: '자연주의 4kg', n: 12, w: 4 }] },
];
const DK_SPECS = ['톤백', '20kg', '10kg', '8kg', '5kg', '4kg', '3kg', '1kg', '잔량'];
const dkSum = (rows) => rows.reduce((s, o) => s + o.n * o.w, 0);
const DK_ALL = DK_GROUPS.flatMap((g) => g.rows);
const DK_TOTAL = dkSum(DK_ALL);
function dkSpecSummary() {
  const m = new Map();
  DK_ALL.forEach((o) => { const c = m.get(o.t) || { n: 0, kg: 0 }; c.n += o.n; c.kg += o.n * o.w; m.set(o.t, c); });
  return [...m.entries()];
}
function DkIco({ d, s = 14 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>; }
const TRASH = 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14';
const LOCK = 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z';

function DkShell({ children, foot, closed }) {
  return (
    <div className="h-full bg-slate-500/30 flex items-start justify-center pt-6">
      <div className="w-[500px] bg-white rounded-xl shadow-xl flex flex-col" style={{ maxHeight: 'calc(100% - 24px)' }}>
        <div className="px-6 pt-5">
          <div className="text-[18px] font-semibold text-slate-900 flex items-center gap-2">포장 기록 관리{closed && <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[12px] font-semibold text-slate-700"><DkIco d={LOCK} s={12} />마감됨</span>}</div>
          <div className="flex items-center gap-2 mt-1.5"><span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700">백미</span><span className="text-[13px] font-bold text-slate-700">총 투입: <span className="font-mono">2,404</span>kg</span></div>
        </div>
        {children}
        {foot}
      </div>
    </div>
  );
}

/* ── 현재 ── */
function DkNow() {
  return (
    <DkShell foot={
      <div className="mx-6 pt-3 pb-5 border-t space-y-3">
        <div className="flex justify-between items-center"><div className="text-[13px] font-medium">총 포장: <span className="font-bold text-[18px]">{DK_TOTAL.toLocaleString()} kg</span></div><button className="h-9 px-4 rounded-md bg-slate-900 text-white text-[14px] font-medium">기록 저장</button></div>
        <div className="flex justify-between pt-2 border-t border-dashed"><span className="px-2 py-1 text-[12px] font-semibold text-amber-600 flex items-center gap-1"><DkIco d={LOCK} s={12} />작업 마감</span><span className="px-2 py-1 text-[12px] font-semibold text-red-500 flex items-center gap-1"><DkIco d={TRASH} s={12} />포장 초기화</span></div>
      </div>
    }>
      <div className="mx-6 mt-2 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/60 shadow-sm px-3 py-2.5">
        <div className="text-[10.5px] font-semibold text-slate-400 mb-1.5">규격별 합계</div>
        <div className="flex flex-wrap gap-1.5">{dkSpecSummary().map(([t, c]) => <div key={t} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t === '잔량' ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-100 text-stone-600'}`}>{t}</span><span className="text-[12px] font-bold text-slate-600 font-mono">{c.n}<span className="text-[9px] text-slate-400">개</span></span><span className="text-slate-200">|</span><span className="text-[12px] font-black text-slate-800 font-mono">{c.kg.toLocaleString()}<span className="text-[9px] text-slate-400">kg</span></span></div>)}</div>
      </div>
      <div className="flex-1 overflow-hidden px-6 py-4 space-y-4">
        {DK_GROUPS.map((g) => (
          <div key={g.lot} className="rounded-xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-50 border-b border-stone-100 px-3 py-2 flex items-center gap-2 text-[12px]"><b className="text-stone-700">{g.name}</b><span className="text-stone-400">{g.variety}</span><span className="font-mono text-[10px] text-stone-400 truncate">{g.lot}</span><span className="ml-auto text-stone-500 whitespace-nowrap">{g.input.toLocaleString()} <span className="text-stone-300 text-[10px]">→</span> <b className="text-blue-600">{g.expect}kg</b></span></div>
            <div className="px-3 pt-3 pb-3 border-b border-stone-200 grid grid-cols-10 gap-1">{[...DK_SPECS, '기타'].map((s) => <span key={s} className={`h-7 rounded-md text-[11px] flex items-center justify-center ${s === '기타' ? 'border border-dashed border-stone-300 text-stone-500' : 'bg-stone-100 text-stone-700'}`}>{s}</span>)}</div>
            <div className="grid grid-cols-[40px_120px_1fr_64px_24px] gap-1 px-3 pt-1.5 pb-0.5 text-[9px] font-semibold text-stone-300"><span className="text-center">규격</span><span>포장지</span><span className="text-center">수량</span><span className="text-right">중량</span><span></span></div>
            <div className="divide-y divide-stone-100">
              {g.rows.map((o) => (
                <div key={o.t} className="px-3 py-1.5 grid grid-cols-[40px_120px_1fr_64px_24px] items-center gap-1">
                  <span className={`text-center rounded py-0.5 text-[11px] ${o.rem ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-100 text-stone-600'}`}>{o.t}</span>
                  {o.ton ? <span className="text-[11px] text-stone-400 pl-0.5">포장지: 톤백</span> : o.rem ? <span className="text-[11px] text-stone-300 pl-0.5">—</span> : <span className="h-7 flex items-center rounded-md border border-stone-200 pl-2 text-[11px] text-stone-600 truncate">{o.pk}</span>}
                  {o.rem ? <span className="text-center text-[12px] font-mono font-bold text-stone-700">1</span> : <span className="flex items-center justify-center"><i className="w-[22px] h-[22px] rounded-full not-italic text-center leading-[22px] text-stone-400">−</i><b className="w-11 text-center font-mono text-[12px]">{o.n}</b><i className="w-[22px] h-[22px] rounded-full not-italic text-center leading-[22px] text-stone-400">+</i></span>}
                  {o.ton || o.rem ? <span className="flex items-center justify-end gap-0.5"><span className="h-6 w-11 rounded border border-stone-200 px-1 text-right text-[11px] leading-6">{o.w}</span><span className="text-[9px] text-stone-400">kg</span></span> : <span className="text-right text-[12px] font-bold text-stone-700">{(o.n * o.w).toLocaleString()}<span className="text-[9px] text-stone-400">kg</span></span>}
                  <span className="text-stone-300 flex justify-center"><DkIco d={TRASH} s={13} /></span>
                </div>
              ))}
            </div>
            <div className="flex justify-end px-3 py-1.5 bg-stone-50 border-t border-stone-100 text-[12px] text-stone-500">소계&nbsp;<b className="text-stone-700">{dkSum(g.rows).toLocaleString()}</b><span className="text-stone-400">&nbsp;/ {g.expect.toLocaleString()} kg</span></div>
          </div>
        ))}
      </div>
    </DkShell>
  );
}

/* ── 제안 ── */
const DK_COLS = 'grid-cols-[52px_minmax(0,1fr)_104px_76px_28px]';
const DK_RO_COLS = 'grid-cols-[52px_minmax(0,1fr)_64px_76px]';
function DkSpecBand() {
  return (
    <div className="mx-6 mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500 mb-1.5">규격별 합계</div>
      <div className="flex flex-wrap gap-1.5">{dkSpecSummary().map(([t, c]) => <div key={t} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1"><span className={`text-[12px] font-semibold rounded px-1.5 ${t === '잔량' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'}`}>{t}</span><span className="font-mono text-[13px] text-slate-700">{c.n}<span className="text-[11px] text-slate-500 font-sans ml-px">개</span></span><span className="text-slate-300">|</span><span className="font-mono text-[13px] font-bold text-slate-900">{c.kg.toLocaleString()}<span className="text-[11px] text-slate-500 font-sans font-normal ml-px">kg</span></span></div>)}</div>
    </div>
  );
}
function DkGroupHead({ g }) {
  return (
    <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-2 text-[13px]">
      <b className="text-slate-800">{g.name}</b><span className="text-slate-500 text-[12px]">{g.variety}</span>
      <span className="font-mono text-[11px] text-slate-500 truncate">{g.lot}</span>
      <span className="ml-auto text-[12px] text-slate-600 whitespace-nowrap"><span className="font-mono">{g.input.toLocaleString()}</span> → 예상 <b className="font-mono text-blue-700">{g.expect}</b>kg</span>
    </div>
  );
}
function DkSubtotal({ g }) {
  const s = dkSum(g.rows), over = s > g.expect;
  return <div className="flex justify-end px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[12px] text-slate-600">소계&nbsp;<b className={`font-mono ${over ? 'text-amber-700' : 'text-slate-900'}`}>{s.toLocaleString()}</b>&nbsp;/ <span className="font-mono">&nbsp;{g.expect.toLocaleString()}</span>&nbsp;kg</div>;
}
function DkRow({ o }) {
  return (
    <div className={`px-3 py-1 grid ${DK_COLS} items-center gap-1.5`}>
      <span className={`text-center rounded py-0.5 text-[12px] font-semibold ${o.rem ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'}`}>{o.t}</span>
      {o.ton ? <span className="text-[13px] text-slate-500 pl-1">톤백</span>
        : o.rem ? <span className="text-[13px] text-slate-500 pl-1">포장지 없음</span>
          : <span className="h-8 flex items-center justify-between rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-800 min-w-0"><span className="truncate">{o.pk}</span><span className="text-slate-400 text-[10px] ml-1">▾</span></span>}
      {o.rem
        ? <span className="flex items-center gap-1 justify-end"><span className="h-8 w-[72px] rounded-md border border-slate-300 px-2 flex items-center justify-end font-mono font-bold text-[14px] text-slate-900">{o.w}</span><span className="text-[11px] text-slate-500">kg</span></span>
        : <div className="flex h-8 items-stretch rounded-md border border-slate-300 overflow-hidden"><button className="w-7 text-slate-600 bg-slate-50 hover:bg-slate-100 text-[15px]">−</button><span className="flex-1 border-x border-slate-300 flex items-center justify-center font-mono font-bold text-[14px] text-slate-900">{o.n}</span><button className="w-7 text-slate-600 bg-slate-50 hover:bg-slate-100 text-[15px]">+</button></div>}
      {o.ton
        ? <span className="h-8 rounded-md border border-slate-300 px-2 flex items-center justify-end font-mono font-bold text-[14px] text-slate-900">{o.w.toLocaleString()}</span>
        : <span className="text-right pr-1 font-mono font-bold text-[14px] text-slate-900">{(o.n * o.w).toLocaleString()}</span>}
      <button className="h-8 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50"><DkIco d={TRASH} s={15} /></button>
    </div>
  );
}
function DkRowRO({ o }) {
  return (
    <div className={`px-3 py-1.5 grid ${DK_RO_COLS} items-center gap-1.5 min-h-8`}>
      <span className={`text-center rounded py-0.5 text-[12px] font-semibold ${o.rem ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-700'}`}>{o.t}</span>
      <span className="text-[13px] text-slate-700 truncate pl-1">{o.ton ? '톤백' : o.rem ? '—' : o.pk}</span>
      <span className="text-right font-mono text-[14px] text-slate-900">{o.n}<span className="text-[11px] text-slate-500 font-sans ml-0.5">개</span></span>
      <span className="text-right font-mono text-[14px] font-bold text-slate-900">{(o.n * o.w).toLocaleString()}</span>
    </div>
  );
}
function DkFoot({ mode }) {
  const total = <div className="text-[13px] text-slate-600">총 포장 <b className="font-mono text-[18px] text-slate-900 ml-1">{DK_TOTAL.toLocaleString()}</b><span className="text-[13px] text-slate-500 ml-0.5">kg</span></div>;
  return (
    <div className="mx-6 py-4 border-t border-slate-200 flex items-center gap-2">
      {total}
      {mode === 'edit' && <>
        <button className="ml-auto h-9 px-3 rounded-md text-[13px] font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"><DkIco d={TRASH} s={13} />포장 초기화</button>
        <button className="h-9 px-3 rounded-md text-[13px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 flex items-center gap-1.5"><DkIco d={LOCK} s={13} />작업 마감</button>
        <button className="h-9 px-4 rounded-md bg-blue-600 text-white text-[14px] font-semibold">기록 저장</button>
      </>}
      {mode === 'closed' && <button className="ml-auto h-9 px-4 rounded-md border border-slate-300 text-slate-800 text-[14px] font-semibold flex items-center gap-1.5"><DkIco d={LOCK} s={13} />마감 해제</button>}
      {mode === 'view' && <span className="ml-auto text-[12px] text-slate-500">조회 전용</span>}
    </div>
  );
}
function DkNew({ mode = 'edit' }) {
  const ro = mode !== 'edit';
  return (
    <DkShell closed={mode === 'closed'} foot={<DkFoot mode={mode} />}>
      <DkSpecBand />
      <div className="flex-1 overflow-hidden px-6 py-3 space-y-3">
        {DK_GROUPS.map((g) => (
          <div key={g.lot} className="rounded-xl border border-slate-200 overflow-hidden">
            <DkGroupHead g={g} />
            {!ro && <div className="px-3 py-2 border-b border-slate-200 grid grid-cols-10 gap-1">{[...DK_SPECS, '기타'].map((s) => <button key={s} className={`h-8 rounded-md text-[13px] ${s === '기타' ? 'border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>{s}</button>)}</div>}
            <div className={`grid ${ro ? DK_RO_COLS : DK_COLS} gap-1.5 px-3 pt-2 pb-0.5 text-[11px] font-semibold text-slate-500`}><span className="text-center">규격</span><span className="pl-1">포장지</span><span className={ro ? 'text-right' : 'text-center'}>수량</span><span className="text-right pr-1">중량(kg)</span>{!ro && <span></span>}</div>
            <div className="divide-y divide-slate-100">{g.rows.map((o) => ro ? <DkRowRO key={o.t} o={o} /> : <DkRow key={o.t} o={o} />)}</div>
            <DkSubtotal g={g} />
          </div>
        ))}
      </div>
    </DkShell>
  );
}

Object.assign(window, { DkNow, DkNew });
