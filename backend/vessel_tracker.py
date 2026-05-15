"""
Real-time AIS vessel tracking via aisstream.io WebSocket.

Setup:
  1. Get a free API key at https://aisstream.io
  2. Set AISSTREAM_API_KEY in backend/.env
  3. When adding a vessel, enter its MMSI (found on MarineTraffic / VesselFinder)
     OR use the Auto-fill button which resolves MMSI from IMO automatically.

aisstream uses MMSI as the primary subscription key.
We maintain an mmsi→imo mapping so the cache is keyed by IMO (matching the fleet).
"""
import asyncio
import json
import logging
import os
import time

import requests

logger = logging.getLogger(__name__)

# IMO → position/static data
_cache: dict[str, dict] = {}

# MMSI → IMO  (built from fleet data + ShipStaticData messages)
_mmsi_to_imo: dict[str, str] = {}

# Current subscription list
_tracked_mmsis: list[str] = []

_task = None
_restart_event: asyncio.Event | None = None

CACHE_TTL = 300   # seconds — after this, position shown as stale

_NAV = {
    0: "Under Way",  1: "At Anchor",  2: "Not Under Command",
    3: "Restricted", 5: "Moored",     6: "Aground",
    7: "Fishing",    8: "Sailing",   15: "Unknown",
}

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}


# ── Vessel lookup (called when user adds/edits a vessel) ─────────────────────

def lookup_vessel(imo: str) -> dict:
    """Return static info (name, type, flag, mmsi) for a given IMO via VesselFinder search."""
    try:
        r = requests.get(
            "https://www.vesselfinder.com/api/pub/portals/search",
            params={"term": imo, "limit": 5},
            headers=_HEADERS,
            timeout=10,
        )
        if r.status_code == 200:
            items = r.json()
            if not isinstance(items, list):
                items = items.get("data", [])
            for item in items:
                if str(item.get("imo") or item.get("IMO") or "") == str(imo):
                    return _normalise(item)
            if items:
                return _normalise(items[0])
    except Exception as e:
        logger.debug(f"lookup_vessel IMO {imo}: {e}")
    return {}


def _normalise(item: dict) -> dict:
    def f(*keys):
        for k in keys:
            v = item.get(k)
            if v is not None and v != "" and v != 0:
                return v
        return None
    return {
        "ship_name":   (f("name", "SHIPNAME", "vessel_name") or "").strip(),
        "imo":         str(f("imo", "IMO") or ""),
        "mmsi":        str(f("mmsi", "MMSI") or ""),
        "flag":        (f("flag", "FLAG", "country") or "").strip(),
        "vessel_type": (f("type", "TYPE", "vessel_type", "shiptype") or "").strip(),
    }


# ── Tracking state management ─────────────────────────────────────────────────

def update_tracked(imos: list[str], mmsi_map: dict[str, str] | None = None):
    """
    Register which vessels to track.
    mmsi_map: { imo -> mmsi } so we can build the MMSI subscription list.
    """
    global _tracked_mmsis, _mmsi_to_imo

    if mmsi_map:
        for imo, mmsi in mmsi_map.items():
            if imo and mmsi:
                _mmsi_to_imo[mmsi] = imo

    new_mmsis = sorted(set(
        mmsi for mmsi, imo in _mmsi_to_imo.items() if imo in imos
    ))

    if new_mmsis != _tracked_mmsis:
        _tracked_mmsis = new_mmsis
        logger.info(f"Tracked MMSIs updated: {_tracked_mmsis}")
        if _restart_event:
            _restart_event.set()


def get_positions(imos: list[str]) -> dict:
    now = time.time()
    out = {}
    for imo in imos:
        entry = _cache.get(imo)
        if entry:
            out[imo] = {k: v for k, v in entry.items() if k != "_cached_at"}
            out[imo]["stale"] = (now - entry.get("_cached_at", 0)) > CACHE_TTL
    return out


# ── AIS message processing ────────────────────────────────────────────────────

