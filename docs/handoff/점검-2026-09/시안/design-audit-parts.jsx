/* 디자인 점검 시안 — 파트 모음 (보조색 · 타입스케일 · 포장다이얼로그 · 승인대기) */
const { useState } = React;

function Note({ tone, children }) {
  const c = tone === 'good' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : tone === 'bad' ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-white text-slate-700 border-slate-200';
  return <div className={`text-[13px] leading-relaxed rounded-lg border px-3 py-2.5 mb-3 ${c}`} style={{ textWrap: 'pretty' }}>{children}</div>;
}
function Cap({ children }) { return <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{children}</div>; }

/* ───────── 1. 보조색 ───────── */
const PAL = {
  now: { chip: 'bg-purple-50 text-purple-700', chipX: 'text-purple-400', on: 'bg-purple-500 text-white', tag: 'text-violet-600 border-violet-200 bg-violet-50', germ: 'border-violet-200 text-violet-700 bg-violet-50', exp: 'bg-purple-50 text-purple-600 border-purple-100' },
  A: { chip: 'bg-blue-50 text-blue-700', chipX: 'text-blue-400', on: 'bg-blue-600 text-white', tag: 'text-violet-700 border-violet-200 bg-violet-50', germ: 'border-violet-200 text-violet-700 bg-violet-50', exp: 'bg-slate-100 text-slate-700 border-slate-200' },
  B: { chip: 'bg-blue-50 text-blue-700', chipX: 'text-blue-400', on: 'bg-blue-600 text-white', tag: 'text-slate-700 border-slate-300 bg-white', germ: 'border-slate-300 text-slate-700 bg-white', exp: 'bg-slate-100 text-slate-700 border-slate-200' },
};
function AccentBoard({ k }) {
  const p = PAL[k];
  return (
    <div className="p-5 space-y-5">
      <div>
        <Cap>통계 · 필터 칩 (stock / milling / millingtype)</Cap>
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-slate-500 mr-1">도정구분</span>
          {['백미', '7분도', '현미'].map((t) => (
            <span key={t} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${p.chip}`}>{t}<span className={p.chipX}>×</span></span>
          ))}
          <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${p.on}`}>필터 <span className="font-mono">3</span></span>
        </div>
      </div>
      <div>
        <Cap>생산자 목록 · 분류 태그 / 잡곡 상태</Cap>
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {[['김영식', '해남친환경작목반', '다중그룹 2'], ['박순자', '땅끝유기농', '']].map(([n, g, t]) => (
            <div key={n} className="flex items-center gap-2 px-3 py-2.5 text-[13px]">
              <b className="text-slate-800">{n}</b><span className="text-slate-500">{g}</span>
              {t && <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-full border ${p.tag}`}>{t}</span>}
              <span className={`ml-auto text-[11.5px] font-semibold px-2 py-0.5 rounded border ${p.germ}`}>발아위탁</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Cap>활동 로그 · 액션 뱃지</Cap>
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-1.5">
          {[['등록', 'bg-emerald-50 text-emerald-700 border-emerald-100'], ['수정', 'bg-blue-50 text-blue-700 border-blue-100'], ['삭제', 'bg-rose-50 text-rose-700 border-rose-100'], ['내보내기', p.exp], ['로그인', 'bg-slate-50 text-slate-600 border-slate-200']].map(([l, c]) => (
            <span key={l} className={`text-xs font-semibold px-2 py-0.5 rounded border ${c}`}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────── 2. 타입 스케일 · 명암 ───────── */
function TypeScale() {
  const rows = [
    ['11', 'caption', '컬럼 헤더 · 단위(kg) · 보조 메타', 'slate-500', '#64748b', '4.8'],
    ['12', 'meta', '뱃지 · 칩 · 소계 라벨', 'slate-600', '#475569', '7.6'],
    ['13', 'body-sm', '표 본문(모바일) · 다이얼로그 본문', 'slate-700', '#334155', '10.4'],
    ['14', 'body', '표 본문(PC) · 버튼', 'slate-800', '#1e293b', '14.6'],
    ['16', 'input', '입력 필드 전부 (iOS 자동확대 방지)', 'slate-900', '#0f172a', '17.9'],
  ];
  return (
    <div className="p-5">
      <Note>지금은 <b>9 · 10 · 10.5 · 11 · 11.5 · 12px</b>가 섞여 있어요. 5단계로 줄이고 <b>11px 미만은 금지</b>. 텍스트 색은 흰 배경 기준 <b>4.5:1 이상</b>인 slate-500부터. slate-300/400은 <b>선·아이콘·비활성 전용</b>으로만 씁니다.</Note>
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {rows.map(([px, name, use, tok, hex, cr]) => (
          <div key={px} className="grid grid-cols-[52px_84px_1fr_92px_56px] items-center gap-3 px-4 py-3">
            <span className="font-mono text-[13px] text-slate-500">{px}px</span>
            <span className="font-mono text-[12px] text-blue-700">{name}</span>
            <span style={{ fontSize: +px, color: hex }}>{use}</span>
            <span className="font-mono text-[12px] text-slate-600">{tok}</span>
            <span className="font-mono text-[12px] text-slate-600 text-right">{cr}:1</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <Cap>현재 — 포장 행 컬럼 헤더</Cap>
          <div className="bg-white rounded-lg border border-slate-200 px-3 py-3 grid grid-cols-4 gap-1">
            {['규격', '포장지', '수량', '중량'].map((t) => <span key={t} className="text-[9px] font-semibold text-stone-300">{t}</span>)}
          </div>
          <div className="text-[12px] text-rose-700 mt-1.5">9px · stone-300 = <span className="font-mono">1.5:1</span></div>
        </div>
        <div>
          <Cap>제안</Cap>
          <div className="bg-white rounded-lg border border-slate-200 px-3 py-3 grid grid-cols-4 gap-1">
            {['규격', '포장지', '수량', '중량'].map((t) => <span key={t} className="text-[11px] font-semibold text-slate-500">{t}</span>)}
          </div>
          <div className="text-[12px] text-emerald-700 mt-1.5">11px · slate-500 = <span className="font-mono">4.8:1</span></div>
        </div>
      </div>
    </div>
  );
}

/* ───────── 3. 포장 다이얼로그 (모바일) ───────── */
const PK = [{ t: '10kg', pk: '친환경 10kg 지대', n: 12, w: 10 }, { t: '20kg', pk: '일반 20kg 지대', n: 5, w: 20 }, { t: '잔량', pk: null, n: 1, w: 13 }];
const SPECS = ['1kg', '2kg', '4kg', '5kg', '10kg', '20kg', '톤백', '잔량', '800kg'];
function SheetShell({ children, footer, title = '포장 등록', lock }) {
  return (
    <div className="bg-white h-full flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-slate-200">
        <div className="text-[16px] font-bold text-slate-900 flex items-center gap-2">{title}{lock && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-2 py-0.5"><LockIco />마감됨</span>}</div>
        <div className="text-[13px] text-slate-500 mt-0.5">2026-09-30 · 백미 · 투입 <span className="font-mono">1,640</span>kg</div>
      </div>
      <div className="flex-1 overflow-hidden px-3 py-3">{children}</div>
      {footer === undefined ? <FootEdit /> : footer}
    </div>
  );
}
function LockIco() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }
function Total() { return <div className="text-[13px] text-slate-600">총 포장 <b className="font-mono text-[16px] text-slate-900">233</b> kg</div>; }
function FootEdit() {
  return (
    <div className="border-t border-slate-200 px-4 pt-3 pb-3 flex flex-col gap-2">
      <div className="flex items-center gap-3"><Total /><button className="ml-auto h-11 px-6 rounded-lg bg-blue-600 text-white text-[15px] font-semibold">기록 저장</button></div>
      <div className="flex items-center gap-2 pt-2 border-t border-dashed border-slate-200">
        <button className="h-10 px-3 rounded-lg text-[13px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 flex items-center gap-1.5"><LockIco />작업 마감</button>
        <button className="ml-auto h-10 px-3 rounded-lg text-[13px] font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>포장 초기화</button>
      </div>
    </div>
  );
}
function FootClosed() {
  return (
    <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-3">
      <Total /><button className="ml-auto h-11 px-5 rounded-lg border border-slate-300 text-slate-800 text-[14px] font-semibold flex items-center gap-1.5"><LockIco />마감 해제</button>
    </div>
  );
}
function FootView() {
  return <div className="border-t border-slate-200 px-4 py-3 flex items-center gap-3"><Total /><span className="ml-auto text-[12px] text-slate-500">조회 전용</span></div>;
}
function GroupHead() {
  return (
    <div className="bg-slate-50 border-b border-slate-200 px-3 py-2.5 flex items-center gap-2">
      <b className="text-[13px] text-slate-800">김영식</b><span className="text-[12px] text-slate-500">새청무</span>
      <span className="ml-auto text-[12px] font-bold text-blue-700">예상 <span className="font-mono">1,197</span>kg</span>
    </div>
  );
}
function PackNow() {
  return (
    <SheetShell>
      <div className="rounded-xl border border-stone-200 overflow-hidden">
        <GroupHead />
        <div className="px-3 py-3 border-b border-stone-200 grid grid-cols-5 gap-1">
          {[...SPECS, '기타'].map((s) => <span key={s} className="h-7 flex items-center justify-center rounded-md bg-stone-100 text-[11px] text-stone-700">{s}</span>)}
        </div>
        <div className="divide-y divide-stone-100">
          {PK.map((o) => (
            <div key={o.t} className="px-2 py-1.5 grid grid-cols-[36px_1fr_88px_58px_22px] items-center gap-1">
              <span className={`text-[11px] text-center rounded py-0.5 ${o.pk ? 'bg-stone-100 text-stone-600' : 'bg-yellow-100 text-yellow-700'}`}>{o.t}</span>
              {o.pk ? <span className="h-7 flex items-center rounded-md border border-stone-200 px-2 text-[11px] text-stone-600 truncate">{o.pk}</span> : <span className="text-[11px] text-stone-300">—</span>}
              <span className="flex items-center justify-center gap-0.5"><i className="w-[22px] h-[22px] rounded-full bg-stone-100 not-italic text-center text-stone-400 text-[13px] leading-[22px]">−</i><b className="font-mono text-[12px] w-7 text-center">{o.n}</b><i className="w-[22px] h-[22px] rounded-full bg-stone-100 not-italic text-center text-stone-400 text-[13px] leading-[22px]">+</i></span>
              <span className="text-[12px] font-bold text-right">{(o.n * o.w).toLocaleString()}<span className="text-[9px] text-stone-400">kg</span></span>
              <span className="w-[22px] h-[22px] flex items-center justify-center text-stone-300"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 text-[12px] text-rose-700 space-y-0.5">
        <div>· 규격 버튼 28px · 스테퍼 22px · 삭제 22px (권장 44px)</div>
        <div>· 포장지 선택 28px · 11px 글자 — 장갑 낀 손으로 누르기 어려움</div>
      </div>
    </SheetShell>
  );
}
function Stepper({ n, size }) {
  const s = size;
  return (
    <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden" style={{ height: s }}>
      <button className="h-full text-[20px] text-slate-600 bg-slate-50" style={{ width: s }}>−</button>
      <span className="font-mono font-bold text-[16px] text-slate-900 text-center border-x border-slate-300 h-full flex items-center justify-center" style={{ width: s + 8 }}>{n}</span>
      <button className="h-full text-[20px] text-slate-600 bg-slate-50" style={{ width: s }}>+</button>
    </div>
  );
}
function TrashBtn({ size }) { return <button className="shrink-0 rounded-lg text-slate-500 flex items-center justify-center hover:bg-rose-50" style={{ width: size, height: size }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button>; }
function SpecGrid({ h }) {
  return (
    <div className="px-3 py-3 border-b border-slate-200 grid grid-cols-5 gap-1.5">
      {[...SPECS, '기타'].map((s) => <button key={s} className={`rounded-lg text-[13px] font-medium ${s === '기타' ? 'border border-dashed border-slate-300 text-slate-600' : 'bg-slate-100 text-slate-800'}`} style={{ height: h }}>{s}</button>)}
    </div>
  );
}
function PackA() {
  return (
    <SheetShell>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <GroupHead /><SpecGrid h={44} />
        <div className="divide-y divide-slate-100">
          {PK.map((o) => (
            <div key={o.t} className="px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 w-12 text-[12px] font-semibold text-center rounded py-1 ${o.pk ? 'bg-slate-100 text-slate-700' : 'bg-yellow-100 text-yellow-800'}`}>{o.t}</span>
                {o.pk ? <span className="flex-1 min-w-0 h-11 flex items-center justify-between rounded-lg border border-slate-300 px-3 text-[14px] text-slate-800"><span className="truncate">{o.pk}</span><span className="text-slate-400">▾</span></span> : <span className="flex-1 text-[13px] text-slate-500">포장지 없음</span>}
                <TrashBtn size={44} />
              </div>
              <div className="flex items-center gap-3 pl-14">
                <Stepper n={o.n} size={44} />
                <span className="ml-auto text-[15px] font-bold text-slate-900 font-mono">{(o.n * o.w).toLocaleString()}<span className="text-[12px] text-slate-500 ml-0.5 font-sans">kg</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SheetShell>
  );
}
function SpecBand() {
  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500 mb-1.5">규격별 합계</div>
      <div className="flex flex-wrap gap-1.5">
        {PK.map((o) => (
          <div key={o.t} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1">
            <span className={`text-[12px] font-semibold rounded px-1.5 ${o.pk ? 'bg-slate-100 text-slate-700' : 'bg-yellow-100 text-yellow-800'}`}>{o.t}</span>
            <span className="font-mono text-[13px] text-slate-700">{o.n}<span className="text-[11px] text-slate-500 font-sans ml-px">개</span></span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-[13px] font-bold text-slate-900">{(o.n * o.w).toLocaleString()}<span className="text-[11px] text-slate-500 font-sans font-normal ml-px">kg</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
function PackB() {
  return (
    <SheetShell>
      <SpecBand />
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <GroupHead /><SpecGrid h={36} />
        <div className="divide-y divide-slate-100">
          {PK.map((o) => (
            <div key={o.t} className="px-2 py-2 flex items-center gap-1.5">
              <div className="flex-1 min-w-0 h-10 flex flex-col justify-center rounded-lg border border-slate-200 px-2">
                <span className={`text-[13px] font-semibold ${o.pk ? 'text-slate-800' : 'text-yellow-800'}`}>{o.t}</span>
                <span className="text-[11px] text-slate-500 truncate">{o.pk ? o.pk.replace(/ \d+kg/, '') + ' ▾' : '포장지 없음'}</span>
              </div>
              <Stepper n={o.n} size={40} />
              <span className="w-[50px] text-right text-[13px] font-bold font-mono text-slate-900">{(o.n * o.w).toLocaleString()}</span>
              <TrashBtn size={40} />
            </div>
          ))}
        </div>
      </div>
    </SheetShell>
  );
}

/* ───────── 4. 승인 대기 ───────── */
function PendingCard() {
  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center text-center gap-6">
      <img src="../assets/logo-full.png" alt="땅끝황토친환경" className="w-48 h-auto" />
      <div className="flex flex-col gap-2">
        <div className="text-[18px] font-bold text-slate-900">관리자 승인을 기다리고 있어요</div>
        <p className="text-[14px] text-slate-600 leading-relaxed" style={{ textWrap: 'pretty' }}>처음 로그인한 계정은 관리자가 승인해야 쓸 수 있어요. 승인되면 이 화면을 새로고침해 주세요.</p>
      </div>
      <div className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold">이</div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-slate-800">이정민</div>
          <div className="text-[12px] text-slate-500">카카오 로그인 · <span className="font-mono">2026-09-30 14:12</span></div>
        </div>
      </div>
      <div className="w-full flex flex-col gap-2">
        <button className="h-11 rounded-lg bg-blue-600 text-white text-[15px] font-semibold">새로고침</button>
        <button className="h-11 rounded-lg text-slate-600 text-[14px] hover:bg-slate-100">다른 계정으로 로그인</button>
      </div>
      <p className="text-[12px] text-slate-500">승인이 오래 걸리면 사무실(관리자)에게 이름을 알려 주세요.</p>
    </div>
  );
}
function UsersAdmin() {
  const pend = [['이정민', '2026-09-30 14:12'], ['kakao_83921', '2026-09-29 08:40']];
  const users = [['최은희', '관리자', 'ADMIN', ['전권']], ['박성호', '생산팀', 'USER', ['원물·마스터', '가공·판매']], ['정미경', '포장', 'USER', ['가공·판매']]];
  return (
    <div className="p-6 space-y-5">
      <div className="text-[20px] font-bold text-slate-900">사용자 관리</div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
          <span className="text-[14px] font-bold text-amber-900">승인 대기</span>
          <span className="font-mono text-[12px] font-bold bg-amber-600 text-white rounded-full px-2 py-0.5">{pend.length}</span>
          <span className="text-[12px] text-amber-900 ml-2">승인 전에는 아무 화면도 볼 수 없어요</span>
        </div>
        {pend.map(([n, d]) => (
          <div key={n} className="bg-white px-4 py-3 flex items-center gap-3 border-b border-amber-100 last:border-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[13px]">{n[0]}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-slate-800">{n}</div>
              <div className="text-[12px] text-slate-500">첫 로그인 <span className="font-mono">{d}</span></div>
            </div>
            <div className="ml-auto flex gap-2">
              <button className="h-9 px-3 rounded-lg text-[13px] text-slate-600 border border-slate-300 hover:bg-slate-50">거절</button>
              <button className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-blue-600 text-white">승인</button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="grid grid-cols-[1fr_100px_90px_1.4fr] gap-3 px-4 py-2 text-[11px] font-semibold text-slate-500 border-b border-slate-200"><span>이름</span><span>부서</span><span>역할</span><span>권한</span></div>
        {users.map(([n, dep, r, ps]) => (
          <div key={n} className="grid grid-cols-[1fr_100px_90px_1.4fr] gap-3 px-4 py-3 items-center text-[14px] border-b border-slate-100 last:border-0">
            <span className="font-semibold text-slate-800">{n}</span><span className="text-slate-600">{dep}</span>
            <span className={`text-[12px] font-semibold w-fit px-2 py-0.5 rounded ${r === 'ADMIN' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{r === 'ADMIN' ? '관리자' : '사용자'}</span>
            <span className="flex flex-wrap gap-1">{ps.map((p) => <span key={p} className="text-[12px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{p}</span>)}</span>
          </div>
        ))}
      </div>
      <Note>승인 후 역할은 <b>사용자</b>, 권한은 비어 있는 상태로 시작 → 기존처럼 행에서 권한을 부여. 거절은 계정 삭제(재로그인 시 다시 대기 목록에 뜸).</Note>
    </div>
  );
}

function PackRO({ closed }) {
  return (
    <SheetShell title="포장 내역" lock={closed} footer={closed ? <FootClosed /> : <FootView />}>
      <SpecBand />
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <GroupHead />
        <div className="px-3 pt-2 pb-1 grid grid-cols-[1fr_52px_56px] gap-2 text-[11px] font-semibold text-slate-500"><span>규격 · 포장지</span><span className="text-right">수량</span><span className="text-right">중량(kg)</span></div>
        <div className="divide-y divide-slate-100">
          {PK.map((o) => (
            <div key={o.t} className="px-3 py-2 grid grid-cols-[1fr_52px_56px] gap-2 items-center">
              <div className="min-w-0 flex items-center gap-2">
                <span className={`shrink-0 text-[12px] font-semibold rounded px-1.5 py-0.5 ${o.pk ? 'bg-slate-100 text-slate-700' : 'bg-yellow-100 text-yellow-800'}`}>{o.t}</span>
                <span className="text-[13px] text-slate-700 truncate">{o.pk ? o.pk.replace(/ \d+kg/, '') : '—'}</span>
              </div>
              <span className="text-right font-mono text-[14px] text-slate-900">{o.n}<span className="text-[11px] text-slate-500 font-sans ml-0.5">개</span></span>
              <span className="text-right font-mono text-[14px] font-bold text-slate-900">{(o.n * o.w).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <Note>{closed ? '마감된 배치: 규격 버튼·스테퍼·삭제 없음. 행 높이 36px(누를 곳 없음). 수정하려면 하단 「마감 해제」.' : '운영 권한 없음: 같은 읽기 전용 행 + 하단은 합계만. 지금은 하단 바 자체가 없어 총량을 볼 수 없음.'}</Note>
    </SheetShell>
  );
}

Object.assign(window, { PackRO, Note, Cap, AccentBoard, TypeScale, PackNow, PackA, PackB, PendingCard, UsersAdmin });
