/* global React, lucide */
const { useState, useRef, useEffect } = React;
const {
  Box, Clipboard, Activity, Package, BarChart2, Layers,
  Boxes, ShoppingCart, ChevronUp, Sprout, TrendingUp, Database
} = lucide;

// ============== Mobile V1: Goo blob (기존 톤 + 5탭 구조) ==============
function MobileNavV1({ iconSet = 'current' }) {
  const [active, setActive] = useState('/packages');
  const [statsOpen, setStatsOpen] = useState(false);
  const [blobX, setBlobX] = useState(0);
  const [ready, setReady] = useState(false);
  const buttonRefs = useRef([]);

  const sets = (window.MobileNavIconSets || {});
  const icons = sets[iconSet] || {
    Raw: Package, Mill: Clipboard, Pkg: Boxes, Sales: ShoppingCart, Stats: Activity
  };

  const navItems = [
    { href: '/raw-stocks', icon: icons.Raw, label: '원물' },
    { href: '/milling', icon: icons.Mill, label: '도정' },
    { href: '/packages', icon: icons.Pkg, label: '제품' },
    { href: '/sales', icon: icons.Sales, label: '판매' },
    { href: '/statistics', icon: icons.Stats, label: '통계' },
  ];

  const BLOB_SIZE = 42;
  const NAV_HEIGHT = 60;
  const blobTop = (NAV_HEIGHT - BLOB_SIZE) / 2;

  const getActiveIndex = (href) => {
    if (href.startsWith('/statistics')) return 4;
    return navItems.findIndex(n => href.startsWith(n.href));
  };

  const getTargetX = (i) => {
    const btn = buttonRefs.current[i];
    if (!btn) return 0;
    return btn.offsetLeft + btn.offsetWidth / 2 - BLOB_SIZE / 2;
  };

  useEffect(() => {
    const i = getActiveIndex(active);
    if (i >= 0) {
      setBlobX(getTargetX(i));
      setReady(true);
    }
  }, [active]);

  const handleNav = (href) => {
    setActive(href);
    setStatsOpen(false);
  };

  return (
    <div className="relative">
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="nav-goo-v1">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
          </filter>
        </defs>
      </svg>

      <div className="px-4 pb-4">
        <nav
          className="relative flex items-center justify-between h-[60px] rounded-full mx-auto max-w-md"
          style={{
            background: '#fff',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            border: '1px solid #cbd5e1',
          }}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none" style={{ filter: 'url(#nav-goo-v1)' }}>
            <div className="absolute rounded-full" style={{
              background: '#2563eb', width: BLOB_SIZE, height: BLOB_SIZE, top: blobTop, left: 0,
              transform: `translateX(${blobX}px)`,
              transition: ready ? 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            }} />
            <div className="absolute rounded-full" style={{
              background: '#2563eb', width: BLOB_SIZE, height: BLOB_SIZE, top: blobTop, left: 0,
              transform: `translateX(${blobX}px)`,
              transition: ready ? 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94) 0.06s' : 'none',
            }} />
          </div>

          {navItems.map((item, i) => {
            const isActive = active === item.href || (item.href === '/statistics' && active.startsWith('/statistics'));
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                ref={(el) => { buttonRefs.current[i] = el; }}
                onClick={() => {
                  if (item.href === '/statistics') setStatsOpen(v => !v);
                  handleNav(item.href);
                }}
                className="relative flex items-center justify-center flex-1 h-full z-10 transition-transform active:scale-[0.92]"
              >
                <div className="flex flex-col items-center justify-center gap-[3px]">
                  {iconSet === 'current' ? (
                    <Icon className={`transition-all duration-300 ${
                      isActive ? 'w-[18px] h-[18px] text-white' : 'w-[20px] h-[20px] text-slate-400'
                    }`} strokeWidth={isActive ? 2.5 : 2} />
                  ) : (
                    <Icon className={`transition-all duration-300 ${
                      isActive ? 'w-[18px] h-[18px] text-white' : 'w-[20px] h-[20px] text-slate-400'
                    }`} strokeWidth={isActive ? 2.5 : 2} active={isActive} />
                  )}
                  <span className={`tracking-tight leading-none transition-all duration-300 overflow-hidden ${
                    isActive ? 'text-[0px] max-h-0 opacity-0' : 'text-[9px] max-h-3 opacity-100 font-medium text-slate-400'
                  }`}>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ============== Mobile V2: 미니멀 라벨형 (땅끝 톤) ==============
function MobileNavV2() {
  const [active, setActive] = useState('/sales');

  const items = [
    { href: '/raw-stocks', icon: Package, label: '원물' },
    { href: '/milling', icon: Clipboard, label: '도정' },
    { href: '/packages', icon: Boxes, label: '제품' },
    { href: '/sales', icon: ShoppingCart, label: '판매' },
    { href: '/statistics', icon: Activity, label: '통계' },
  ];

  return (
    <div className="px-3 pb-3">
      <nav className="bg-white border border-stone-200 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex items-stretch h-[64px] overflow-hidden">
        {items.map(item => {
          const on = active === item.href || (item.href === '/statistics' && active.startsWith('/statistics'));
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => setActive(item.href)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                on ? 'text-stone-900' : 'text-stone-400'
              }`}
            >
              {on && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-amber-600" />
              )}
              <Icon className={`transition-transform ${on ? 'w-[22px] h-[22px]' : 'w-[19px] h-[19px]'}`} strokeWidth={on ? 2.3 : 1.8} />
              <span className={`text-[10px] tracking-tight ${on ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ============== Mobile V3: Pill + 중앙 액션 (판매관리 강조) ==============
function MobileNavV3() {
  const [active, setActive] = useState('/sales');
  const sideItems = [
    { href: '/raw-stocks', icon: Package, label: '원물' },
    { href: '/milling', icon: Clipboard, label: '도정' },
    { href: '/packages', icon: Boxes, label: '제품' },
    { href: '/statistics', icon: Activity, label: '통계' },
  ];

  return (
    <div className="px-4 pb-4 relative">
      <nav className="relative bg-white rounded-full h-[58px] shadow-[0_8px_30px_rgba(15,23,42,0.10)] border border-slate-200 flex items-center justify-around px-2">
        {sideItems.slice(0, 2).map(item => {
          const on = active === item.href;
          const Icon = item.icon;
          return (
            <button key={item.href} onClick={() => setActive(item.href)} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${on ? 'text-slate-900' : 'text-slate-400'}`}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={on ? 2.4 : 1.8} />
              <span className={`text-[9.5px] ${on ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          );
        })}

        {/* 중앙 판매 액션 버튼 */}
        <button
          onClick={() => setActive('/sales')}
          className="relative flex flex-col items-center -mt-7"
        >
          <div className={`w-[54px] h-[54px] rounded-full flex items-center justify-center shadow-lg transition-all ${
            active === '/sales'
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-4 ring-amber-100'
              : 'bg-gradient-to-br from-amber-400 to-orange-500'
          }`}>
            <ShoppingCart className="w-[22px] h-[22px] text-white" strokeWidth={2.2} />
          </div>
          <span className="text-[9.5px] font-bold text-stone-700 mt-0.5">판매</span>
        </button>

        {sideItems.slice(2).map(item => {
          const on = active === item.href || (item.href === '/statistics' && active.startsWith('/statistics'));
          const Icon = item.icon;
          return (
            <button key={item.href} onClick={() => setActive(item.href)} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${on ? 'text-slate-900' : 'text-slate-400'}`}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={on ? 2.4 : 1.8} />
              <span className={`text-[9.5px] ${on ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

window.MobileNavV1 = MobileNavV1;
window.MobileNavV2 = MobileNavV2;
window.MobileNavV3 = MobileNavV3;
