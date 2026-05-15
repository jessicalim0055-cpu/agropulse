import { ExternalLink } from 'lucide-react'

const SENT_STYLE = {
  bullish: 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/40',
  bearish: 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40',
  neutral: 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
}

function timeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NewsFeed({ news, selectedCommodity, onSelectCommodity }) {
  return (
    <section className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            News Feed
            {selectedCommodity && <span className="text-slate-400 dark:text-slate-500 font-normal ml-1.5">— filtered</span>}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{news.length} articles · click commodity tags to filter</p>
        </div>
      </div>

      {news.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500 dark:text-slate-600 text-sm">
          No articles yet. Click <span className="text-emerald-600">Refresh</span> to pull the latest news.
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          {news.map(article => (
            <article
              key={article.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-3 transition-colors"
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors leading-snug flex items-start gap-1 group"
              >
                <span className="flex-1">{article.title}</span>
                <ExternalLink size={11} className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>

              <div className="flex items-center gap-2 mt-0.5 mb-1.5">
                <span className="text-xs text-emerald-600 font-medium">{article.source}</span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-600">{timeAgo(article.published_at)}</span>
              </div>

              {article.summary && (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                  {article.summary}
                </p>
              )}

              {article.commodities?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {article.commodities.map(c => (
                    <button
                      key={c.commodity}
                      onClick={() => onSelectCommodity(selectedCommodity === c.commodity ? null : c.commodity)}
                      title={c.reasoning || ''}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide transition-all hover:scale-105
                        ${SENT_STYLE[c.sentiment] || SENT_STYLE.neutral}
                        ${selectedCommodity === c.commodity ? 'ring-1 ring-slate-900/20 dark:ring-white/20' : ''}`}
                    >
                      {c.name} · {c.sentiment}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
