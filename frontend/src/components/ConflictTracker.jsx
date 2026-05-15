import { useState, useEffect, useRef, useCallback } from 'react'
import { Globe, ExternalLink, Newspaper, Loader2 } from 'lucide-react'

function timeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const SEV = {
  critical: { label: 'Critical', color: '#ef4444', ring: 'ring-red-500/30',    badge: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/50',    card: 'border-red-300 bg-red-50 dark:border-red-700/40 dark:bg-red-950/20'  },
  high:     { label: 'High',     color: '#f97316', ring: 'ring-orange-500/30',  badge: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40', card: 'border-orange-300 bg-orange-50 dark:border-orange-700/40 dark:bg-orange-950/20' },
  medium:   { label: 'Medium',   color: '#f59e0b', ring: 'ring-amber-500/30',   badge: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30',  card: 'border-amber-200 bg-amber-50 dark:border-amber-700/30 dark:bg-amber-950/10'  },
  low:      { label: 'Low',      color: '#64748b', ring: 'ring-slate-500/20',   badge: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',        card: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'        },
}

const TYPE_BADGE = {
  'Armed Conflict':        'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40',
  'Maritime Security':     'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
  'Political Instability': 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30',
  'Economic Crisis':       'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/30',
}

const DIR_BADGE = {
  bullish: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/40',
  bearish: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40',
  neutral: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30',
}

const COMMODITY_NAMES = {
  canada_yellow_peas:       'Canada Yellow Peas',
  canada_red_lentils:       'Canada Red Lentils',
  canada_green_peas:        'Canada Green Peas',
  australia_desi_chickpeas: 'Australia Desi Chickpeas',
  australia_nipper_lentils: 'Australia Nipper Lentils',
  russian_yellow_peas:      'Russian Yellow Peas',
  russian_flax_seeds:       'Russian Flax Seeds',
}

const CONFLICTS = [
  { id: 1,  lat: 49.0, lng: 32.0,  name: 'Russia-Ukraine War',              searchTerms: 'Ukraine Russia war',                    type: 'Armed Conflict',        severity: 'critical', status: 'Ongoing',          region: 'Europe / Black Sea',        summary: 'Full-scale invasion continues with ongoing fighting across eastern and southern Ukraine. Western sanctions on Russia constrain commodity exports and SWIFT access for Russian banks.', tradeImpact: 'Russia is a top-3 global exporter of yellow peas and flaxseed. Sanctions, port access restrictions at Novorossiysk, and war-risk freight insurance premiums are suppressing Black Sea export volumes. Bullish for Russian-origin pricing; alternative-origin demand is elevated.', commodities: ['russian_yellow_peas', 'russian_flax_seeds'], direction: 'bullish' },
  { id: 2,  lat: 14.5, lng: 42.5,  name: 'Red Sea / Houthi Crisis',         searchTerms: 'Red Sea Houthi shipping attack',          type: 'Maritime Security',     severity: 'high',     status: 'Ongoing',          region: 'Middle East / Indian Ocean', summary: 'Houthi drone and missile attacks on commercial shipping in the Red Sea have forced most vessels to reroute around the Cape of Good Hope, adding 10–14 days and significant cost to voyages.', tradeImpact: 'Freight rates from Vancouver and Melbourne to South Asian and Middle Eastern discharge ports have risen 25–40% since attacks began. Longer voyages tie up vessel capacity, effectively tightening available tonnage for pulse shipments. Broadly bullish across all origins on a freight-cost basis.', commodities: ['canada_yellow_peas', 'canada_red_lentils', 'canada_green_peas', 'australia_desi_chickpeas', 'australia_nipper_lentils'], direction: 'bullish' },
  { id: 3,  lat: 31.5, lng: 34.5,  name: 'Israel-Gaza Conflict',            searchTerms: 'Israel Gaza war ceasefire',              type: 'Armed Conflict',        severity: 'high',     status: 'Ongoing',          region: 'Middle East',               summary: 'Ongoing military operations in Gaza with risk of broader regional escalation involving Iran, Lebanon, and proxy forces across the Middle East.', tradeImpact: 'Broader Middle East instability adds a risk premium to Red Sea shipping and supports safe-haven commodity demand. Regional food security emergency is driving WFP and UNRWA pulse procurement across Egypt, Jordan, and Palestinian territories — supporting lentil and chickpea bids.', commodities: ['canada_red_lentils', 'australia_desi_chickpeas'], direction: 'bullish' },
  { id: 4,  lat: 30.5, lng: 72.0,  name: 'India-Pakistan Military Tensions', searchTerms: 'India Pakistan military strike ceasefire', type: 'Armed Conflict',        severity: 'critical', status: 'Active Standoff',   region: 'South Asia',                summary: 'Active military standoff between two nuclear-armed states following cross-border strikes. Both sides on heightened alert; ceasefire fragile. Risk of miscalculation remains very high.', tradeImpact: "India is the world's largest pulse importer — any sustained disruption has an outsized market impact across all origins. Pakistani buyers have stepped back from forward commitments. Indian importers pausing tendering until situation stabilises.", commodities: ['canada_yellow_peas', 'canada_red_lentils', 'canada_green_peas', 'australia_desi_chickpeas'], direction: 'neutral' },
  { id: 5,  lat: 17.0, lng: 96.0,  name: 'Myanmar Civil War',               searchTerms: 'Myanmar civil war junta',                type: 'Armed Conflict',        severity: 'high',     status: 'Ongoing',          region: 'Southeast Asia',            summary: 'Civil war between the military junta and resistance forces has destabilised the country since the 2021 coup, with large areas outside government control.', tradeImpact: "Myanmar is the world's largest black matpe and green mung exporter. Supply chain disruptions and banking restrictions are limiting export capacity. Tight matpe availability shifts South Asian demand toward substitute pulses — desi chickpeas and red lentils benefit on volume displacement.", commodities: ['australia_desi_chickpeas', 'canada_red_lentils'], direction: 'bullish' },
  { id: 6,  lat: 32.0, lng: 54.0,  name: 'Iran Regional Tensions',          searchTerms: 'Iran nuclear tensions Strait Hormuz',    type: 'Political Instability', severity: 'medium',   status: 'Ongoing',          region: 'Middle East',               summary: 'Iran continues proxy operations across the Middle East and faces escalating nuclear programme pressure. The Strait of Hormuz remains a critical shipping vulnerability.', tradeImpact: 'Any closure or restriction of the Strait of Hormuz would severely disrupt tanker traffic and sharply elevate global freight rates. Iran is also a secondary pulse importer whose buying is constrained by sanctions.', commodities: ['canada_yellow_peas', 'canada_red_lentils'], direction: 'neutral' },
  { id: 7,  lat: 12.0, lng: 114.0, name: 'South China Sea Tensions',        searchTerms: 'South China Sea dispute Philippines',    type: 'Political Instability', severity: 'medium',   status: 'Ongoing',          region: 'Asia-Pacific',              summary: 'Ongoing territorial disputes between China, the Philippines, Vietnam, and other claimants, with regular coast guard and naval incidents.', tradeImpact: 'Australian pulse exports to China transit the South China Sea. Escalation or blockade scenarios would reroute shipping and inflate freight. Australian commodity flows to China are also sensitive to Sino-Australian diplomatic relations.', commodities: ['australia_desi_chickpeas', 'australia_nipper_lentils'], direction: 'neutral' },
  { id: 8,  lat: 15.6, lng: 32.5,  name: 'Sudan Civil War',                 searchTerms: 'Sudan civil war RSF humanitarian',       type: 'Armed Conflict',        severity: 'medium',   status: 'Ongoing',          region: 'East Africa',               summary: 'War between the Sudanese Armed Forces and Rapid Support Forces has created one of the worst humanitarian crises, displacing millions.', tradeImpact: 'WFP emergency procurement for Sudan and the broader Horn of Africa provides a recurring demand floor for red lentils. Aid-funded buying insulates Canadian lentil bids from complete demand collapse in slow commercial periods.', commodities: ['canada_red_lentils'], direction: 'bullish' },
  { id: 9,  lat: 30.3, lng: 69.3,  name: 'Pakistan Economic Crisis',        searchTerms: 'Pakistan economy IMF inflation rupee',   type: 'Economic Crisis',       severity: 'medium',   status: 'Ongoing',          region: 'South Asia',                summary: "Pakistan faces severe foreign exchange shortages, elevated inflation, and IMF programme conditionality limiting government import spending.", tradeImpact: "Pakistan's ability to import pulses at scale is directly constrained by FX reserves. Reduced Pakistani buying removes a key demand pillar for Australian chickpeas and Canadian lentils. Any IMF disbursement or reserve improvement would likely trigger a purchasing surge.", commodities: ['australia_desi_chickpeas', 'canada_red_lentils', 'canada_yellow_peas'], direction: 'bearish' },
  { id: 10, lat: 39.0, lng: 35.0,  name: 'Turkey Lira & Inflation Crisis',  searchTerms: 'Turkey inflation lira currency economy',  type: 'Economic Crisis',       severity: 'medium',   status: 'Ongoing',          region: 'Europe / Middle East',      summary: 'Turkey continues to manage elevated inflation and currency depreciation, limiting real purchasing power for commodity imports.', tradeImpact: "Turkey is one of the world's largest red lentil importers for processing and re-export. Lira weakness reduces import affordability, capping the price Turkish crushers can bid for Canadian red lentils.", commodities: ['canada_red_lentils'], direction: 'bearish' },
  { id: 11, lat: 23.7, lng: 90.4,  name: 'Bangladesh Political Transition', searchTerms: 'Bangladesh political crisis economy',      type: 'Political Instability', severity: 'medium',   status: 'Ongoing',          region: 'South Asia',                summary: 'Political transition following the ouster of the Hasina government. New interim administration navigating economic pressures and civil unrest.', tradeImpact: 'Bangladesh is a significant chickpea and lentil importer. Political uncertainty has slowed government procurement decisions. Stabilisation of the new administration would likely release pent-up import demand.', commodities: ['australia_desi_chickpeas', 'canada_red_lentils'], direction: 'neutral' },
  { id: 12, lat: 23.8, lng: 120.9, name: 'Taiwan Strait Tensions',          searchTerms: 'Taiwan China military strait tensions',   type: 'Political Instability', severity: 'medium',   status: 'Ongoing',          region: 'Asia-Pacific',              summary: "Ongoing Chinese military exercises and air incursions into Taiwan's ADIZ. Risk of miscalculation remains elevated; significant tail risk for global trade.", tradeImpact: "A Taiwan Strait disruption would affect major shipping lanes used by Australian exporters. China's pulse import flows would be severely disrupted in an escalation scenario.", commodities: ['australia_desi_chickpeas', 'australia_nipper_lentils'], direction: 'neutral' },
  { id: 13, lat: 9.0,  lng: 40.0,  name: 'Horn of Africa Conflicts',        searchTerms: 'Somalia Ethiopia Horn Africa conflict',  type: 'Armed Conflict',        severity: 'low',      status: 'Ongoing',          region: 'East Africa',               summary: 'Low-level conflict persists across Ethiopia, Somalia, and Eritrea. Humanitarian needs remain elevated across the region.', tradeImpact: 'WFP and NGO emergency pulse procurement for the Horn of Africa provides a steady baseline demand for red lentils. Consistent humanitarian buying insulates lentil markets from full demand drops.', commodities: ['canada_red_lentils'], direction: 'bullish' },
  { id: 14, lat: 13.5, lng: 2.0,   name: 'Sahel Instability',               searchTerms: 'Sahel Mali Burkina Faso Niger instability', type: 'Political Instability', severity: 'low',    status: 'Ongoing',          region: 'West Africa',               summary: 'Military coups across Mali, Burkina Faso, Niger, and Chad have created a broad arc of instability. French forces withdrawn from the region.', tradeImpact: 'Humanitarian pulse demand from WFP and NGOs across the Sahel is modest but recurring. Cowpea and groundnut production disruptions in Niger may marginally shift local demand toward imported pulses.', commodities: ['canada_red_lentils'], direction: 'bullish' },
  { id: 15, lat: 48.0, lng: 68.0,  name: 'Kazakhstan Transit Risk',         searchTerms: 'Kazakhstan Russia transit rail commodity', type: 'Political Instability', severity: 'low',      status: 'Low-level',        region: 'Central Asia',              summary: 'Kazakhstan is a key transit corridor for Russian commodity exports eastward. Periodic internal tensions and deep economic ties to Russia create latent disruption risk.', tradeImpact: 'Russian yellow peas and flaxseed destined for Chinese buyers transit Kazakh rail corridors. Any disruption would redirect Russian supply westward — increasing Black Sea availability and adding bearish pressure to European-market pricing.', commodities: ['russian_yellow_peas', 'russian_flax_seeds'], direction: 'neutral' },
]

export default function ConflictTracker() {
  const [selected, setSelected]         = useState(null)
  const [conflictNews, setConflictNews] = useState([])
  const [newsLoading, setNewsLoading]   = useState(false)
  const mapDivRef  = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef({})

  const filtered = CONFLICTS

  useEffect(() => {
    if (leafletRef.current || !mapDivRef.current || !window.L) return
    const L = window.L

    const map = L.map(mapDivRef.current, {
      center: [20, 20], zoom: 2, minZoom: 2, maxZoom: 8, zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(map)

    CONFLICTS.forEach(conflict => {
      const radius = conflict.severity === 'critical' ? 12 : conflict.severity === 'high' ? 9 : 7
      const marker = L.circleMarker([conflict.lat, conflict.lng], {
        radius, fillColor: SEV[conflict.severity].color,
        color: '#0b1120', weight: 2, opacity: 1, fillOpacity: 0.9,
      }).addTo(map)

      marker.bindTooltip(conflict.name, { permanent: false, direction: 'top', className: 'leaflet-dark-tooltip' })
      marker.on('click', () => setSelected(conflict))
      markersRef.current[conflict.id] = marker
    })

    leafletRef.current = map
    return () => { map.remove(); leafletRef.current = null }
  }, [])

  const focusConflict = (conflict) => {
    if (selected?.id === conflict.id) {
      setSelected(null)
      leafletRef.current?.flyTo([20, 20], 2, { duration: 1.2 })
      return
    }
    setSelected(conflict)
    leafletRef.current?.flyTo([conflict.lat, conflict.lng], 5, { duration: 1.2 })
  }

  useEffect(() => {
    if (!selected?.searchTerms) return
    setConflictNews([])
    setNewsLoading(true)
    fetch(`/api/conflict-news?q=${encodeURIComponent(selected.searchTerms)}`)
      .then(r => r.json())
      .then(data => setConflictNews(data.articles || []))
      .catch(() => setConflictNews([]))
      .finally(() => setNewsLoading(false))
  }, [selected?.id])

  return (
    <div className="flex flex-col gap-4 pb-16">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Globe size={16} className="text-emerald-600 dark:text-emerald-400" />
            Global Conflict Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {CONFLICTS.length} active conflicts · {CONFLICTS.filter(c => c.severity === 'critical').length} critical · impact on pulse &amp; oilseed trade routes · click any marker or card to explore
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          {Object.entries(SEV).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
              {v.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3" style={{ height: 'calc(100vh - 220px)', minHeight: 520 }}>

        {/* Left: conflict list */}
        <div className="w-60 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
          {filtered.map(c => {
            const s = SEV[c.severity]
            const isSel = selected?.id === c.id
            return (
              <button key={c.id} onClick={() => focusConflict(c)}
                className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] active:scale-100
                  ${isSel ? `${s.card} ring-1 ${s.ring}` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">{c.name}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-1.5">{c.region} · {c.status}</p>
                <div className="flex flex-wrap gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TYPE_BADGE[c.type] || ''}`}>
                    {c.type}
                  </span>
                  {c.direction !== 'neutral' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${DIR_BADGE[c.direction]}`}>
                      {c.direction === 'bullish' ? '▲' : '▼'} {c.direction}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Centre: map — always full height */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 relative min-w-0">
          <div ref={mapDivRef} className="absolute inset-0" />
        </div>

        {/* Right: detail + news panel (slides in when a conflict is selected) */}
        {selected && (
          <div className="w-80 flex-shrink-0 overflow-y-auto space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{selected.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.region} · {selected.status}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${SEV[selected.severity].badge}`}>
                    {SEV[selected.severity].label}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${DIR_BADGE[selected.direction]}`}>
                    {selected.direction === 'bullish' ? '▲' : selected.direction === 'bearish' ? '▼' : '◆'} {selected.direction}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{selected.summary}</p>

              <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 rounded-lg p-3 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1.5">Pulse &amp; Oilseed Trade Impact</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{selected.tradeImpact}</p>
              </div>

              {selected.commodities.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-1.5">Commodities affected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.commodities.map(k => (
                      <span key={k}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300"
                      >
                        {COMMODITY_NAMES[k]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* News cards */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Newspaper size={11} className="text-slate-400" />
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Latest News</p>
              </div>

              {newsLoading && (
                <div className="flex items-center gap-2 py-3 text-slate-400">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-xs">Fetching latest coverage…</span>
                </div>
              )}

              {!newsLoading && conflictNews.length === 0 && (
                <p className="text-xs text-slate-400 italic">No recent articles found.</p>
              )}

              {!newsLoading && conflictNews.length > 0 && (
                <div className="space-y-2">
                  {conflictNews.map((article, i) => (
                    <a
                      key={i}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                    >
                      {article.image ? (
                        <img
                          src={article.image}
                          alt=""
                          className="w-14 h-14 object-cover rounded-md flex-shrink-0 bg-slate-200 dark:bg-slate-700"
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-md flex-shrink-0 bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Newspaper size={16} className="text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {article.title}
                        </p>
                        {article.description && (
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{article.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{article.source}</span>
                          {article.published_at && (
                            <>
                              <span className="text-[10px] text-slate-400">·</span>
                              <span className="text-[10px] text-slate-400">{timeAgo(article.published_at)}</span>
                            </>
                          )}
                          <ExternalLink size={9} className="ml-auto text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
