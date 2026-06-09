/* global React */
const { useState: useStateDV } = React;

// ============================================================
// 품종 카테고리 컬러 — 로고에서 추출
// ============================================================
// 핵심값(mid) + gradient용 from/to + 50톤(배경)
const VARIETY_TOKENS = {
  uruchi: {
    label: '메벼',
    mid: '#0080c8',
    from: '#0066a3',
    to: '#2a9fd6',
    via: '#0080c8',
    bg: '#e0eff7',
    text: '#006097',
    note: '로고 진청(#0060b0)에 가깝게 미세조정한 코발트 톤. 기존 #00a2e8 대비 채도↓ 명도↓',
  },
  indica: {
    label: '인디카',
    mid: '#8dc540',
    from: '#6da12c',
    to: '#aae35f',
    via: '#8dc540',
    bg: '#f1f7e3',
    text: '#5f8a26',
    note: '로고 잎사귀 메인 그린 (#90c030 ~ #b0d040)',
  },
  glutinous: {
    label: '찰벼',
    mid: '#f89c1e',
    from: '#cc7b0c',
    to: '#ffb44d',
    via: '#f89c1e',
    bg: '#fef3e3',
    text: '#b87214',
    note: '로고 잎사귀 가장자리 옐로우 오렌지 (#f0a030 ~ #f0b040)',
  },
  others: {
    label: '기타',
    mid: '#94a3b8',
    from: '#475569',
    to: '#cbd5e1',
    via: '#94a3b8',
    bg: '#f1f5f9',
    text: '#475569',
    note: '미분류 / 합산용 중성 슬레이트',
  },
};

window.VARIETY_TOKENS = VARIETY_TOKENS;

// ============================================================
// VarietyCard — 한 품종 셀
// ============================================================
function VarietyCard({ k, t }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* main swatch */}
      <div className="h-16 relative" style={{ background: t.mid }}>
        <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white/90 drop-shadow-sm tracking-wide">{t.label}</span>
        <span className="absolute bottom-1.5 right-2 text-[10px] font-mono text-white/90 drop-shadow-sm">{t.mid}</span>
      </div>
      {/* gradient sample */}
      <div className="h-5" style={{ background: `linear-gradient(to right, ${t.from}, ${t.via}, ${t.to})` }} />
      {/* details */}
      <div className="p-2.5 space-y-1.5 text-[11px] leading-tight">
        <div className="flex justify-between">
          <span className="text-slate-400">from</span>
          <span className="font-mono text-slate-700">{t.from}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">to</span>
          <span className="font-mono text-slate-700">{t.to}</span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1.5">
          <span className="text-slate-400">bg / text</span>
          <span className="font-mono text-slate-700">{t.bg}</span>
        </div>
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 text-[10.5px] text-slate-500 leading-snug">{t.note}</div>
      </div>
    </div>
  );
}

// ============================================================
// VarietyPaletteShowcase — 4개 카드 그리드
// ============================================================
function VarietyPaletteShowcase() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Object.entries(VARIETY_TOKENS).map(([k, t]) => <VarietyCard key={k} k={k} t={t} />)}
    </div>
  );
}
window.VarietyPaletteShowcase = VarietyPaletteShowcase;

