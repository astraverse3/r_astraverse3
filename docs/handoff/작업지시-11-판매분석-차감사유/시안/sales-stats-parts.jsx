// 판매분석 시안 공용 — 데이터 · 색 · 차트 · PC/모바일 화면
const SS_CH = ['DELIVERY', 'EMART', 'MEAL_SEOUL', 'MEAL_HAENAM', 'CORPORATE', 'DIRECT'];
const SS_LABEL = { DELIVERY: '택배', EMART: '이마트', MEAL_SEOUL: '서울급식', MEAL_HAENAM: '해남급식', CORPORATE: '기업별', DIRECT: '직접판매' };
const SS_PALETTES = {
  now: { name: '현재', c: { DELIVERY: '#2a78d6', EMART: '#4a3aa7', MEAL_SEOUL: '#1baf7a', MEAL_HAENAM: '#eda100', CORPORATE: '#e87ba4', DIRECT: '#008300' } },
  brick: { name: 'A안 · 이마트 벽돌색', c: { DELIVERY: '#2a78d6', EMART: '#b9472a', MEAL_SEOUL: '#1baf7a', MEAL_HAENAM: '#eda100', CORPORATE: '#e87ba4', DIRECT: '#008300' } },
  ink: { name: 'B안 · 이마트 먹색', c: { DELIVERY: '#2a78d6', EMART: '#3b4656', MEAL_SEOUL: '#1baf7a', MEAL_HAENAM: '#eda100', CORPORATE: '#e87ba4', DIRECT: '#008300' } },
};
const SS_COL = SS_PALETTES.brick.c;
const ssFmt = n => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

// 실데이터 규모(10/1~10/2, 1,288kg)
const SS_TREND_NOW = Array.from({ length: 31 }, (_, i) => ({ d: i + 1, v: i === 0 ? { DELIVERY: 260, EMART: 438 } : i === 1 ? { DELIVERY: 204, MEAL_HAENAM: 386 } : {} }));
// 몇 달 뒤 — 한 달 가득 찬 경우(밀도 확인용)
const SS_TREND_FULL = Array.from({ length: 31 }, (_, i) => {
  const r = k => Math.round(((Math.sin(i * 1.7 + k) + 1.3) * 90) / 10) * 10;
  const wk = (i + 3) % 7 >= 5;
  return { d: i + 1, v: wk ? {} : { DELIVERY: r(1), EMART: i % 4 === 0 ? 420 : 0, MEAL_SEOUL: i % 7 === 2 ? 300 : 0, MEAL_HAENAM: i % 7 === 4 ? 380 : 0, CORPORATE: i % 10 === 6 ? 160 : 0, DIRECT: i % 5 === 1 ? 40 : 0 } };
});
const SS_SUMMARY = { kg: 1288, count: 214, orders: 61, customers: 10 };
const SS_ROWS = {
  channel: [['택배', 'DELIVERY', 464, 98, 52], ['이마트', 'EMART', 438, 72, 6], ['해남급식', 'MEAL_HAENAM', 386, 44, 3]],
  customer: [['이마트', 'EMART', 438, 72, 6], ['해남급식', 'MEAL_HAENAM', 386, 44, 3], ['박정숙', 'DELIVERY', 120, 24, 11], ['한살림 서울', 'DELIVERY', 96, 20, 9], ['이영미', 'DELIVERY', 64, 14, 7], ['해남로컬푸드', 'DELIVERY', 56, 12, 6], ['최민수', 'DELIVERY', 40, 9, 6], ['정은주', 'DELIVERY', 36, 8, 5], ['윤서연', 'DELIVERY', 28, 6, 4], ['강동원', 'DELIVERY', 24, 5, 4]],
  variety: [['새청무', null, 402, 64, 22], ['신동진', null, 286, 48, 17], ['찰현미', null, 198, 34, 12], ['흑미', null, 142, 28, 10], ['귀리', null, 120, 18, 8], ['찹쌀', null, 84, 14, 6], ['보리', null, 56, 8, 4]],
};
const SS_TABS = [['channel', '채널별', '채널'], ['customer', '거래처별', '거래처'], ['variety', '품종별', '품종'], ['product', '제품별', '제품']];

function SsLegend({ chs, col = SS_COL }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">{chs.map(c => <span key={c} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: col[c] }}></span>{SS_LABEL[c]}</span>)}</div>;
}
const ssPresent = t => SS_CH.filter(c => t.some(b => (b.v[c] || 0) > 0));

