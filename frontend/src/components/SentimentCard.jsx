const STYLES = {
  bullish: {
    outer: 'border-emerald-300 hover:border-emerald-500 bg-emerald-50 dark:border-emerald-500/30 dark:hover:border-emerald-500/60 dark:bg-emerald-950/30',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-600/40',
    icon:  'text-emerald-600 dark:text-emerald-400',
    bull:  'text-emerald-600 dark:text-emerald-400',
    bear:  'text-slate-400 dark:text-slate-500',
  },
  bearish: {
    outer: 'border-red-200 hover:border-red-400 bg-red-50 dark:border-red-500/30 dark:hover:border-red-500/60 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-600/40',
    icon:  'text-red-600 dark:text-red-400',
    bull:  'text-slate-400 dark:text-slate-500',
    bear:  'text-red-600 dark:text-red-400',
  },
  neutral: {
    outer: 'border-amber-200 hover:border-amber-400 bg-amber-50 dark:border-amber-500/20 dark:hover:border-amber-500/40 dark:bg-amber-950/10',
    badge: 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-600/30',
    icon:  'text-amber-600 dark:text-amber-400',
    bull:  'text-slate-400 dark:text-slate-500',
    bear:  'text-slate-400 dark:text-slate-500',
  },
}

const ICONS = { bullish: '▲', bearish: '▼', neutral: '◆' }

export default function SentimentCard({ data, isSelected, onClick }) {
  const s = data.dominant_sentiment
  const style = STYLES[s] || STYLES.neutral

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer transition-all duration-150 select-none
        ${style.outer}
        ${isSelected ? 'ring-2 ring-slate-900/10 dark:ring-white/20 scale-[1.03]' : 'hover:scale-[1.02]'}`}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">{data.name}</p>
        <span className={`text-base font-bold ${style.icon}`}>{ICONS[s]}</span>
      </div>

      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide mb-3 ${style.badge}`}>
        {s.toUpperCase()}
      </span>

      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700/60 mb-2">
        {data.bullish_pct > 0 && <div className="bg-emerald-500" style={{ width: `${data.bullish_pct}%` }} />}
        {data.neutral_pct > 0 && <div className="bg-amber-400" style={{ width: `${data.neutral_pct}%` }} />}
        {data.bearish_pct > 0 && <div className="bg-red-500" style={{ width: `${data.bearish_pct}%` }} />}
      </div>

      <div className="flex justify-between text-[10px] mt-1">
        <span className={style.bull}>{data.bullish_pct}% bull</span>
        <span className="text-slate-400 dark:text-slate-600">{data.total_articles} art.</span>
        <span className={style.bear}>{data.bearish_pct}% bear</span>
      </div>

      <div className="mt-2 text-center">
        <span className={`text-xs font-semibold ${style.icon}`}>
          Net {data.net_score > 0 ? '+' : ''}{data.net_score.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
