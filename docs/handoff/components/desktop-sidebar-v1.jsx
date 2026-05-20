/* global React, lucide */
const { useState } = React;
const {
  Home, Package, ClipboardList, Boxes, ShoppingCart, BarChart3,
  Server, Leaf, Users, ChevronDown, ChevronRight, Sprout, Settings, History, Megaphone, Database
} = lucide;

// Set C (듀오톤 필) 아이콘을 5개 핵심 메뉴에 적용
const getSetC = () => (window.MobileNavIconSets && window.MobileNavIconSets.C) || {};

// ============== V1: 클래식 - 기존 톤 유지 + 새 구조 ==============
function SidebarV1() {
  const [active, setActive] = useState('/packages');
  // 자동펼침: 현재 경로가 그룹 하위면 true
  const [statsOpen, setStatsOpen] = useState(active.startsWith('/statistics'));
  const [adminOpen, setAdminOpen] = useState(active.startsWith('/admin/'));
  const [collapsed, setCollapsed] = useState(false);

  const C = getSetC();

  const isActive = (p) => active === p || (p !== '/' && active.startsWith(p));

  const NavItem = ({ href, icon: Icon, label, badge, duotone }) => {
    const on = isActive(href);
    return (
      <button
        onClick={() => setActive(href)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          on
            ? 'bg-blue-50 text-blue-600'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {duotone
          ? <Icon className="w-4 h-4" strokeWidth={on ? 1.8 : 1.8} active={on} />
          : <Icon className="w-4 h-4" />}
        <span className="flex-1 text-left">{label}</span>
        {badge && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 tracking-tight">
            {badge}
          </span>
        )}
      </button>
    );
  };

  const SubItem = ({ href, label }) => (
    <button
      onClick={() => setActive(href)}
      className={`block w-full text-left text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
        isActive(href)
          ? 'text-blue-600 bg-blue-50'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-slate-200 flex flex-col h-full transition-[width] duration-200`}>
      <div className="p-6 flex-1 overflow-y-auto flex flex-col">
        <div className="flex items-center gap-2 mb-10 px-1">
          <a className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
            {collapsed
              ? <img src="assets/logo-symbol.svg" alt="" className="h-8 w-8 object-contain" />
              : <img src="assets/logo-full.png" alt="MILL LOG" className="h-10 w-auto object-contain" />}
          </a>
          <button
            onClick={() => setCollapsed(v => !v)}
            className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <path d="m9 18 6-6-6-6"/> : <path d="m15 18-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Main Menu</p>

          <NavItem href="/" icon={Home} label="홈" />
          <NavItem href="/raw-stocks" icon={C.Raw} label="원물재고" duotone />
          <NavItem href="/milling" icon={C.Mill} label="도정관리" duotone />
          <NavItem href="/packages" icon={C.Pkg} label="제품재고" duotone />
          <NavItem href="/sales" icon={C.Sales} label="판매관리" duotone />

          <div className="pt-1">
            <button
              onClick={() => setStatsOpen(v => !v)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive('/statistics') ? 'text-blue-600' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {C.Stats
                ? <C.Stats className="w-4 h-4" active={isActive('/statistics')} />
                : <BarChart3 className="w-4 h-4" />}
              <span className="flex-1 text-left">통계</span>
              {statsOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {statsOpen && (
              <div className="pl-10 mt-1 space-y-1">
                <SubItem href="/statistics/milling" label="수율분석" />
                <SubItem href="/statistics/stock" label="재고분석" />
                <SubItem href="/statistics/output" label="판매분석" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Management</p>
          <div className="space-y-1">
            <NavItem href="/admin/varieties" icon={Leaf} label="품종 관리" />
            <NavItem href="/admin/farmers" icon={Users} label="생산자 관리" />

            <div className="group pt-1">
              <button
                onClick={() => setAdminOpen(v => !v)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Server className="w-4 h-4" />
                <span className="flex-1 text-left">관리자 메뉴</span>
                {adminOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              {adminOpen && (
                <div className="pl-10 mt-1 space-y-1">
                  <SubItem href="/admin/users" label="사용자 관리" />
                  <SubItem href="/admin/notices" label="공지사항 관리" />
                  <SubItem href="/admin/logs" label="활동 로그" />
                  <SubItem href="/admin/backup" label="시스템 백업" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============== V2: 그룹 헤더 + 단계별 섹션 ==============
function SidebarV2() {
  const [active, setActive] = useState('/packages');
  const isActive = (p) => active === p || (p !== '/' && active.startsWith(p));

  const NavItem = ({ href, icon: Icon, label, step }) => (
    <button
      onClick={() => setActive(href)}
      className={`w-full flex items-center gap-3 pl-3 pr-2.5 py-2 text-[13px] font-medium rounded-lg transition-all ${
        isActive(href)
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className={`flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
        isActive(href) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
      }`}>{step}</span>
      <Icon className="w-4 h-4 opacity-90" />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );

  const SimpleItem = ({ href, icon: Icon, label }) => (
    <button
      onClick={() => setActive(href)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all ${
        isActive(href)
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4 opacity-90" />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );

  return (
    <aside className="w-64 bg-stone-50 border-r border-stone-200 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-stone-200 flex items-center gap-2">
        <img src="assets/logo-symbol.svg" alt="" className="h-8 w-8 object-contain" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] tracking-[0.2em] text-stone-400 font-semibold">MILL · LOG</span>
          <span className="text-sm font-bold text-stone-800">땅끝황토친환경</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        <div>
          <SimpleItem href="/" icon={Home} label="홈" />
        </div>

        <div>
          <div className="flex items-center gap-2 px-3 mb-2">
            <div className="h-px flex-1 bg-stone-200" />
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Workflow</p>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          <div className="space-y-1">
            <NavItem step="1" href="/raw-stocks" icon={Package} label="원물재고" />
            <NavItem step="2" href="/milling" icon={ClipboardList} label="도정관리" />
            <NavItem step="3" href="/packages" icon={Boxes} label="제품재고" />
            <NavItem step="4" href="/sales" icon={ShoppingCart} label="판매관리" />
          </div>
        </div>

        <div>
          <p className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Insights</p>
          <div className="space-y-1">
            <SimpleItem href="/statistics/milling" icon={Sprout} label="수율분석" />
            <SimpleItem href="/statistics/stock" icon={Database} label="재고분석" />
            <SimpleItem href="/statistics/output" icon={BarChart3} label="판매분석" />
          </div>
        </div>

        <div className="mt-auto">
          <p className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Management</p>
          <div className="space-y-1">
            <SimpleItem href="/admin/varieties" icon={Leaf} label="품종 관리" />
            <SimpleItem href="/admin/farmers" icon={Users} label="생산자 관리" />
            <SimpleItem href="/admin/users" icon={Settings} label="관리자 설정" />
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============== V3: 컴팩트 + 색상 코드 액센트 ==============
function SidebarV3() {
  const [active, setActive] = useState('/sales');
  const [statsOpen, setStatsOpen] = useState(false);
  const isActive = (p) => active === p || (p !== '/' && active.startsWith(p));

  // 단계별 색상 코딩
  const items = [
    { href: '/', icon: Home, label: '홈', accent: 'slate' },
    { href: '/raw-stocks', icon: Package, label: '원물재고', accent: 'amber' },
    { href: '/milling', icon: ClipboardList, label: '도정관리', accent: 'orange' },
    { href: '/packages', icon: Boxes, label: '제품재고', accent: 'emerald' },
    { href: '/sales', icon: ShoppingCart, label: '판매관리', accent: 'blue' },
  ];

  const accentMap = {
    slate:   { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400', barBg: 'bg-slate-500' },
    amber:   { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', barBg: 'bg-amber-500' },
    orange:  { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400', barBg: 'bg-orange-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', barBg: 'bg-emerald-500' },
    blue:    { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400', barBg: 'bg-blue-500' },
  };

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="px-5 py-4 flex items-center gap-2.5">
        <img src="assets/logo-symbol.svg" alt="" className="h-7 w-7 object-contain" />
        <span className="text-[15px] font-extrabold tracking-tight text-slate-800">MILL <span className="text-amber-600">·</span> LOG</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col">
        <div className="space-y-0.5">
          {items.map((item) => {
            const a = accentMap[item.accent];
            const Icon = item.icon;
            const on = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => setActive(item.href)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-md transition-all group ${
                  on ? `${a.bg} ${a.text}` : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {on && <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r ${a.barBg}`} />}
                <Icon className="w-4 h-4" strokeWidth={on ? 2.4 : 1.8} />
                <span className="flex-1 text-left">{item.label}</span>
                {!on && <span className={`w-1 h-1 rounded-full ${a.dot} opacity-60`} />}
              </button>
            );
          })}

          <div className="pt-0.5">
            <button
              onClick={() => setStatsOpen(v => !v)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-md transition-all ${
                isActive('/statistics') ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" strokeWidth={1.8} />
              <span className="flex-1 text-left">통계</span>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${statsOpen ? 'rotate-90' : ''}`} />
            </button>
            {statsOpen && (
              <div className="pl-10 pr-2 mt-1 space-y-0.5 border-l border-slate-100 ml-5">
                {[
                  { href: '/statistics/milling', label: '수율분석' },
                  { href: '/statistics/stock', label: '재고분석' },
                  { href: '/statistics/output', label: '판매분석' },
                ].map(s => (
                  <button
                    key={s.href}
                    onClick={() => setActive(s.href)}
                    className={`block w-full text-left text-[12px] py-1.5 px-2 rounded transition-colors ${
                      isActive(s.href) ? 'text-violet-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100 space-y-0.5">
          <button onClick={() => setActive('/admin/varieties')} className={`w-full flex items-center gap-3 px-3 py-2 text-[12.5px] font-medium rounded-md ${isActive('/admin/varieties') ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Leaf className="w-3.5 h-3.5" /> 품종 관리
          </button>
          <button onClick={() => setActive('/admin/farmers')} className={`w-full flex items-center gap-3 px-3 py-2 text-[12.5px] font-medium rounded-md ${isActive('/admin/farmers') ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users className="w-3.5 h-3.5" /> 생산자 관리
          </button>
          <button onClick={() => setActive('/admin/users')} className={`w-full flex items-center gap-3 px-3 py-2 text-[12.5px] font-medium rounded-md ${isActive('/admin/users') ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Settings className="w-3.5 h-3.5" /> 관리자 메뉴
          </button>
        </div>

        <div className="mt-3 mx-1 p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
              <Sprout className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-amber-700 tracking-wide">2025년산</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">잡곡 입고가 시작되었어요. 원물재고에서 등록하세요.</p>
        </div>
      </div>
    </aside>
  );
}

window.SidebarV1 = SidebarV1;
window.SidebarV2 = SidebarV2;
window.SidebarV3 = SidebarV3;
