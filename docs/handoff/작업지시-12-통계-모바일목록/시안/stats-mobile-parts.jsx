// 재고분석 · 수율분석 모바일 목록 시안 부품
const SM_C = { done: '#8dc540', out: '#8b5cf6', left: '#f89c1e' };
const smKg = n => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
function SmIcon({ d, s = 14 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}></path></svg>; }
const SM_DOWN = 'm6 9 6 6 6-6', SM_RIGHT = 'm9 6 6 6-6 6';

function SmShell({ title, children, h }) {
  return (
    <div className="bg-slate-50 flex flex-col" style={{ minHeight: h }}>
      <div className="h-[52px] shrink-0 bg-white border-b border-slate-100 flex items-center px-4 text-[14px] font-bold text-slate-800">{title}</div>
      <div className="flex-1 px-1.5 pt-2 pb-2 flex flex-col gap-2">{children}</div>
      <div className="h-14 shrink-0 bg-white border-t border-slate-200 flex items-center justify-around text-[11px] text-slate-500">{['홈', '도정', '재고', '판매', '더보기'].map(t => <span key={t} className={t === '더보기' ? 'text-blue-600 font-bold' : ''}>{t}</span>)}</div>
    </div>
  );
}
function SmTabs({ tabs, on }) {
  return <div className="flex border-b border-slate-100">{tabs.map(t => <span key={t} className={`px-3 py-3 text-[13px] font-semibold border-b-2 -mb-px ${t === on ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>{t}</span>)}</div>;
}
// 목록 머리 — 범례 또는 정렬
function SmSeg({ opts, on, dir }) {
  return <span className="inline-flex p-0.5 rounded-lg bg-slate-100 text-[12px] font-semibold">{opts.map(o => <span key={o} className={`px-2.5 h-7 flex items-center gap-0.5 rounded-md ${o === on ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{o}{o === on && dir && <SmIcon s={11} d={dir === 'desc' ? SM_DOWN : 'm6 15 6-6 6 6'}></SmIcon>}</span>)}</span>;
}

// ── A-1 재고분석 ──
const SM_FARMERS = [['김영수', '송지작목반', 48200, 36400, 4800], ['박정희', '북평친환경작목반', 41600, 22100, 0], ['이순자', '화산유기농작목반', 38900, 30200, 6100], ['최동철', '송지작목반', 33400, 9800, 2400], ['정미경', '해남땅끝친환경쌀작목반', 29800, 27600, 0], ['한상우', '현산작목반', 27200, 14600, 8000], ['윤옥순', '북평친환경작목반', 24100, 21300, 1200], ['강기남', '송지작목반', 21800, 6200, 0]];
const SM_GROUPS = [['해남땅끝친환경쌀작목반', '유기농', 14, 212400, 168300, 12000], ['송지작목반', '무농약', 11, 186200, 92400, 18600], ['북평친환경작목반', '유기농', 9, 142800, 121000, 4200], ['화산유기농작목반', '유기농', 8, 118600, 70100, 22400], ['현산작목반', '일반', 6, 64200, 18000, 9600]];
const SM_VARS = [['새청무', 412600, 268200, 42000], ['신동진', 286400, 214800, 12800], ['찰현미', 98200, 40100, 0], ['흑미', 64800, 51800, 6000], ['해들', 42100, 12600, 0]];
const smRate = r => r <= 20 ? 'text-emerald-700' : r <= 50 ? 'text-amber-700' : 'text-red-600';

function SmStockBar({ total, done, out }) {
  const left = total - done - out;
  return <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden flex">{[[done, SM_C.done], [out, SM_C.out], [left, SM_C.left]].map(([v, c], i) => v > 0 && <span key={i} style={{ width: `${(v / total) * 100}%`, background: c }} className="h-full border-r border-white last:border-0"></span>)}</span>;
}
function SmStockRow({ i, name, sub, cert, count, total, done, out, open }) {
  const left = total - done - out, rate = (left / total) * 100;
  return (
    <div className={`border-b border-slate-100 ${open ? 'bg-slate-50' : ''}`}>
      <div className="px-3 py-2.5 grid grid-cols-[20px_minmax(0,1fr)_auto] gap-x-2 items-baseline">
        <span className="text-right text-[12px] tabular-nums text-slate-500">{i}</span>
        <span className="min-w-0 flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold text-slate-800">{name}</span>{cert && <SmCert c={cert}></SmCert>}{sub && <span className="truncate text-[11px] text-slate-500">{sub}</span>}</span>
        <span className="text-[13px] font-bold tabular-nums text-slate-800 whitespace-nowrap">{smKg(total)}<span className="ml-0.5 text-[11px] font-medium text-slate-500">kg</span></span>
        <span className="col-start-2 col-span-2 mt-1.5 flex items-center gap-2">
          <SmStockBar total={total} done={done} out={out}></SmStockBar>
          <span className="text-[11px] tabular-nums text-slate-500 whitespace-nowrap">{count != null && <>{count}명 · </>}재고 <b className={`font-bold ${smRate(rate)}`}>{rate.toFixed(1)}%</b></span>
        </span>
      </div>
      {open && <div className="px-3 pb-3 pl-[42px] grid grid-cols-3 gap-1.5">{[['도정완료', done, SM_C.done], ['직접출고', out, SM_C.out], ['미처리', left, SM_C.left]].map(([l, v, c]) => <div key={l} className="bg-white rounded-lg border border-slate-200 px-2 py-1.5"><p className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-2 h-2 rounded-sm" style={{ background: c }}></span>{l}</p><p className="text-[13px] font-bold tabular-nums text-slate-800">{smKg(v)}<span className="text-[11px] font-medium text-slate-500 ml-0.5">kg</span></p></div>)}</div>}
    </div>
  );
}
function SmCert({ c }) {
  const cls = c === '유기농' ? 'bg-green-100 text-green-800' : c === '무농약' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600';
  return <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls}`}>{c}</span>;
}
function SmStockLegend() {
  return <div className="flex gap-3 text-[11px] text-slate-500">{[['도정완료', SM_C.done], ['직접출고', SM_C.out], ['미처리', SM_C.left]].map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: c }}></span>{l}</span>)}</div>;
}
function SmStockList({ tab = '생산자', openIdx = -1, more, sort = '입고순' }) {
  let rows;
  if (tab === '생산자') rows = SM_FARMERS.map(([n, g, t, d, o]) => ({ name: n, sub: g, total: t, done: d, out: o }));
  else if (tab === '작목반') rows = SM_GROUPS.map(([n, c, k, t, d, o]) => ({ name: n, cert: c, count: k, total: t, done: d, out: o }));
  else rows = SM_VARS.map(([n, t, d, o]) => ({ name: n, total: t, done: d, out: o }));
  if (sort === '미처리순') rows = [...rows].sort((a, b) => (b.total - b.done - b.out) - (a.total - a.done - a.out));
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2"><SmStockLegend></SmStockLegend><SmSeg opts={['입고순', '미처리순']} on={sort}></SmSeg></div>
      {rows.map((r, i) => <SmStockRow key={r.name} i={i + 1} {...r} open={i === openIdx}></SmStockRow>)}
      {more && <div className="h-11 flex items-center justify-center gap-1 text-[13px] font-semibold text-slate-600">나머지 {more} 더 보기<SmIcon s={12} d={SM_DOWN}></SmIcon></div>}
    </div>
  );
}
function SmStockScreen({ tab, openIdx, more, sort, h = 900 }) {
  return (
    <SmShell title="재고분석" h={h}>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><SmTabs tabs={['생산자', '작목반', '품종']} on={tab}></SmTabs><div className="px-3 py-2.5 flex items-center gap-2 text-[12px]"><b className="text-slate-700">2025년산</b><span className="text-slate-500">벼 원물</span><span className="ml-auto h-8 px-2.5 rounded-lg bg-slate-100 font-semibold text-slate-700 flex items-center gap-1"><SmIcon s={13} d="M4 6h16M7 12h10M10 18h4"></SmIcon>조건</span></div></div>
      <div className="h-[86px] bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-[12px] text-slate-500">요약 · 차트 (1단계 반영분 · 생략)</div>
      <SmStockList tab={tab} openIdx={openIdx} more={more} sort={sort}></SmStockList>
    </SmShell>
  );
}

// ── A-2 수율분석 ──
const SM_YB = { good: 'bg-blue-600/10 text-blue-600', warn: 'bg-amber-50 text-amber-600', bad: 'bg-red-50 text-red-500' };
const SM_MILL = [['2026-09-30', '백미', '새청무', '김영수 외 3명', 2400, 1752, 73, 'good', '오후 2시 기계 점검 후 재개', 12, 8], ['2026-09-29', '현미', '찰현미', '이순자', 820, 672, 82, 'good', '', 3, 4], ['2026-09-27', '오분도미', '새청무 외 1', '박정희 외 1명', 1600, 1104, 69, 'warn', '', 6, 5], ['2026-09-26', '백미', '신동진', '최동철', 1200, 816, 68, 'bad', '수분 높음', 5, 3], ['2026-09-24', '칠분도미', '해들', '정미경 외 2명', 980, 706, 72, 'good', '', 4, 3], ['2026-09-23', '백미', '새청무', '한상우', 1800, 1314, 73, 'good', '', 7, 6]];
function SmMillRow({ r, open }) {
  const [date, type, vars, farmers, inKg, outKg, y, lv, note, nIn, nOut] = r;
  return (
    <div className={`border-b border-slate-100 ${open ? 'bg-slate-50' : ''}`}>
      <div className="px-3 py-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 items-center">
        <span className="min-w-0 flex items-center gap-1.5"><span className="font-mono text-[12px] tabular-nums text-slate-600">{date.slice(5)}</span><span className="shrink-0 px-1.5 py-0.5 rounded border border-blue-600/30 bg-blue-600/5 text-blue-600 text-[11px] font-bold">{type}</span><span className="truncate text-[13px] font-semibold text-slate-800">{vars}</span></span>
        <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold tabular-nums ${SM_YB[lv]}`}>{y}%</span>
        <span className="truncate text-[12px] text-slate-500">{farmers}</span>
        <span className="text-[12px] tabular-nums text-slate-600 whitespace-nowrap">{smKg(inKg)} <span className="text-slate-500">→</span> <b className="text-slate-800">{smKg(outKg)}</b><span className="text-[11px] text-slate-500 ml-0.5">kg</span></span>
      </div>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {note && <p className="text-[12px] text-slate-600 bg-white rounded-lg border border-slate-200 px-2.5 py-2">{note}</p>}
          <div className="grid grid-cols-2 gap-1.5">{[['투입 원물', nIn + '포대', inKg], ['포장 내역', nOut + '건', outKg]].map(([l, n, kg]) => <span key={l} className="h-11 rounded-lg border border-slate-200 bg-white px-2.5 flex items-center justify-between"><span className="text-[12px] font-semibold text-slate-700">{l} <span className="font-normal text-slate-500 tabular-nums">{n}</span></span><SmIcon s={14} d={SM_RIGHT}></SmIcon></span>)}</div>
        </div>
      )}
    </div>
  );
}
function SmMillList({ openIdx = -1, sort = '날짜', shown = 20, total = 120 }) {
  let rows = SM_MILL;
  if (sort === '수율') rows = [...rows].sort((a, b) => b[6] - a[6]);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2"><span className="text-[12px] text-slate-500">도정 상세 <b className="text-slate-700 tabular-nums">{total}건</b></span><SmSeg opts={['날짜', '수율', '생산량']} on={sort} dir="desc"></SmSeg></div>
      {rows.map((r, i) => <SmMillRow key={r[0]} r={r} open={i === openIdx}></SmMillRow>)}
      <div className="h-11 flex items-center justify-center gap-1 text-[13px] font-semibold text-slate-600"><span className="tabular-nums text-slate-500 font-normal mr-1">{shown}/{total}</span>20건 더 보기<SmIcon s={12} d={SM_DOWN}></SmIcon></div>
    </div>
  );
}
function SmMillScreen({ openIdx, sort, h = 820 }) {
  return (
    <SmShell title="수율분석" h={h}>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><SmTabs tabs={['기간', '품종', '도정구분']} on="기간"></SmTabs><div className="px-3 py-2.5 flex items-center gap-2 text-[12px]"><b className="text-slate-700">최근 6개월</b><span className="text-slate-500 tabular-nums">04.03 ~ 10.02</span><span className="ml-auto h-8 px-2.5 rounded-lg bg-slate-100 font-semibold text-slate-700 flex items-center gap-1"><SmIcon s={13} d="M4 6h16M7 12h10M10 18h4"></SmIcon>조건</span></div></div>
      <div className="h-[86px] bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-[12px] text-slate-500">요약 · 차트 (1단계 반영분 · 생략)</div>
      <SmMillList openIdx={openIdx} sort={sort}></SmMillList>
    </SmShell>
  );
}