// ============================================================
// 수율 컬러 — 톤다운 (amber / emerald / slate)
// ============================================================
const YIELD_TOKENS = {
  low:    { label: '부진',   threshold: '≤ 60%',         text: 'text-amber-700', bg: 'bg-amber-50',   border: 'border-amber-200',  hex: '#b45309' },
  normal: { label: '보통',   threshold: '60% < x < target', text: 'text-slate-700', bg: 'bg-slate-50',   border: 'border-slate-200',  hex: '#334155' },
  good:   { label: '도달',   threshold: '≥ target',        text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#047857' },
};
window.YIELD_TOKENS = YIELD_TOKENS;

function YieldColorShowcase() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(YIELD_TOKENS).map(([k, t]) => (
          <div key={k} className={`border ${t.border} ${t.bg} rounded-lg p-4`}>
            <div className="flex items-baseline justify-between mb-2">
              <span className={`text-[12px] font-bold ${t.text}`}>{t.label}</span>
              <span className="font-mono text-[10.5px] text-slate-500">{t.hex}</span>
            </div>
            <div className={`text-[28px] font-black tabular-nums leading-none ${t.text}`}>
              {k === 'low' ? '58.2' : k === 'normal' ? '64.1' : '69.8'}<span className="text-[16px] ml-0.5">%</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500">{t.threshold}</div>
          </div>
        ))}
      </div>
      <div className="text-[11.5px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-3">
        <strong className="text-slate-700">규칙:</strong> 부진은 빨강 대신 <code className="font-mono text-[11px]">amber-700</code> 으로 톤다운(경고 강도를 낮춤).
        도달은 <code className="font-mono text-[11px]">emerald-700</code> (success 의미). target 값은 도정타입별로 다르며 <code className="font-mono text-[11px]">DEFAULT_YIELD_RATES</code> 상수에서 관리.
      </div>
    </div>
  );
}
window.YieldColorShowcase = YieldColorShowcase;

