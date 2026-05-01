import { useState, useEffect, useRef } from 'react'
import { Globe, ExternalLink } from 'lucide-react'

// ── Severity config ────────────────────────────────────────────────────────────
const SEV = {
  critical: { label: 'Critical', color: '#ef4444', ring: 'ring-red-500/30',    badge: 'bg-red-900/40 text-red-300 border-red-700/50',    card: 'border-red-700/40 bg-red-950/20'  },
  high:     { label: 'High',     color: '#f97316', ring: 'ring-orange-500/30',  badge: 'bg-orange-900/30 text-orange-300 border-orange-700/40', card: 'border-orange-700/40 bg-orange-950/20' },
  medium:   { label: 'Medium',   color: '#f59e0b', ring: 'ring-amber-500/30',   badge: 'bg-amber-900/20 text-amber-300 border-amber-700/30',  card: 'border-amber-700/30 bg-amber-950/10'  },
  low:      { label: 'Low',      color: '#64748b', ring: 'ring-slate-500/20',   badge: 'bg-slate-800 text-slate-400 border-slate-700',        card: 'border-slate-700 bg-slate-900'        },
}

const TYPE_BADGE = {
  'Armed Conflict':        'bg-red-900/30 text-red-300 border-red-800/40',
  'Maritime Security':     'bg-blue-900/30 text-blue-300 border-blue-800/40',
  'Political Instability': 'bg-amber-900/20 text-amber-300 border-amber-700/30',
  'Economic Crisis':       'bg-violet-900/20 text-violet-300 border-violet-800/30',
}

