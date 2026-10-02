// 판매분석 시안 2 — 채널 색 검증 · 원물출고 탭 · 재고차감 사유
// ── 색 검증: 이웃 ΔE2000 (일반·제1·제2색약, Machado 2009 심도 1.0) · 흰 바탕 대비 ──
const ccLin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const ccGam = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const ccHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const CC_M = {
  deut: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  prot: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
function ccSim(hex, m) {
  const l = ccHex(hex).map(ccLin);
  if (!m) return ccHex(hex);
  return CC_M[m].map(r => Math.max(0, Math.min(255, ccGam(Math.max(0, Math.min(1, r[0] * l[0] + r[1] * l[1] + r[2] * l[2]))))));
}
function ccLab(rgb) {
  const [r, g, b] = rgb.map(ccLin);
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function ccDE([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, p7 = 25 ** 7;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + p7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const hh = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1 = hh(b1, a1p), h2 = hh(b2, a2p);
  let dh = C1 * C2 === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * rad / 2);
  const Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2;
  let hb = h1 + h2; if (C1 * C2 !== 0) hb = Math.abs(h1 - h2) > 180 ? (hb < 360 ? (hb + 360) / 2 : (hb - 360) / 2) : hb / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dT = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + p7));
  const Sl = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dT * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
const ccLum = hex => { const [r, g, b] = ccHex(hex).map(ccLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ccContrast = hex => 1.05 / (ccLum(hex) + 0.05);
const ccToHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

function CcPalette({ pk }) {
  const p = SS_PALETTES[pk], cols = SS_CH.map(c => p.c[c]);
  const pairs = cols.slice(0, -1).map((c, i) => {
    const d = m => ccDE(ccLab(ccSim(c, m)), ccLab(ccSim(cols[i + 1], m)));
    return { n: d(null), cvd: Math.min(d('deut'), d('prot')) };
  });
  const minN = Math.min(...pairs.map(x => x.n)), minC = Math.min(...pairs.map(x => x.cvd));
  const row = m => <div className="flex h-7 rounded overflow-hidden">{cols.map((c, i) => <span key={i} className="flex-1" style={{ background: m ? ccToHex(ccSim(c, m)) : c }}></span>)}</div>;
  return (
    <div className="bg-white p-4 h-full flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between"><b className="text-[14px] text-slate-800">{p.name}</b><span className="text-[12px] tabular-nums text-slate-600">이웃 최소 ΔE · 일반 <b className="text-slate-800">{minN.toFixed(1)}</b> · 색약 <b className={minC < 8 ? 'text-red-700' : 'text-slate-800'}>{minC.toFixed(1)}</b></span></div>
      <div className="grid grid-cols-6 text-[11px] text-slate-600 text-center">{SS_CH.map(c => <span key={c} className={c === 'EMART' ? 'font-bold text-slate-800' : ''}>{SS_LABEL[c]}</span>)}</div>
      <div className="grid grid-cols-[52px_1fr] gap-x-2 gap-y-1.5 items-center text-[11px] text-slate-500"><span>일반</span>{row(null)}<span>제2색약</span>{row('deut')}<span>제1색약</span>{row('prot')}</div>
      <div className="grid grid-cols-6 text-[11px] tabular-nums text-center text-slate-500">{cols.map((c, i) => <span key={i}><span className="font-mono">{c}</span><br></br><span className={ccContrast(c) < 3 ? 'text-amber-700 font-semibold' : ''}>{ccContrast(c).toFixed(1)}:1</span></span>)}</div>
      <div className="grid grid-cols-5 text-[11px] tabular-nums text-center text-slate-500 border-t border-slate-100 pt-2">{pairs.map((x, i) => <span key={i}>{SS_LABEL[SS_CH[i]].slice(0, 2)}↔{SS_LABEL[SS_CH[i + 1]].slice(0, 2)}<br></br>{x.n.toFixed(1)} / <b className="text-slate-700">{x.cvd.toFixed(1)}</b></span>)}</div>
    </div>
  );
}
function CcBadges() {
  const Prog = ({ l, cls, dot }) => <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${cls}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }}></span>{l}</span>;
  const C = [['택배', 'bg-blue-50 text-blue-700'], ['이마트', 'bg-pink-50 text-pink-700'], ['서울급식', 'bg-teal-50 text-teal-700'], ['해남급식', 'bg-cyan-50 text-cyan-700'], ['기업별', 'bg-slate-100 text-slate-600']];
  const rows = [[0, '오늘 오전', 'done'], [1, '오늘', 'part'], [2, '10/6 오전', 'done'], [3, '10/7', 'part'], [4, '10/8', 'wait']];
  return (
    <div className="bg-white p-4 h-full flex flex-col gap-2 text-[12px]">
      <p className="text-slate-600 font-semibold">C′ · 채널마다 색 바탕, 점 없음 — 원래 색 그대로, 이마트만 보라 → 분홍</p>
      <div className="border border-slate-100 rounded-lg overflow-hidden">
        {rows.map(([i, ld, st]) => <div key={i} className="grid grid-cols-[80px_minmax(0,1fr)_130px_80px] items-center h-10 px-3 border-t border-slate-100 first:border-0">
          <span className={`justify-self-start px-2 py-0.5 rounded-md text-[11px] font-bold ${C[i][1]}`}>{C[i][0]}</span>
          <span className="text-[13px] font-bold text-slate-800 truncate">{C[i][0]}_2610{String(i + 2).padStart(2, '0')}</span>
          <span className={`justify-self-start text-[12px] font-bold ${ld.startsWith('오늘') ? 'px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-700' : 'text-slate-700'}`}>{ld}</span>
          {st === 'done' ? <Prog l="완료" cls="bg-emerald-50 text-emerald-700" dot="#10b981"></Prog> : st === 'part' ? <Prog l="부분" cls="bg-amber-50 text-amber-700" dot="#f59e0b"></Prog> : <span className="text-[12px] text-slate-500">대기</span>}
        </div>)}
      </div>
      <p className="text-slate-500">서울급식(teal)과 「완료」(emerald)는 가까운 색이지만, 열이 떨어져 있고 점 유무로 모양이 갈린다. 노랑·빨강은 채널에 안 쓴다(부분·오늘 자리).</p>
    </div>
  );
}
function CcBadgesOld() {
  const Badge = ({ k, cls }) => <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 border ${cls}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: SS_COL[k] }}></span>{SS_LABEL[k]}</span>;
  const Prog = ({ l, cls, dot }) => <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${cls}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }}></span>{l}</span>;
  const opts = [['A · 흰 바탕 (지금)', 'bg-white border-slate-300 text-slate-700'], ['B · slate-100 바탕 (결정)', 'bg-slate-100 border-slate-200 text-slate-700']];
  return (
    <div className="bg-white p-4 h-full flex flex-col gap-3 text-[12px]">
      {opts.map(([t, cls]) => <div key={t}><p className="text-slate-600 font-semibold mb-1.5">{t}</p><div className="flex items-center gap-1.5 border-y border-slate-100 py-2">{['DELIVERY', 'EMART', 'MEAL_SEOUL', 'MEAL_HAENAM', 'CORPORATE'].map(k => <Badge key={k} k={k} cls={cls}></Badge>)}<span className="w-px h-4 bg-slate-200 mx-1"></span><Prog l="완료" cls="bg-emerald-50 text-emerald-700" dot="#10b981"></Prog><Prog l="부분" cls="bg-amber-50 text-amber-800" dot="#f59e0b"></Prog></div></div>)}
      <p className="text-slate-500">채널마다 색 바탕(C)을 깔면 서울급식이 「완료」, 해남급식이 「부분」과 겹친다 → 채널은 회색 덩어리 + 점, 진행은 색 바탕.</p>
    </div>
  );
}

