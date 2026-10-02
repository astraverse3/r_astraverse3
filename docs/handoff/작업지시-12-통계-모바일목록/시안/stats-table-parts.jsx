// 통계 표 PC 공통 겉모양 (작업지시 ⑫ C) — 판매 · 재고 · 수율
// 규칙: 카드 rounded-2xl border-slate-100 shadow-sm / 머리줄 h-10 bg-slate-50 12px slate-600 / 행 h-11 13px border-slate-100 · 줄무늬 없음 · 호버 slate-50
//       주 값 굵게 slate-800 · 나머지 slate-600 · 판정 색은 재고율·수율만 / 눌리는 숫자 = 점선 밑줄 한 종류
const TB_CARD = 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden';
const TB_HEAD = 'h-10 items-center bg-slate-50 border-b border-slate-200 text-[12px] font-medium text-slate-600 px-1';
const TB_ROW = 'h-11 items-center border-b border-slate-100 last:border-b-0 text-[13px] px-1';
const TB_LINK = 'underline decoration-dotted decoration-slate-400 underline-offset-[3px] cursor-pointer';

function TbStock({ hover = 1 }) {
  const g = 'grid grid-cols-[48px_minmax(0,1fr)_100px_92px_92px_92px_72px_22%]';
  const cols = [['도정완료', SM_C.done], ['직접출고', SM_C.out], ['미처리', SM_C.left]];
  const rows = SM_FARMERS.slice(0, 6);
  return (
    <div className={TB_CARD}>
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between"><span className="text-[12px] text-slate-500">총 입고 많은 순 · <b className="text-slate-700 tabular-nums">119명</b></span><SmSegPc opts={['입고순', '미처리순']} on="입고순"></SmSegPc></div>
      <div className={`${g} ${TB_HEAD}`}><span className="text-right pr-3">순위</span><span className="px-3">생산자</span><span className="text-right px-3">총 입고 (kg)</span>{cols.map(([l, c]) => <span key={l} className="px-3 flex items-center justify-end gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: c }}></span>{l}</span>)}<span className="text-right px-3">재고율</span><span className="px-3">구성</span></div>
      {rows.map(([n, grp, t, d, o], i) => { const l = t - d - o, r = (l / t) * 100; return (
        <div key={n} className={`${g} ${TB_ROW} tabular-nums ${i === hover ? 'bg-slate-50' : ''}`}>
          <span className="text-right pr-3 text-slate-500">{i + 1}</span>
          <span className="px-3 min-w-0 flex items-center gap-2"><span className="font-medium text-slate-800">{n}</span><span className="truncate text-[12px] text-slate-500">{grp}</span></span>
          <span className="text-right px-3 font-semibold text-slate-800">{smKg(t)}</span>
          {[d, o, l].map((v, k) => <span key={k} className="text-right px-3 text-slate-600">{smKg(v)}</span>)}
          <span className={`text-right px-3 font-semibold ${smRate(r)}`}>{r.toFixed(1)}%</span>
          <span className="px-3 flex"><SmStockBar total={t} done={d} out={o}></SmStockBar></span>
        </div>); })}
      <div className="h-11 flex items-center justify-center gap-1 text-[13px] font-semibold text-slate-600 border-t border-slate-100">나머지 99명 더 보기<SmIcon s={12} d={SM_DOWN}></SmIcon></div>
    </div>
  );
}
function TbGroupRow() {
  const g = 'grid grid-cols-[48px_minmax(0,1fr)_64px_100px_92px_92px_92px_72px_18%]';
  return (
    <div className={TB_CARD}>
      <div className={`${g} ${TB_HEAD}`}><span className="text-right pr-3">순위</span><span className="px-3">작목반</span><span className="text-right px-3">생산자</span><span className="text-right px-3">총 입고 (kg)</span>{[['도정완료', SM_C.done], ['직접출고', SM_C.out], ['미처리', SM_C.left]].map(([l, c]) => <span key={l} className="px-3 flex items-center justify-end gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: c }}></span>{l}</span>)}<span className="text-right px-3">재고율</span><span className="px-3">구성</span></div>
      {SM_GROUPS.slice(0, 3).map(([n, c, k, t, d, o], i) => { const l = t - d - o, r = (l / t) * 100; return (
        <div key={n} className={`${g} ${TB_ROW} tabular-nums`}>
          <span className="text-right pr-3 text-slate-500">{i + 1}</span>
          <span className="px-3 min-w-0 flex items-center gap-1.5"><span className="truncate font-medium text-slate-800">{n}</span><SmCert c={c}></SmCert></span>
          <span className="text-right px-3 text-slate-600">{k}명</span>
          <span className="text-right px-3 font-semibold text-slate-800">{smKg(t)}</span>
          {[d, o, l].map((v, x) => <span key={x} className="text-right px-3 text-slate-600">{smKg(v)}</span>)}
          <span className={`text-right px-3 font-semibold ${smRate(r)}`}>{r.toFixed(1)}%</span>
          <span className="px-3 flex"><SmStockBar total={t} done={d} out={o}></SmStockBar></span>
        </div>); })}
    </div>
  );
}
function SmSegPc({ opts, on }) {
  return <span className="inline-flex p-0.5 rounded-lg bg-slate-100 text-[12px] font-semibold">{opts.map(o => <span key={o} className={`px-2.5 h-7 flex items-center rounded-md ${o === on ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{o}</span>)}</span>;
}

function TbMilling({ now }) {
  const g = 'grid grid-cols-[110px_86px_minmax(0,1fr)_minmax(0,1fr)_100px_100px_80px_minmax(0,1fr)]';
  const Sort = ({ on }) => <SmIcon s={11} d={on ? SM_DOWN : 'm7 15 5 5 5-5M7 9l5-5 5 5'}></SmIcon>;
  if (now) return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50"><h3 className="text-sm font-semibold text-slate-700">도정 상세 내역</h3><p className="text-[12px] text-slate-400 mt-0.5">총 120건</p></div>
      <div className={`grid grid-cols-[110px_86px_minmax(0,1fr)_minmax(0,1fr)_100px_100px_80px_minmax(0,1fr)] h-10 items-center border-b border-slate-200 text-[14px] font-medium text-slate-700 px-2`}>{['날짜', '도정종류', '품종', '생산자', '투입량 (kg)', '생산량 (kg)', '수율 (%)', '비고'].map((h, i) => <span key={h} className="px-2 flex items-center gap-1">{h}<span className={i ? 'opacity-40' : ''}><Sort on={i === 0}></Sort></span></span>)}</div>
      {SM_MILL.slice(0, 4).map(r => <div key={r[0]} className="grid grid-cols-[110px_86px_minmax(0,1fr)_minmax(0,1fr)_100px_100px_80px_minmax(0,1fr)] h-11 items-center border-b border-slate-100 text-[14px] px-2">
        <span className="px-2 font-mono text-[12px] text-slate-600">{r[0]}</span><span className="px-2"><span className="px-1.5 rounded border border-blue-600/30 bg-blue-600/5 text-blue-600 text-[10px] font-bold">{r[1]}</span></span><span className="px-2 text-[12px] text-slate-500 truncate">{r[2]}</span><span className="px-2 text-[12px] text-slate-500 truncate">{r[3]}</span>
        <span className="px-2 font-medium text-slate-700 underline decoration-dotted underline-offset-2">{smKg(r[4])}</span><span className="px-2 font-bold text-[#0080c8] underline decoration-dashed decoration-[#0080c8]/40 underline-offset-2">{smKg(r[5])}</span>
        <span className="px-2"><span className={`px-2 py-0.5 rounded-full text-[12px] font-bold ${SM_YB[r[7]]}`}>{r[6]}%</span></span><span className="px-2 text-[12px] text-slate-400 truncate">{r[8] || '-'}</span></div>)}
      <div className="px-5 py-3 flex justify-between text-[12px] text-slate-500"><span>1–10 / 120건</span><span>‹ 1 / 12 ›</span></div>
    </div>
  );
  return (
    <div className={TB_CARD}>
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-baseline gap-2"><h3 className="text-[13px] font-semibold text-slate-800">도정 상세 내역</h3><span className="text-[12px] text-slate-500 tabular-nums">120건</span><span className="ml-auto text-[12px] text-slate-500">위 탭과 상관없이 기간 조건 전체</span></div>
      <div className={`${g} ${TB_HEAD}`}>{[['날짜', 'desc'], ['도정종류'], ['품종'], ['생산자'], ['투입 (kg)', 0, 1], ['생산 (kg)', 0, 1], ['수율', 0, 1], ['비고']].map(([h, on, right]) => <span key={h} className={`px-3 flex items-center gap-1 ${right ? 'justify-end' : ''} ${on ? 'text-slate-800' : ''}`}>{h}<span className={on ? 'text-slate-700' : 'text-slate-400'}><Sort on={!!on}></Sort></span></span>)}</div>
      {SM_MILL.slice(0, 4).map((r, i) => <div key={r[0]} className={`${g} ${TB_ROW} tabular-nums ${i === 1 ? 'bg-slate-50' : ''}`}>
        <span className="px-3 font-mono text-[12px] text-slate-600">{r[0]}</span>
        <span className="px-3"><span className="px-1.5 py-0.5 rounded border border-blue-600/30 bg-blue-600/5 text-blue-600 text-[11px] font-bold">{r[1]}</span></span>
        <span className="px-3 truncate text-slate-800">{r[2]}</span><span className="px-3 truncate text-[12px] text-slate-600">{r[3]}</span>
        <span className={`px-3 text-right text-slate-600 ${TB_LINK}`}>{smKg(r[4])}</span>
        <span className={`px-3 text-right font-semibold text-slate-800 ${TB_LINK}`}>{smKg(r[5])}</span>
        <span className="px-3 text-right"><span className={`px-2 py-0.5 rounded-full text-[12px] font-bold ${SM_YB[r[7]]}`}>{r[6]}%</span></span>
        <span className="px-3 truncate text-[12px] text-slate-500">{r[8] || '—'}</span></div>)}
      <div className="h-11 px-4 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500 tabular-nums"><span>1–10 / 120건</span><span className="flex items-center gap-1"><span className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400"><SmIcon d="m15 6-6 6 6 6"></SmIcon></span><b className="px-1 text-slate-700">1 / 12</b><span className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600"><SmIcon d={SM_RIGHT}></SmIcon></span></span></div>
    </div>
  );
}
function TbSales() {
  const g = 'grid grid-cols-[48px_minmax(0,1fr)_110px_80px_80px_32%]';
  const rows = [['택배', '#2a78d6', 464, 98, 52], ['이마트', '#b9472a', 438, 72, 6], ['해남급식', '#eda100', 386, 44, 3]];
  return (
    <div className={TB_CARD}>
      <div className={`${g} ${TB_HEAD}`}><span className="text-right pr-3">순위</span><span className="px-3">채널</span><span className="text-right px-3">판매량 (kg)</span><span className="text-right px-3">개수</span><span className="text-right px-3">주문</span><span className="px-3">비중</span></div>
      {rows.map(([n, c, kg, ct, od], i) => <div key={n} className={`${g} ${TB_ROW} tabular-nums`}><span className="text-right pr-3 text-slate-500">{i + 1}</span><span className="px-3 font-medium text-slate-800">{n}</span><span className="text-right px-3 font-semibold text-slate-800">{kg}</span><span className="text-right px-3 text-slate-600">{ct}</span><span className="text-right px-3 text-slate-600">{od}</span><span className="px-3 flex items-center gap-2"><span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(kg / 464) * 100}%`, background: c }}></span></span><span className="w-12 text-right text-slate-600">{((kg / 1288) * 100).toFixed(1)}%</span></span></div>)}
    </div>
  );
}
function TbSpec() {
  const R = ({ k, v }) => <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 border-b border-slate-100 last:border-0"><span className="text-slate-500">{k}</span><span className="text-slate-800">{v}</span></div>;
  return (
    <div className="bg-white p-5 h-full text-[12px]">
      <R k="카드" v="rounded-2xl · border-slate-100 · shadow-sm (수율도 테두리 추가)"></R>
      <R k="카드 머리" v="표가 위 탭과 따로 놀 때만 — 수율 「도정 상세 내역 120건」 13px. 판매·재고는 탭 이름이 제목이라 없음"></R>
      <R k="머리글 줄" v="h-10 · bg-slate-50 · 아래선 slate-200 · 12px medium slate-600"></R>
      <R k="행" v="h-11 · 13px · 아래선 slate-100 · 줄무늬 없음 · 호버 bg-slate-50"></R>
      <R k="보조 글자" v="날짜 mono 12 slate-600 · 생산자/작목반/비고 12 slate-500~600"></R>
      <R k="숫자" v="주 값(판매량·총 입고·생산) semibold slate-800 · 나머지 slate-600 · 계열 색 글자 없음"></R>
      <R k="판정 색" v="재고율 글자(emerald-700/amber-700/red-600) · 수율 배지(YIELD_BADGE_CLASS)만"></R>
      <R k="눌리는 숫자" v="점선 밑줄 한 종류(decoration-slate-400) · 파랑·대시 밑줄 없앰"></R>
      <R k="긴 목록" v="합계 표 = 상위 20 + 더 보기 · 원장(수율) = 10줄 페이지 유지, 바닥줄 h-11"></R>
    </div>
  );
}
Object.assign(window, { TbStock, TbGroupRow, TbMilling, TbSales, TbSpec });
