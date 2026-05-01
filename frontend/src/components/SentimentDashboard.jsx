import SentimentCard from './SentimentCard'

export default function SentimentDashboard({ sentiment, selectedCommodity, onSelectCommodity }) {
  if (!sentiment) return null

  const entries = Object.values(sentiment)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Market Sentiment</h2>
          <p className="text-xs text-slate-500 mt-0.5">Based on news from the last 7 days · click to filter</p>
        </div>
        {selectedCommodity && (
          <button
            onClick={() => onSelectCommodity(null)}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {entries.map((data) => (
          <SentimentCard
            key={data.key}
            data={data}
            isSelected={selectedCommodity === data.key}
            onClick={() => onSelectCommodity(selectedCommodity === data.key ? null : data.key)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Bullish</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Neutral</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Bearish</span>
      </div>
    </section>
  )
}
