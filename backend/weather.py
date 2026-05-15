"""
Live agricultural weather for key pulse/oilseed growing regions.
Uses Open-Meteo (free, no API key) — cached 3 hours.
"""

import requests
import logging
import time
from datetime import date
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

REGIONS = [
    # ── Canada ────────────────────────────────────────────────────────────────
    {
        "id": "saskatoon", "name": "Saskatoon", "area": "Saskatchewan", "country": "Canada",
        "lat": 52.13, "lon": -106.67,
        "crops": ["Canada Yellow Peas", "Canada Red Lentils", "Canada Green Peas"],
        "note": "#1 pulse province — dominates Canadian red & green lentil output; major yellow & green pea producer. Semi-arid climate limits disease pressure. Soil moisture May–Jul is the primary price catalyst.",
    },
    {
        "id": "lethbridge", "name": "Lethbridge", "area": "Alberta (South)", "country": "Canada",
        "lat": 49.70, "lon": -112.84,
        "crops": ["Canada Yellow Peas", "Canada Green Peas"],
        "note": "Southern Alberta — yellow peas and green peas; drier climate suits field peas. Chickpeas also grown here but not our tracked origin. Spring frost timing and summer drought are key risks.",
    },
    {
        "id": "red_deer", "name": "Red Deer", "area": "Alberta (Central)", "country": "Canada",
        "lat": 52.27, "lon": -113.81,
        "crops": ["Canada Yellow Peas", "Canada Red Lentils"],
        "note": "Central Alberta pulse belt — field peas and lentils in rotation with cereals and canola. Less arid than southern AB; spring soil conditions drive seeding pace.",
    },
    {
        "id": "brandon", "name": "Brandon", "area": "Manitoba (West)", "country": "Canada",
        "lat": 49.85, "lon": -99.95,
        "crops": ["Canada Yellow Peas", "Canada Green Peas", "Canada Red Lentils"],
        "note": "Western Manitoba pulse belt — peas and lentils alongside cereals and canola. More humid than SK/AB, raising sclerotinia and ascochyta disease pressure. Excess moisture in May is a key seeding risk.",
    },
    # ── India ─────────────────────────────────────────────────────────────────
    {
        "id": "ludhiana", "name": "Ludhiana", "area": "Punjab", "country": "India",
        "lat": 30.90, "lon": 75.85,
        "crops": ["Green Peas", "Lentils (Masur)"],
        "note": "Major import hub for Canadian peas and lentils — monsoon onset timing shifts buyer demand. Punjab also produces green peas domestically (rabi season); import demand is sensitive to local crop performance and seasonal procurement prices.",
    },
    {
        "id": "nagpur", "name": "Nagpur", "area": "Maharashtra", "country": "India",
        "lat": 21.15, "lon": 79.09,
        "crops": ["Pigeon Peas (Tur)", "Chickpeas (Gram)"],
        "note": "Maharashtra is India's #1 pigeon pea (tur/arhar) state and a significant desi chickpea zone. Domestic rabi chickpea crop (Oct–Mar) directly competes with Australian imports. Poor monsoon → smaller tur crop → higher overall pulse import demand.",
    },
    {
        "id": "indore", "name": "Indore", "area": "Madhya Pradesh", "country": "India",
        "lat": 22.72, "lon": 75.86,
        "crops": ["Chickpeas (Gram)", "Lentils (Masur)", "Pigeon Peas (Tur)"],
        "note": "MP is India's most critical pulse state — #1 for chickpeas (~25–30% national share), #1 for masur lentils, and top-3 for tur, mung, and urad. Strong domestic harvests here directly suppress import demand for Canadian lentils and Australian chickpeas. Pre-monsoon heat and rabi soil moisture are key watch points.",
    },
    {
        "id": "jaipur", "name": "Jaipur", "area": "Rajasthan", "country": "India",
        "lat": 26.91, "lon": 75.79,
        "crops": ["Chickpeas (Gram)", "Mung Beans (Moong)"],
        "note": "Rajasthan is India's #2 chickpea state (~15–20% national share) and #1 mung bean producer. Arid climate makes production highly rainfall-dependent — drought years reduce domestic chickpea supply and boost Australian import demand. Key watch: northeast monsoon retreat and rabi sowing rains (Oct–Nov).",
    },
    # ── China ─────────────────────────────────────────────────────────────────
    {
        "id": "harbin", "name": "Harbin", "area": "Heilongjiang", "country": "China",
        "lat": 45.75, "lon": 126.64,
        "crops": ["Mung Beans", "Soybeans", "Adzuki Beans"],
        "note": "Northeast China — Heilongjiang is #1 nationally for mung beans, soybeans, and adzuki beans; also a major importer of Russian flax and oilseeds. Spring thaw timing and summer rainfall affect both domestic pulse production and demand for northern-origin imports.",
    },
    {
        "id": "zhengzhou", "name": "Zhengzhou", "area": "Henan", "country": "China",
        "lat": 34.75, "lon": 113.66,
        "crops": ["Mung Beans", "Soybeans"],
        "note": "Key pulse consumption and trading hub — Henan is a major pea and bean processing province in central China. Flood risk in summer (Yellow River basin) can disrupt logistics and briefly spike import demand for Canadian yellow peas.",
    },
    {
        "id": "kunming", "name": "Kunming", "area": "Yunnan", "country": "China",
        "lat": 24.88, "lon": 102.83,
        "crops": ["Chickpeas", "Mung Beans"],
        "note": "Yunnan is China's primary chickpea-growing region (also Tibet, Sichuan) — production is modest nationally but growing. SW monsoon climate with distinct wet/dry seasons. Domestic chickpea output partially offsets Australian import demand; watch dry-season soil moisture for crop condition signals.",
    },
    # ── Russia ────────────────────────────────────────────────────────────────
    {
        "id": "krasnodar", "name": "Krasnodar", "area": "Krasnodar Krai", "country": "Russia",
        "lat": 45.04, "lon": 38.98,
        "crops": ["Russian Yellow Peas", "Russian Flax Seeds"],
        "note": "Black Sea export corridor — critical logistics hub for pea and oilseed exports via Novorossiysk. Growing area for winter cereals and pulses; June–July drought affects forward supply estimates and export loading pace.",
    },
    {
        "id": "voronezh", "name": "Voronezh", "area": "Voronezh Oblast", "country": "Russia",
        "lat": 51.67, "lon": 39.21,
        "crops": ["Russian Yellow Peas"],
        "note": "Central European Russia's main field pea belt — Voronezh, Kursk, Tambov, and Lipetsk oblasts are Russia's largest yellow pea growing zone. Spring weather here drives Russian crop estimates more directly than the Black Sea corridor. Late frost (Apr–May) and June drought are primary risks.",
    },
    {
        "id": "rostov", "name": "Rostov-on-Don", "area": "Rostov Oblast", "country": "Russia",
        "lat": 47.23, "lon": 39.72,
        "crops": ["Russian Yellow Peas", "Russian Flax Seeds"],
        "note": "Port region at the mouth of the Don — weather affects loading pace and vessel queues at Azov/Black Sea ports. Also a flax and pea growing region; spring soil moisture and summer heat are key production risks.",
    },
    # ── Australia ─────────────────────────────────────────────────────────────
    {
        "id": "port_lincoln", "name": "Port Lincoln", "area": "South Australia (Eyre Peninsula)", "country": "Australia",
        "lat": -34.72, "lon": 135.87,
        "crops": ["Australia Nipper Lentils", "Australia Desi Chickpeas"],
        "note": "Australia's #1 lentil region — SA Eyre Peninsula and Mid-North account for ~40–50% of national lentil production. Also significant for chickpeas and field peas. Dry Mediterranean climate: winter rainfall (Apr–Sep) is the critical growing season. El Niño dry years severely cut SA lentil supply and lift import interest.",
    },
    {
        "id": "moree", "name": "Moree", "area": "New South Wales (Northwest)", "country": "Australia",
        "lat": -29.47, "lon": 149.84,
        "crops": ["Australia Desi Chickpeas", "Australia Nipper Lentils"],
        "note": "Northwest NSW is Australia's #1 chickpea region — Moree, Narrabri, and Walgett account for ~50–60% of national chickpea production. Central NSW also significant for lentils. Summer heat during pod-fill and rain at harvest are primary quality and yield risks.",
    },
]