// ── 원물출고 탭 ──
const RW_PURPOSE = { SALE: ['판매', '#0f766e'], OTHER: ['판매 아님', '#cbd5e1'] };
const RW_MONTHS = [[84.2, 0], [5.6, 0], [0, 3.0], [0, 4.4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0.8]].map(([s, o], i) => ({ label: `${i + 1}월`, v: { SALE: s, OTHER: o } }));
const RW_DEST = [['해남농협 RPC', '판매', 52.0, 6], ['강진 미곡처리장', '원물판매', 22.0, 3], ['땅끝정미소', '판매', 12.4, 2], ['박종진 (농가)', '종자', 6.0, 2], ['해남육묘장', '육묘장출고', 4.4, 2], ['송지작목반', '톤백 빌려줌', 0.8, 1]];
const RW_PURP = [['판매', 'SALE', 64.4, 8], ['원물판매', 'SALE', 22.0, 3], ['종자', 'OTHER', 6.0, 2], ['육묘장출고', 'OTHER', 4.4, 2], ['톤백 빌려줌', 'OTHER', 0.8, 1]];
const rwSale = p => ['판매', '원물판매'].includes(p);

function RwUnitNote() {
  return <div className="px-4 py-2 border-t border-slate-100 bg-amber-50/60 text-[12px] text-amber-900 flex items-center gap-1.5"><SsIcon s={13} d="M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></SsIcon><span><b>벼 원물</b>을 그대로 내보낸 기록이에요. 단위는 <b>톤</b>이고, 제품 판매(kg)와 따로 셉니다.</span></div>;
}
function RwPurposeTag({ p }) {
  return <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${rwSale(p) ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>{p}</span>;
}
function RwTable({ by = 'dest' }) {
  const rows = by === 'dest' ? RW_DEST : RW_PURP, total = 98.0, max = rows[0][2];
  return (
    <div>
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-100"><span className="inline-flex p-0.5 rounded-lg bg-slate-100 text-[12px] font-semibold">{[['dest', '출고처별'], ['purpose', '목적별']].map(([k, l]) => <span key={k} className={`px-3 py-1 rounded-md ${by === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{l}</span>)}</span></div>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_110px_70px_32%] items-center h-10 bg-slate-50 border-b border-slate-200 text-[12px] font-medium text-slate-600 px-1"><span className="text-right pr-3">순위</span><span className="px-3">{by === 'dest' ? '출고처' : '목적'}</span><span className="text-right px-3">출고량 (톤)</span><span className="text-right px-3">건</span><span className="px-3">비중</span></div>
      {rows.map((r, i) => (
        <div key={r[0]} className="grid grid-cols-[48px_minmax(0,1fr)_110px_70px_32%] items-center h-11 border-b border-slate-100 text-[13px] px-1">
          <span className="text-right pr-3 tabular-nums text-slate-500">{i + 1}</span>
          <span className="px-3 flex items-center gap-2 min-w-0 font-medium text-slate-800"><span className="truncate">{r[0]}</span>{by === 'dest' && <RwPurposeTag p={r[1]}></RwPurposeTag>}</span>
          <span className="text-right px-3 font-semibold tabular-nums text-slate-800">{r[2].toFixed(1)}</span>
          <span className="text-right px-3 tabular-nums text-slate-600">{r[3]}</span>
          <span className="px-3 flex items-center gap-2"><span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(r[2] / max) * 100}%`, background: rwSale(by === 'dest' ? r[1] : r[0]) ? '#0f766e' : '#94a3b8' }}></span></span><span className="w-12 text-right tabular-nums text-slate-600">{((r[2] / total) * 100).toFixed(1)}%</span></span>
        </div>
      ))}
    </div>
  );
}
function RwSummary({ mobile }) {
  const cards = [['출고량', '98.0', '톤', '판매 86.4 · 판매 아님 11.6'], ['출고', '16', '건'], ['출고처', '6', '곳']];
  if (mobile) return <div className="grid grid-cols-3 gap-2">{cards.map(([l, v, u]) => <div key={l} className="bg-white rounded-xl border border-slate-100 shadow-sm px-2.5 py-2"><p className="text-[11px] font-medium text-slate-500">{l}</p><p className="mt-0.5 flex items-baseline gap-0.5"><b className="text-[16px] tabular-nums text-slate-800">{v}</b><span className="text-[12px] text-slate-500">{u}</span></p></div>)}</div>;
  return (
    <div className="flex flex-col gap-3 w-48 shrink-0">
      {cards.map(([l, v, u, sub]) => <div key={l} className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex flex-col justify-center"><span className="text-[12px] font-bold text-slate-500 mb-2">{l}</span><div className="flex items-baseline justify-end gap-1"><span className="text-2xl font-bold leading-none tabular-nums text-slate-800">{v}</span><span className="text-[12px] font-semibold text-slate-500">{u}</span></div>{sub && <span className="mt-1.5 text-right text-[11px] tabular-nums text-slate-500">{sub}</span>}</div>)}
    </div>
  );
}
function RwLegend() { return <div className="flex gap-3 text-[12px] text-slate-500">{Object.values(RW_PURPOSE).map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }}></span>{l}</span>)}<span className="text-slate-500">(종자·육묘장·톤백)</span></div>; }
function RwDesktop({ by = 'dest' }) {
  return (
    <div className="bg-slate-50 p-5 flex flex-col gap-4 min-h-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><SsTabBar tab="raw"></SsTabBar><RwUnitNote></RwUnitNote><SsFilterBar raw></SsFilterBar><SsChips raw></SsChips></div>
      <div className="flex gap-3 items-stretch">
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between px-4 pt-3 pb-2"><p className="text-[12px] font-semibold text-slate-500">원물 출고 추이 · 월별 (톤)</p><RwLegend></RwLegend></div>
          <div className="px-2 pb-3"><SsTrend data={RW_MONTHS} w={820} h={240} col={{ SALE: '#0f766e', OTHER: '#cbd5e1' }} stackKeys={['SALE', 'OTHER']} unit="" maxBar={40}></SsTrend></div>
        </div>
        <RwSummary></RwSummary>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><RwTable by={by}></RwTable></div>
    </div>
  );
}
function RwMobile() {
  return (
    <SsMobileShell h={1000}>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><SsTabBar tab="raw" mobile></SsTabBar><RwUnitNote></RwUnitNote><SsMobileFilterRow raw></SsMobileFilterRow></div>
      <RwSummary mobile></RwSummary>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><div className="px-3 pt-3 pb-1 flex flex-col gap-1.5"><p className="text-[12px] font-semibold text-slate-500">원물 출고 추이 · 월별 (톤)</p><RwLegend></RwLegend></div><SsTrend data={RW_MONTHS} w={346} h={170} col={{ SALE: '#0f766e', OTHER: '#cbd5e1' }} stackKeys={['SALE', 'OTHER']} maxBar={22}></SsTrend></div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100"><span className="inline-flex p-0.5 rounded-lg bg-slate-100 text-[12px] font-semibold"><span className="px-3 py-1 rounded-md bg-white shadow-sm text-slate-800">출고처별</span><span className="px-3 py-1 text-slate-500">목적별</span></span></div>
        {RW_DEST.map((r, i) => <div key={r[0]} className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2"><span className="w-5 text-right text-[12px] tabular-nums text-slate-500">{i + 1}</span><span className="truncate text-[13px] font-semibold text-slate-800">{r[0]}</span><RwPurposeTag p={r[1]}></RwPurposeTag><span className="ml-auto text-[13px] font-bold tabular-nums text-slate-800">{r[2].toFixed(1)}<span className="text-[11px] font-medium text-slate-500 ml-0.5">톤</span></span></div>)}
      </div>
    </SsMobileShell>
  );
}

// ── B. 재고차감 사유 ──
const DD_TYPES = ['판매', '증정', '분실', '파손', '기타'];
const DD_LBL = 'text-[11px] font-bold tracking-wider text-slate-500';
function DdDialog({ type = null, customer = '', mobile = true, variant = 'next' }) {
  const next = variant === 'next';
  const sale = type === '판매';
  const block = !type ? null : sale && !customer ? '판매는 거래처를 적어주세요.' : null;
  const field = (on, val, ph) => <span className={`flex items-center h-9 px-3 rounded-md border text-[13px] ${on ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200'} ${val ? 'text-slate-800' : on ? 'text-slate-400' : 'text-slate-500'}`}>{val || ph}</span>;
  return (
    <div className="bg-black/30 h-full flex items-center justify-center p-2">
      <div className="bg-white rounded-xl shadow-2xl w-full overflow-hidden flex flex-col">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-start gap-2.5"><span className="w-[30px] h-[30px] rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0"><SsIcon s={16} d="M20 7 12 3 4 7v10l8 4 8-4zM9 12h6"></SsIcon></span><div><p className="text-[14px] font-bold text-slate-900">재고차감</p><p className="text-[12px] text-slate-500">고른 <b className="text-slate-700 tabular-nums">3건 12개</b>를 재고에서 빼고 이력에 남깁니다</p></div></div>
        <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-baseline gap-1.5"><span className={DD_LBL}>사유</span>{next && !type && <span className="text-[12px] text-slate-600">하나 골라주세요</span>}</div>
          <div className={`mt-1.5 ${mobile ? 'grid grid-cols-5' : 'flex'} gap-1.5`}>
            {DD_TYPES.map(t => <span key={t} className={`flex items-center justify-center rounded-lg border text-[13px] ${mobile ? 'h-[34px]' : 'h-[30px] px-3'} ${type === t ? 'border-blue-600/35 bg-blue-600/10 font-bold text-blue-600' : next && !type ? 'border-slate-300 border-dashed bg-white font-semibold text-slate-600' : 'border-slate-200 bg-white font-semibold text-slate-600'}`}>{t}</span>)}
          </div>
          <div className={`mt-3 grid gap-2.5 ${mobile ? (next ? 'grid-cols-[132px_minmax(0,1fr)]' : 'grid-cols-1') : 'grid-cols-[190px_1fr]'}`}>
            <label className="flex flex-col gap-1"><span className={DD_LBL}>발생일</span>{field(true, '2026-10-02')}</label>
            {next ? <label className="flex flex-col gap-1"><span className={DD_LBL}>거래처{sale && <span className="ml-1 tracking-normal text-blue-600">· 필수</span>}</span>{field(sale, customer, sale ? '예) 한살림 서울' : '판매일 때만 적어요')}</label>
              : sale && <label className="flex flex-col gap-1"><span className={DD_LBL}>거래처 <span className="tracking-normal text-blue-600">· 판매는 필수</span></span>{field(true, customer, '예) 한살림 서울, 현장판매')}</label>}
          </div>
          <label className="mt-3 flex flex-col gap-1"><span className={DD_LBL}>메모</span>{field(true, '', '예) 2~3월 출고분 소급 정리')}</label>
        </div>
        <div className="px-4 py-2.5 flex flex-col">{[['새청무 · 4kg', '김영수', 4], ['새청무 · 4kg', '김영수', 4], ['신동진 · 10kg', '박정희', 4]].map(([a, b, n], i) => <div key={i} className="flex items-center justify-between py-2 border-t border-slate-100 first:border-0 text-[13px]"><span><b className="text-slate-900">{a.split(' · ')[0]}</b> · {a.split(' · ')[1]} <span className="text-slate-500 ml-1">{b}</span></span><span className="flex items-center gap-1.5"><span className="w-16 h-9 rounded-md border border-slate-200 flex items-center justify-end px-2 tabular-nums">{n}</span><span className="text-[11px] text-slate-500">개</span></span></div>)}</div>
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between gap-3">
            <div><p className={`text-[12px] font-bold ${type ? 'text-slate-600' : 'text-slate-500'}`}>{type ? `${type}로 차감` : next ? '사유 미정' : '판매로 차감'}</p><p className="text-[12px] tabular-nums text-slate-500">3행 · 2026-10-02{customer ? ` · ${customer}` : ''}</p></div>
            <span className="text-[22px] font-extrabold tabular-nums text-slate-900">12개</span>
          </div>
          <div className="mt-2.5 flex gap-2"><span className="h-11 px-4 rounded-md border border-slate-200 bg-white text-[13px] font-semibold flex items-center">취소</span><span className={`flex-1 h-11 rounded-md text-[13px] font-semibold flex items-center justify-center ${!type || block ? 'bg-blue-600/40 text-white' : 'bg-blue-600 text-white'}`}>차감하기</span></div>
          {next && !type && <p className="mt-2 text-[12px] font-semibold text-slate-600">사유를 고르면 차감할 수 있어요.</p>}
          {block && <p className="mt-2 text-[12px] font-semibold text-red-600">{block}</p>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CcPalette, CcBadges, RwDesktop, RwMobile, DdDialog });
