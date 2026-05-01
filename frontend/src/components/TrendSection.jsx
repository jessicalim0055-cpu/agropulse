import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

const PERIODS = [
  { label: '1D', value: 'day' },
  { label: '1W', value: 'week' },
  { label: '1M', value: 'month' },
  { label: '1Y', value: 'year' },
]

const COLORS = {
  canada_yellow_peas:       '#f59e0b',
  canada_red_lentils:       '#ef4444',
  canada_green_peas:        '#10b981',
  australia_desi_chickpeas: '#38bdf8',
  australia_nipper_lentils: '#a78bfa',
  russian_yellow_peas:      '#fb923c',
  russian_flax_seeds:       '#f472b6',
}

function buildChartData(trends) {
  if (!trends) return []
  const dateSet = new Set()
  Object.values(trends).forEach(c => c.points.forEach(p => dateSet.add(p.date)))
  const dates = [...dateSet].sort()
  return dates.map(date => {
    const row = { date }
    Object.entries(trends).forEach(([key, c]) => {
      const pt = c.points.find(p => p.date === date)
      row[key] = pt ? pt.net_score : null
    })
    return row
  })
}

const CustomTooltip = ({ active, payload, label, trends }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-6 mb-0.5">
          <span style={{ color: p.stroke }}>{trends?.[p.dataKey]?.name || p.dataKey}</span>
          <span className={p.value > 0 ? 'text-emerald-400' : p.value < 0 ? 'text-red-400' : 'text-slate-400'}>
            {p.value != null ? (p.value > 0 ? '+' : '') + p.value.toFixed(2) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function TrendSection({ trends, period, onPeriodChange }) {
  const [visible, setVisible] = useState(
    Object.fromEntries(Object.keys(COLORS).map(k => [k, true]))
  )
  const chartData = buildChartData(trends)
  const hasData = chartData.length > 0

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-200">Sentiment Trends</h2>
          <p className="text-xs text-slate-500 mt-0.5">Net score: +1.0 fully bullish · 0 neutral · −1.0 fully bearish</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all
                ${period === p.value
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {/* Commodity toggles */}
        <div className="flex flex-wrap gap-2 mb-5">
          {trends && Object.entries(trends).map(([key, c]) => (
            <button
              key={key}
              onClick={() => setVisible(v => ({ ...v, [key]: !v[key] }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all
                ${visible[key]
                  ? 'border-slate-600 bg-slate-800 text-slate-300'
                  : 'border-slate-800 bg-transparent text-slate-600'}`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: visible[key] ? COLORS[key] : '#475569' }}
              />
              {c.name}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="flex items-center justify-center h-52 text-slate-600 text-sm">
            No trend data yet — click Refresh to fetch news articles.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={v => v.slice(5)}
              />
              <YAxis
                domain={[-1, 1]}
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={v => (v > 0 ? `+${v}` : String(v))}
              />
              <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" label={{ value: 'Neutral', fill: '#475569', fontSize: 10, position: 'right' }} />
              <Tooltip content={<CustomTooltip trends={trends} />} />
              {Object.keys(COLORS).map(key =>
                visible[key] ? (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[key]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLORS[key], strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS[key], strokeWidth: 0 }}
                    connectNulls={false}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
