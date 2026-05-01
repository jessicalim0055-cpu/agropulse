import { RefreshCw, Sprout, LayoutDashboard, FileSearch, Globe, Ship, Sun, Moon, BarChart2 } from 'lucide-react'

function fmt(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard',        Icon: LayoutDashboard },
  { id: 'prices',    label: 'Price Tracker',    Icon: BarChart2 },
  { id: 'reports',   label: 'Report Analyser',  Icon: FileSearch },
  { id: 'conflicts', label: 'Conflict Tracker', Icon: Globe },
  { id: 'vessels',   label: 'Vessel Tracker',   Icon: Ship },
]

export default function Header({ status, onRefresh, refreshing, activeTab, onTabChange, isDark, onThemeToggle }) {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm dark:shadow-xl">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

        {/* Brand */}
        <div className="flex items-center gap-4">
          <img
            src="https://agrocorp.com.sg/wp-content/uploads/2019/04/agrocorp-logo.png"
            alt="AgroCorp International"
            className="h-8 w-auto object-contain dark:hidden"
          />
          <img
            src="https://agrocorp.com.sg/wp-content/uploads/2019/04/agrocorp-logo-white.png"
            alt="AgroCorp International"
            className="h-8 w-auto object-contain hidden dark:block"
          />
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-600/20 border border-emerald-300 dark:border-emerald-600/40">
              <Sprout size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">AgroPulse</h1>
              <p className="text-xs text-slate-500 leading-none">Pulse &amp; Oilseed Intelligence</p>
            </div>
          </div>
        </div>

        {/* Stats + Theme toggle + Refresh */}
        <div className="flex items-center gap-5">
          {status && (
            <>
              <div className="hidden sm:block text-right">
                <p className="text-xs text-slate-500">Last refresh</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{fmt(status.last_refresh)}</p>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-xs text-slate-500">Total articles</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{(status.total_articles || 0).toLocaleString()}</p>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-xs text-slate-500">Last 24h</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{(status.articles_last_24h || 0).toLocaleString()}</p>
              </div>
            </>
          )}

          {/* Theme toggle */}
          <button
            onClick={onThemeToggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
              ${refreshing
                ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'border-emerald-600 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-700/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-700/40'
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
                ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/30'
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
