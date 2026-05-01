import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Lock, Unlock, Plus, Trash2 } from 'lucide-react'

const SESSION_KEY = 'agropulse_admin_pw'

const COMMODITIES = {
  canada_yellow_peas:       'Canada Yellow Peas',
  canada_red_lentils:       'Canada Red Lentils',
  canada_green_peas:        'Canada Green Peas',
  australia_desi_chickpeas: 'Australia Desi Chickpeas',
  australia_nipper_lentils: 'Australia Nipper Lentils',
  russian_yellow_peas:      'Russian Yellow Peas',
  russian_flax_seeds:       'Russian Flax Seeds',
}

const COLORS = {
  canada_yellow_peas:       '#d97706',
  canada_red_lentils:       '#dc2626',
  canada_green_peas:        '#059669',
  australia_desi_chickpeas: '#0284c7',
  australia_nipper_lentils: '#7c3aed',
  russian_yellow_peas:      '#ea580c',
  russian_flax_seeds:       '#db2777',
}

const TRADE_BADGE = {
  buy:        'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/40',
  sell:       'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40',
  indicative: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
}

const CARGO_BADGE = {
  bulk:      'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40',
  container: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40',
}

function buildChartData(entries, cargoFilter, tradeFilter) {
  const filtered = entries.filter(e => {
    if (cargoFilter !== 'all' && e.cargo_type !== cargoFilter) return false
    if (tradeFilter !== 'all' && e.trade_type !== tradeFilter) return false
    return true
  })
  const map = {}
  for (const e of filtered) {
    if (!map[e.date]) map[e.date] = {}
    if (!map[e.date][e.commodity]) map[e.date][e.commodity] = []
    map[e.date][e.commodity].push(e.price)
  }
  return Object.keys(map).sort().map(date => {
    const row = { date }
    for (const [key, prices] of Object.entries(map[date])) {
      row[key] = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100
    }
    return row
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-6 mb-0.5">
          <span style={{ color: p.stroke }}>{COMMODITIES[p.dataKey] || p.dataKey}</span>
          <span className="text-slate-700 dark:text-slate-300 font-semibold">
            {p.value != null ? `$${p.value.toFixed(2)}/MT` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  commodity: 'canada_yellow_peas',
  origin: '',
  destination: '',
  price: '',
  trade_type: 'buy',
  cargo_type: 'bulk',
  notes: '',
}

export default function PriceTracker({ isDark }) {
  const [entries, setEntries]     = useState([])
  const [fetching, setFetching]   = useState(true)
  const [isAdmin, setIsAdmin]     = useState(() => !!sessionStorage.getItem(SESSION_KEY))
  const [showPw, setShowPw]       = useState(false)
  const [pwInput, setPwInput]     = useState('')
  const [pwError, setPwError]     = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [cargoFilter, setCargoFilter] = useState('all')
  const [tradeFilter, setTradeFilter] = useState('all')
  const [visible, setVisible]     = useState(
    Object.fromEntries(Object.keys(COLORS).map(k => [k, true]))
  )

  useEffect(() => {
    fetch('/api/prices')
      .then(r => r.json())
      .then(setEntries)
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  const handleUnlock = () => {
    if (!pwInput.trim()) return
    sessionStorage.setItem(SESSION_KEY, pwInput)
    setIsAdmin(true)
    setShowPw(false)
    setPwInput('')
    setPwError(false)
  }

  const handleLock = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setIsAdmin(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.origin.trim() || !form.destination.trim() || !form.price) {
      setFormError('Please fill in origin, destination, and price.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '',
        },
        body: JSON.stringify({ ...form, price: parseFloat(form.price) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401) {
          sessionStorage.removeItem(SESSION_KEY)
          setIsAdmin(false)
          throw new Error('Incorrect password — please log in again.')
        }
        throw new Error(err.detail || 'Failed to save entry.')
      }
      const data = await res.json()
      setEntries(prev => [data, ...prev])
      setForm(f => ({ ...EMPTY_FORM, date: f.date, commodity: f.commodity, trade_type: f.trade_type, cargo_type: f.cargo_type }))
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = useCallback(async (id) => {
    await fetch(`/api/prices/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
    })
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const chartData  = buildChartData(entries, cargoFilter, tradeFilter)
  const gridColor  = isDark ? '#1e293b' : '#e2e8f0'
  const tickColor  = isDark ? '#64748b' : '#94a3b8'

  const inputCls = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500'

  const toggleBtn = (active) =>
    `px-3 py-1 rounded text-xs font-medium transition-all ${
      active
        ? 'bg-emerald-600 text-white'
        : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
    }`

  return (
    <div className="space-y-6 pb-16">

      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Price Tracker</h2>
          <p className="text-xs text-slate-500 mt-0.5">Log purchase &amp; sale prices by commodity, route, and cargo type.</p>
        </div>
        {isAdmin ? (
          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all flex-shrink-0"
          >
            <Unlock size={12} /> Admin
          </button>
        ) : (
          <button
            onClick={() => setShowPw(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold hover:text-slate-700 dark:hover:text-slate-300 transition-all flex-shrink-0"
          >
            <Lock size={12} /> Admin
          </button>
        )}
      </div>

      {/* Password input */}
      {showPw && !isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
          <input
            type="password"
            placeholder="Admin password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-600"
            autoFocus
          />
          <button
            onClick={handleUnlock}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Unlock
          </button>
          {pwError && <span className="text-red-500 dark:text-red-400 text-xs">Wrong password</span>}
        </div>
      )}

      {/* Entry form */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">New Price Entry</h3>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Commodity</label>
                <select
                  value={form.commodity}
                  onChange={e => setForm(f => ({ ...f, commodity: e.target.value }))}
                  className={inputCls}
                >
                  {Object.entries(COMMODITIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Origin</label>
                <input
                  type="text"
                  placeholder="e.g. Canada"
                  value={form.origin}
                  onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Destination</label>
                <input
                  type="text"
                  placeholder="e.g. India"
                  value={form.destination}
                  onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Price (USD/MT)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="580.00"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-5">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Trade Type</label>
                <div className="flex gap-1">
                  {['buy', 'sell', 'indicative'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, trade_type: t }))}
                      className={`${toggleBtn(form.trade_type === t)} capitalize`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Cargo Type</label>
                <div className="flex gap-1">
                  {['bulk', 'container'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, cargo_type: c }))}
                      className={`${toggleBtn(form.cargo_type === c)} capitalize`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CFR Nhava Sheva, new crop"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Plus size={13} />
                {submitting ? 'Saving…' : 'Add Entry'}
              </button>
            </div>

            {formError && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{formError}</p>
            )}
          </form>
        </div>
      )}

      {/* Price history chart */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Price History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Average logged price per commodity (USD/MT)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1">
              {[['all', 'All cargo'], ['bulk', 'Bulk'], ['container', 'Container']].map(([v, label]) => (
                <button key={v} onClick={() => setCargoFilter(v)} className={toggleBtn(cargoFilter === v)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {[['all', 'All types'], ['buy', 'Buy'], ['sell', 'Sell'], ['indicative', 'Indicative']].map(([v, label]) => (
                <button key={v} onClick={() => setTradeFilter(v)} className={toggleBtn(tradeFilter === v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap gap-2 mb-5">
            {Object.entries(COMMODITIES).map(([key, name]) => (
              <button
                key={key}
                onClick={() => setVisible(v => ({ ...v, [key]: !v[key] }))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all
                  ${visible[key]
                    ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-400 dark:text-slate-600'}`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: visible[key] ? COLORS[key] : (isDark ? '#475569' : '#cbd5e1') }}
                />
                {name}
              </button>
            ))}
          </div>

          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-slate-400 dark:text-slate-600 text-sm">
              No price data yet.{isAdmin ? ' Add your first entry above.' : ''}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fill: tickColor, fontSize: 10 }} tickFormatter={v => `$${v}`} width={60} />
                <Tooltip content={<CustomTooltip />} />
                {Object.keys(COLORS).map(key =>
                  visible[key] ? (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[key]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: COLORS[key], strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: COLORS[key], strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Price log table */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">Price Log</h2>
        {fetching ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-600 text-sm">
            No price entries yet.{isAdmin ? ' Add your first entry above.' : ''}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Commodity</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Route</th>
                  <th className="text-right px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider">Cargo</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-semibold uppercase tracking-wider hidden md:table-cell">Notes</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${
                      i % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: COLORS[e.commodity] || '#94a3b8' }}
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{COMMODITIES[e.commodity] || e.commodity}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {e.origin} → {e.destination}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">${e.price.toFixed(2)}</span>
                      <span className="text-slate-400 dark:text-slate-600 ml-0.5">/MT</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${TRADE_BADGE[e.trade_type] || ''}`}>
                        {e.trade_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${CARGO_BADGE[e.cargo_type] || ''}`}>
                        {e.cargo_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-500 hidden md:table-cell max-w-[220px] truncate">
                      {e.notes || '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
