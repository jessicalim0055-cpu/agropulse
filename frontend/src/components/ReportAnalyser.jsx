import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { FileText, ArrowRight, Lock, Unlock, Trash2, RefreshCw, Wifi, WifiOff,
         ExternalLink, TrendingUp, TrendingDown, Minus, Calendar, AlertTriangle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

const SESSION_KEY = 'agropulse_admin_pw'

const COMMODITY_COLORS = ['#d97706', '#dc2626', '#059669', '#0284c7', '#7c3aed', '#ea580c', '#db2777']

// ── Chart ─────────────────────────────────────────────────────────────────────

function buildChartData(reports) {
  const byDate = {}
  reports.forEach(r => {
    if (!r.report_date || !Array.isArray(r.commodity_prices) || !r.commodity_prices.length) return
    if (!byDate[r.report_date] || r.synced_at > byDate[r.report_date].synced_at)
      byDate[r.report_date] = r
  })
  const sorted = Object.values(byDate).sort((a, b) => a.report_date.localeCompare(b.report_date))
  if (sorted.length < 2) return { rows: [], commodities: [] }

  const commoditySet = new Set()
  sorted.forEach(r => r.commodity_prices.forEach(p => { if (p.commodity && p.price_usd != null) commoditySet.add(p.commodity) }))
  const commodities = [...commoditySet]

  const rows = sorted.map(r => {
    const row = { date: r.report_date }
    r.commodity_prices.forEach(p => {
      if (p.price_usd != null) row[p.commodity] = p.price_usd
    })
    return row
  })
  return { rows, commodities }
}

function PriceTrendChart({ reports, highlightDate }) {
  const { rows, commodities } = buildChartData(reports)

  if (rows.length < 2) return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-center">
      <TrendingUp size={18} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
      <p className="text-xs text-slate-400 dark:text-slate-600">Chart appears once 2+ weekly reports are synced</p>
    </div>
  )

  const CustomDot = ({ cx, cy, payload, stroke }) => {
    if (payload.date === highlightDate)
      return <circle cx={cx} cy={cy} r={5} fill={stroke} stroke="white" strokeWidth={2} />
    return <circle cx={cx} cy={cy} r={2.5} fill={stroke} fillOpacity={0.8} />
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">FOB Price Trends</span>
        <span className="text-[10px] text-slate-400">USD/MT · selected week highlighted</span>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={rows} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44}
            tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
            formatter={(val, name) => [`$${val}/MT`, name]}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: 9, paddingTop: 6 }} />
          {commodities.map((c, i) => (
            <Line key={c} type="monotone" dataKey={c} name={c}
              stroke={COMMODITY_COLORS[i % COMMODITY_COLORS.length]}
              strokeWidth={1.5} dot={<CustomDot />} activeDot={{ r: 5 }}
              connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Report detail ─────────────────────────────────────────────────────────────

const DIR_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }
const DIR_COLOR = {
  up:   'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-500 dark:text-red-400',
  flat: 'text-slate-400',
}
const DIR_BG = {
  up:   'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40',
  down: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40',
  flat: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700',
}

function PriceGrid({ prices }) {
  if (!prices?.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {['Commodity', 'Price', 'Basis', 'W/W', 'Detail'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prices.map((p, i) => {
            const dir = p.direction || 'flat'
            const DirIcon = DIR_ICON[dir] || Minus
            const chg = p.change_usd
            return (
              <tr key={i} className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${i % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{p.commodity}</td>
                <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {p.price_usd != null ? `$${p.price_usd}` : '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{p.price_basis || '—'}</td>
                <td className={`px-3 py-2 whitespace-nowrap font-mono ${DIR_COLOR[dir]}`}>
                  <span className="flex items-center gap-1">
                    <DirIcon size={10} />
                    {chg != null && chg !== 0 ? `${chg > 0 ? '+' : ''}$${chg}` : '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-500 max-w-[260px]">{p.detail || ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReportDetail({ report, isAdmin, onDelete }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
        <FileText size={13} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
            {report.title || report.email_subject || report.filename}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {report.report_date} · {report.filename}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => onDelete(report.id)}
            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0" title="Delete">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Overview */}
        {report.overview && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-lg p-3">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Overview</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{report.overview}</p>
          </div>
        )}

        {/* Price table */}
        {report.commodity_prices?.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Commodity Prices</p>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <PriceGrid prices={report.commodity_prices} />
            </div>
          </div>
        )}

        {/* Supply/demand + Trade flows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.supply_demand && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Supply & Demand</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.supply_demand}</p>
            </div>
          )}
          {report.trade_flows && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Trade Flows</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.trade_flows}</p>
            </div>
          )}
        </div>

        {/* Market commentary */}
        {report.market_commentary && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Market Commentary</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.market_commentary}</p>
          </div>
        )}

        {/* Key themes + Risk factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.key_themes?.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Key Themes</p>
              <ul className="space-y-1">
                {report.key_themes.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <ArrowRight size={10} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.risk_factors?.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Risk Factors</p>
              <ul className="space-y-1">
                {report.risk_factors.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <AlertTriangle size={10} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Outlook */}
        {report.outlook && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Outlook</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{report.outlook}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Outlook bar ───────────────────────────────────────────────────────────────

function OutlookBar({ isAdmin, reportCount, setReports }) {
  const [status, setStatus]         = useState(null)
  const [deviceFlow, setDeviceFlow] = useState(null)
  const [syncing, setSyncing]       = useState(false)
  const [connecting, setConnecting] = useState(false)
  const pollRef = useRef(null)

  const loadStatus = useCallback(() => {
    fetch('/api/outlook/status').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  useEffect(() => {
    if (deviceFlow) {
      pollRef.current = setInterval(async () => {
        const s = await fetch('/api/outlook/auth/status').then(r => r.json()).catch(() => null)
        if (!s) return
        if (s.status === 'authenticated' || s.status === 'failed') {
          clearInterval(pollRef.current)
          setDeviceFlow(null)
          setConnecting(false)
          loadStatus()
        }
      }, 3000)
    }
    return () => clearInterval(pollRef.current)
  }, [deviceFlow, loadStatus])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/outlook/auth/start', {
        method: 'POST',
        headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed to start auth')
      setDeviceFlow(await res.json())
    } catch (e) { alert(e.message); setConnecting(false) }
  }

  const handleDisconnect = async () => {
    await fetch('/api/outlook/disconnect', {
      method: 'POST',
      headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
    })
    loadStatus()
  }

  const handleSync = async () => {
    setSyncing(true)
    const countBefore = reportCount
    try {
      await fetch('/api/leftfield/sync', {
        method: 'POST',
        headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
      })
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const data = await fetch('/api/leftfield-reports').then(r => r.json()).catch(() => null)
        if (!data) return
        if (data.length > countBefore || attempts > 30) {
          clearInterval(poll)
          setReports(data)
          setSyncing(false)
        }
      }, 2000)
    } catch { setSyncing(false) }
  }

  if (!status) return null
  const connected = status.status === 'authenticated'
  const configured = status.configured

  return (
    <div className="space-y-2">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
        {connected
          ? <Wifi size={13} className="text-emerald-500 flex-shrink-0" />
          : <WifiOff size={13} className="text-slate-400 flex-shrink-0" />
        }
        <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 min-w-0 truncate">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Outlook</span>
          {connected
            ? <> <span className="text-emerald-600 dark:text-emerald-400">● connected</span>
                {status.email && <span className="text-slate-400 ml-1">· {status.email}</span>}
                <span className="text-slate-400 ml-1">· watching leftfield@leftfieldcr.com</span>
              </>
            : <span className="text-slate-400"> ○ not connected</span>
          }
          {!configured && <span className="text-amber-500 ml-1">· AZURE_CLIENT_ID not set</span>}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {connected && <>
              <button onClick={handleSync} disabled={syncing}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold hover:bg-emerald-100 transition-all disabled:opacity-60">
                <RefreshCw size={9} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
              <button onClick={handleDisconnect}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 text-[10px] font-semibold hover:text-red-500 transition-colors">
                Disconnect
              </button>
            </>}
            {!connected && configured && !deviceFlow && (
              <button onClick={handleConnect} disabled={connecting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold hover:bg-slate-200 transition-all disabled:opacity-60">
                {connecting ? <><div className="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin" /> Starting…</> : 'Connect'}
              </button>
            )}
          </div>
        )}
      </div>

      {deviceFlow && (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">1. Go to</p>
            <a href={deviceFlow.verification_uri} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              {deviceFlow.verification_uri} <ExternalLink size={10} />
            </a>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">2. Enter code</p>
            <span className="font-mono text-lg font-bold text-slate-800 dark:text-slate-200 tracking-widest">{deviceFlow.user_code}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <div className="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Waiting for sign-in…
          </div>
        </div>
      )}

      {!configured && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Add to backend/.env to enable:</p>
          <pre className="font-mono bg-white dark:bg-slate-800 rounded p-2 text-[10px] text-slate-600 dark:text-slate-400 overflow-x-auto">{`AZURE_CLIENT_ID=<Application ID>
AZURE_TENANT_ID=<Tenant ID>`}</pre>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportAnalyser() {
  const [reports, setReports]   = useState([])
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState(null)
  const [isAdmin, setIsAdmin]   = useState(() => !!sessionStorage.getItem(SESSION_KEY))
  const [showPw, setShowPw]     = useState(false)
  const [pwInput, setPwInput]   = useState('')
  const [pwError, setPwError]   = useState(false)

  useEffect(() => {
    fetch('/api/leftfield-reports')
      .then(r => r.json())
      .then(data => { setReports(data); if (data.length > 0) setSelected(data[0].id) })
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [])

  const handleUnlock = () => {
    if (!pwInput.trim()) return
    sessionStorage.setItem(SESSION_KEY, pwInput)
    setIsAdmin(true); setShowPw(false); setPwInput(''); setPwError(false)
  }

  const handleLock = () => { sessionStorage.removeItem(SESSION_KEY); setIsAdmin(false) }

  const handleDelete = useCallback(async (id) => {
    await fetch(`/api/leftfield-reports/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
    })
    setReports(prev => {
      const next = prev.filter(r => r.id !== id)
      if (id === selected && next.length > 0) setSelected(next[0].id)
      return next
    })
  }, [selected])

  const sortedReports = useMemo(() =>
    [...reports].sort((a, b) =>
      (b.report_date || '').localeCompare(a.report_date || '') ||
      (b.synced_at || '').localeCompare(a.synced_at || '')
    ), [reports])

  const selectedReport = sortedReports.find(r => r.id === selected)

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Leftfield</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-synced from Outlook · leftfield@leftfieldcr.com · AI-extracted market intelligence
          </p>
        </div>
        {isAdmin ? (
          <button onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-all flex-shrink-0">
            <Unlock size={12} /> Admin
          </button>
        ) : (
          <button onClick={() => setShowPw(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold hover:text-slate-700 transition-all flex-shrink-0">
            <Lock size={12} /> Admin
          </button>
        )}
      </div>

      <OutlookBar isAdmin={isAdmin} reportCount={reports.length} setReports={setReports} />

      {showPw && !isAdmin && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
          <input type="password" placeholder="Admin password" value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            autoFocus />
          <button onClick={handleUnlock}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Unlock
          </button>
          {pwError && <span className="text-red-500 text-xs">Wrong password</span>}
        </div>
      )}

      {fetching ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-600 text-sm">
          No reports yet — connect Outlook above and sync to pull the latest Leftfield PDFs automatically.
        </div>
      ) : (
        <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 290px)' }}>

          {/* Left: week list */}
          <div className="w-44 flex-shrink-0 overflow-y-auto space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">
              {sortedReports.length} report{sortedReports.length !== 1 ? 's' : ''}
            </p>
            {sortedReports.map(r => {
              const isSel = r.id === selected
              const priceCount = r.commodity_prices?.length || 0
              return (
                <button key={r.id} onClick={() => setSelected(r.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all
                    ${isSel
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700/60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Calendar size={9} className={isSel ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className={`text-xs font-bold ${isSel ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {r.report_date || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate pl-3.5">
                    {r.title || r.email_subject || r.filename || '—'}
                  </p>
                  {priceCount > 0 && (
                    <p className={`text-[10px] pl-3.5 mt-0.5 ${isSel ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-400'}`}>
                      {priceCount} commodities
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Right: chart + detail */}
          <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
            <PriceTrendChart reports={reports} highlightDate={selectedReport?.report_date} />
            {selectedReport
              ? <ReportDetail report={selectedReport} isAdmin={isAdmin} onDelete={handleDelete} />
              : <p className="text-center text-xs text-slate-400 py-8">Select a report on the left</p>
            }
          </div>

        </div>
      )}
    </div>
  )
}
