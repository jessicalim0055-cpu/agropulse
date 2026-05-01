import { RefreshCw, Sprout, LayoutDashboard, FileSearch, Globe, Ship } from 'lucide-react'

function fmt(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard',        Icon: LayoutDashboard },
  { id: 'reports',   label: 'Report Analyser',  Icon: FileSearch },
  { id: 'conflicts', label: 'Conflict Tracker', Icon: Globe },
  { id: 'vessels',   label: 'Vessel Tracker',   Icon: Ship },
]

export default function Header({ status, onRefresh, refreshing, activeTab, onTabChange }) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-xl">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-600/40">
            <Sprout size={18} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight tracking-tight">AgroPulse</h1>
            <p className="text-xs text-slate-500 leading-none">Pulse &amp; Oilseed Intelligence</p>
          </div>
        </div>

        {/* Stats + Refresh */}
        <div className="flex items-center gap-5">
          {status && (
            <>
              <div className="hidden sm:block text-right">
                <p className="text-xs text-slate-500">Last refresh</p>
                <p className="text-xs text-slate-300 font-medium">{fmt(status.last_refresh)}</p>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-xs text-slate-500">Total articles</p>
                <p className="text-xs text-slate-300 font-medium">{(status.total_articles || 0).toLocaleString()}</p>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-xs text-slate-500">Last 24h</p>
                <p className="text-xs text-slate-300 font-medium">{(status.articles_last_24h || 0).toLocaleString()}</p>
              </div>
            </>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
              ${refreshing
                ? 'border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'border-emerald-700 bg-emerald-700/20 text-emerald-300 hover:bg-emerald-700/40'
              }`}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-0 flex gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all
              ${activeTab === id
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
              }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </header>
  )
}
