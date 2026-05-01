"""
Vessel data module.

Two functions:
  lookup_vessel(imo)   – one-shot: fetch static vessel info (name, type, flag) by IMO
  refresh_positions()  – periodic: fetch live AIS position for every tracked IMO

Data source: VesselFinder public search JSON (no API key required).
Results cached so we don't hammer the site.
"""
import asyncio
import json
import logging
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# { imo -> { lat, lng, speed, course, nav_status, destination, ship_name, flag, updated_at, _cached_at } }
_cache: dict[str, dict] = {}

_tracked_imos: list[str] = []
_task = None

CACHE_TTL        = 900   # 15 min — don't refetch if still fresh
REFRESH_INTERVAL = 840   # 14 min loop
REQUEST_DELAY    = 3     # seconds between requests (be polite)

_SESSION: Optional[requests.Session] = None

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.vesselfinder.com/",
    "Origin": "https://www.vesselfinder.com",
}

_NAV = {
    0: "Under Way",  1: "At Anchor",  2: "Not Under Command",
    3: "Restricted", 5: "Moored",     6: "Aground",
    7: "Fishing",    8: "Sailing",   15: "Unknown",
}


def _sess() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        _SESSION = requests.Session()
        _SESSION.headers.update(_HEADERS)
    return _SESSION


# ── Public lookup endpoint (one-shot, called when admin adds a vessel) ─────────

def lookup_vessel(imo: str) -> dict:
    """
    Return static vessel info for a given IMO.
    Tries VesselFinder public search → MarineTraffic page → empty dict.
    """
    s = _sess()

    # VesselFinder public search JSON (used by their autocomplete, no auth)
    try:
        r = s.get(
            "https://www.vesselfinder.com/api/pub/portals/search",
            params={"term": imo, "limit": 5},
            timeout=10,
        )
        if r.status_code == 200:
            items = r.json()
            if not isinstance(items, list):
                items = items.get("data", [])
            for item in items:
                item_imo = str(item.get("imo") or item.get("IMO") or "")
                if item_imo == str(imo):
                    return _normalise(item)
            # If no exact IMO match, return first result's name/type at minimum
            if items:
                return _normalise(items[0])
    except Exception as e:
        logger.debug(f"VF search error (IMO {imo}): {e}")

    # MarineTraffic vessel page scrape
    try:
        r = s.get(
            f"https://www.marinetraffic.com/en/ais/details/ships/imo:{imo}",
            timeout=12, allow_redirects=True,
        )
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            # Ship name in <h1> or title
            h1 = soup.find("h1")
            title = soup.title.string if soup.title else ""
            name = h1.get_text(strip=True) if h1 else title.split("|")[0].strip()
            return {"ship_name": name, "imo": imo}
    except Exception as e:
        logger.debug(f"MT scrape error (IMO {imo}): {e}")

    return {}


# ── Live position fetch (called in background loop) ───────────────────────────

def _fetch_live(imo: str) -> Optional[dict]:
    s = _sess()

    # Attempt 1 — VesselFinder public search (returns lat/lng when vessel is transmitting)
    try:
        r = s.get(
            "https://www.vesselfinder.com/api/pub/portals/search",
            params={"term": imo, "limit": 5},
            timeout=12,
        )
        if r.status_code == 200:
            items = r.json()
            if not isinstance(items, list):
                items = items.get("data", [])
            for item in items:
                item_imo = str(item.get("imo") or item.get("IMO") or "")
                if item_imo == str(imo):
                    pos = _normalise(item)
                    if pos.get("lat") and pos.get("lng"):
                        return pos
    except Exception as e:
        logger.debug(f"VF live fetch (IMO {imo}): {e}")

    # Attempt 2 — VesselFinder vessel detail page (HTML)
    try:
        r = s.get(
            f"https://www.vesselfinder.com/vessels/details/{imo}",
            timeout=14, allow_redirects=True,
        )
        if r.status_code == 200:
            pos = _parse_vf_html(r.text, imo)
            if pos:
                return pos
    except Exception as e:
        logger.debug(f"VF detail (IMO {imo}): {e}")

    return None


