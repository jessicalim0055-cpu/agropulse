import { useState, useEffect, useRef } from 'react'
import { CloudRain, Droplets, Wind, Thermometer, RefreshCw, ExternalLink, Newspaper } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

// ── Constants ─────────────────────────────────────────────────────────────────

const COUNTRIES = ['All', 'Canada', 'India', 'China', 'Russia', 'Australia']

const FLAGS = { Canada: '🇨🇦', India: '🇮🇳', China: '🇨🇳', Russia: '🇷🇺', Australia: '🇦🇺' }

const NEWS_KEYWORDS = {
  Canada:    ['canada', 'canadian', 'saskatchewan', 'alberta', 'manitoba', 'prairie', 'statcan', 'viterra'],
  India:     ['india', 'indian', 'monsoon', 'kharif', 'rabi', 'punjab', 'maharashtra', 'madhya', 'rajasthan', 'uttar pradesh'],
  China:     ['china', 'chinese', 'heilongjiang', 'beijing', 'henan', 'yunnan', 'kunming'],
  Russia:    ['russia', 'russian', 'black sea', 'novorossiysk', 'krasnodar', 'voronezh', 'kursk', 'ukraine'],
  Australia: ['australia', 'australian', 'eyre peninsula', 'south australia', 'new south wales', 'moree', 'grdc', 'pulse australia'],
}

const SOIL_COLORS = {
  'Very Dry':  '#ef4444',
  'Dry':       '#f59e0b',
  'Normal':    '#10b981',
  'Moist':     '#3b82f6',
  'Saturated': '#6366f1',
  'N/A':       '#94a3b8',
}

// ── Soil moisture helpers ─────────────────────────────────────────────────────

function soilStatus(sm) {
  if (sm == null) return { label: 'N/A',       color: 'slate',   pct: 0,   tw: 'bg-slate-300' }
  if (sm < 0.10)  return { label: 'Very Dry',  color: 'red',     pct: 18,  tw: 'bg-red-500' }
  if (sm < 0.18)  return { label: 'Dry',       color: 'amber',   pct: 35,  tw: 'bg-amber-500' }
  if (sm < 0.30)  return { label: 'Normal',    color: 'emerald', pct: 58,  tw: 'bg-emerald-500' }
  if (sm < 0.42)  return { label: 'Moist',     color: 'blue',    pct: 78,  tw: 'bg-blue-500' }
  return            { label: 'Saturated',  color: 'indigo',  pct: 95,  tw: 'bg-indigo-500' }
}

function waterBalanceLabel(mm) {
  if (mm == null) return { text: '—', cls: 'text-slate-400' }
  if (mm > 20)    return { text: `+${mm} mm surplus`,  cls: 'text-blue-600 dark:text-blue-400' }
  if (mm > 0)     return { text: `+${mm} mm slight surplus`, cls: 'text-emerald-600 dark:text-emerald-400' }
  if (mm > -20)   return { text: `${mm} mm slight deficit`,  cls: 'text-amber-600 dark:text-amber-400' }
  return            { text: `${mm} mm deficit`,  cls: 'text-red-600 dark:text-red-400' }
}

// ── Precipitation bar chart ───────────────────────────────────────────────────

function PrecipChart({ daily }) {
  if (!daily?.length) return null

  const today = new Date().toISOString().slice(0, 10)
  const data = daily.map(d => ({
    label: d.date.slice(5),          // MM-DD
    past:     d.date <= today && !d.is_forecast ? (d.precip_mm ?? 0) : null,
    forecast: d.is_forecast          ? (d.precip_mm ?? 0) : null,
  }))

  const maxPrecip = Math.max(...daily.map(d => d.precip_mm ?? 0), 5)

  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} margin={{ top: 2, right: 4, left: -20, bottom: 0 }} barSize={6}>
        <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} axisLine={false}
          interval={2} />
        <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} axisLine={false}
          tickFormatter={v => `${v}`} domain={[0, Math.ceil(maxPrecip * 1.2)]} />
        <Tooltip
          contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}
          formatter={(v, name) => [`${v?.toFixed(1) ?? 0} mm`, name === 'past' ? 'Actual' : 'Forecast']}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="past"     stackId="p" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        <Bar dataKey="forecast" stackId="p" fill="#93c5fd" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 7-day forecast strip ──────────────────────────────────────────────────────