// 누적 막대 SVG. tickEvery: 눈금 간격, gap: 막대 사이 비율
function SsTrend({ data, w, h = 220, col = SS_COL, tickEvery = 1, gap = 0.25, maxBar = 36, unit = '', stackKeys = SS_CH, tip }) {
  const padL = 34, padB = 20, padT = 8, iw = w - padL - 6, ih = h - padB - padT;
  const tot = data.map(b => stackKeys.reduce((s, k) => s + (b.v[k] || 0), 0));
  const max = Math.max(...tot, 1), top = Math.ceil(max / 250) * 250 || 250;
  const slot = iw / data.length, bw = Math.min(maxBar, slot * (1 - gap));
  const ticks = [0, top / 2, top];
  return (
    <svg width={w} height={h} className="block">
      {ticks.map(t => { const y = padT + ih - (t / top) * ih; return <g key={t}><line x1={padL} x2={w - 6} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={t ? '3 3' : ''}></line><text x={padL - 5} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{t >= 1000 ? ssFmt(t / 1000) + '톤' : ssFmt(t) + unit}</text></g>; })}
      {tip != null && <rect x={padL + slot * tip} y={padT} width={slot} height={ih} fill="#f1f5f9"></rect>}
      {data.map((b, i) => { let y = padT + ih; const x = padL + slot * i + (slot - bw) / 2; return <g key={i}>{stackKeys.map(k => { const v = b.v[k] || 0; if (!v) return null; const hh = (v / top) * ih; y -= hh; return <rect key={k} x={x} y={y} width={bw} height={hh} fill={col[k]} stroke="#fff" strokeWidth={bw > 6 ? 1 : 0.5}></rect>; })}{(i % tickEvery === 0) && <text x={padL + slot * i + slot / 2} y={h - 5} textAnchor="middle" fontSize="11" fill="#64748b">{b.label || b.d}</text>}</g>; })}
    </svg>
  );
}

