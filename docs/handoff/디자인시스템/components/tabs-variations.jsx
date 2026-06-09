/* global React */
const { useState } = React;

// 공통 아이콘 (잡곡 = 씨앗들, 벼 = 벼 이삭)
const RiceIcon = ({ className = '', strokeWidth = 2 }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20" />
    <path d="M12 6c-2 0-3.5 1.5-3.5 3.5S10 12 12 12" />
    <path d="M12 6c2 0 3.5 1.5 3.5 3.5S14 12 12 12" />
    <path d="M12 12c-2 0-3.5 1.5-3.5 3.5S10 18 12 18" />
    <path d="M12 12c2 0 3.5 1.5 3.5 3.5S14 18 12 18" />
  </svg>
);
const GrainIcon = ({ className = '', strokeWidth = 2 }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="8" r="2.5" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="12" cy="14" r="2.3" />
    <circle cx="18" cy="15" r="1.8" />
    <circle cx="6" cy="16" r="2" />
  </svg>
);

// ============== A. 기본 underline (현재) ==============
function TabA() {
  const [active, setActive] = useState('misc');
  return (
    <div className="flex border-b border-slate-200">
      {[['rice','벼'],['misc','잡곡']].map(([v,l]) => (
        <button key={v} onClick={() => setActive(v)}
          className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px ${active===v ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ============== B. 아이콘 + underline ==============
function TabB() {
  const [active, setActive] = useState('misc');
  return (
    <div className="flex border-b border-slate-200">
      {[['rice','벼',RiceIcon],['misc','잡곡',GrainIcon]].map(([v,l,Icon]) => (
        <button key={v} onClick={() => setActive(v)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${active===v ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'}`}>
          <Icon className={active===v ? 'opacity-100' : 'opacity-60'} strokeWidth={active===v ? 2.3 : 2} />
          {l}
        </button>
      ))}
    </div>
  );
}

// ============== C. 아이콘 + 카운트 배지 ==============
function TabC() {
  const [active, setActive] = useState('misc');
  const counts = { rice: 412, misc: 128 };
  return (
    <div className="flex border-b border-slate-200">
      {[['rice','벼',RiceIcon],['misc','잡곡',GrainIcon]].map(([v,l,Icon]) => (
        <button key={v} onClick={() => setActive(v)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${active===v ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
          <Icon strokeWidth={active===v ? 2.3 : 2} />
          {l}
          <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9.5px] font-bold tabular-nums ${active===v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
            {counts[v]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============== D. 필 (Pill / Segmented) ==============
function TabD() {
  const [active, setActive] = useState('misc');
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200">
      {[['rice','벼',RiceIcon],['misc','잡곡',GrainIcon]].map(([v,l,Icon]) => (
        <button key={v} onClick={() => setActive(v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-md transition-all ${active===v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Icon strokeWidth={active===v ? 2.3 : 2} />
          {l}
        </button>
      ))}
    </div>
  );
}

// ============== E. 컬러 액센트 (벼=청록, 잡곡=앰버) ==============
function TabE() {
  const [active, setActive] = useState('misc');
  const config = {
    rice: { label: '벼', Icon: RiceIcon, bar: 'bg-[#00a2e8]', text: 'text-[#00a2e8]', dot: 'bg-[#00a2e8]' },
    misc: { label: '잡곡', Icon: GrainIcon, bar: 'bg-amber-600', text: 'text-amber-700', dot: 'bg-amber-500' },
  };
  return (
    <div className="flex border-b border-slate-200">
      {Object.entries(config).map(([v, c]) => {
        const on = active === v;
        const Icon = c.Icon;
        return (
          <button key={v} onClick={() => setActive(v)}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold transition-colors ${on ? c.text : 'text-slate-400 hover:text-slate-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${on ? c.dot : 'bg-slate-300'}`} />
            <Icon strokeWidth={on ? 2.3 : 2} />
            {c.label}
            {on && <span className={`absolute left-0 right-0 bottom-[-1px] h-[2px] ${c.bar} rounded-full`} />}
          </button>
        );
      })}
    </div>
  );
}

// ============== F. 애니메이션 하이라이트 (active가 배경+굵기 커지는 형태) ==============
function TabF() {
  const [active, setActive] = useState('misc');
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
      {[['rice','벼',RiceIcon],['misc','잡곡',GrainIcon]].map(([v,l,Icon]) => {
        const on = active === v;
        return (
          <button key={v} onClick={() => setActive(v)}
            className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 ${on ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon className={`transition-transform duration-300 ${on ? 'scale-110' : 'scale-100'}`} strokeWidth={on ? 2.4 : 1.8} />
            <span className={`transition-all ${on ? 'text-[14px]' : 'text-[13px]'}`}>{l}</span>
            <span className={`absolute left-2 right-2 bottom-[-1px] h-[2.5px] rounded-full transition-all ${on ? 'bg-slate-900 opacity-100' : 'bg-transparent opacity-0'}`} />
          </button>
        );
      })}
    </div>
  );
}

window.TabA = TabA; window.TabB = TabB; window.TabC = TabC;
window.TabD = TabD; window.TabE = TabE; window.TabF = TabF;