const DIR_BADGE = {
  bullish: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  bearish: 'bg-red-900/30 text-red-300 border-red-700/40',
  neutral: 'bg-amber-900/20 text-amber-300 border-amber-700/30',
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

// ── Conflict data ──────────────────────────────────────────────────────────────
const CONFLICTS = [
  {
    id: 1, lat: 49.0, lng: 32.0,
    name: 'Russia-Ukraine War',
    type: 'Armed Conflict', severity: 'critical', status: 'Ongoing',
    region: 'Europe / Black Sea',
    summary: 'Full-scale invasion continues with ongoing fighting across eastern and southern Ukraine. Western sanctions on Russia constrain commodity exports and SWIFT access for Russian banks.',
    tradeImpact: 'Russia is a top-3 global exporter of yellow peas and flaxseed. Sanctions, port access restrictions at Novorossiysk, and war-risk freight insurance premiums are suppressing Black Sea export volumes. Bullish for Russian-origin pricing; alternative-origin demand is elevated.',
    commodities: ['russian_yellow_peas', 'russian_flax_seeds'],
    direction: 'bullish',
  },
  {
    id: 2, lat: 14.5, lng: 42.5,
    name: 'Red Sea / Houthi Crisis',
    type: 'Maritime Security', severity: 'high', status: 'Ongoing',
    region: 'Middle East / Indian Ocean',
    summary: 'Houthi drone and missile attacks on commercial shipping in the Red Sea have forced most vessels to reroute around the Cape of Good Hope, adding 10–14 days and significant cost to voyages.',
    tradeImpact: 'Freight rates from Vancouver and Melbourne to South Asian and Middle Eastern discharge ports have risen 25–40% since attacks began. Longer voyages tie up vessel capacity, effectively tightening available tonnage for pulse shipments. Broadly bullish across all origins on a freight-cost basis.',
    commodities: ['canada_yellow_peas', 'canada_red_lentils', 'canada_green_peas', 'australia_desi_chickpeas', 'australia_nipper_lentils'],
    direction: 'bullish',
  },
  {
    id: 3, lat: 31.5, lng: 34.5,
    name: 'Israel-Gaza Conflict',
    type: 'Armed Conflict', severity: 'high', status: 'Ongoing',
    region: 'Middle East',
    summary: 'Ongoing military operations in Gaza with risk of broader regional escalation involving Iran, Lebanon, and proxy forces across the Middle East.',
    tradeImpact: 'Broader Middle East instability adds a risk premium to Red Sea shipping and supports safe-haven commodity demand. Regional food security emergency is driving WFP and UNRWA pulse procurement across Egypt, Jordan, and Palestinian territories — supporting lentil and chickpea bids.',
    commodities: ['canada_red_lentils', 'australia_desi_chickpeas'],
    direction: 'bullish',
  },
  {
    id: 4, lat: 30.5, lng: 72.0,
    name: 'India-Pakistan Military Tensions',
    type: 'Armed Conflict', severity: 'high', status: 'Escalating',
    region: 'South Asia',
    summary: 'Military standoff between two nuclear-armed states following cross-border incidents. Risk of miscalculation and broader escalation is elevated.',
    tradeImpact: 'India is the world\'s largest pulse importer — any trade disruption has an outsized market impact. Pakistan is a significant chickpea and lentil buyer. Heightened uncertainty is causing importers and traders to pause forward commitments; market direction depends heavily on whether tensions de-escalate or intensify.',
    commodities: ['canada_yellow_peas', 'canada_red_lentils', 'canada_green_peas', 'australia_desi_chickpeas'],
    direction: 'neutral',
  },
  {
    id: 5, lat: 17.0, lng: 96.0,
    name: 'Myanmar Civil War',
    type: 'Armed Conflict', severity: 'high', status: 'Ongoing',
    region: 'Southeast Asia',
    summary: 'Civil war between the military junta and resistance forces has destabilised the country since the 2021 coup, with large areas outside government control.',
    tradeImpact: 'Myanmar is the world\'s largest black matpe and green mung exporter. Supply chain disruptions and banking restrictions are limiting export capacity. Tight matpe availability shifts South Asian demand toward substitute pulses — desi chickpeas and red lentils benefit on volume displacement.',
    commodities: ['australia_desi_chickpeas', 'canada_red_lentils'],
    direction: 'bullish',
  },
  {
    id: 6, lat: 32.0, lng: 54.0,
    name: 'Iran Regional Tensions',
    type: 'Political Instability', severity: 'medium', status: 'Ongoing',
    region: 'Middle East',
    summary: 'Iran continues proxy operations across the Middle East and faces escalating nuclear programme pressure. The Strait of Hormuz remains a critical shipping vulnerability.',
    tradeImpact: 'Any closure or restriction of the Strait of Hormuz would severely disrupt tanker traffic and sharply elevate global freight rates. Iran is also a secondary pulse importer whose buying is constrained by sanctions — any sanctions relief would release pent-up demand.',
    commodities: ['canada_yellow_peas', 'canada_red_lentils'],
    direction: 'neutral',
  },
  {
    id: 7, lat: 12.0, lng: 114.0,
    name: 'South China Sea Tensions',
    type: 'Political Instability', severity: 'medium', status: 'Ongoing',
    region: 'Asia-Pacific',
    summary: 'Ongoing territorial disputes between China, the Philippines, Vietnam, and other claimants, with regular coast guard and naval incidents.',
    tradeImpact: 'Australian pulse exports to China transit the South China Sea. Escalation or blockade scenarios would reroute shipping and inflate freight. Australian commodity flows to China are also sensitive to Sino-Australian diplomatic relations, which remain a longer-term watch point.',
    commodities: ['australia_desi_chickpeas', 'australia_nipper_lentils'],
    direction: 'neutral',
  },
  {
    id: 8, lat: 15.6, lng: 32.5,
    name: 'Sudan Civil War',
    type: 'Armed Conflict', severity: 'medium', status: 'Ongoing',
    region: 'East Africa',
    summary: 'War between the Sudanese Armed Forces and Rapid Support Forces has created one of the world\'s worst humanitarian crises, displacing millions.',
    tradeImpact: 'WFP emergency procurement for Sudan and the broader Horn of Africa provides a recurring demand floor for red lentils. Modest in scale but consistent — aid-funded buying insulates Canadian lentil bids from complete demand collapse in slow commercial periods.',
    commodities: ['canada_red_lentils'],
    direction: 'bullish',
  },
  {
    id: 9, lat: 30.3, lng: 69.3,
    name: 'Pakistan Economic Crisis',
    type: 'Economic Crisis', severity: 'medium', status: 'Ongoing',
    region: 'South Asia',
    summary: 'Pakistan faces severe foreign exchange shortages, elevated inflation, and IMF programme conditionality limiting government import spending.',
    tradeImpact: 'Pakistan\'s ability to import pulses at scale is directly constrained by FX reserves. Reduced Pakistani buying removes a key demand pillar for Australian chickpeas and Canadian lentils — a bearish factor. Any IMF disbursement or reserve improvement would likely trigger a purchasing surge.',
    commodities: ['australia_desi_chickpeas', 'canada_red_lentils', 'canada_yellow_peas'],
    direction: 'bearish',
  },
  {
    id: 10, lat: 39.0, lng: 35.0,
    name: 'Turkey Lira & Inflation Crisis',
    type: 'Economic Crisis', severity: 'medium', status: 'Ongoing',
    region: 'Europe / Middle East',
    summary: 'Turkey continues to manage elevated inflation and currency depreciation, limiting real purchasing power for commodity imports.',
    tradeImpact: 'Turkey is one of the world\'s largest red lentil importers for processing and re-export. Lira weakness reduces import affordability, capping the price Turkish crushers can bid for Canadian red lentils. A persistent bearish factor for lentil FOB values until macro conditions stabilise.',
    commodities: ['canada_red_lentils'],
    direction: 'bearish',
  },
  {
    id: 11, lat: 23.7, lng: 90.4,
    name: 'Bangladesh Political Transition',
    type: 'Political Instability', severity: 'medium', status: 'Ongoing',
    region: 'South Asia',
    summary: 'Political transition following the ouster of the Hasina government. New interim administration navigating economic pressures and civil unrest.',
    tradeImpact: 'Bangladesh is a significant chickpea and lentil importer. Political uncertainty has slowed government procurement decisions. Stabilisation of the new administration would likely release pent-up import demand — a potential upside catalyst to watch.',
    commodities: ['australia_desi_chickpeas', 'canada_red_lentils'],
    direction: 'neutral',
  },
  {
    id: 12, lat: 23.8, lng: 120.9,
    name: 'Taiwan Strait Tensions',
    type: 'Political Instability', severity: 'medium', status: 'Ongoing',
    region: 'Asia-Pacific',
    summary: 'Ongoing Chinese military exercises and air incursions into Taiwan\'s ADIZ. Risk of miscalculation remains elevated; significant tail risk for global trade.',
    tradeImpact: 'A Taiwan Strait disruption would affect major shipping lanes used by Australian exporters. China\'s pulse import flows would be severely disrupted in an escalation scenario. Low probability but very high impact — worth monitoring as a tail risk for Australian commodity values.',
    commodities: ['australia_desi_chickpeas', 'australia_nipper_lentils'],
    direction: 'neutral',
  },
  {
    id: 13, lat: 9.0, lng: 40.0,
    name: 'Horn of Africa Conflicts',
    type: 'Armed Conflict', severity: 'low', status: 'Ongoing',
    region: 'East Africa',
    summary: 'Low-level conflict persists across Ethiopia, Somalia, and Eritrea. Humanitarian needs remain elevated across the region.',
    tradeImpact: 'WFP and NGO emergency pulse procurement for the Horn of Africa provides a steady baseline demand for red lentils. Consistent humanitarian buying insulates lentil markets from full demand drops in quiet commercial periods.',
    commodities: ['canada_red_lentils'],
    direction: 'bullish',
  },
  {
    id: 14, lat: 13.5, lng: 2.0,
    name: 'Sahel Instability',
    type: 'Political Instability', severity: 'low', status: 'Ongoing',
    region: 'West Africa',
    summary: 'Military coups across Mali, Burkina Faso, Niger, and Chad have created a broad arc of instability. French forces withdrawn from the region.',
    tradeImpact: 'Humanitarian pulse demand from WFP and NGOs across the Sahel is modest but recurring. Cowpea and groundnut production disruptions in Niger may marginally shift local demand toward imported pulses over time.',
    commodities: ['canada_red_lentils'],
    direction: 'bullish',
  },
  {
    id: 15, lat: 48.0, lng: 68.0,
    name: 'Kazakhstan Transit Risk',
    type: 'Political Instability', severity: 'low', status: 'Low-level',
    region: 'Central Asia',
    summary: 'Kazakhstan is a key transit corridor for Russian commodity exports eastward. Periodic internal tensions and deep economic ties to Russia create latent disruption risk.',
    tradeImpact: 'Russian yellow peas and flaxseed destined for Chinese buyers transit Kazakh rail corridors. Any disruption would redirect Russian supply westward — increasing Black Sea availability and adding bearish pressure to European-market pricing.',
    commodities: ['russian_yellow_peas', 'russian_flax_seeds'],
    direction: 'neutral',
  },
]

// ── Reference links per conflict ───────────────────────────────────────────────
const CONFLICT_LINKS = {
  1: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Russo-Ukrainian_War' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/conflict-ukraine' },
    { label: 'UN OCHA', url: 'https://www.unocha.org/ukraine' },
    { label: 'ACLED', url: 'https://acleddata.com/ukraine-crisis/' },
  ],
  2: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Red_Sea_crisis_(2023%E2%80%93present)' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/houthi-attacks-red-sea' },
    { label: 'UKMTO', url: 'https://www.ukmto.org' },
    { label: 'IMO', url: 'https://www.imo.org/en/MediaCentre/PressBriefings/Pages/default.aspx' },
  ],
  3: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Israel%E2%80%93Hamas_war' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/israeli-palestinian-conflict' },
    { label: 'UN OCHA oPt', url: 'https://www.unocha.org/occupied-palestinian-territory' },
    { label: 'WFP', url: 'https://www.wfp.org/emergencies/palestine-emergency' },
  ],
  4: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/India%E2%80%93Pakistan_relations' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/conflict-between-india-and-pakistan' },
    { label: 'ICG', url: 'https://www.crisisgroup.org/asia/south-asia/pakistan' },
  ],
  5: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Myanmar_civil_war_(2021%E2%80%93present)' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/civil-war-myanmar' },
    { label: 'UN OCHA', url: 'https://www.unocha.org/myanmar' },
    { label: 'ACLED', url: 'https://acleddata.com/myanmar/' },
  ],
  6: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Iran%E2%80%93United_States_relations' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/confrontation-between-united-states-and-iran' },
    { label: 'IAEA', url: 'https://www.iaea.org/topics/iran-and-iaea' },
  ],
  7: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/South_China_Sea_disputes' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/territorial-disputes-south-china-sea' },
    { label: 'CSIS AMTI', url: 'https://amti.csis.org' },
  ],
  8: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sudanese_civil_war_(2023%E2%80%93present)' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/civil-war-sudan' },
    { label: 'UN OCHA', url: 'https://www.unocha.org/sudan' },
    { label: 'WFP', url: 'https://www.wfp.org/countries/sudan' },
  ],
  9: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/2023_Pakistani_economic_crisis' },
    { label: 'IMF Pakistan', url: 'https://www.imf.org/en/Countries/PAK' },
    { label: 'World Bank', url: 'https://www.worldbank.org/en/country/pakistan' },
  ],
  10: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/2021%E2%80%932023_Turkish_currency_and_debt_crisis' },
    { label: 'IMF Turkey', url: 'https://www.imf.org/en/Countries/TUR' },
    { label: 'World Bank', url: 'https://www.worldbank.org/en/country/turkey' },
  ],
  11: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/2024_Bangladeshi_political_crisis' },
    { label: 'ICG', url: 'https://www.crisisgroup.org/asia/south-asia/bangladesh' },
  ],
  12: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Cross-strait_relations' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/cross-strait-relations' },
    { label: 'CSIS China Power', url: 'https://chinapower.csis.org/military-exercises/' },
  ],
  13: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Horn_of_Africa' },
    { label: 'CFR Somalia', url: 'https://www.cfr.org/global-conflict-tracker/conflict/al-shabaab-somalia' },
    { label: 'UN OCHA', url: 'https://www.unocha.org/east-africa-region' },
    { label: 'WFP', url: 'https://www.wfp.org/news/wfp-horn-africa' },
  ],
  14: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Sahel_conflict' },
    { label: 'CFR Tracker', url: 'https://www.cfr.org/global-conflict-tracker/conflict/al-qaeda-and-mali' },
    { label: 'ACLED', url: 'https://acleddata.com/sahel/' },
    { label: 'WFP Sahel', url: 'https://www.wfp.org/sahel' },
  ],
  15: [
    { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Kazakhstan' },
    { label: 'World Bank', url: 'https://www.worldbank.org/en/country/kazakhstan' },
    { label: 'ICG', url: 'https://www.crisisgroup.org/europe-central-asia/central-asia' },
  ],
}

