import SentimentCard from './SentimentCard'

export default function SentimentDashboard({ sentiment, selectedCommodity, onSelectCommodity }) {
  if (!sentiment) return null

  const entries = Object.values(sentiment)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Market Sentiment</h2>
          <p className="text-xs text-slate-500 mt-0.5">7-day signal · click to filter news</p>
        </div>
        {selectedCommodity && (
          <button
            onClick={() => onSelectCommodity(null)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="space-y-2">
        {entries.map((data) => (
          <SentimentCard
            key={data.key}
            data={data}
            isSelected={selectedCommodity === data.key}
            onClick={() => onSelectCommodity(selectedCommodity === data.key ? null : data.key)}
          />
        ))}
      </div>
    </section>
  )
}
