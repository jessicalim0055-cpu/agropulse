import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Mail, ArrowRight, AlertCircle, Lock, Unlock, Trash2, ChevronDown, ChevronUp, RefreshCw, Wifi, WifiOff, ExternalLink } from 'lucide-react'

const SESSION_KEY = 'agropulse_admin_pw'

function Badge({ children, color = 'slate' }) {
  const cls = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/40',
    slate:   'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    amber:   'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40',
  }[color] || ''
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {children}
    </span>
  )
}

function ParityTable({ parities }) {
  if (!parities?.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {['Commodity', 'Origin', 'FOB', 'Freight', 'CIF India', 'Duty', 'Landing Cost', 'Notes'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parities.map((p, i) => (
            <tr key={i} className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${i % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
              <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{p.commodity}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.origin}</td>
              <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono">{p.fob || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">{p.freight || '—'}</td>
              <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono">{p.cif_india || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.duty || '—'}</td>
              <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap font-mono">{p.landing_cost || '—'}</td>
              <td className="px-3 py-2.5 text-slate-500 dark:text-slate-500 max-w-[180px]">{p.notes || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OutlookPanel({ isAdmin }) {
  const [status, setStatus]       = useState(null)
  const [deviceFlow, setDeviceFlow] = useState(null)  // {user_code, verification_uri}
  const [syncing, setSyncing]     = useState(false)
  const [connecting, setConnecting] = useState(false)
  const pollRef = useRef(null)

  const loadStatus = useCallback(() => {
    fetch('/api/outlook/status').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Poll auth status while device flow is active
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
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || 'Failed to start auth')
      }
      setDeviceFlow(await res.json())
    } catch (e) {
      alert(e.message)
      setConnecting(false)
    }
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
    const countBefore = reports.length
    try {
      await fetch('/api/outlook/sync', {
        method: 'POST',
        headers: { 'x-admin-password': sessionStorage.getItem(SESSION_KEY) || '' },
      })
      // Poll until new reports appear (up to 60s)
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const data = await fetch('/api/parity-emails').then(r => r.json()).catch(() => null)
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {connected
            ? <Wifi size={15} className="text-emerald-600 dark:text-emerald-400" />
            : <WifiOff size={15} className="text-slate-400 dark:text-slate-600" />
          }
          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Outlook Auto-Sync
              {connected && <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-normal">● Connected</span>}
              {!connected && <span className="ml-2 text-slate-400 dark:text-slate-500 font-normal">○ Not connected</span>}
            </p>
            {connected && status.email && (
              <p className="text-xs text-slate-500 mt-0.5">{status.email}</p>
            )}
            {connected && status.sender && (
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                Watching: <span className="text-slate-600 dark:text-slate-400">{status.sender}</span>
                {status.subject_filter && <> · subject contains <span className="text-slate-600 dark:text-slate-400">"{status.subject_filter}"</span></>}
              </p>
            )}
            {!configured && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                AZURE_CLIENT_ID not set in .env — see setup instructions below
              </p>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {connected && (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all disabled:opacity-60"
                >
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 text-xs font-semibold hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </>
            )}
            {!connected && configured && !deviceFlow && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-60"
              >
                {connecting ? <><div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" /> Starting…</> : 'Connect Outlook'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Device code prompt */}
      {deviceFlow && (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Sign in to Microsoft</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">1. Go to</p>
              <a
                href={deviceFlow.verification_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {deviceFlow.verification_uri} <ExternalLink size={11} />
              </a>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">2. Enter code</p>
              <span className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200 tracking-widest">
                {deviceFlow.user_code}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Waiting for you to sign in…
          </div>
        </div>
      )}

      {/* Setup instructions when not configured */}
      {!configured && (
        <div className="text-xs text-slate-500 dark:text-slate-600 space-y-1 border-t border-slate-200 dark:border-slate-800 pt-3">
          <p className="font-semibold text-slate-600 dark:text-slate-500">Add to backend/.env to enable:</p>
          <pre className="font-mono bg-slate-100 dark:bg-slate-800 rounded p-2 text-slate-600 dark:text-slate-400 overflow-x-auto">{`AZURE_CLIENT_ID=<Application ID from Azure portal>
AZURE_TENANT_ID=<Directory ID from Azure portal>
PARITY_SENDER_EMAIL=priya@supplier.com
PARITY_SUBJECT_FILTER=parity`}</pre>
        </div>
      )}
    </div>
  )
}

function EmailResult({ report, isAdmin, onDelete }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <Mail size={14} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {report.sender || report.filename}
            </span>
            {report.email_date && (
              <Badge color="slate">{report.email_date}</Badge>
            )}
            {report.parities?.length > 0 && (
              <Badge color="emerald">{report.parities.length} commodities</Badge>
            )}
          </div>
          {report.sender && report.filename && (
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5 truncate">{report.filename}</p>
          )}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-600 flex-shrink-0">
          {new Date(report.uploaded_at.endsWith('Z') ? report.uploaded_at : report.uploaded_at + 'Z').toLocaleString()}
        </span>
        {isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(report.id) }}
            className="text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
        {expanded
          ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" />
          : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
        }
      </div>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 space-y-5">

          {report.overview && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Overview</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{report.overview}</p>
            </div>
          )}

          {report.parities?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Parity Table</p>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <ParityTable parities={report.parities} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.freight_notes && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Freight</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.freight_notes}</p>
              </div>
            )}
            {report.duty_structure && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Duty Structure</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{report.duty_structure}</p>
              </div>
            )}
          </div>

          {report.key_highlights?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Key Highlights</p>
              <ul className="space-y-1.5">
                {report.key_highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <ArrowRight size={12} className="text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.outlook && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Outlook</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{report.outlook}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function EmailReports() {
  const [reports, setReports]   = useState([])
  const [fetching, setFetching] = useState(true)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [dragging, setDragging] = useState(false)
  const [isAdmin, setIsAdmin]   = useState(() => !!sessionStorage.getItem(SESSION_KEY))
  const [showPw, setShowPw]     = useState(false)
  const [pwInput, setPwInput]   = useState('')
  const [pwError, setPwError]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/parity-emails')
      .then(r => r.json())
      .then(setReports)
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
      const res = await fetch('/api/parity-emails/upload', {
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
        throw new Error(err.detail || 'Upload failed.')
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
    await fetch(`/api/parity-emails/${id}`, {
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
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Parity Email Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload weekly parity emails to extract FOB, freight, CIF India, duty &amp; landing costs.</p>
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

      <OutlookPanel isAdmin={isAdmin} />

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
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !loading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all
            ${dragging
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/50'}
            ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".eml,.txt,.pdf,.docx"
            className="hidden"
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = '' }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Extracting parity data…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={28} className="text-slate-400 dark:text-slate-500" />
              <div>
                <p className="text-slate-700 dark:text-slate-300 font-medium text-sm">Drop parity email here</p>
                <p className="text-slate-500 text-xs mt-1">.eml · .txt · .pdf · .docx &nbsp;·&nbsp; click to browse</p>
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
          No parity emails uploaded yet.{isAdmin ? ' Drop a file above to get started.' : ''}
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => (
            <EmailResult key={r.id} report={r} isAdmin={isAdmin} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