function SsSummaryCards({ s = SS_SUMMARY, neutral = true, empty }) {
  const cards = [['판매량', s.kg, 'kg', '#2a78d6'], ['판매 개수', s.count, '개', '#1baf7a'], ['주문', s.orders, '건', '#eda100'], ['거래처', s.customers, '곳', '#94a3b8']];
  return (
    <div className="flex flex-col gap-3 w-48 shrink-0">
      {cards.map(([l, v, u, a]) => (
        <div key={l} className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          {!neutral && <div className="h-[3px]" style={{ background: a }}></div>}
          <div className="flex-1 flex flex-col justify-center px-4 py-3">
            <div className="flex items-center gap-1 mb-2">{!neutral && <span className="w-2 h-2 rounded-full" style={{ background: a }}></span>}<span className="text-[12px] font-bold text-slate-500">{l}</span></div>
            <div className="flex items-baseline justify-end gap-1"><span className={`text-2xl font-bold leading-none tabular-nums ${empty ? 'text-slate-300' : 'text-slate-800'}`}>{empty ? '0' : ssFmt(v)}</span><span className="text-[12px] font-semibold text-slate-500">{u}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SsTabBar({ tab = 'channel', raw = true, mobile }) {
  const tabs = mobile ? [['channel', '채널'], ['customer', '거래처'], ['variety', '품종'], ['product', '제품']] : SS_TABS;
  return (
    <div className="flex items-center border-b border-slate-100">
      {tabs.map(([k, l]) => <span key={k} className={`${mobile ? 'px-3 text-[13px]' : 'px-5 text-sm'} py-3 font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>{l}</span>)}
      {raw && <><span className="w-px h-4 bg-slate-200 mx-1"></span><span className={`${mobile ? 'px-3 text-[13px]' : 'px-5 text-sm'} py-3 font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === 'raw' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>원물출고</span></>}
      {!mobile && <span className="ml-auto mr-2 w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500"><SsIcon d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"></SsIcon></span>}
    </div>
  );
}
function SsIcon({ d, s = 14 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}></path></svg>; }
const SS_SEL = 'flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-100 text-slate-700';
function SsFilterBar({ raw }) {
  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-2">
      <span className={SS_SEL}>{raw ? '올해' : '이번 달'}<SsIcon s={12} d="m6 9 6 6 6-6"></SsIcon></span>
      <span className="text-[12px] text-slate-500 tabular-nums">{raw ? '2026.01.01 ~ 2026.10.02' : '2026.10.01 ~ 2026.10.31'}</span>
      {(raw ? ['목적'] : ['곡종', '채널', '품종']).map(l => <span key={l} className={SS_SEL}>{l}<SsIcon s={12} d="m6 9 6 6 6-6"></SsIcon></span>)}
      <div className="ml-auto flex gap-1.5"><span className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-100 text-slate-500">초기화</span><span className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-blue-500 text-white">검색</span></div>
    </div>
  );
}
function SsChips({ raw }) {
  return <div className="px-4 py-2 border-t border-slate-50 flex items-center gap-1.5 min-h-[2.5rem]"><span className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-slate-100 text-slate-600 tabular-nums">{raw ? '올해 · 2026.01.01 ~ 10.02' : '이번 달 · 2026.10.01 ~ 10.31'}</span></div>;
}

function SsTable({ tab = 'channel', limit, col = SS_COL }) {
  const rows = SS_ROWS[tab] || SS_ROWS.variety, total = rows.reduce((s, r) => s + r[2], 0), max = rows[0][2];
  const shown = limit ? rows.slice(0, limit) : rows;
  const colName = SS_TABS.find(t => t[0] === tab)[2];
  return (
    <div>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_110px_80px_80px_32%] items-center h-10 bg-slate-50 border-b border-slate-200 text-[12px] font-medium text-slate-600 px-1">
        <span className="text-right pr-3">순위</span><span className="px-3">{colName}</span><span className="text-right px-3">판매량 (kg)</span><span className="text-right px-3">개수</span><span className="text-right px-3">주문</span><span className="px-3">비중</span>
      </div>
      {shown.map((r, i) => {
        const c = r[1] ? col[r[1]] : '#2a78d6';
        return (
          <div key={r[0]} className="grid grid-cols-[48px_minmax(0,1fr)_110px_80px_80px_32%] items-center h-11 border-b border-slate-100 text-[13px] px-1">
            <span className="text-right pr-3 tabular-nums text-slate-500">{i + 1}</span>
            <span className="px-3 flex items-center gap-2 min-w-0 font-medium text-slate-800"><span className="truncate">{r[0]}</span>{tab === 'customer' && <span className="flex items-center gap-1 text-[12px] font-normal text-slate-500 shrink-0"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c }}></span>{SS_LABEL[r[1]]}</span>}</span>
            <span className="text-right px-3 font-semibold tabular-nums text-slate-800">{ssFmt(r[2])}</span>
            <span className="text-right px-3 tabular-nums text-slate-600">{r[3]}</span>
            <span className="text-right px-3 tabular-nums text-slate-600">{r[4]}</span>
            <span className="px-3 flex items-center gap-2"><span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(r[2] / max) * 100}%`, background: c }}></span></span><span className="w-12 text-right tabular-nums text-slate-600">{((r[2] / total) * 100).toFixed(1)}%</span></span>
          </div>
        );
      })}
      {limit && rows.length > limit && <div className="h-11 flex items-center justify-center text-[13px] font-semibold text-slate-600">나머지 {rows.length - limit}곳 더 보기 <span className="ml-1 text-slate-400"><SsIcon s={12} d="m6 9 6 6 6-6"></SsIcon></span></div>}
    </div>
  );
}

// PC 전체 — variant: 'now' 현재 코드 / 'next' 제안 / 'empty' 빈 상태
function SsDesktop({ variant = 'next', tab = 'channel', limit }) {
  const next = variant !== 'now', empty = variant === 'empty';
  const col = next ? SS_COL : SS_PALETTES.now.c;
  return (
    <div className="bg-slate-50 p-5 flex flex-col gap-4 min-h-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><SsTabBar tab={tab} raw={next}></SsTabBar><SsFilterBar></SsFilterBar><SsChips></SsChips></div>
      <div className="flex gap-3 items-stretch">
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-2"><p className="text-[12px] font-semibold text-slate-500">판매량 추이 · 일별</p>{!empty && <SsLegend chs={ssPresent(SS_TREND_NOW)} col={col}></SsLegend>}</div>
          <div className="px-2 pb-3 relative">
            {empty ? <div className="h-[260px] flex flex-col items-center justify-center gap-3"><p className="text-sm text-slate-600 font-semibold">이 기간에 판매가 없어요</p><p className="text-[12px] text-slate-500">판매는 2026.10.01부터 기록되고 있어요</p><span className="px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-slate-200 text-slate-600">이번 달로 보기</span></div>
              : <SsTrend data={SS_TREND_NOW} w={820} h={260} col={col}></SsTrend>}
          </div>
        </div>
        <SsSummaryCards neutral={next} empty={empty}></SsSummaryCards>
      </div>
      {!empty && <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><SsTable tab={tab} limit={limit} col={col}></SsTable></div>}
    </div>
  );
}

// ── 모바일 ──
function SsMobileShell({ children, h }) {
  return (
    <div className="bg-slate-50 relative flex flex-col" style={{ height: h }}>
      <div className="h-[52px] shrink-0 bg-white border-b border-slate-100 flex items-center px-4 text-[14px] font-bold text-slate-800">판매분석</div>
      <div className="flex-1 overflow-hidden px-1.5 pt-2 flex flex-col gap-2">{children}</div>
      <div className="h-14 shrink-0 bg-white border-t border-slate-200 flex items-center justify-around text-[11px] text-slate-500">{['홈', '도정', '재고', '판매', '더보기'].map(t => <span key={t} className={t === '판매' ? 'text-blue-600 font-bold' : ''}>{t}</span>)}</div>
    </div>
  );
}
function SsMobileFilterRow({ raw, count = 0 }) {
  return (
    <div className="px-3 py-2.5 flex items-center gap-2 border-t border-slate-50">
      <span className="text-[12px] font-semibold text-slate-700">{raw ? '올해' : '이번 달'}</span>
      <span className="text-[12px] text-slate-500 tabular-nums truncate">{raw ? '01.01 ~ 10.02' : '10.01 ~ 10.31'}</span>
      <span className="ml-auto flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-100 text-[12px] font-semibold text-slate-700"><SsIcon s={13} d="M4 6h16M7 12h10M10 18h4"></SsIcon>조건{count > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[11px] font-mono flex items-center justify-center">{count}</span>}</span>
      <span className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500"><SsIcon d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"></SsIcon></span>
    </div>
  );
}
function SsMobileSummary({ s = SS_SUMMARY }) {
  return <div className="grid grid-cols-2 gap-2">{[['판매량', s.kg, 'kg'], ['판매 개수', s.count, '개'], ['주문', s.orders, '건'], ['거래처', s.customers, '곳']].map(([l, v, u]) => <div key={l} className="bg-white rounded-xl border border-slate-100 shadow-sm px-3 py-2.5 flex items-center justify-between"><span className="text-[12px] font-medium text-slate-500">{l}</span><span className="flex items-baseline gap-0.5"><b className="text-[14px] tabular-nums text-slate-800">{ssFmt(v)}</b><span className="text-[12px] text-slate-500">{u}</span></span></div>)}</div>;
}
// 표 → 두 줄 목록
function SsMobileList({ tab = 'channel', limit, col = SS_COL }) {
  const rows = SS_ROWS[tab], total = rows.reduce((s, r) => s + r[2], 0), max = rows[0][2];
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {shown.map((r, i) => {
        const c = r[1] ? col[r[1]] : '#2a78d6';
        return (
          <div key={r[0]} className="px-3 py-2.5 border-b border-slate-100 grid grid-cols-[20px_minmax(0,1fr)_auto] gap-x-2 items-baseline">
            <span className="text-[12px] tabular-nums text-slate-500 text-right">{i + 1}</span>
            <span className="min-w-0 flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold text-slate-800">{r[0]}</span>{tab === 'customer' && <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0"><span className="w-1.5 h-1.5 rounded-full" style={{ background: c }}></span>{SS_LABEL[r[1]]}</span>}</span>
            <span className="text-[13px] font-bold tabular-nums text-slate-800">{ssFmt(r[2])}<span className="text-[11px] font-medium text-slate-500 ml-0.5">kg</span></span>
            <span></span>
            <span className="col-span-2 mt-1.5 flex items-center gap-2"><span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(r[2] / max) * 100}%`, background: c }}></span></span><span className="text-[11px] tabular-nums text-slate-500 whitespace-nowrap">{r[3]}개 · 주문 {r[4]} · <b className="text-slate-700">{((r[2] / total) * 100).toFixed(1)}%</b></span></span>
          </div>
        );
      })}
      {limit && rows.length > limit && <div className="h-11 flex items-center justify-center text-[13px] font-semibold text-slate-600">나머지 {rows.length - limit}곳 더 보기</div>}
    </div>
  );
}
function SsMobile({ tab = 'channel', data = SS_TREND_NOW, limit, h = 1180 }) {
  return (
    <SsMobileShell h={h}>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><SsTabBar tab={tab} mobile></SsTabBar><SsMobileFilterRow></SsMobileFilterRow></div>
      <SsMobileSummary></SsMobileSummary>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="px-3 pt-3 pb-1 flex flex-col gap-1.5"><p className="text-[12px] font-semibold text-slate-500">판매량 추이 · 일별</p><SsLegend chs={ssPresent(data)}></SsLegend></div>
        <div className="pb-2"><SsTrend data={data} w={346} h={180} tickEvery={7} gap={0.2} maxBar={20}></SsTrend></div>
      </div>
      <SsMobileList tab={tab} limit={limit}></SsMobileList>
    </SsMobileShell>
  );
}
// 일별 31개 처리 3가지
function SsDensity({ kind }) {
  const w = 346;
  return (
    <div className="bg-white p-3 h-full flex flex-col gap-2">
      {kind === 'scroll' && <><div className="overflow-hidden"><SsTrend data={SS_TREND_FULL.slice(0, 14)} w={w - 24} h={170} maxBar={18}></SsTrend></div><p className="text-[12px] text-slate-500">→ 옆으로 밀어야 나머지 17일. 한 달 모양이 한눈에 안 들어옴.</p></>}
      {kind === 'thin' && <><SsTrend data={SS_TREND_FULL} w={w} h={170} tickEvery={7} gap={0.2} maxBar={20} tip={14}></SsTrend><div className="self-center -mt-1 bg-white border border-slate-200 rounded-lg shadow px-2.5 py-1.5 text-[12px] flex gap-3"><b className="text-slate-700">10/15</b><span className="tabular-nums text-slate-600">합계 <b className="text-slate-800">612 kg</b></span></div><p className="text-[12px] text-slate-500">막대 약 9px · 눈금 1·8·15·22·29 · 탭하면 툴팁.</p></>}
      {kind === 'week' && <><SsTrend data={[0, 1, 2, 3, 4].map(k => ({ label: ['1주', '2주', '3주', '4주', '5주'][k], v: SS_CH.reduce((o, c) => (o[c] = SS_TREND_FULL.slice(k * 7, k * 7 + 7).reduce((s, b) => s + (b.v[c] || 0), 0), o), {}) }))} w={w} h={170} maxBar={36}></SsTrend><p className="text-[12px] text-slate-500">PC와 묶음 단위가 달라짐 — 같은 조건인데 화면마다 모양이 다름.</p></>}
    </div>
  );
}
function SsFilterSheet() {
  const Chip = ({ on, children }) => <span className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold ${on ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'}`}>{children}</span>;
  return (
    <SsMobileShell h={720}>
      <div className="absolute inset-0 bg-black/30 z-40"></div>
      <div className="absolute left-3 right-3 z-50 bg-white rounded-2xl shadow-2xl flex flex-col" style={{ bottom: 64 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">검색 조건</h3><span className="text-slate-500"><SsIcon s={16} d="M6 6l12 12M18 6 6 18"></SsIcon></span></div>
        <div className="px-4 py-3 flex flex-col gap-3.5">
          <div><p className="text-[12px] font-semibold text-slate-500 mb-1.5">기간</p><div className="flex flex-wrap gap-1.5">{['이번 달', '지난 달', '최근 3개월', '최근 6개월', '올해', '최근 1년', '직접 지정'].map(l => <Chip key={l} on={l === '이번 달'}>{l}</Chip>)}</div><p className="mt-1.5 text-[12px] text-slate-500 tabular-nums">2026.10.01 ~ 2026.10.31</p></div>
          <div><p className="text-[12px] font-semibold text-slate-500 mb-1.5">곡종</p><div className="flex flex-wrap gap-1.5">{['쌀', '현미', '잡곡'].map(l => <Chip key={l}>{l}</Chip>)}</div></div>
          <div><p className="text-[12px] font-semibold text-slate-500 mb-1.5">채널</p><div className="flex flex-wrap gap-1.5">{SS_CH.map(c => <Chip key={c} on={c === 'DELIVERY'}>{SS_LABEL[c]}</Chip>)}</div></div>
          <div><p className="text-[12px] font-semibold text-slate-500 mb-1.5">품종</p><div className="flex flex-wrap gap-1.5">{SS_ROWS.variety.map(r => <Chip key={r[0]}>{r[0]}</Chip>)}</div></div>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex gap-2"><span className="h-11 px-4 rounded-lg bg-slate-100 text-slate-600 text-[13px] font-semibold flex items-center">초기화</span><span className="flex-1 h-11 rounded-lg bg-blue-500 text-white text-[13px] font-semibold flex items-center justify-center">검색</span></div>
      </div>
    </SsMobileShell>
  );
}

Object.assign(window, { SS_CH, SS_LABEL, SS_PALETTES, SS_COL, ssFmt, SS_TREND_NOW, SS_TREND_FULL, SsTrend, SsLegend, SsTabBar, SsFilterBar, SsChips, SsDesktop, SsMobile, SsMobileShell, SsMobileFilterRow, SsDensity, SsFilterSheet, SsIcon, SsSummaryCards });