// ── B 필터 칩 · 표 숫자 색 ──
function SmChipsCompare() {
  const now = [['유기농', 'bg-teal-50 text-teal-700'], ['송지작목반', 'bg-blue-50 text-blue-700'], ['새청무', 'bg-green-50 text-green-700'], ['김영수', 'bg-purple-50 text-purple-700']];
  const next = [['인증', '유기농'], ['작목반', '송지작목반'], ['품종', '새청무'], ['생산자', '김영수']];
  const X = <SmIcon s={11} d="M6 6l12 12M18 6 6 18"></SmIcon>;
  return (
    <div className="bg-white p-4 h-full flex flex-col gap-4 text-[12px]">
      <div><p className="text-slate-600 font-semibold mb-1.5">지금 — 조건마다 색이 다름 (생산자 보라)</p><div className="flex flex-wrap gap-1.5"><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">2025년산</span>{now.map(([l, c]) => <span key={l} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${c}`}>{l}{X}</span>)}</div></div>
      <div><p className="text-slate-600 font-semibold mb-1.5">제안 — 전부 파랑 하나 + 조건 이름을 앞에</p><div className="flex flex-wrap gap-1.5"><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">2025년산</span>{next.map(([k, v]) => <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium"><span className="text-blue-700/70">{k}</span><b className="font-semibold">{v}</b>{X}</span>)}</div></div>
      <div><p className="text-slate-600 font-semibold mb-1.5">수율분석 — 도정구분 칩·시트 선택도 같은 규칙</p><div className="flex flex-wrap gap-1.5"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium"><span className="text-blue-700/70">품종</span><b className="font-semibold">새청무</b>{X}</span><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium"><span className="text-blue-700/70">도정구분</span><b className="font-semibold">백미 · 현미</b>{X}</span><span className="ml-2 px-2.5 py-1 rounded-lg bg-blue-500 text-white font-semibold">백미</span><span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">오분도미</span><span className="text-slate-500 self-center">← 시트 선택 상태</span></div></div>
    </div>
  );
}
function SmTableNumbers({ next }) {
  const cols = [['도정완료', SM_C.done, '#7db037'], ['직접출고', SM_C.out, '#7c3aed'], ['미처리', SM_C.left, '#cc7b0c']];
  return (
    <div className="bg-white h-full">
      <div className="grid grid-cols-[90px_100px_repeat(3,1fr)_70px] h-10 items-center bg-slate-50 border-b border-slate-200 text-[12px] font-medium text-slate-600 px-3">
        <span>생산자명</span><span className="text-right">총 입고</span>{cols.map(([l, c]) => <span key={l} className="text-right flex items-center justify-end gap-1">{next && <span className="w-2 h-2 rounded-sm" style={{ background: c }}></span>}{l}</span>)}<span className="text-right">재고율</span>
      </div>
      {SM_FARMERS.slice(0, 4).map(([n, g, t, d, o]) => { const l = t - d - o, r = (l / t) * 100; return (
        <div key={n} className="grid grid-cols-[90px_100px_repeat(3,1fr)_70px] h-10 items-center border-b border-slate-100 text-[12px] tabular-nums px-3">
          <span className="font-medium text-slate-700">{n}</span><span className="text-right font-medium text-slate-700">{smKg(t)}</span>
          {[d, o, l].map((v, i) => <span key={i} className="text-right" style={{ color: next ? '#334155' : cols[i][2] }}>{smKg(v)}</span>)}
          <span className={`text-right font-semibold ${next ? smRate(r) : ''}`} style={next ? {} : { color: r <= 20 ? '#7db037' : r <= 50 ? '#cc7b0c' : '#ef4444' }}>{r.toFixed(1)}%</span>
        </div>); })}
    </div>
  );
}

Object.assign(window, { SmStockScreen, SmMillScreen, SmChipsCompare, SmTableNumbers });
