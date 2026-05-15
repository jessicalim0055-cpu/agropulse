import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import SentimentDashboard from './components/SentimentDashboard'
import TrendSection from './components/TrendSection'
import NewsFeed from './components/NewsFeed'
import ReportAnalyser from './components/ReportAnalyser'
import ConflictTracker from './components/ConflictTracker'
import VesselTracker from './components/VesselTracker'
import EmailReports from './components/EmailReports'
import WeatherDashboard from './components/WeatherDashboard'

const POLL_MS = 5 * 60 * 1000 // auto-reload every 5 min

export default function App() {
  const [status, setStatus]       = useState(null)
  const [sentiment, setSentiment] = useState(null)
  const [trends, setTrends]       = useState(null)
  const [news, setNews]           = useState([])
  const [period, setPeriod]       = useState('week')
  const [commodity, setCommodity] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('agropulse_theme')
    return !saved || saved === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('agropulse_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark(d => !d)

  const api = (path) => fetch(path).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json() })

  const loadSentiment = useCallback(() => api('/api/sentiment/current').then(setSentiment), [])
  const loadStatus    = useCallback(() => api('/api/status').then(setStatus), [])
  const loadTrends    = useCallback((p) => api(`/api/trends?period=${p}`).then(setTrends), [])
  const loadNews      = useCallback((c) => api(`/api/news?limit=40${c ? `&commodity=${c}` : ''}`).then(setNews), [])

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([loadStatus(), loadSentiment(), loadTrends(period), loadNews(commodity)])
      setError(null)
    } catch {
      setError('Cannot reach backend. Make sure the Python server is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }, [period, commodity, loadStatus, loadSentiment, loadTrends, loadNews])

  // Full reload on mount + periodic poll
  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, POLL_MS)
    return () => clearInterval(id)
  }, [loadAll])

  // Reload trends only when period changes
  useEffect(() => { if (!loading) loadTrends(period) }, [period])

  // Reload news only when commodity filter changes
  useEffect(() => { if (!loading) loadNews(commodity) }, [commodity])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/refresh', { method: 'POST' })
      // Poll status until no longer refreshing
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const s = await api('/api/status')
        setStatus(s)
        if (!s.is_refreshing || attempts > 120) {
          clearInterval(poll)
          await loadAll()
          setRefreshing(false)
        }
      }, 2000)
    } catch {
      setRefreshing(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-red-600 dark:text-red-400 text-xl font-semibold mb-2">Connection Error</p>
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
          <button
            onClick={loadAll}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header status={status} onRefresh={handleRefresh} refreshing={refreshing || status?.is_refreshing} activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} onThemeToggle={toggleTheme} />
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-10">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">Fetching market intelligence…</p>
            </div>
          </div>
        ) : activeTab === 'vessels' ? (
          <VesselTracker />
        ) : activeTab === 'conflicts' ? (
          <ConflictTracker />
        ) : activeTab === 'reports' ? (
          <ReportAnalyser />
        ) : activeTab === 'emails' ? (
          <EmailReports />
        ) : activeTab === 'weather' ? (
          <WeatherDashboard />
        ) : (
          <>
            <div className="flex gap-5 items-start">
              <div className="w-[400px] flex-shrink-0">
                <SentimentDashboard
                  sentiment={sentiment}
                  selectedCommodity={commodity}
                  onSelectCommodity={setCommodity}
                />
              </div>
              <div className="flex-1 min-w-0">
                <NewsFeed
                  news={news}
                  selectedCommodity={commodity}
                  onSelectCommodity={setCommodity}
                />
              </div>
            </div>
            <TrendSection
              trends={trends}
              period={period}
              onPeriodChange={setPeriod}
              isDark={isDark}
            />
          </>
        )}
      </main>
    </div>
  )
}