def _process(msg: dict):
    msg_type = msg.get("MessageType", "")
    meta     = msg.get("MetaData", {})
    mmsi     = str(meta.get("MMSI", ""))
    imo      = _mmsi_to_imo.get(mmsi) or mmsi

    if msg_type == "PositionReport":
        pr = msg.get("Message", {}).get("PositionReport", {})
        lat = pr.get("Latitude")
        lng = pr.get("Longitude")
        if lat is None or lng is None:
            return
        entry = dict(_cache.get(imo, {}))
        entry.update({
            "lat":        round(float(lat), 5),
            "lng":        round(float(lng), 5),
            "speed":      round(float(pr.get("Sog", 0)), 1),
            "course":     round(float(pr.get("Cog", 0)), 1),
            "heading":    pr.get("TrueHeading"),
            "nav_status": _NAV.get(pr.get("NavigationalStatus", 15), "Unknown"),
            "mmsi":       mmsi,
            "ship_name":  meta.get("ShipName", entry.get("ship_name", "")),
            "_cached_at": time.time(),
        })
        _cache[imo] = entry
        logger.debug(f"Position: IMO {imo} ({entry['ship_name']}) "
                     f"{entry['lat']}, {entry['lng']} @ {entry['speed']} kn")

    elif msg_type == "ShipStaticData":
        sd = msg.get("Message", {}).get("ShipStaticData", {})
        reported_imo = str(sd.get("ImoNumber") or "").strip()
        if reported_imo and reported_imo != "0":
            if mmsi and mmsi not in _mmsi_to_imo:
                _mmsi_to_imo[mmsi] = reported_imo
            imo = reported_imo

        eta_raw = sd.get("Eta") or {}
        month, day = eta_raw.get("Month", 0), eta_raw.get("Day", 0)
        hour, minute = eta_raw.get("Hour", 0), eta_raw.get("Minute", 0)
        ais_eta = (
            f"{month:02d}/{day:02d} {hour:02d}:{minute:02d} UTC"
            if month and day else ""
        )

        entry = dict(_cache.get(imo, {}))
        entry.update({
            "ship_name":   (sd.get("Name") or "").strip(),
            "destination": (sd.get("Destination") or "").strip(),
            "vessel_type": str(sd.get("Type") or ""),
            "mmsi":        mmsi,
            "ais_eta":     ais_eta,
        })
        if "_cached_at" not in entry:
            entry["_cached_at"] = time.time()
        _cache[imo] = entry


# ── WebSocket connection ──────────────────────────────────────────────────────

async def _connect():
    """One WebSocket session. Returns when connection drops or restart is triggered."""
    try:
        import websockets
    except ImportError:
        logger.error("websockets not installed — run: pip install websockets")
        return False

    api_key = os.getenv("AISSTREAM_API_KEY", "")
    if not api_key or api_key.startswith("your-"):
        logger.info("AISSTREAM_API_KEY not configured — live AIS disabled.")
        return False

    if not _tracked_mmsis:
        logger.debug("No MMSIs to track yet.")
        return False

    subscription = {
        "APIKey": api_key,
        "Mmsis": [int(m) for m in _tracked_mmsis if m.isdigit()],
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }

    logger.info(f"aisstream: connecting for {len(_tracked_mmsis)} vessel(s)")
    try:
        async with websockets.connect(
            "wss://stream.aisstream.io/v0/stream",
            ping_interval=25,
            ping_timeout=20,
        ) as ws:
            await ws.send(json.dumps(subscription))
            logger.info("aisstream: subscribed, receiving messages…")
            async for raw in ws:
                try:
                    _process(json.loads(raw))
                except Exception as e:
                    logger.debug(f"aisstream message parse error: {e}")
                if _restart_event and _restart_event.is_set():
                    logger.info("aisstream: restarting for updated vessel list")
                    return True
    except Exception as e:
        logger.warning(f"aisstream connection error: {e}")
    return True


async def _loop():
    global _restart_event
    _restart_event = asyncio.Event()
    while True:
        _restart_event.clear()
        connected = await _connect()
        if not connected:
            # No key or no vessels — check again in 60s
            try:
                await asyncio.wait_for(_restart_event.wait(), timeout=60)
            except asyncio.TimeoutError:
                pass
        else:
            # Brief pause before reconnecting
            try:
                await asyncio.wait_for(_restart_event.wait(), timeout=10)
            except asyncio.TimeoutError:
                pass


async def start():
    global _task
    _task = asyncio.create_task(_loop())


def stop():
    global _task
    if _task:
        _task.cancel()
        _task = None
