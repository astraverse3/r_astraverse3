/* global React */
// 모바일 하단 네비용 아이콘 세트 3종
// 각 아이콘은 { className, strokeWidth, active } props 지원
// 기본 viewBox 24×24, stroke 기반 (active=false) / fill 혼합 (active=true, Set C만)

const _svg = (children, props = {}) => {
  const { className = '', strokeWidth = 2, active = false, ...rest } = props;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}>
      {children}
    </svg>
  );
};

// ====================================================================
// SET A — 농업/재료 중심 (도메인 직관적)
//   원물=벼이삭 / 도정=롤러 방앗간 / 제품=포대(sack) / 판매=손익(코인+화살표) / 통계=막대
// ====================================================================
const A_Raw = (p) => _svg(<>
  <path d="M12 3v18" />
  <path d="M12 7c-2.2 0-4-1-4-3 2.2 0 4 1 4 3Z" />
  <path d="M12 7c2.2 0 4-1 4-3-2.2 0-4 1-4 3Z" />
  <path d="M12 12c-2.6 0-4.5-1.2-4.5-3.5 2.6 0 4.5 1.2 4.5 3.5Z" />
  <path d="M12 12c2.6 0 4.5-1.2 4.5-3.5-2.6 0-4.5 1.2-4.5 3.5Z" />
  <path d="M12 17c-2.6 0-4.5-1.2-4.5-3.5 2.6 0 4.5 1.2 4.5 3.5Z" />
  <path d="M12 17c2.6 0 4.5-1.2 4.5-3.5-2.6 0-4.5 1.2-4.5 3.5Z" />
</>, p);

const A_Mill = (p) => _svg(<>
  <rect x="3" y="5" width="18" height="11" rx="1.5" />
  <circle cx="8" cy="10.5" r="2.2" />
  <circle cx="16" cy="10.5" r="2.2" />
  <path d="M5 16v3" />
  <path d="M19 16v3" />
  <path d="M9 19h6" />
</>, p);

const A_Pkg = (p) => _svg(<>
  <path d="M7 4h10l1.5 3H5.5z" />
  <path d="M5.5 7h13v13a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1z" />
  <path d="M9 11c1 1.5 4 1.5 6 0" />
  <path d="M10 15h4" />
</>, p);

const A_Sales = (p) => _svg(<>
  <circle cx="12" cy="12" r="8.5" />
  <path d="M12 7v10" />
  <path d="M15 9.5c-.5-1-1.7-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 1 3 2-1.3 2-3 2c-1.3 0-2.5-.5-3-1.5" />
</>, p);

const A_Stats = (p) => _svg(<>
  <path d="M3 20h18" />
  <rect x="5" y="12" width="3.5" height="6" rx="0.5" />
  <rect x="10.25" y="7" width="3.5" height="11" rx="0.5" />
  <rect x="15.5" y="4" width="3.5" height="14" rx="0.5" />
</>, p);

// ====================================================================
// SET B — 기하 미니멀 (추상 / 트렌디)
//   원물=점 3개 / 도정=회전 원 / 제품=라운드 사각 / 판매=상승 화살표 / 통계=계단
// ====================================================================
const B_Raw = (p) => _svg(<>
  <circle cx="7.5" cy="8" r="2.3" />
  <circle cx="16" cy="9" r="1.8" />
  <circle cx="9" cy="16" r="2" />
  <circle cx="16.5" cy="15.5" r="1.6" />
</>, p);

const B_Mill = (p) => _svg(<>
  <circle cx="12" cy="12" r="8" />
  <path d="M12 4v4" />
  <path d="M12 16v4" />
  <path d="M4 12h4" />
  <path d="M16 12h4" />
  <circle cx="12" cy="12" r="2" />
</>, p);

const B_Pkg = (p) => _svg(<>
  <rect x="4" y="4" width="16" height="16" rx="3.5" />
  <path d="M4 10h16" />
  <path d="M10 4v16" />
</>, p);

const B_Sales = (p) => _svg(<>
  <path d="M4 18 10 12 13.5 15.5 20 9" />
  <path d="M14 9h6v6" />
</>, p);