function ForecastStrip({ daily }) {
  const forecast = daily?.filter(d => d.is_forecast).slice(0, 7) ?? []
  if (!forecast.length) return null
  return (
    <div className="flex gap-1 mt-2">
      {forecast.map(d => (
        <div key={d.date} className="flex-1 text-center">
          <p className="text-[9px] text-slate-400">{new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</p>
          <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
            {d.temp_max != null ? `${Math.round(d.temp_max)}°` : '—'}
          </p>
          <p className="text-[9px] text-slate-400">{d.temp_min != null ? `${Math.round(d.temp_min)}°` : '—'}</p>
          {(d.precip_mm ?? 0) > 0.5 && (
            <p className="text-[9px] text-blue-500">{d.precip_mm?.toFixed(1)}mm</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Region card ───────────────────────────────────────────────────────────────

function RegionCard({ region }) {
  const { current, daily, water_balance_14d_mm, precip_7d_mm } = region
  const sm = soilStatus(current?.soil_moisture)
  const wb = waterBalanceLabel(water_balance_14d_mm)

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{FLAGS[region.country]}</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{region.name}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{region.area} · {region.country}</p>
        </div>
        {/* Today's temp */}
        {current?.temp_max_c != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-base font-bold text-slate-800 dark:text-slate-200 leading-tight">
              {Math.round(current.temp_max_c)}°C
            </p>
            <p className="text-[10px] text-slate-400">↓ {current.temp_min_c != null ? Math.round(current.temp_min_c) : '—'}°C</p>
          </div>
        )}
      </div>

      {/* Today quick stats */}
      <div className="flex gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <CloudRain size={10} className="text-blue-400" />
          {current?.precip_mm != null ? `${current.precip_mm.toFixed(1)} mm today` : '—'}
        </span>
        <span className="flex items-center gap-1">
          <Droplets size={10} className="text-blue-400" />
          {precip_7d_mm != null ? `${precip_7d_mm} mm / 7d` : '—'}
        </span>
        {current?.wind_kmh != null && (
          <span className="flex items-center gap-1">
            <Wind size={10} className="text-slate-400" />
            {Math.round(current.wind_kmh)} km/h
          </span>
        )}
      </div>

      {/* Precip chart */}
      <div>
        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
          Precipitation — 14d actual + 7d forecast (mm)
        </p>
        <PrecipChart daily={daily} />
        <div className="flex gap-3 mt-1">
          <span className="flex items-center gap-1 text-[9px] text-slate-400">
            <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Actual
          </span>
          <span className="flex items-center gap-1 text-[9px] text-slate-400">
            <span className="w-2 h-2 rounded-sm bg-blue-200 inline-block" /> Forecast
          </span>
        </div>
      </div>

      {/* Soil moisture */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Soil Moisture (0–7 cm)</p>
          <span className={`text-[10px] font-semibold text-${sm.color}-600 dark:text-${sm.color}-400`}>
            {sm.label}{current?.soil_moisture != null ? ` · ${current.soil_moisture.toFixed(2)}` : ''}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${sm.tw}`} style={{ width: `${sm.pct}%` }} />
        </div>
      </div>

      {/* Water balance */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400">14-day water balance (rain − ET₀)</span>
        <span className={`font-semibold ${wb.cls}`}>{wb.text}</span>
      </div>

      {/* 7-day forecast */}
      <ForecastStrip daily={daily} />

      {/* Crop relevance */}
      <div className="flex flex-wrap gap-1 mt-1">
        {region.crops.map(c => (
          <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
            {c}
          </span>
        ))}
      </div>

      {/* Note */}
      {region.note && (
        <p className="text-[10px] text-slate-400 italic border-t border-slate-100 dark:border-slate-800 pt-2">
          {region.note}
        </p>
      )}
    </div>
  )
}

// ── Interactive map ───────────────────────────────────────────────────────────

function WeatherMap({ regions, onCountryClick }) {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef({})
  const fittedRef  = useRef(false)

  useEffect(() => {
    if (leafletRef.current || !mapRef.current || !window.L) return
    const L = window.L
    const map = L.map(mapRef.current, { center: [20, 100], zoom: 2, minZoom: 1, maxZoom: 8, scrollWheelZoom: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 20,
    }).addTo(map)
    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null; fittedRef.current = false }
  }, [])

  useEffect(() => {
    const L = window.L
    if (!L || !leafletRef.current || !regions.length) return
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    regions.forEach(r => {
      const sm    = soilStatus(r.current?.soil_moisture)
      const color = SOIL_COLORS[sm.label] || '#94a3b8'
      const wb    = waterBalanceLabel(r.water_balance_14d_mm)

      const popHtml = `
        <div style="min-width:170px;font-size:12px;line-height:1.5;">
          <div style="font-weight:700;margin-bottom:2px;">${FLAGS[r.country] || ''} ${r.name}</div>
          <div style="color:#64748b;font-size:10px;margin-bottom:6px;">${r.area} · ${r.country}</div>
          ${r.current?.temp_max_c != null ? `<div>🌡 ${Math.round(r.current.temp_max_c)}° / ${r.current.temp_min_c != null ? Math.round(r.current.temp_min_c) : '—'}°C</div>` : ''}
          ${r.current?.precip_mm != null ? `<div>🌧 ${r.current.precip_mm.toFixed(1)} mm today</div>` : ''}
          <div>💧 Soil: <b style="color:${color}">${sm.label}</b></div>
          <div style="margin-top:4px;font-size:10px;">${wb.text}</div>
          <div style="margin-top:6px;font-size:9px;color:#94a3b8;">Click to filter by country</div>
        </div>`

      const marker = L.circleMarker([r.lat, r.lon], {
        radius: 9, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85,
      })
        .addTo(leafletRef.current)
        .bindTooltip(popHtml, { permanent: false, direction: 'top', sticky: true })
        .on('click', () => onCountryClick(r.country))

      markersRef.current[r.id] = marker
    })

    if (!fittedRef.current && Object.keys(markersRef.current).length > 0) {
      const group = L.featureGroup(Object.values(markersRef.current))
      leafletRef.current.fitBounds(group.getBounds().pad(0.15))
      fittedRef.current = true
    }
  }, [regions, onCountryClick])

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      <div ref={mapRef} style={{ height: 320 }} />
      <div className="bg-white dark:bg-slate-900 px-4 py-2.5 flex items-center gap-4 flex-wrap border-t border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Soil Moisture</span>
        {Object.entries(SOIL_COLORS).filter(([k]) => k !== 'N/A').map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span style={{ background: color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
            {label}
          </span>
        ))}
        <span className="text-[10px] text-slate-400 ml-auto">Click marker to filter country</span>
      </div>
    </div>
  )
}

// ── Related news ──────────────────────────────────────────────────────────────

function RelatedNews({ country, news }) {
  const keywords = NEWS_KEYWORDS[country] ?? []
  const filtered = news.filter(a => {
    const text = `${a.title} ${a.summary || ''}`.toLowerCase()
    return keywords.some(k => text.includes(k))
  }).slice(0, 6)

  if (!filtered.length) return null

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper size={13} className="text-slate-400" />
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Related News{country !== 'All' ? ` — ${country}` : ''}
        </h3>
        <span className="text-[10px] text-slate-400">{filtered.length} articles</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(a => (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
            className="flex flex-col gap-1 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors group">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
              {a.title}
            </p>
            {a.summary && (
              <p className="text-[10px] text-slate-500 line-clamp-2">{a.summary}</p>
            )}
            <div className="flex items-center gap-1 mt-auto pt-1">
              <span className="text-[9px] text-slate-400">{a.source}</span>
              <ExternalLink size={8} className="text-slate-300 ml-auto" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WeatherDashboard() {
  const [regions, setRegions]       = useState([])
  const [news, setNews]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [country, setCountry]       = useState('All')
  const [updatedAt, setUpdatedAt]   = useState(null)
  const [error, setError]           = useState(null)

  const load = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true)
      await fetch('/api/weather/refresh', { method: 'POST' }).catch(() => {})
    }
    try {
      const [weatherData, newsData] = await Promise.all([
        fetch('/api/weather').then(r => r.json()),
        fetch('/api/news?limit=60').then(r => r.json()),
      ])
      setRegions(weatherData)
      setNews(newsData)
      setUpdatedAt(new Date())
      setError(null)
    } catch (e) {
      setError('Could not load weather data. Make sure the backend is running.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const displayed = country === 'All'
    ? regions
    : regions.filter(r => r.country === country)

  const newsCountry = country === 'All' ? null : country

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Fetching live weather data…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-xl p-6 text-center text-red-600 dark:text-red-400 text-sm">
      {error}
    </div>
  )

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Weather · Agricultural Regions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live data via Open-Meteo · precipitation, soil moisture &amp; 7-day forecast
            {updatedAt && <> · updated {updatedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</>}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-60"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Country filter */}
      <div className="flex gap-2 flex-wrap">
        {COUNTRIES.map(c => (
          <button key={c} onClick={() => setCountry(c)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${country === c
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}>
            {c !== 'All' && <span className="mr-1">{FLAGS[c]}</span>}{c}
            {c !== 'All' && <span className="ml-1.5 text-[10px] opacity-60">({regions.filter(r => r.country === c).length})</span>}
          </button>
        ))}
      </div>

      {/* Interactive map */}
      {regions.length > 0 && (
        <WeatherMap regions={regions} onCountryClick={setCountry} />
      )}

      {/* Region cards */}
      {displayed.length === 0 ? (
        <p className="text-center text-slate-400 py-12 text-sm">No weather data yet — backend may still be loading.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map(r => <RegionCard key={r.id} region={r} />)}
        </div>
      )}

      {/* Related news */}
      {newsCountry ? (
        <RelatedNews country={newsCountry} news={news} />
      ) : (
        COUNTRIES.slice(1).map(c => (
          <RelatedNews key={c} country={c} news={news} />
        ))
      )}

    </div>
  )
}
