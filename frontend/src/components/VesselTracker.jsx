import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Ship, Lock, Unlock, Plus, Trash2, Edit3, ExternalLink,
  AlertTriangle, Wifi, WifiOff, Search, X, Navigation,
} from 'lucide-react'

const SESSION_KEY = 'agropulse_vessel_admin'
const STORAGE_KEY = 'agropulse_fleet'
const ADMIN_PW    = 'agropulse2026'
const POLL_MS     = 15 * 60 * 1000

const OPERATORS = ['ALL', 'PEIRU', 'ESTHER', 'SARI', 'JESSICA']
const OP_COLORS = { PEIRU: '#10b981', ESTHER: '#3b82f6', SARI: '#f59e0b', JESSICA: '#a855f7' }

const STATUS_STYLE = {
  'Laden':       'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700/40 dark:text-blue-300',
  'Ballast':     'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400',
  'Loading':     'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300',
  'Discharging': 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700/40 dark:text-violet-300',
  'At Anchor':   'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500',
}

const DEFAULT_FLEET = [
  { id: 'b1', type: 'bulk',      name: 'MV Meridian Grain',  imo: '', operator: 'PEIRU',   origin: 'Vancouver',    destination: 'Mundra',     etd: '2026-04-20', eta: '2026-05-02', status: 'Laden',    lat: 36.5,  lng: 170.2  },
  { id: 'b2', type: 'bulk',      name: 'MV Pacific Harvest', imo: '', operator: 'ESTHER',  origin: 'Melbourne',    destination: 'Kolkata',    etd: '2026-04-22', eta: '2026-05-05', status: 'Laden',    lat: -18.4, lng: 88.6   },
  { id: 'b3', type: 'bulk',      name: 'MV Black Sea Star',  imo: '', operator: 'SARI',    origin: 'Novorossiysk', destination: 'Kandla',     etd: '2026-04-18', eta: '2026-05-08', status: 'Laden',    lat: 12.8,  lng: 50.4   },
  { id: 'b4', type: 'bulk',      name: 'MV Golden Prairie',  imo: '', operator: 'JESSICA', origin: 'Vancouver',    destination: 'Chittagong', etd: '2026-04-25', eta: '2026-05-15', status: 'Laden',    lat: 28.2,  lng: -150.6 },
  { id: 'b5', type: 'bulk',      name: 'MV Southern Cross',  imo: '', operator: 'PEIRU',   origin: 'Brisbane',     destination: 'Chennai',    etd: '2026-04-28', eta: '2026-05-12', status: 'Ballast',  lat: -28.1, lng: 102.3  },
  { id: 'c1', type: 'container', name: 'MSC Ankara',         imo: '', operator: 'ESTHER',  origin: 'Port Klang',   destination: 'Dubai',      etd: '2026-04-29', eta: '2026-05-03', status: 'Laden',    lat: 8.4,   lng: 76.2   },
  { id: 'c2', type: 'container', name: 'CMA CGM Jade',       imo: '', operator: 'SARI',    origin: 'Singapore',    destination: 'Colombo',    etd: '2026-04-30', eta: '2026-05-06', status: 'Laden',    lat: 4.6,   lng: 84.1   },
  { id: 'c3', type: 'container', name: 'Evergreen Fortune',  imo: '', operator: 'JESSICA', origin: 'Kaohsiung',   destination: 'Mumbai',     etd: '2026-05-01', eta: '2026-05-10', status: 'Laden',    lat: 10.2,  lng: 72.8   },
]