const B_Stats = (p) => _svg(<>
  <path d="M4 18h4v-4h4v-4h4V6h4v12" />
</>, p);

// ====================================================================
// SET C — 듀오톤 / 필 (active 시 채움 형태)
//   원물=반달 / 도정=톱니 / 제품=큐브 / 판매=카트 (둥근) / 통계=파이
//   active=true 이면 내부 fill, false 이면 stroke-only
// ====================================================================
const C_Raw = ({ active, ...p }) => _svg(<>
  <path d="M12 4a7 7 0 0 1 7 7c0 .5-.1 1-.2 1.4C17 13 14.6 11 12 11s-5 2-6.8 1.4C5.1 12 5 11.5 5 11a7 7 0 0 1 7-7Z"
    fill={active ? 'currentColor' : 'none'} />
  <path d="M5 14c1.5 3 3.5 6 7 6s5.5-3 7-6" />
</>, { ...p, strokeWidth: p.strokeWidth || 1.8 });

const C_Mill = ({ active, ...p }) => _svg(<>
  <path d="M12 3.5 14 5l2.5-.5.8 2.4 2.3 1-.3 2.5 1.7 1.8-1.2 2.2.7 2.4-2.3.9-.8 2.4-2.5-.3L12 21l-1.9-1.7-2.5.3-.8-2.4-2.3-.9.7-2.4-1.2-2.2L5.7 9.9l-.3-2.5 2.3-1 .8-2.4 2.5.5z"
    fill={active ? 'currentColor' : 'none'} />
  <circle cx="12" cy="12" r="3" fill={active ? '#fff' : 'none'} stroke={active ? '#fff' : 'currentColor'} />
</>, { ...p, strokeWidth: p.strokeWidth || 1.6 });

const C_Pkg = ({ active, ...p }) => _svg(<>
  <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill={active ? 'currentColor' : 'none'} />
  <path d="M4 7.5 12 12l8-4.5" stroke={active ? '#fff' : 'currentColor'} />
  <path d="M12 12v9" stroke={active ? '#fff' : 'currentColor'} />
</>, { ...p, strokeWidth: p.strokeWidth || 1.8 });

const C_Sales = ({ active, ...p }) => _svg(<>
  <path d="M4 5h2.5l1 3m0 0 2 8h9l2-7h-13"
    fill={active ? 'currentColor' : 'none'} />
  <circle cx="10" cy="19" r="1.6" fill={active ? 'currentColor' : 'none'} />
  <circle cx="17" cy="19" r="1.6" fill={active ? 'currentColor' : 'none'} />
</>, { ...p, strokeWidth: p.strokeWidth || 1.8 });

const C_Stats = ({ active, ...p }) => _svg(<>
  <path d="M12 3v9l8 2.2A9 9 0 1 1 12 3Z" fill={active ? 'currentColor' : 'none'} />
  <path d="M14 3.3A9 9 0 0 1 20.7 10H14Z" fill={active ? '#fff' : 'none'} stroke={active ? '#fff' : 'currentColor'} />
</>, { ...p, strokeWidth: p.strokeWidth || 1.8 });

// ====================================================================
// 통합 export — 모바일 네비가 세트 전환해가며 쓸 수 있도록
// ====================================================================
window.MobileNavIconSets = {
  current: {
    // 현재 lucide 기반 (기본값 참고용)
    Raw: window.lucide.Package,
    Mill: window.lucide.Clipboard,
    Pkg: window.lucide.Boxes,
    Sales: window.lucide.ShoppingCart,
    Stats: window.lucide.Activity,
  },
  A: { Raw: A_Raw, Mill: A_Mill, Pkg: A_Pkg, Sales: A_Sales, Stats: A_Stats },
  B: { Raw: B_Raw, Mill: B_Mill, Pkg: B_Pkg, Sales: B_Sales, Stats: B_Stats },
  C: { Raw: C_Raw, Mill: C_Mill, Pkg: C_Pkg, Sales: C_Sales, Stats: C_Stats },
};