const TYPE_FILTERS = ['All', 'Armed Conflict', 'Maritime Security', 'Political Instability', 'Economic Crisis']

// ── Component ──────────────────────────────────────────────────────────────────
export default function ConflictTracker() {
  const [selected, setSelected]         = useState(null)
  const [typeFilter, setTypeFilter]     = useState('All')
  const [sevFilter, setSevFilter]       = useState('All')
  const [agroOnly, setAgroOnly]         = useState(false)
  const mapDivRef    = useRef(null)
  const leafletRef   = useRef(null)
  const markersRef   = useRef({})

  // Filtered list
  const filtered = CONFLICTS.filter(c => {
    if (typeFilter !== 'All' && c.type !== typeFilter) return false
    if (sevFilter  !== 'All' && c.severity !== sevFilter)  return false
    if (agroOnly && c.commodities.length === 0)            return false
    return true
  })

  // Initialise Leaflet once
  useEffect(() => {
    if (leafletRef.current || !mapDivRef.current || !window.L) return
    const L = window.L

    const map = L.map(mapDivRef.current, {
      center: [20, 20], zoom: 2, minZoom: 2, maxZoom: 8,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
    setSelected(conflict)
    leafletRef.current?.flyTo([conflict.lat, conflict.lng], 5, { duration: 1.2 })
  }

  return (
    <div className="flex flex-col gap-4 pb-16">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Globe size={16} className="text-emerald-400" />
            Global Conflict Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {CONFLICTS.length} active conflicts · impact on pulse &amp; oilseed trade routes · click any marker or card to explore
          </p>
        </div>
        {/* Severity legend */}
        <div className="hidden sm:flex items-center gap-3">
          {Object.entries(SEV).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
              {v.label}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 text-xs rounded-full border transition-all
              ${typeFilter === t
                ? 'bg-emerald-700 text-white border-emerald-600'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'}`}
          >{t}</button>
        ))}
        <button onClick={() => setAgroOnly(v => !v)}
          className={`px-3 py-1 text-xs rounded-full border transition-all
            ${agroOnly
              ? 'bg-amber-700/30 text-amber-300 border-amber-600/60'
              : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'}`}
        >Agro Impact Only</button>
        {['All','critical','high','medium','low'].map(s => (
          <button key={s} onClick={() => setSevFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-all capitalize
              ${sevFilter === s
                ? 'bg-slate-600 text-white border-slate-500'
                : 'bg-slate-800/60 text-slate-500 border-slate-800 hover:border-slate-600 hover:text-slate-400'}`}
          >{s === 'All' ? 'All Severity' : s}</button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 310px)', minHeight: 520 }}>

        {/* Conflict list sidebar */}
        <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 && (
            <p className="text-xs text-slate-600 text-center pt-8">No conflicts match the current filters.</p>
          )}
          {filtered.map(c => {
            const s = SEV[c.severity]
            const isSelected = selected?.id === c.id
            return (
              <button key={c.id} onClick={() => focusConflict(c)}
                className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] active:scale-100
                  ${isSelected ? `${s.card} ring-1 ${s.ring}` : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-200 leading-snug">{c.name}</p>
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

        {/* Map + detail panel */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Leaflet map */}
          <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 relative">
            <div ref={mapDivRef} className="absolute inset-0" />
          </div>

          {/* Selected conflict detail */}
          {selected && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-shrink-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selected.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.region} · {selected.status}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${SEV[selected.severity].badge}`}>
                    {SEV[selected.severity].label}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${DIR_BADGE[selected.direction]}`}>
                    {selected.direction === 'bullish' ? '▲' : selected.direction === 'bearish' ? '▼' : '◆'} {selected.direction}
                  </span>
                  <button onClick={() => setSelected(null)}
                    className="text-slate-600 hover:text-slate-300 transition-colors text-xl leading-none ml-1"
                  >×</button>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-3">{selected.summary}</p>

              <div className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1.5">Pulse &amp; Oilseed Trade Impact</p>
                <p className="text-xs text-slate-300 leading-relaxed">{selected.tradeImpact}</p>
              </div>

              {selected.commodities.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 mb-1.5">Commodities affected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.commodities.map(k => (
                      <span key={k}
                        className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300"
                      >
                        {COMMODITY_NAMES[k]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {CONFLICT_LINKS[selected.id]?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 mb-2">References:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONFLICT_LINKS[selected.id].map(({ label, url }) => (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
                      >
                        <ExternalLink size={10} />
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
