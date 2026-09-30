/* 실제 앱 duotone.tsx 규칙: stroke 1.8 · round · active면 몸통 currentColor 채움 + 안쪽 선 #fff */
const hbF = a => (a ? 'currentColor' : 'none');
const hbW = a => (a ? '#fff' : 'currentColor');
const HB_P = {
  bell: a => <><path d="M6 9.5a6 6 0 0 1 12 0c0 4.2 1 6.4 2.1 7.5H3.9C5 15.9 6 13.7 6 9.5Z" fill={hbF(a)} /><path d="M10 20.2a2.3 2.3 0 0 0 4 0" /><path d="M12 3.5V2.6" /></>,
  userPlus: a => <><circle cx="9.5" cy="8" r="3.6" fill={hbF(a)} /><path d="M3.2 20c.4-3.6 3-6 6.3-6s5.9 2.4 6.3 6Z" fill={hbF(a)} /><path d="M19 8.5v5M16.5 11h5" /></>,
  file: a => <><path d="M14.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5Z" fill={hbF(a)} /><path d="M14.5 3v4.5H19" stroke={hbW(a)} /><path d="M8.5 12.5h7M8.5 16h4.5" stroke={hbW(a)} /></>,
  alert: a => <><path d="M10.3 4.2a2 2 0 0 1 3.4 0l7.4 12.9A2 2 0 0 1 19.4 20H4.6a2 2 0 0 1-1.7-2.9Z" fill={hbF(a)} /><path d="M12 9.5v4" stroke={hbW(a)} /><path d="M12 16.6h.01" stroke={hbW(a)} strokeWidth="2.4" /></>,
  msg: a => <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.3a.5.5 0 0 1-.8-.4Z" fill={hbF(a)} /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke={hbW(a)} strokeWidth="2.4" /></>,
  check: a => <><circle cx="12" cy="12" r="8.5" fill={hbF(a)} /><path d="m8.3 12.2 2.5 2.5 5-5" stroke={hbW(a)} /></>,
  chev: () => <path d="m9 18 6-6-6-6" />,
  gear: () => <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  raw: a => <><path d="M12 4a7 7 0 0 1 7 7c0 .5-.1 1-.2 1.4C17 13 14.6 11 12 11s-5 2-6.8 1.4C5.1 12 5 11.5 5 11a7 7 0 0 1 7-7Z" fill={hbF(a)} /><path d="M5 14c1.5 3 3.5 6 7 6s5.5-3 7-6" /></>,
  mill: a => <><path d="M12 3.5 14 5l2.5-.5.8 2.4 2.3 1-.3 2.5 1.7 1.8-1.2 2.2.7 2.4-2.3.9-.8 2.4-2.5-.3L12 21l-1.9-1.7-2.5.3-.8-2.4-2.3-.9.7-2.4-1.2-2.2L5.7 9.9l-.3-2.5 2.3-1 .8-2.4 2.5.5z" fill={hbF(a)} strokeWidth="1.6" /><circle cx="12" cy="12" r="3" fill={a ? '#fff' : 'none'} stroke={hbW(a)} strokeWidth="1.6" /></>,
  pkg: a => <><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill={hbF(a)} /><path d="M4 7.5 12 12l8-4.5M12 12v9" stroke={hbW(a)} /></>,
  sales: a => <><path d="M4 5h2.5l1 3m0 0 2 8h9l2-7h-13" fill={hbF(a)} /><circle cx="10" cy="19" r="1.6" fill={hbF(a)} /><circle cx="17" cy="19" r="1.6" fill={hbF(a)} /></>,
  stats: a => <><path d="M12 3v9l8 2.2A9 9 0 1 1 12 3Z" fill={hbF(a)} /><path d="M14 3.3A9 9 0 0 1 20.7 10H14Z" fill={a ? '#fff' : 'none'} stroke={hbW(a)} /></>,
};
function HbIcon({ n, s = 20, c = '', a = false, sw = 1.8 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={c}>{HB_P[n](a)}</svg>;
}

const hbBadgeText = n => (n > 99 ? '99+' : String(n));
function HbBadge({ n }) {
  if (!n) return null;
  return <span className="absolute left-[calc(100%-8px)] -top-[7px] min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 ring-2 ring-white text-white font-mono text-[11px] font-bold leading-[18px] text-center">{hbBadgeText(n)}</span>;
}
/* 버튼 40×40(모바일 터치 하한) / PC 32×32 */
function HbBell({ n = 0, size = 'm', open = false }) {
  const box = size === 'm' ? 'w-10 h-10' : 'w-8 h-8';
  const tone = open ? 'text-blue-600' : n > 0 ? 'text-slate-600' : 'text-slate-400';
  return <button className={`relative ${box} rounded-full flex items-center justify-center ${tone} ${open ? 'bg-blue-50' : ''}`} aria-label={n ? `알림 ${n}건` : '알림 없음'}>
    <span className="relative flex"><HbIcon n="bell" s={size === 'm' ? 20 : 18} a={open} /><HbBadge n={n} /></span>
  </button>;
}

const HB_KIND = {
  pending: { icon: 'userPlus', tile: 'bg-amber-50 text-amber-600', title: n => <>승인 대기 <b className="font-mono">{n}</b>명</>, sub: '카카오 가입 · 가장 오래된 요청 3일 전', href: '/admin/users' },
  orders: { icon: 'file', tile: 'bg-blue-50 text-blue-600', title: n => <>오늘 나갈 발주서 <b className="font-mono">{n}</b>건</>, sub: '출고 준비 전 3건', href: '/orders' },
  unmatched: { icon: 'alert', tile: 'bg-red-50 text-red-600', title: n => <>매칭실패 <b className="font-mono">{n}</b>품목</>, sub: '발주 품목명이 SKU와 안 맞음', href: '/orders/unmatched' },
};
function HbRow({ k, n, m }) {
  const d = HB_KIND[k];
  return <a className={`flex items-center gap-3 px-3 ${m ? 'h-12' : 'h-10'} rounded-lg hover:bg-slate-50 no-underline`} style={{ color: 'inherit' }}>
    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${d.tile}`}><HbIcon n={d.icon} s={17} a /></span>
    <span className="flex-1 min-w-0 text-[13px] font-semibold text-slate-800">{d.title(n)}</span>
    <HbIcon n="chev" s={16} sw={2} c="shrink-0 text-slate-400" />
  </a>;
}
function HbEmpty() {
  return <div className="py-8 flex flex-col items-center gap-2 text-center">
    <span className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center"><HbIcon n="check" s={22} a /></span>
    <p className="text-[13px] font-medium text-slate-700">확인할 알림이 없어요</p>
  </div>;
}
/* 1단계 목록. items: [[kind, n], ...] */
function HbPanel({ items, m, maxH }) {
  return <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden flex flex-col" style={{ maxHeight: maxH }}>
    <div className="px-4 h-11 shrink-0 flex items-center border-b border-slate-100">
      <span className="text-[14px] font-semibold text-slate-800">알림</span>
          </div>
    <div className="p-1.5 overflow-y-auto flex flex-col gap-0.5">
      {items.length ? items.map(([k, n], i) => <HbRow key={i} k={k} n={n} m={m} />) : <HbEmpty />}
    </div>
  </div>;
}

/* ─── 헤더 셸 ─── */
function HbAvatar({ s = 28 }) {
  return <div className="rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs" style={{ width: s, height: s }}>김</div>;
}
function HbMobileHeader({ n, showBell = true, open }) {
  return <header className="relative h-11 bg-white pl-4 pr-1 flex items-center justify-between border-b border-slate-200">
    <span className="font-extrabold tracking-tight text-slate-800 text-[15px]">MILL LOG</span>
    <div className="flex items-center">
      {showBell && <HbBell n={n} open={open} />}
      <button className="w-10 h-10 flex items-center justify-center"><HbAvatar /></button>
      <button className="w-10 h-10 flex items-center justify-center text-slate-500"><HbIcon n="gear" /></button>
    </div>
  </header>;
}
function HbTabBar() {
  const t = [['raw', '원물'], ['mill', '도정'], ['pkg', '제품'], ['sales', '판매'], ['stats', '통계']];
  return <div className="absolute left-4 right-4 bottom-4">
    <nav className="h-[60px] bg-white rounded-full flex items-center" style={{ border: '1px solid #cbd5e1', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
      {t.map(([i, l], k) => <span key={k} className="flex-1 h-full flex items-center justify-center">{k === 0
        ? <span className="w-[42px] h-[42px] rounded-full bg-blue-600 text-white flex items-center justify-center"><HbIcon n={i} s={18} sw={2.5} a /></span>
        : <span className="flex flex-col items-center gap-[3px] text-slate-400"><HbIcon n={i} s={20} sw={2} /><span className="text-[11px] font-medium leading-none tracking-tight">{l}</span></span>}</span>)}
    </nav>
  </div>;
}
function HbPageGhost() {
  return <div className="p-4 flex flex-col gap-3">{[80, 140, 110, 140].map((h, i) => <div key={i} className="bg-white rounded-xl border border-slate-200" style={{ height: h }}></div>)}</div>;
}
function HbMobile({ n, items, open, showBell = true, h = 700 }) {
  return <div className="relative bg-slate-100 overflow-hidden" style={{ height: h }}>
    <HbMobileHeader n={n} showBell={showBell} open={open} />
    <HbPageGhost />
    {open && <><div className="absolute inset-0 top-11 bg-slate-900/10"></div>
      <div className="absolute left-2 right-2 top-[48px]"><HbPanel items={items} m maxH={h - 44 - 60 - 16 - 24} /></div></>}
    <HbTabBar />
  </div>;
}
function HbDesktop({ n, items, open, showBell = true }) {
  return <div className="relative h-full bg-slate-100 flex">
    <aside className="w-[200px] shrink-0 bg-white border-r border-slate-200 p-3 flex flex-col gap-1">
      <span className="font-extrabold text-slate-800 text-[15px] px-2 h-9 flex items-center">MILL LOG</span>
      {[['raw', '원물재고'], ['mill', '도정관리'], ['pkg', '제품재고'], ['sales', '판매관리'], ['stats', '통계']].map(([ic, l], i) => <span key={i} className={`px-3 h-9 flex items-center gap-3 rounded-lg text-[14px] font-medium ${i === 0 ? 'bg-blue-50 text-blue-600' : 'text-slate-600'}`}><HbIcon n={ic} s={16} a={i === 0} />{l}</span>)}
    </aside>
    <div className="flex-1 min-w-0 relative">
      <header className="h-12 bg-white border-b border-slate-200 px-5 flex items-center justify-between">
        <span className="text-[13px] text-slate-500">재고 <span className="mx-1 text-slate-400">/</span> <b className="text-slate-800 font-semibold">원물재고</b></span>
        <div className="flex items-center gap-2">
          {showBell && <><HbBell n={n} size="d" open={open} /><span className="w-px h-5 bg-slate-200"></span></>}
          <button className="flex items-center gap-2.5 p-1.5 pr-2 rounded-full"><HbAvatar s={32} /><span className="flex flex-col items-start leading-tight"><span className="text-[13px] font-semibold text-slate-700">김도정</span><span className="text-[11px] text-slate-500">생산팀 · 대표</span></span></button>
        </div>
      </header>
      <div className="p-5 grid grid-cols-3 gap-4">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-slate-200"></div>)}</div>
      {open && <div className="absolute top-[52px] right-[150px] w-[340px]"><HbPanel items={items} maxH={420} /></div>}
    </div>
  </div>;
}

/* ─── 뱃지 규칙표 ─── */
function HbBadgeRules() {
  const cell = 'flex flex-col items-center gap-2';
  const cap = 'text-[12px] text-slate-600 text-center leading-snug';
  const cases = [[2, '1~9'], [12, '10~99'], [140, '100 이상 → 99+'], [0, 'ADMIN · 0건\n회색, 뱃지 없음'], [null, '해당 알림 없는 사람\n아이콘 숨김']];
  return <div className="p-6 bg-white h-full flex flex-col gap-5">
    <div className="grid grid-cols-5 gap-4">
      {cases.map(([n, l], i) => <div key={i} className={cell}>
        <div className="h-11 w-full rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">{n === null ? <span className="text-[12px] text-slate-400">—</span> : <HbBell n={n} />}</div>
        <span className={cap} style={{ whiteSpace: 'pre-line' }}>{l}</span>
      </div>)}
    </div>
    <ul className="text-[13px] text-slate-700 leading-relaxed list-disc pl-5 flex flex-col gap-1">
      <li><b>숫자 알약</b> — red-600 바탕 · 흰 글자 11px mono bold · 높이 18 · 흰 테두리 2. 점은 “몇 명인지”를 못 알려 줘 쓰지 않음.</li>
      <li>숫자 = 각 항목 숫자의 <b>합</b> (승인 대기 2 + 발주서 5 → 7). 99 넘으면 <span className="font-mono">99+</span>.</li>
      <li><b>0건</b>이면 뱃지만 빼고 종은 slate-400으로 남김 — 자리가 들썩이지 않고, 눌러서 “없음”을 확인할 수 있음.</li>
      <li>기존 톱니 위 amber 점 · 사용자 관리 옆 amber 숫자(T4 임시)는 <b>제거</b>. amber-600 위 흰 글자는 명암 3.2:1로 ③ 기준 미달.</li>
    </ul>
  </div>;
}

/* ─── 2단계 방향 ─── */
function HbStage2Row({ unread, icon, title, meta }) {
  return <a className="relative flex items-start gap-3 pl-5 pr-3 py-2.5 rounded-lg hover:bg-slate-50 no-underline" style={{ color: 'inherit' }}>
    {unread && <span className="absolute left-2 top-[18px] w-1.5 h-1.5 rounded-full bg-blue-600" aria-label="안 읽음"></span>}
    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${unread ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}><HbIcon n={icon} s={17} a /></span>
    <span className="flex-1 min-w-0"><span className={`block text-[13px] ${unread ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{title}</span><span className="block text-[12px] text-slate-500">{meta}</span></span>
  </a>;
}
function HbStage2() {
  const head = 'px-3 pt-2 pb-1 text-[11px] font-semibold text-slate-500';
  return <div className="p-6 bg-slate-100 h-full flex gap-6">
    <div className="w-[340px] shrink-0 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden flex flex-col">
      <div className="px-4 h-11 flex items-center justify-between border-b border-slate-100"><span className="text-[14px] font-semibold text-slate-800">알림</span><button className="text-[12px] text-blue-600 font-medium">모두 읽음</button></div>
      <div className="p-1.5 flex flex-col">
        <p className={head}>처리할 일</p>
        <HbRow k="pending" n={2} />
        <div className="h-px bg-slate-100 my-1.5 mx-3"></div>
        <p className={head}>받은 알림</p>
        <HbStage2Row unread icon="msg" title="박현장 님이 쪽지를 보냈어요" meta="“3번 톤백 수분 다시 봐주세요” · 10분 전" />
        <HbStage2Row unread icon="file" title="발주서 #2031 출고 완료" meta="이유진 · 1시간 전" />
        <HbStage2Row icon="pkg" title="포장 배치 0929-2 마감됨" meta="어제 17:40" />
      </div>
      <a className="h-10 border-t border-slate-100 flex items-center justify-center text-[13px] font-medium text-slate-600 no-underline">전체 보기</a>
    </div>
    <ul className="flex-1 text-[13px] text-slate-700 leading-relaxed list-disc pl-5 flex flex-col gap-1.5">
      <li><b>두 칸으로 나눔.</b> 위 「처리할 일」= 1단계 계산형(읽음 없음, 해결되면 사라짐). 아래 「받은 알림」= 저장형.</li>
      <li><b>안 읽음</b> = 왼쪽 파랑 점 + 제목 semibold slate-800. <b>읽음</b> = 점 없음 + 보통 굵기 slate-600. 배경색은 바꾸지 않음(행 구분이 흐려짐).</li>
      <li>누르면 해당 화면으로 가면서 읽음 처리. 헤더 「모두 읽음」은 받은 알림에만 적용.</li>
      <li>뱃지 숫자 = 처리할 일 합 + 안 읽은 알림 수.</li>
      <li>목록이 길어지면 팝오버엔 최근 20개, 나머지는 「전체 보기」(/notifications).</li>
      <li>2단계부터는 모든 사람이 쪽지를 받을 수 있으니 <b>종은 전원에게 보임</b>.</li>
    </ul>
  </div>;
}

Object.assign(window, { HbMobile, HbDesktop, HbPanel, HbBadgeRules, HbStage2 });
