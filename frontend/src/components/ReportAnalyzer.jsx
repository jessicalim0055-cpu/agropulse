import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileText, TrendingUp, TrendingDown, Minus, Sprout, AlertCircle, ArrowRight, Lock, Unlock, Trash2 } from 'lucide-react'

const SESSION_KEY = 'agropulse_admin_pw'

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  )
}

const DIR_ICON = {
  up:   <TrendingUp  size={13} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />,
  down: <TrendingDown size={13} className="text-red-600   dark:text-red-400   flex-shrink-0 mt-0.5" />,
  flat: <Minus        size={13} className="text-amber-600  dark:text-amber-400  flex-shrink-0 mt-0.5" />,
}
const DIR_COLOR = {
  up:   'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  flat: 'text-amber-600 dark:text-amber-400',
}

function ReportResult({ report, isAdmin, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-2">
        <FileText size={14} className="text-emerald-600 dark:text-emerald-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{report.filename}</span>
        <span className="text-slate-500 dark:text-slate-600 text-xs ml-auto">
          {new Date(report.analyzed_at.endsWith('Z') ? report.analyzed_at : report.analyzed_at + 'Z').toLocaleString()}
        </span>
        {isAdmin && (
          <button
            onClick={() => onDelete(report.id)}
            className="ml-2 text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Delete report"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {report.overview && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-5">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Overview</p>
          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{report.overview}</p>
        </div>
      )}

      {report.week_on_week?.length > 0 && (
        <Section title="Week on Week">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {report.week_on_week.map((w, i) => (
              <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                {DIR_ICON[w.direction] || DIR_ICON.flat}
                <div>
                  <span className={`text-xs font-semibold ${DIR_COLOR[w.direction] || 'text-slate-500'}`}>
                    {w.commodity}
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{w.change}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.prices?.length > 0 && (
        <Section title="Prices">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {report.prices.map((p, i) => (
              <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{p.commodity}</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{p.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.acreages?.length > 0 && (
        <Section title="Acreages & Production">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {report.acreages.map((a, i) => (
              <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3">
                <Sprout size={13} className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{a.region}</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(report.supply_demand || report.trade_flows) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.supply_demand && (
            <Section title="Supply & Demand">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.supply_demand}</p>
            </Section>
          )}
          {report.trade_flows && (
            <Section title="Trade Flows">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.trade_flows}</p>
            </Section>
          )}
        </div>
      )}

      {report.key_themes?.length > 0 && (
        <Section title="Key Themes">
          <ul className="space-y-1.5">
            {report.key_themes.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                <ArrowRight size={12} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.outlook && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-5">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Outlook</p>
          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{report.outlook}</p>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-800" />
    </div>
  )
}

export default function ReportAnalyzer() {
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState(null)
  const [dragging, setDragging] = useState(false)
  const [isAdmin, setIsAdmin]   = useState(() => !!sessionStorage.getItem(SESSION_KEY))
  const [pwInput, setPwInput]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [pwError, setPwError]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => setReports(data))
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

  const handleFile = useCallback(async (file) => {
    setError(null)
    setLoading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/reports/analyze', {
        method: 'POST',
        body: form,
        headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401) {
          sessionStorage.removeItem(SESSION_KEY)
          setIsAdmin(false)
          throw new Error('Incorrect password — please log in again.')
        }
        throw new Error(err.detail || 'Analysis failed.')
      }
      const data = await res.json()
      setReports(prev => [data, ...prev])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDelete = useCallback(async (id) => {
    await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
    })
    setReports(prev => prev.filter(r => r.id !== id))
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="space-y-6 pb-16">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Market Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload weekly reports for an AI summary of prices, acreages &amp; week-on-week changes.</p>
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

      {isAdmin && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !loading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all
            ${dragging
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/50'}
            ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = '' }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Analysing report…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={28} className="text-slate-400 dark:text-slate-500" />
              <div>
                <p className="text-slate-700 dark:text-slate-300 font-medium text-sm">Drop your weekly report here</p>
                <p className="text-slate-500 text-xs mt-1">PDF · DOCX · TXT &nbsp;·&nbsp; click to browse</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {fetching ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-600 text-sm">
          No reports uploaded yet.{isAdmin ? ' Drop a file above to get started.' : ''}
        </div>
      ) : (
        reports.map(r => (
          <ReportResult key={r.id} report={r} isAdmin={isAdmin} onDelete={handleDelete} />
        ))
      )}
    </div>
  )
}