_cache: dict = {}
_CACHE_TTL = 3 * 3600  # 3 hours


def _fetch_region(region: dict) -> dict | None:
    params = {
        "latitude": region["lat"],
        "longitude": region["lon"],
        "daily": ",".join([
            "temperature_2m_max", "temperature_2m_min",
            "precipitation_sum", "et0_fao_evapotranspiration",
            "wind_speed_10m_max",
        ]),
        "hourly": "soil_moisture_0_to_7cm",
        "timezone": "auto",
        "past_days": 14,
        "forecast_days": 7,
    }
    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error(f"Weather fetch failed for {region['name']}: {e}")
        return None

    daily  = data.get("daily", {})
    hourly = data.get("hourly", {})
    today  = date.today().isoformat()

    dates     = daily.get("time", [])
    temp_max  = daily.get("temperature_2m_max", [])
    temp_min  = daily.get("temperature_2m_min", [])
    precip    = daily.get("precipitation_sum", [])
    et0       = daily.get("et0_fao_evapotranspiration", [])
    wind      = daily.get("wind_speed_10m_max", [])

    def _get(lst, i):
        return lst[i] if lst and i < len(lst) else None

    daily_records = [
        {
            "date": d,
            "temp_max": _get(temp_max, i),
            "temp_min": _get(temp_min, i),
            "precip_mm": _get(precip, i),
            "et0_mm": _get(et0, i),
            "wind_kmh": _get(wind, i),
            "is_forecast": d > today,
        }
        for i, d in enumerate(dates)
    ]

    # Today's index
    today_idx = next((i for i, d in enumerate(dates) if d == today), None)

    # Most recent hourly soil moisture
    sm_hourly = hourly.get("soil_moisture_0_to_7cm", [])
    sm_current = next((v for v in reversed(sm_hourly) if v is not None), None)

    # 14-day water balance (past only)
    past_precip = sum(p for p in precip[:14] if p is not None)
    past_et0    = sum(e for e in et0[:14]    if e is not None)
    water_balance_14d = round(past_precip - past_et0, 1)

    # 7-day actual precip total (days 7-13 = prior week)
    precip_7d = round(sum(p for p in precip[7:14] if p is not None), 1)

    return {
        **{k: v for k, v in region.items()},
        "current": {
            "temp_max_c": _get(temp_max, today_idx) if today_idx is not None else None,
            "temp_min_c": _get(temp_min, today_idx) if today_idx is not None else None,
            "precip_mm":  _get(precip,   today_idx) if today_idx is not None else None,
            "wind_kmh":   _get(wind,     today_idx) if today_idx is not None else None,
            "soil_moisture": round(sm_current, 3) if sm_current is not None else None,
        },
        "water_balance_14d_mm": water_balance_14d,
        "precip_7d_mm": precip_7d,
        "daily": daily_records,
    }


def fetch_all_weather() -> list[dict]:
    global _cache
    now = time.time()
    if "data" in _cache and now - _cache.get("ts", 0) < _CACHE_TTL:
        return _cache["data"]

    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(_fetch_region, r): r for r in REGIONS}
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)

    # Preserve original region order
    order = {r["id"]: i for i, r in enumerate(REGIONS)}
    results.sort(key=lambda r: order.get(r["id"], 99))

    _cache = {"data": results, "ts": now}
    logger.info(f"Weather: fetched {len(results)}/{len(REGIONS)} regions")
    return results