// ============================================================
// 차트 스펙 — 막대 두께/Y축/target line
// ============================================================
function ChartSpecShowcase() {
  const T = VARIETY_TOKENS;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Yield chart canonical spec */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase mb-3">백미 평균 수율 (Canonical)</div>
        <div className="relative h-[140px] pl-10 pr-2">
          {/* y grid */}
          {[50, 55, 60, 65, 70, 75].map(v => {
            const isTarget = v === 65;
            return (
              <div key={v} className="absolute left-10 right-2 flex items-center" style={{ bottom: `${(v-50)/25*100}%` }}>
                <span className={`absolute -left-9 -top-[7px] w-8 text-right pr-1.5 text-[9.5px] tabular-nums ${isTarget ? 'font-bold text-slate-600' : 'font-medium text-slate-400'}`}>{v}</span>
                <div className={`w-full border-t ${isTarget ? 'border-dashed border-emerald-400' : 'border-slate-100'}`} />
                {isTarget && <span className="absolute right-0 -top-[14px] text-[9px] font-bold text-emerald-600 bg-white px-1">목표 65</span>}
              </div>
            );
          })}
          {/* bars */}
          <div className="absolute inset-y-0 left-10 right-2 flex items-end justify-between">
            {[
              { v: 67.3, k: 'uruchi' },
              { v: 64.7, k: 'indica' },
              { v: 67.5, k: 'glutinous' },
            ].map(b => {
              const t = T[b.k];
              const clamp = Math.max(50, Math.min(75, b.v));
              const h = (clamp - 50) / 25 * 100;
              return (
                <div key={b.k} className="w-12 h-full flex flex-col items-center justify-end">
                  <span className="text-[12px] font-black text-slate-800 tabular-nums mb-1">{b.v.toFixed(1)}</span>
                  <div className="w-full rounded-t-[3px]" style={{ height: `${h}%`, background: `linear-gradient(to top, ${t.from}, ${t.via}, ${t.to})` }} />
                </div>
              );
            })}
          </div>
          {/* baseline */}
          <div className="absolute left-10 right-2 bottom-0 h-[1.5px] bg-slate-300" />
        </div>
        <div className="flex justify-between pl-10 pr-2 mt-1.5">
          {['메벼', '인디카', '찰벼'].map(l => <span key={l} className="w-12 text-center text-[10.5px] font-bold text-slate-500">{l}</span>)}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] text-slate-600">
          <div><strong className="text-slate-400 font-semibold">Y축 범위</strong> 50–75 고정</div>
          <div><strong className="text-slate-400 font-semibold">막대 폭</strong> 48px (w-12)</div>
          <div><strong className="text-slate-400 font-semibold">목표선</strong> 점선 emerald-400</div>
          <div><strong className="text-slate-400 font-semibold">라벨 위치</strong> 막대 위 (안 ❌)</div>
        </div>
      </div>

      {/* Horizontal bar canonical */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase mb-3">잔여율 바 (Canonical)</div>
        <div className="space-y-4">
          {/* H8 — KPI 카드 */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[12px] font-bold text-slate-700">KPI 카드 (h-8)</span>
              <span className="text-[10px] font-mono text-slate-400">h-8 = 32px</span>
            </div>
            <div className="w-full bg-slate-100 h-8 rounded-full overflow-hidden border border-slate-200/60">
              <div className="h-full rounded-full flex items-center justify-center" style={{ width: '51%', background: `linear-gradient(to right, ${T.uruchi.from}, ${T.uruchi.to})` }}>
                <span className="text-[11px] font-bold text-white drop-shadow-sm tracking-wide">51%</span>
              </div>
            </div>
          </div>
          {/* H1.5 — 리스트 행 */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[12px] font-bold text-slate-700">리스트 행 (h-1.5)</span>
              <span className="text-[10px] font-mono text-slate-400">h-1.5 = 6px</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '93%', background: `linear-gradient(to right, ${T.indica.from}, ${T.indica.to})` }} />
            </div>
          </div>
          {/* Stacked */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[12px] font-bold text-slate-700">Stacked (품종별 비중)</span>
              <span className="text-[10px] font-mono text-slate-400">h-8</span>
            </div>
            <div className="w-full bg-slate-100 h-8 rounded-full overflow-hidden flex border border-slate-200/60">
              {[{ k: 'uruchi', w: 64 }, { k: 'indica', w: 22 }, { k: 'glutinous', w: 14 }].map(s => {
                const t = T[s.k];
                return (
                  <div key={s.k} className="h-full flex items-center justify-center" style={{ width: `${s.w}%`, background: `linear-gradient(to right, ${t.from}, ${t.to})` }}>
                    <span className="text-[10.5px] font-bold text-white drop-shadow-sm">{s.w}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] text-slate-600">
          <div><strong className="text-slate-400 font-semibold">Track</strong> bg-slate-100</div>
          <div><strong className="text-slate-400 font-semibold">Radius</strong> rounded-full</div>
          <div><strong className="text-slate-400 font-semibold">Min %</strong> 라벨용 12% 보정</div>
          <div><strong className="text-slate-400 font-semibold">Gradient</strong> from→to (horizontal)</div>
        </div>
      </div>
    </div>
  );
}
window.ChartSpecShowcase = ChartSpecShowcase;

// ============================================================
// 숫자 표기 규칙
// ============================================================
function NumberRulesShowcase() {
  return (
    <table className="w-full text-[12.5px]">
      <thead className="text-slate-400 text-left">
        <tr className="border-b border-slate-200">
          <th className="py-2 font-medium w-32">구분</th>
          <th className="py-2 font-medium">예시</th>
          <th className="py-2 font-medium">규칙</th>
        </tr>
      </thead>
      <tbody>
        {[
          ['중량 (kg)', <span className="tabular-nums"><strong className="text-slate-900">845,731</strong> <span className="text-slate-500 text-[11px]">kg</span></span>, 'toLocaleString() + 단위는 별도 span, 작은 font-size/weight'],
          ['포 (단위)', <span className="tabular-nums"><strong className="text-slate-900">40</strong> <span className="text-slate-500 text-[11px]">포</span></span>, '정수만'],
          ['수율 (%)', <span className="tabular-nums font-bold text-emerald-700">67.5%</span>, 'toFixed(1) · 0.x 미만은 1자리 그대로'],
          ['비율 (%)', <span className="tabular-nums">51%</span>, '바 라벨은 Math.round() 정수만'],
          ['연도', <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">2025년산</span>, '메타칩 (Foundations §Caption 스타일)'],
          ['빈 값', <span className="text-slate-300">—</span>, 'em-dash · text-slate-300'],
        ].map((r, i) => (
          <tr key={i} className="border-b border-slate-100 last:border-b-0">
            <td className="py-2.5 text-slate-700 font-semibold align-top">{r[0]}</td>
            <td className="py-2.5 align-top">{r[1]}</td>
            <td className="py-2.5 text-slate-500 text-[11.5px] align-top">{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
window.NumberRulesShowcase = NumberRulesShowcase;
