/* global React, lucide */
const { useState: useStateSS } = React;

// ============================================================
// 도정 작업 상태 (3단계) — isClosed + outputs.length 로 판정
// ============================================================
const MILLING_STATUS = [
  {
    key: 'milling',
    label: '도정중',
    desc: '도정 시작, 첫 포장 기록 전',
    cond: '!isClosed && outputs.length === 0',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    animate: false,
  },
  {
    key: 'packaging',
    label: '포장중',
    desc: '일부 포장건 기록됨, 미마감',
    cond: '!isClosed && outputs.length > 0',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    animate: true,
  },
  {
    key: 'closed',
    label: '마감됨',
    desc: '포장 완료, 작업 종료 (수정 불가)',
    cond: 'isClosed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    animate: false,
  },
];
window.MILLING_STATUS = MILLING_STATUS;

function StatusBadge({ s, size = 'md' }) {
  const cls = size === 'sm'
    ? 'h-[18px] px-1.5 text-[10px]'
    : 'h-6 px-2.5 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1 ${cls} rounded-full font-bold whitespace-nowrap border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${s.animate ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
}

function StatusShowcase() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MILLING_STATUS.map(s => (
          <div key={s.key} className="border border-slate-200 rounded-lg bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <StatusBadge s={s} />
              <code className="text-[10px] text-slate-400 font-mono">{s.key}</code>
            </div>
            <div className="text-[12px] text-slate-700 font-semibold mb-1">{s.desc}</div>
            <code className="block text-[10px] text-slate-500 font-mono leading-snug bg-slate-50 border border-slate-100 rounded p-1.5">
              {s.cond}
            </code>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-[12px] text-amber-900 leading-relaxed">
        <strong>용어 통일</strong> — 기존 코드에서는 <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-amber-200">완료</code>(대시보드) / <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-amber-200">마감</code>(목록·다이얼로그) 이 혼용되고 있습니다.
        → 전체를 <strong>마감됨</strong> 으로 통일하고, "포장" 단일 상태는 <strong>도정중 / 포장중</strong> 두 상태로 세분화합니다. (액션 버튼의 "마감하다"·"마감 해제" 같은 <strong>동사형은 그대로</strong> 유지) 영향 분석은 <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-amber-200">handoff/status-migration.md</code>.
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-[10.5px] font-bold text-slate-400 tracking-wider uppercase mb-2.5">크기 변형</div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            {MILLING_STATUS.map(s => <StatusBadge key={s.key} s={s} size="md" />)}
            <span className="text-[10.5px] text-slate-400 ml-2 font-mono">md · h-6</span>
          </div>
          <div className="flex items-center gap-1.5">
            {MILLING_STATUS.map(s => <StatusBadge key={s.key} s={s} size="sm" />)}
            <span className="text-[10.5px] text-slate-400 ml-2 font-mono">sm · h-[18px]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
window.StatusShowcase = StatusShowcase;
window.StatusBadge = StatusBadge;

// ============================================================
// 도정 타입 칩 — 백미 / 현미 / 찰현미 / 칠분도미 / 오분도미 / 찹쌀 / 기타
// ============================================================
const MILLING_TYPES = [
  { key: '백미',    bg: 'bg-white',         text: 'text-slate-600',  border: 'border-slate-300',     desc: '메벼/인디카 기본 도정' },
  { key: '현미',    bg: 'bg-amber-800/10',  text: 'text-amber-800',  border: 'border-amber-800/30',  desc: '겨를 살린 도정' },
  { key: '찰현미',  bg: 'bg-amber-800/10',  text: 'text-amber-800',  border: 'border-amber-800/30',  desc: '찰벼 + 현미 도정' },
  { key: '칠분도미', bg: 'bg-orange-50',     text: 'text-orange-600', border: 'border-orange-300',    desc: '70% 도정' },
  { key: '오분도미', bg: 'bg-orange-50',     text: 'text-orange-600', border: 'border-orange-300',    desc: '50% 도정' },
  { key: '찹쌀',    bg: 'bg-white',         text: 'text-slate-600',  border: 'border-slate-300',     desc: '찰벼 백미 도정' },
  { key: '기타',    bg: 'bg-slate-100',     text: 'text-slate-500',  border: 'border-slate-300',     desc: '미분류' },
];
window.MILLING_TYPES = MILLING_TYPES;

function MillingTypeChip({ t }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap border ${t.bg} ${t.text} ${t.border}`}>
      {t.key}
    </span>
  );
}
window.MillingTypeChip = MillingTypeChip;

function MillingTypeShowcase() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {MILLING_TYPES.map(t => (
          <div key={t.key} className="border border-slate-100 bg-white rounded-md px-3 py-2.5 flex items-center gap-2.5">
            <MillingTypeChip t={t} />
            <span className="text-[10.5px] text-slate-500 flex-1">{t.desc}</span>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11.5px] text-slate-600 leading-relaxed">
        <strong className="text-slate-700">자동 치환 규칙:</strong> <code className="font-mono text-[11px]">variety.type === 'GLUTINOUS'</code> 인 경우 <code className="font-mono text-[11px]">백미→찹쌀</code>, <code className="font-mono text-[11px]">현미→찰현미</code> 로 표시 변환.
        (DB의 millingType 값은 그대로, 표시만 변환)
      </div>
    </div>
  );
}
window.MillingTypeShowcase = MillingTypeShowcase;

// ============================================================
// 인터랙션 어포던스 — 클릭 가능 셀
// ============================================================
function ClickAffordanceShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">Dotted Underline (셀 내부 값)</div>
        <div className="space-y-3 text-[13px]">
          <div className="flex items-center justify-between py-2 px-3 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer group">
            <span className="text-slate-700">생산량</span>
            <span className="font-black text-slate-800 underline decoration-dotted underline-offset-2 group-hover:text-slate-600">464,572 <span className="text-[11px] font-bold text-slate-400">kg</span></span>
          </div>
          <div className="flex items-center justify-between py-2 px-3 border border-slate-100 rounded-md hover:bg-slate-50 cursor-pointer group">
            <span className="text-slate-700">수율</span>
            <span className="font-black text-emerald-700 underline decoration-dotted underline-offset-2">67.5%</span>
          </div>
        </div>
        <div className="mt-3 text-[10.5px] text-slate-500 leading-relaxed">
          · <code className="font-mono">underline decoration-dotted underline-offset-2</code><br/>
          · hover 시 부모 row 배경 <code className="font-mono">bg-slate-50</code>, 텍스트 한 단계 흐려짐<br/>
          · 셀 클릭 → 상세 다이얼로그 (예: 포장내역)
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">Row Click + Stop Propagation</div>
        <div className="border border-slate-100 rounded-md overflow-hidden">
          <div className="py-2.5 px-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-[12.5px] border-b border-slate-50">
            <span className="text-slate-700">2025-03-12 · 새청무</span>
            <span className="text-slate-400 group-hover:text-slate-500">→</span>
          </div>
          <div className="py-2.5 px-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-[12.5px]">
            <span className="text-slate-700">2025-03-10 · 백옥찰</span>
            <span className="text-slate-400">→</span>
          </div>
        </div>
        <div className="mt-3 text-[10.5px] text-slate-500 leading-relaxed">
          · row 전체 클릭 → <strong>투입내역</strong> 다이얼로그<br/>
          · 셀 내부 dotted underline 클릭 → <strong>해당 셀별 상세</strong> 다이얼로그<br/>
          · 셀 클릭 시 <code className="font-mono">e.stopPropagation()</code> 필수
        </div>
      </div>
    </div>
  );
}
window.ClickAffordanceShowcase = ClickAffordanceShowcase;

// ============================================================
// 빈 / 로딩 상태
// ============================================================
function EmptyStateShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <div className="text-[10.5px] font-bold text-slate-400 tracking-wider uppercase mb-2">데이터 없음 — 카드/리스트</div>
        <div className="border border-dashed border-slate-200 bg-slate-50/60 rounded-lg p-8 text-center">
          <p className="text-[12.5px] text-slate-400 italic">등록된 재고가 없습니다 (2025년산)</p>
        </div>
      </div>
      <div>
        <div className="text-[10.5px] font-bold text-slate-400 tracking-wider uppercase mb-2">테이블 행 / 차트 막대</div>
        <div className="border border-slate-200 rounded-lg p-5 bg-white flex items-end justify-around h-[120px]">
          {[1,2,3].map(i => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-8 h-0 flex items-end justify-center">
                <span className="text-slate-300 text-[11px] pb-1">—</span>
              </div>
              <span className="text-[10px] font-medium text-slate-400">품종 {i}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10.5px] font-bold text-slate-400 tracking-wider uppercase mb-2">로딩 (Skeleton)</div>
        <div className="border border-slate-100 rounded-lg p-4 bg-white space-y-2.5">
          <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-7 w-32 rounded bg-slate-100 animate-pulse" />
          <div className="h-2 w-full rounded-full bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
window.EmptyStateShowcase = EmptyStateShowcase;