const BLANK = {
  type: 'bulk', name: '', imo: '', mmsi: '', operator: 'PEIRU',
  origin: '', destination: '', etd: '', eta: '', status: 'Laden',
  lat: '', lng: '', flag: '', vessel_type: '',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysUntil(d) {
  if (!d) return null
  return Math.ceil((new Date(d) - new Date()) / 86400000)
}
function EtaBadge({ date, label = 'ETA' }) {
  const days = daysUntil(date)
  if (days === null) return null
  if (days < 0) return <span className="text-[10px] text-slate-500 italic">Arrived</span>
  const urgent = days <= 3
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold ${urgent ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
      {urgent && <AlertTriangle size={10} />}{label} {days}d
    </span>
  )
}

function makeIcon(L, color, course, isSelected, isLive) {
  const deg  = (course ?? 0)
  const ring = isSelected ? `box-shadow:0 0 0 3px ${color}55;border-radius:50%;` : ''
  const html = `<div style="transform:rotate(${deg}deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center;${ring}">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2 C12 2 7 14 7 17 Q7 22 12 22 Q17 22 17 17 C17 14 12 2 12 2Z"
        fill="${color}" fill-opacity="${isLive ? 1 : 0.45}"
        stroke="#0b1120" stroke-width="1.5"/>
    </svg>
  </div>`
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
}

export default function VesselTracker() {
  const [isAdmin,   setIsAdmin]   = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true')
  const [showLogin, setShowLogin] = useState(false)
  const [pwInput,   setPwInput]   = useState('')
  const [pwError,   setPwError]   = useState(false)

  const [fleet, setFleet] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_FLEET }
    catch { return DEFAULT_FLEET }
  })

  const [livePos,  setLivePos]  = useState({})
  const [liveAge,  setLiveAge]  = useState(null)
  const [fetching, setFetching] = useState(false)

  const [activeTab, setActiveTab] = useState('bulk')
  const [operator,  setOperator]  = useState('ALL')
  const [selected,  setSelected]  = useState(null)

  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(BLANK)
  const [imoSearch, setImoSearch] = useState('')
  const [looking,   setLooking]   = useState(false)

  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef({})

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(fleet)) }, [fleet])

  const fetchLive = useCallback(async () => {
    const imos = fleet.map(v => v.imo).filter(Boolean)
    if (!imos.length) return
    setFetching(true)
    try {
      const mmsi_map = Object.fromEntries(
        fleet.filter(v => v.imo && v.mmsi).map(v => [v.imo, v.mmsi])
      )
      const res = await fetch('/api/vessel-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imo: imos, mmsi_map }),
      })
      if (res.ok) {
        const data = await res.json()
        if (Object.keys(data).length) { setLivePos(data); setLiveAge(new Date()) }
      }
    } catch { /* backend down */ }
    finally { setFetching(false) }
  }, [fleet])

  useEffect(() => {
    fetchLive()
    const id = setInterval(fetchLive, POLL_MS)
    return () => clearInterval(id)
  }, [fetchLive])

  useEffect(() => {
    if (leafletRef.current || !mapRef.current || !window.L) return
    const L = window.L
    const map = L.map(mapRef.current, { center: [15, 80], zoom: 2, minZoom: 1, maxZoom: 10 })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 20,
    }).addTo(map)
    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [])

  useEffect(() => {
    const L = window.L
    if (!L || !leafletRef.current) return
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    fleet.forEach(v => {
      const live  = v.imo ? livePos[v.imo] : null
      const lat   = live?.lat ?? (v.lat !== '' ? Number(v.lat) : null)
      const lng   = live?.lng ?? (v.lng !== '' ? Number(v.lng) : null)
      if (!lat || !lng) return

      const color     = OP_COLORS[v.operator] || '#64748b'
      const isLive    = !!live?.lat
      const isSelected = selected?.id === v.id
      const course    = live?.course ?? null
      const icon      = makeIcon(L, color, course, isSelected, isLive)

      const speedStr = live?.speed != null ? `${live.speed} kn · ` : ''
      const navStr   = live?.nav_status ?? ''
      const popHtml  = `<b>${v.name}</b><br/>${v.origin} → ${v.destination}<br/>${speedStr}${navStr}${isLive ? '<br/><span style="color:#10b981">● Live AIS</span>' : ''}`

      const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 0 })
        .addTo(leafletRef.current)
        .bindTooltip(popHtml, { permanent: false, direction: 'top', className: 'leaflet-dark-tooltip' })
        .on('click', () => { setSelected(v); setActiveTab(v.type); setOperator('ALL') })
      markersRef.current[v.id] = marker
    })
  }, [fleet, livePos, selected])

  const focusVessel = (v) => {
    setSelected(prev => prev?.id === v.id ? null : v)
    const live = v.imo ? livePos[v.imo] : null
    const lat  = live?.lat ?? (v.lat !== '' ? Number(v.lat) : null)
    const lng  = live?.lng ?? (v.lng !== '' ? Number(v.lng) : null)
    if (leafletRef.current && lat && lng) leafletRef.current.flyTo([lat, lng], 6, { duration: 1.2 })
  }

  const login = () => {
    if (pwInput === ADMIN_PW) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setIsAdmin(true); setPwInput(''); setPwError(false); setShowLogin(false)
    } else { setPwError(true) }
  }
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setIsAdmin(false) }

  const lookupIMO = async () => {
    const imo = (form.imo || '').trim()
    if (!imo) return
    setLooking(true)
    try {
      const res = await fetch(`/api/vessels/lookup?imo=${imo}`)
      if (res.ok) {
        const data = await res.json()
        if (data.ship_name || data.mmsi) {
          setForm(f => ({
            ...f,
            name:        data.ship_name || f.name,
            mmsi:        data.mmsi      || f.mmsi,
            flag:        data.flag      || f.flag,
            vessel_type: data.vessel_type || f.vessel_type,
          }))
        }
      }
    } catch { /* ignore */ }
    finally { setLooking(false) }
  }

  const openAdd   = () => { setEditId(null); setForm({ ...BLANK, type: activeTab }); setShowForm(true) }
  const openEdit  = (v) => { setEditId(v.id); setForm({ ...v }); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(BLANK) }

  const saveForm = () => {
    if (!form.name.trim()) return
    const cleaned = { ...form, lat: form.lat !== '' ? parseFloat(form.lat) : null, lng: form.lng !== '' ? parseFloat(form.lng) : null }
    if (editId) {
      setFleet(prev => prev.map(v => v.id === editId ? { ...cleaned, id: editId } : v))
    } else {
      setFleet(prev => [...prev, { ...cleaned, id: Date.now().toString() }])
    }
    closeForm()
  }

  const deleteVessel = (id) => { setFleet(prev => prev.filter(v => v.id !== id)); if (selected?.id === id) setSelected(null) }
  const setField = (k, val) => setForm(f => ({ ...f, [k]: val }))

  const visibleVessels = fleet.filter(v => v.type === activeTab && (operator === 'ALL' || v.operator === operator))
  const opCounts = Object.fromEntries(OPERATORS.map(op => [op, op === 'ALL' ? fleet.filter(v => v.type === activeTab).length : fleet.filter(v => v.type === activeTab && v.operator === op).length]))
  const liveCount = fleet.filter(v => v.imo && livePos[v.imo]?.lat).length
  const selLive   = selected?.imo ? livePos[selected.imo] : null

  const inputCls = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-emerald-600 transition-colors'

  return (
    <div className="flex flex-col gap-4 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Ship size={16} className="text-emerald-600 dark:text-emerald-400" /> Vessel Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
            Fleet positions · live AIS via aisstream.io · updates in real time
            {liveCount > 0 ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Wifi size={11} /> {liveCount} live
                {liveAge && <span className="text-slate-400 dark:text-slate-600">· {liveAge.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400 dark:text-slate-600">
                <WifiOff size={11} /> enter real IMO numbers to enable live data
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchLive} disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 disabled:opacity-40 transition-all"
          >
            <Wifi size={11} className={fetching ? 'animate-pulse' : ''} />
            {fetching ? 'Fetching…' : 'Refresh'}
          </button>
          <a href="https://www.marinetraffic.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition-all"
          ><ExternalLink size={11} /> MarineTraffic</a>
          {isAdmin ? (
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-emerald-600 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all"
            ><Unlock size={12} /> Admin</button>
          ) : (
            <button onClick={() => setShowLogin(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-all"
            ><Lock size={12} /> Admin Login</button>
          )}
        </div>
      </div>

      {/* Login */}
      {showLogin && !isAdmin && (
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
          <input type="password" value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Admin password"
            className={`bg-slate-100 dark:bg-slate-800 border rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-emerald-600 w-44 ${pwError ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'}`}
          />
          <button onClick={login} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs text-white font-medium transition-all">Unlock</button>
          {pwError && <span className="text-xs text-red-500 dark:text-red-400">Incorrect password</span>}
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 relative" style={{ height: 380 }}>
        <div ref={mapRef} className="absolute inset-0" />
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 z-[1000]">
          {Object.entries(OP_COLORS).map(([op, color]) => (
            <span key={op} className="flex items-center gap-1.5 px-2 py-1 bg-white/85 dark:bg-slate-900/85 rounded-lg text-[10px] font-bold backdrop-blur-sm border border-slate-300/50 dark:border-slate-700/50" style={{ color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />{op}
            </span>
          ))}
        </div>
        {liveCount > 0 && (
          <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 px-2 py-1 bg-white/85 dark:bg-slate-900/85 rounded-lg text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold backdrop-blur-sm border border-emerald-300 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live AIS
          </div>
        )}
      </div>

      {/* Fleet panel */}
      <div className="flex gap-4" style={{ minHeight: 360 }}>

        {/* Operators sidebar */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1 mb-0.5">Operators</p>
          {OPERATORS.map(op => (
            <button key={op} onClick={() => setOperator(op)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all
                ${operator === op
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              <span style={op !== 'ALL' && operator === op ? { color: OP_COLORS[op] } : {}}>
                {op === 'ALL' ? 'All' : op}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${operator === op ? 'bg-emerald-100 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {opCounts[op] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Tab bar + Add */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {[['bulk', 'Bulk Carriers'], ['container', 'Containers']].map(([tab, label]) => (
                <button key={tab}
                  onClick={() => { setActiveTab(tab); setOperator('ALL'); setSelected(null) }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all
                    ${activeTab === tab
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                >{label}</button>
              ))}
            </div>
            {isAdmin && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-700/20 hover:bg-emerald-100 dark:hover:bg-emerald-700/40 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 rounded-lg transition-all"
              ><Plus size={12} /> Add Vessel</button>
            )}
          </div>

          {/* Selected vessel detail */}
          {selected && (
            <div className="rounded-xl border p-4 relative"
              style={{ borderColor: (OP_COLORS[selected.operator] || '#334155') + '60', background: (OP_COLORS[selected.operator] || '#1e293b') + '12' }}
            >
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-lg leading-none">×</button>

              <div className="flex items-start gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{selected.name}</h3>
                    {selLive?.lat && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700/40 px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {selected.imo ? `IMO ${selected.imo}` : 'No IMO'}
                    {selected.mmsi ? ` · MMSI ${selected.mmsi}` : ''}
                    {(selected.flag || selected.vessel_type) ? ` · ${selected.flag || selected.vessel_type}` : ''}
                    {selected.operator && <span className="font-bold" style={{ color: OP_COLORS[selected.operator] }}> · {selected.operator}</span>}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${STATUS_STYLE[selected.status] || STATUS_STYLE['Ballast']}`}>
                  {selected.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { label: 'Position', content: selLive?.lat ? <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">{selLive.lat.toFixed(3)}°, {selLive.lng.toFixed(3)}°</p> : <p className="text-xs text-slate-400 dark:text-slate-600">Estimated</p> },
                  { label: 'Speed / Course', content: selLive?.speed != null ? <div className="flex items-center gap-1.5"><Navigation size={11} className="text-emerald-600 dark:text-emerald-400" style={{ transform: `rotate(${(selLive.course || 0) - 45}deg)` }} /><span className="text-xs text-slate-700 dark:text-slate-300">{selLive.speed} kn · {Math.round(selLive.course ?? 0)}°</span></div> : <p className="text-xs text-slate-400 dark:text-slate-600">—</p> },
                  { label: 'Nav Status', content: <p className="text-xs text-slate-700 dark:text-slate-300">{selLive?.nav_status ?? '—'}</p> },
                  { label: 'AIS Destination', content: <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{selLive?.destination || selected.destination || '—'}</p> },
                  { label: 'AIS ETA (self-reported)', content: <p className="text-xs text-slate-700 dark:text-slate-300">{selLive?.ais_eta || '—'}</p> },
                ].map(({ label, content }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 mb-1">{label}</p>
                    {content}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <div>
                  <span className="text-slate-400 dark:text-slate-600 text-[10px] uppercase tracking-wider mr-1">Route</span>
                  <span className="text-slate-700 dark:text-slate-300">{selected.origin} → {selected.destination}</span>
                </div>
                {selected.etd && <div><span className="text-slate-400 dark:text-slate-600 text-[10px] uppercase tracking-wider mr-1">ETD</span><span className="text-slate-700 dark:text-slate-300">{fmtDate(selected.etd)}</span><span className="ml-1"><EtaBadge date={selected.etd} label="dep" /></span></div>}
                {selected.eta && <div><span className="text-slate-400 dark:text-slate-600 text-[10px] uppercase tracking-wider mr-1">ETA</span><span className="text-slate-700 dark:text-slate-300">{fmtDate(selected.eta)}</span><span className="ml-1"><EtaBadge date={selected.eta} label="arr" /></span></div>}
                {selected.imo && (
                  <a href={`https://www.marinetraffic.com/en/ais/details/ships/imo:${selected.imo}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors ml-auto"
                    onClick={e => e.stopPropagation()}
                  ><ExternalLink size={11} /> View on MarineTraffic</a>
                )}
              </div>
            </div>
          )}

          {/* Vessel table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Vessel', 'Operator', 'Route', 'ETD', 'ETA', 'Live', ...(isAdmin ? [''] : [])].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleVessels.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center text-xs text-slate-400 dark:text-slate-600 py-10">No vessels found.</td></tr>
                )}
                {visibleVessels.map(v => {
                  const live  = v.imo ? livePos[v.imo] : null
                  const isSel = selected?.id === v.id
                  return (
                    <tr key={v.id} onClick={() => focusVessel(v)}
                      className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer transition-colors
                        ${isSel ? 'bg-slate-100 dark:bg-slate-800/50 ring-1 ring-inset ring-slate-300 dark:ring-slate-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: OP_COLORS[v.operator] || '#475569' }} />
                          <div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{v.name}</p>
                            <p className="text-[10px] text-slate-500">{v.imo ? `IMO ${v.imo}` : <span className="text-slate-300 dark:text-slate-700">No IMO</span>}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold" style={{ color: OP_COLORS[v.operator] || '#94a3b8' }}>{v.operator}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-700 dark:text-slate-300">{v.origin}</p>
                        <p className="text-[10px] text-slate-500">→ {v.destination}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500">{fmtDate(v.etd)}</p>
                        <EtaBadge date={v.etd} label="dep" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500">{fmtDate(v.eta)}</p>
                        <EtaBadge date={v.eta} label="arr" />
                      </td>
                      <td className="px-4 py-3">
                        {live?.lat ? (
                          <div>
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                            </div>
                            <p className="text-[10px] text-slate-500">{live.speed} kn</p>
                          </div>
                        ) : v.imo ? (
                          <span className="text-[10px] text-slate-400 dark:text-slate-600">Awaiting</span>
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEdit(v)} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><Edit3 size={12} /></button>
                            <button onClick={() => deleteVessel(v.id)} className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{editId ? 'Edit Vessel' : 'Add Vessel'}</p>
              <button onClick={closeForm} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">

              <div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1.5">
                  IMO Number <span className="text-emerald-600 normal-case font-normal">(7 digits — enables live position tracking)</span>
                </p>
                <div className="flex gap-2">
                  <input
                    value={form.imo || ''}
                    onChange={e => setField('imo', e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 9741044"
                    maxLength={8}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800/50 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                  <button
                    onClick={lookupIMO}
                    disabled={!form.imo || looking}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-700/20 hover:bg-emerald-100 dark:hover:bg-emerald-700/40 border border-emerald-300 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium disabled:opacity-40 transition-all"
                  >
                    <Search size={12} className={looking ? 'animate-spin' : ''} />
                    {looking ? 'Looking up…' : 'Auto-fill'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Auto-fill resolves both name and MMSI from the IMO. Or find on <a href="https://www.vesselfinder.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">VesselFinder</a>.</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1.5">
                  MMSI <span className="text-emerald-600 normal-case font-normal">(9 digits — required for live aisstream.io tracking)</span>
                </p>
                <input
                  value={form.mmsi || ''}
                  onChange={e => setField('mmsi', e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 477123456"
                  maxLength={9}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-emerald-600 transition-colors font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-500 mb-1">Vessel Name</p>
                  <input value={form.name || ''} onChange={e => setField('name', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Origin Port</p>
                  <input value={form.origin || ''} onChange={e => setField('origin', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Destination Port</p>
                  <input value={form.destination || ''} onChange={e => setField('destination', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">ETD (departure)</p>
                  <input type="date" value={form.etd || ''} onChange={e => setField('etd', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">ETA (arrival)</p>
                  <input type="date" value={form.eta || ''} onChange={e => setField('eta', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Status</p>
                  <select value={form.status || 'Laden'} onChange={e => setField('status', e.target.value)} className={inputCls}>
                    {Object.keys(STATUS_STYLE).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Operator</p>
                  <select value={form.operator || 'PEIRU'} onChange={e => setField('operator', e.target.value)} className={inputCls}>
                    {OPERATORS.filter(op => op !== 'ALL').map(op => <option key={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Type</p>
                  <select value={form.type || 'bulk'} onChange={e => setField('type', e.target.value)} className={inputCls}>
                    <option value="bulk">Bulk Carrier</option>
                    <option value="container">Container</option>
                  </select>
                </div>
              </div>

              <details className="text-[10px]">
                <summary className="text-slate-500 dark:text-slate-600 cursor-pointer hover:text-slate-700 dark:hover:text-slate-400 transition-colors">Fallback position (used if IMO not found)</summary>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <p className="text-slate-500 mb-1">Latitude</p>
                    <input type="number" value={form.lat ?? ''} onChange={e => setField('lat', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Longitude</p>
                    <input type="number" value={form.lng ?? ''} onChange={e => setField('lng', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </details>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={saveForm} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs text-white font-semibold transition-all">
                {editId ? 'Save Changes' : 'Add Vessel'}
              </button>
              <button onClick={closeForm} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