def _normalise(item: dict) -> dict:
    """Convert various field naming conventions → standard dict."""
    def f(*keys):
        for k in keys:
            v = item.get(k)
            if v is not None and v != "" and v != 0:
                return v
        return None

    lat  = f("lat", "LAT", "latitude")
    lng  = f("lng", "lon", "LON", "longitude")
    spd  = f("speed", "SPD", "sog")
    cog  = f("course", "COG", "cog", "heading", "HDG")
    nav  = f("status", "STATUS", "navigational_status")

    return {
        "ship_name":   (f("name", "SHIPNAME", "vessel_name") or "").strip(),
        "imo":         str(f("imo", "IMO") or ""),
        "flag":        (f("flag", "FLAG", "country") or "").strip(),
        "vessel_type": (f("type", "TYPE", "vessel_type", "shiptype") or "").strip(),
        "lat":         float(lat) if lat is not None else None,
        "lng":         float(lng) if lng is not None else None,
        "speed":       round(float(spd), 1) if spd is not None else None,
        "course":      round(float(cog), 1) if cog is not None else None,
        "nav_status":  _NAV.get(int(nav), str(nav)) if nav is not None else "Unknown",
        "destination": (f("destination", "DESTINATION") or "").strip(),
        "updated_at":  str(f("timestamp", "TIMESTAMP", "time_utc") or ""),
    }


def _parse_vf_html(html: str, imo: str) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")
    # JSON-LD schema
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(script.string or "")
            geo = d.get("geo", {})
            if geo.get("latitude"):
                return {
                    "ship_name": d.get("name", ""),
                    "imo": imo,
                    "lat": float(geo["latitude"]),
                    "lng": float(geo["longitude"]),
                    "speed": None, "course": None,
                    "nav_status": "Unknown", "destination": "",
                    "flag": "", "vessel_type": "",
                    "updated_at": "",
                }
        except Exception:
            pass
    # data-lat / data-lon attributes
    for tag in soup.find_all(attrs={"data-lat": True}):
        try:
            return {
                "ship_name": "", "imo": imo,
                "lat": float(tag["data-lat"]),
                "lng": float(tag.get("data-lon") or tag.get("data-lng") or 0),
                "speed": None, "course": None,
                "nav_status": "Unknown", "destination": "",
                "flag": "", "vessel_type": "", "updated_at": "",
            }
        except Exception:
            pass
    return None


# ── Cache management ──────────────────────────────────────────────────────────

def update_tracked(imos: list[str]):
    global _tracked_imos
    _tracked_imos = [i for i in imos if i]


def get_positions(imos: list[str]) -> dict:
    now = time.time()
    out = {}
    for imo in imos:
        entry = _cache.get(imo)
        if entry and (now - entry.get("_cached_at", 0)) < CACHE_TTL:
            out[imo] = {k: v for k, v in entry.items() if k != "_cached_at"}
    return out


# ── Background refresh loop ───────────────────────────────────────────────────

async def _loop():
    while True:
        now = time.time()
        for imo in list(_tracked_imos):
            cached_at = _cache.get(imo, {}).get("_cached_at", 0)
            if now - cached_at < CACHE_TTL:
                continue
            try:
                pos = await asyncio.get_event_loop().run_in_executor(None, _fetch_live, imo)
                if pos:
                    pos["_cached_at"] = time.time()
                    _cache[imo] = pos
                    logger.info(f"IMO {imo} ({pos.get('ship_name','?')}): {pos.get('lat')}, {pos.get('lng')} @ {pos.get('speed')} kn")
                else:
                    logger.debug(f"IMO {imo}: no live data")
            except Exception as e:
                logger.warning(f"IMO {imo} refresh error: {e}")
            await asyncio.sleep(REQUEST_DELAY)
        await asyncio.sleep(REFRESH_INTERVAL)


async def start():
    global _task
    _task = asyncio.create_task(_loop())


def stop():
    global _task
    if _task:
        _task.cancel()
        _task = None
