const STYLES = {
  bullish: {
    outer:  'border-emerald-300 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:hover:border-emerald-500/50',
    badge:  'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-600/40',
    bar:    'bg-emerald-500',
    score:  'text-emerald-600 dark:text-emerald-400',
    dot:    'bg-emerald-500',
  },
  bearish: {
    outer:  'border-red-200 bg-red-50 hover:border-red-400 dark:border-red-500/30 dark:bg-red-950/20 dark:hover:border-red-500/50',
    badge:  'bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-600/40',
    bar:    'bg-red-500',
    score:  'text-red-600 dark:text-red-400',
    dot:    'bg-red-500',
  },
  neutral: {
    outer:  'border-amber-200 bg-amber-50 hover:border-amber-400 dark:border-amber-500/20 dark:bg-amber-950/10 dark:hover:border-amber-500/40',
    badge:  'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-600/30',
    bar:    'bg-amber-400',
    score:  'text-amber-600 dark:text-amber-400',
    dot:    'bg-amber-400',
  },
}

const ICONS = { bullish: '▲', bearish: '▼', neutral: '◆' }

export default function SentimentCard({ data, isSelected, onClick }) {
  const s = data.dominant_sentiment
  const style = STYLES[s] || STYLES.neutral
  const reason = data.top_reasons?.[0] || ''

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 cursor-pointer transition-all duration-150 select-none
        ${style.outer}
        ${isSelected ? 'ring-2 ring-slate-900/10 dark:ring-white/20' : ''}`}
    >
      {/* Top row: name + badge + score */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-1 leading-snug">{data.name}</p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${style.badge}`}>
          {ICONS[s]} {s.toUpperCase()}
        </span>
        <span className={`text-xs font-bold flex-shrink-0 ${style.score}`}>
          {data.net_score > 0 ? '+' : ''}{data.net_score.toFixed(2)}
        </span>
      </div>

      {/* Reason line */}
      {reason ? (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-2 pl-4">
          {reason}
        </p>
      ) : (
        <p className="text-[10px] text-slate-400 italic mb-2 pl-4">No recent signal</p>
      )}

      {/* Mini bar */}
      <div className="flex h-1 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700/60 ml-4">
        {data.bullish_pct > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${data.bullish_pct}%` }} />}
        {data.neutral_pct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${data.neutral_pct}%` }} />}
        {data.bearish_pct > 0 && <div className="bg-red-500 transition-all" style={{ width: `${data.bearish_pct}%` }} />}
      </div>
      <div className="flex justify-between text-[9px] mt-1 ml-4 text-slate-400 dark:text-slate-600">
        <span>{data.bullish_pct}% bull</span>
        <span>{data.total_articles} articles</span>
        <span>{data.bearish_pct}% bear</span>
      </div>
    </div>
  )
}
