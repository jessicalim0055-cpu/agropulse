import anthropic
import json
import os
import random
import logging
from typing import Optional

logger = logging.getLogger(__name__)

COMMODITIES: dict[str, str] = {
    "canada_yellow_peas":       "Canada Yellow Peas",
    "canada_red_lentils":       "Canada Red Lentils",
    "canada_green_peas":        "Canada Green Peas",
    "australia_desi_chickpeas": "Australia Desi Chickpeas",
    "australia_nipper_lentils": "Australia Nipper Lentils",
    "russian_yellow_peas":      "Russian Yellow Peas",
    "russian_flax_seeds":       "Russian Flax Seeds",
}

_client: Optional[anthropic.Anthropic] = None

SYSTEM_PROMPT = """You are a senior commodities analyst specialising in agricultural pulses and oilseeds
with 20 years of experience trading Canadian, Australian, and Russian pulse crops. You assess news for
its directional impact on specific physical commodity prices."""

REPORT_SYSTEM_PROMPT = """You are a senior commodities analyst specialising in agricultural pulses and oilseeds.
Extract and summarise key market data from trade reports, market letters, and government publications.
Focus on actionable price, acreage, supply/demand, and trade flow data for pulse and oilseed markets."""

_MOCK_REPORT_SUMMARY = {
    "overview": "Canadian pulse markets showed mixed signals this week, with yellow peas firming on strong Indian demand while red lentils faced pressure from competitive Australian origin. Australian desi chickpea FOB values remained stable amid steady Middle East inquiry. Russian yellow pea export pace continues to outperform last year's levels.",
    "prices": [
        {"commodity": "Canada Yellow Peas", "detail": "USD 282–286/MT FOB Vancouver; up USD 3–4 w/w on firm Indian CNF demand"},
        {"commodity": "Canada Red Lentils", "detail": "USD 510–520/MT FOB Vancouver; eased USD 5 w/w on Australian competition"},
        {"commodity": "Canada Green Peas", "detail": "USD 310–318/MT FOB Vancouver; steady, limited spot availability"},
        {"commodity": "Australia Desi Chickpeas", "detail": "USD 620–635/MT FOB Melbourne; stable, Pakistani and Bangladeshi buying noted"},
        {"commodity": "Australia Nipper Lentils", "detail": "USD 490–500/MT FOB Adelaide; firm, harvest stocks tightening"},
        {"commodity": "Russian Yellow Peas", "detail": "USD 248–255/MT FOB Novorossiysk; competitive on freight to South Asia"},
        {"commodity": "Russian Flax Seeds", "detail": "USD 520–530/MT FOB; steady, European demand underpinning values"},
    ],
    "acreages": [
        {"region": "Canadian Prairies", "detail": "StatsCan seeding intentions: yellow peas 3.8M acres (+6% y/y), lentils 6.2M acres (+3% y/y), green peas 1.1M acres (flat)"},
        {"region": "Australia", "detail": "ABARES chickpea area forecast 415K ha (+12% y/y); lentil area 780K ha (+5% y/y)"},
        {"region": "Russia / Black Sea", "detail": "Yellow pea area est. 1.6M ha, broadly flat y/y; flaxseed area 1.2M ha (-2% y/y)"},
    ],
    "supply_demand": "Global yellow pea balance remains snug with Indian stocks below 5-year average. Canadian carry-out projected at 400K MT vs 620K MT last year. Australian lentil exportable surplus estimated 900K MT, ample but mostly committed.",
    "trade_flows": "India imported 380K MT of yellow peas in March, up 28% y/y. Bangladesh tendered for 50K MT desi chickpeas. China quiet on pulses. EU red lentil demand steady from Turkey and Egypt.",
    "key_themes": [
        "Indian demand underpinning Canadian yellow pea and lentil FOB values",
        "Australian chickpea harvest running 18% above last year, capping upside",
        "Russian origin gaining share in South Asian pea tenders on freight advantage",
        "Dryness across Saskatchewan — early crop risk premium building",
        "INR depreciation slightly dampening Indian import affordability",
    ],
    "week_on_week": [
        {"commodity": "Canada Yellow Peas",       "direction": "up",   "change": "FOB firmed USD 3–4/MT on stronger Indian inquiry; export pace 15% ahead of prior week"},
        {"commodity": "Canada Red Lentils",       "direction": "down", "change": "Eased USD 5/MT as Australian origin offered competitively; Turkish demand softened"},
        {"commodity": "Canada Green Peas",        "direction": "flat", "change": "Steady w/w; limited new business, holders firm on offer"},
        {"commodity": "Australia Desi Chickpeas", "direction": "up",   "change": "Recovered USD 8–10/MT after two weeks of softness; Bangladeshi buying returned"},
        {"commodity": "Australia Nipper Lentils", "direction": "up",   "change": "Tightened USD 5/MT as harvest arrivals slow; stocks drawing down faster than expected"},
        {"commodity": "Russian Yellow Peas",      "direction": "down", "change": "Offered USD 3–5/MT lower on aggressive seller competition; freight advantage vs Canada widening"},
        {"commodity": "Russian Flax Seeds",       "direction": "flat", "change": "Unchanged w/w; European buyers sidelined ahead of crush margin review"},
    ],
    "outlook": "Near-term bias is mildly bullish for Canadian yellow peas and green peas on tight supply. Red lentils remain under pressure from Australian competition. Watch Indian import duty announcements and Saskatchewan precipitation forecasts as key price catalysts over the next 4–6 weeks.",
}

_MOCK_SUMMARIES = [
    "Export demand from South Asia remains robust, supporting near-term price floors across Canadian pulse crops. Freight costs out of Vancouver continue to weigh on FOB competitiveness versus Australian origin. Traders watching India import duty signals closely.",
    "Dryness across the Canadian Prairies raises early crop concern, with soil moisture deficits widening in Saskatchewan pulse-growing regions. Australian harvest volumes are tracking above last year, creating downward pressure on desi chickpea bids. Russian origin remains competitive on freight.",
    "India's Rabi pulse harvest is progressing well, likely tempering import appetite through Q2. Bangladesh and Pakistan tender activity is providing a floor for red lentil bids. Currency weakness in importing nations adding complexity to pricing discussions.",
    "USDA supply and demand estimates came in broadly neutral for oilseeds, with minor upward revision to global flaxseed production. Canadian yellow pea exports running ahead of last year's pace. Weather premium fading in Australian markets following recent rainfall.",
    "Black Sea logistics disruptions are creating brief tightness in Russian yellow pea availability. Chinese demand for Canadian pulses remains steady month-on-month. Australian growers holding stocks amid expectations of stronger late-season demand from the Middle East.",
]

_MOCK_REASONING = {
    "bullish": [
        "Supply tightness and strong export demand pointing to upward price pressure.",
        "Weather disruptions in key growing regions reducing available supply.",
        "Import tender activity from major buyers supporting bid levels.",
        "Logistics constraints limiting near-term export availability.",
        "Currency moves in origin countries reducing competitive pressure.",
    ],
    "bearish": [
        "Bumper harvest expectations weighing on forward price outlook.",
        "Increased competition from alternative origins suppressing bids.",
        "Demand softness from key importing nations reducing buying interest.",
        "Improved weather conditions easing earlier supply concerns.",
        "Large carry-in stocks limiting upside potential.",
    ],
    "neutral": [
        "Mixed signals from production and demand side offsetting each other.",
        "Mentioned in broader agricultural context without direct price implications.",
        "Market awaiting further clarity on import policy before directional move.",
    ],
}


def _is_demo_mode() -> bool:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    return not key or key.startswith("sk-ant-your")


def _mock_analyze(title: str, content: str) -> dict:
    rng = random.Random(hash(title) & 0xFFFFFFFF)
    summary = rng.choice(_MOCK_SUMMARIES)
    commodity_keys = list(COMMODITIES.keys())
    n = rng.randint(2, 4)
    chosen = rng.sample(commodity_keys, n)
    sentiments = []
    for key in chosen:
        sentiment = rng.choices(["bullish", "bearish", "neutral"], weights=[0.4, 0.35, 0.25])[0]
        sentiments.append({
            "commodity": key,
            "sentiment": sentiment,
            "confidence": round(rng.uniform(0.55, 0.92), 2),
            "reasoning": rng.choice(_MOCK_REASONING[sentiment]),
        })
    return {"summary": summary, "sentiments": sentiments}


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        key = os.getenv("ANTHROPIC_API_KEY", "")
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key."
            )
        _client = anthropic.Anthropic(api_key=key)
    return _client


def analyze_article(title: str, content: str) -> dict:
    """Returns {summary, sentiments: [{commodity, sentiment, confidence, reasoning}]}"""
    commodities_list = "\n".join(f"  {k}: {v}" for k, v in COMMODITIES.items())

    user_prompt = f"""Analyse this news article for its impact on tracked pulse/oilseed commodities.

Tracked commodities:
{commodities_list}

Article Title: {title}
Article Content: {content}

Instructions:
1. Write a 2–3 sentence trading-desk summary (price-action focused).
2. For each tracked commodity that is directly OR indirectly affected, assign:
   - sentiment: "bullish" (prices likely to rise / demand up / supply tight),
                "bearish" (prices likely to fall / oversupply / demand down), or
                "neutral" (mentioned but mixed/unclear direction)
   - confidence: 0.0–1.0
   - reasoning: one concise sentence explaining the directional call

Only include commodities that are genuinely relevant. If none apply, return an empty sentiments array.

Respond with VALID JSON ONLY — no markdown, no explanation outside the JSON:
{{
  "summary": "...",
  "sentiments": [
    {{
      "commodity": "canada_yellow_peas",
      "sentiment": "bullish",
      "confidence": 0.85,
      "reasoning": "..."
    }}
  ]
}}"""

    if _is_demo_mode():
        logger.info("Demo mode — returning mock analysis (no API key set)")
        return _mock_analyze(title, content)

    try:
        client = get_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text.strip()
        # Strip markdown fences if model wraps them anyway
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1].lstrip("json").strip() if len(parts) > 1 else text
        result = json.loads(text)
        # Validate commodity keys
        result["sentiments"] = [
            s for s in result.get("sentiments", [])
            if s.get("commodity") in COMMODITIES
            and s.get("sentiment") in ("bullish", "bearish", "neutral")
        ]
        return result
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return {"summary": "", "sentiments": []}
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"Analyzer error: {e}")
        return {"summary": "", "sentiments": []}


PARITY_SYSTEM_PROMPT = """You are a senior trader specialising in Indian pulse and oilseed imports.
You analyse parity reports that cover FOB origin prices, ocean freight, CIF India levels, import duty,
and all-in landed costs. Extract all price data precisely and structure it clearly for a trading desk."""

_MOCK_PARITY = {
    "sender": "Priya Sharma <priya@indiapulses.com>",
    "email_date": "2026-05-02",
    "overview": "Indian import parities remain supportive for Canadian yellow peas with FOB values firming on tight nearby supply. Australian desi chickpeas showing competitive landed cost into Nhava Sheva this week. Red lentil parities under mild pressure from Vancouver freight levels.",
    "parities": [
        {"commodity": "Canada Yellow Peas",       "origin": "Canada / Vancouver",    "fob": "USD 285/MT FOB",  "freight": "USD 65/MT",  "cif_india": "USD 350/MT CIF JNPT", "duty": "Nil (exemption in force)", "landing_cost": "~USD 358/MT",  "notes": "Tight spot, holders firm"},
        {"commodity": "Canada Red Lentils",        "origin": "Canada / Vancouver",    "fob": "USD 515/MT FOB",  "freight": "USD 70/MT",  "cif_india": "USD 585/MT CIF JNPT", "duty": "Nil",                      "landing_cost": "~USD 595/MT",  "notes": "Some competition from Aus"},
        {"commodity": "Canada Green Peas",         "origin": "Canada / Vancouver",    "fob": "USD 312/MT FOB",  "freight": "USD 65/MT",  "cif_india": "USD 377/MT CIF JNPT", "duty": "Nil",                      "landing_cost": "~USD 385/MT",  "notes": "Limited inquiry"},
        {"commodity": "Australia Desi Chickpeas",  "origin": "Australia / Melbourne", "fob": "USD 630/MT FOB",  "freight": "USD 45/MT",  "cif_india": "USD 675/MT CIF JNPT", "duty": "66% (incl. BCD+AIDC)",     "landing_cost": "~USD 1120/MT", "notes": "Duty makes it uncompetitive currently"},
        {"commodity": "Australia Nipper Lentils",  "origin": "Australia / Adelaide",  "fob": "USD 495/MT FOB",  "freight": "USD 48/MT",  "cif_india": "USD 543/MT CIF JNPT", "duty": "Nil",                      "landing_cost": "~USD 555/MT",  "notes": "Steady demand from processors"},
        {"commodity": "Russian Yellow Peas",       "origin": "Russia / Novorossiysk", "fob": "USD 252/MT FOB",  "freight": "USD 42/MT",  "cif_india": "USD 294/MT CIF JNPT", "duty": "Nil",                      "landing_cost": "~USD 302/MT",  "notes": "Cheapest origin for peas"},
        {"commodity": "Russian Flax Seeds",        "origin": "Russia / Novorossiysk", "fob": "USD 525/MT FOB",  "freight": "USD 42/MT",  "cif_india": "USD 567/MT CIF JNPT", "duty": "30%",                      "landing_cost": "~USD 738/MT",  "notes": "High duty limiting volume"},
    ],
    "freight_notes": "Handysize freight on Vancouver–JNPT route eased USD 2–3/MT w/w to around USD 64–66/MT. Black Sea–JNPT holding at USD 40–43/MT, providing Russian origin a structural freight advantage of ~USD 22/MT vs Canada.",
    "duty_structure": "Yellow peas, red/green lentils remain duty-free under the current government notification (valid through Sept 2026). Desi chickpeas attract 66% effective duty (BCD 40% + AIDC 20% + other levies). Flaxseed duty at 30% BCD.",
    "key_highlights": [
        "Russian yellow peas remain the cheapest pea origin at ~USD 302/MT landed, USD 56/MT below Canadian equivalent",
        "Canadian yellow pea FOB firmed USD 3/MT w/w on strong inquiry from Kolkata-based importers",
        "Desi chickpea duty remains prohibitive — no commercial business likely until structure changes",
        "Red lentil parity into India still workable at ~USD 595/MT vs domestic prices of ~INR 9,200/qtl (~USD 670/MT equivalent)",
        "INR at 83.7 per USD — slight depreciation adding ~1.2% to landed costs vs last week",
    ],
    "outlook": "Yellow pea parities likely to stay supported near-term given tight Canadian stocks and ongoing Indian demand. Red lentil buyers may find better value in Australian origin if freight differential narrows. Watch for any duty notification changes on chickpeas ahead of kharif sowing season.",
}


def analyze_parity_email(text: str, sender: str = "", email_date: str = "") -> dict:
    """Extract parity table and market data from a pulses parity report email."""
    if _is_demo_mode():
        logger.info("Demo mode — returning mock parity email analysis")
        return dict(_MOCK_PARITY)

    context = ""
    if sender:
        context += f"Sender: {sender}\n"
    if email_date:
        context += f"Date: {email_date}\n"

    prompt = f"""Analyse this pulses parity report email and extract all market data.

{context}
Email content:
{text[:14000]}

Return VALID JSON ONLY with this exact structure:
{{
  "sender": "sender name/email if identifiable, else empty string",
  "email_date": "date of the report (YYYY-MM-DD if possible, else as written)",
  "overview": "2-3 sentence summary of key market messages and price direction",
  "parities": [
    {{
      "commodity": "Full commodity name",
      "origin": "Origin country / port",
      "fob": "FOB price and basis (e.g. USD 285/MT FOB Vancouver)",
      "freight": "Ocean freight rate (e.g. USD 65/MT)",
      "cif_india": "CIF India price and port (e.g. USD 350/MT CIF JNPT)",
      "duty": "Import duty rate or amount",
      "landing_cost": "All-in landed cost",
      "notes": "Any relevant remarks, quality, incoterm details"
    }}
  ],
  "freight_notes": "Freight market commentary (rates, routes, trends)",
  "duty_structure": "Current Indian import duty structure for relevant commodities",
  "key_highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "outlook": "Forward price direction and key catalysts"
}}

Include all commodities with parity data found in the email.
If a field is not available, use an empty string.
Only return commodities actually mentioned in the email."""

    try:
        client = get_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            system=PARITY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Parity email analysis error: {e}")
        return {"overview": "Analysis failed — please try again.", "parities": [], "key_highlights": [], "outlook": ""}


LEFTFIELD_SYSTEM_PROMPT = """You are a senior agricultural commodities analyst. You extract structured
market intelligence from weekly research reports covering pulse and oilseed markets — specifically
Canada, Australia, and Russian origin crops. Extract all price data as precise numeric values."""

_MOCK_LEFTFIELD = {
    "report_date": "2026-05-09",
    "title": "Global Pulses & Oilseeds Weekly — Week 19/2026",
    "overview": "Canadian pulse markets held firm underpinned by tight nearby supply and steady South Asian import demand. Australian chickpea FOB softened on harvest pressure while Russian yellow pea offers remained competitive on freight differential. Lentil markets showed mixed signals ahead of the new-crop season.",
    "commodity_prices": [
        {"commodity": "Canada Yellow Peas",       "price_usd": 285.0, "price_basis": "FOB Vancouver",      "change_usd":  3.0, "direction": "up",   "detail": "USD 285/MT FOB Vancouver, firmed $3 w/w on strong Indian inquiry; limited spot availability"},
        {"commodity": "Canada Red Lentils",        "price_usd": 515.0, "price_basis": "FOB Vancouver",      "change_usd": -5.0, "direction": "down", "detail": "USD 515/MT FOB Vancouver, eased $5 w/w on Australian competition; Turkish demand softer"},
        {"commodity": "Canada Green Peas",         "price_usd": 312.0, "price_basis": "FOB Vancouver",      "change_usd":  0.0, "direction": "flat", "detail": "USD 312/MT FOB Vancouver, steady w/w; limited spot inquiry, holders firm on offer"},
        {"commodity": "Australia Desi Chickpeas",  "price_usd": 628.0, "price_basis": "FOB Melbourne",      "change_usd": -8.0, "direction": "down", "detail": "USD 628/MT FOB Melbourne, eased $8 w/w on harvest pressure; Pakistani demand tepid"},
        {"commodity": "Australia Nipper Lentils",  "price_usd": 495.0, "price_basis": "FOB Adelaide",       "change_usd":  5.0, "direction": "up",   "detail": "USD 495/MT FOB Adelaide, firmed $5 w/w as harvest arrivals slow; stocks tightening"},
        {"commodity": "Russian Yellow Peas",       "price_usd": 252.0, "price_basis": "FOB Novorossiysk",   "change_usd": -3.0, "direction": "down", "detail": "USD 252/MT FOB Novorossiysk, offered $3 lower on aggressive seller competition"},
        {"commodity": "Russian Flax Seeds",        "price_usd": 525.0, "price_basis": "FOB Novorossiysk",   "change_usd":  0.0, "direction": "flat", "detail": "USD 525/MT FOB Novorossiysk, unchanged w/w; European crush buyers sidelined"},
    ],
    "supply_demand": "Global yellow pea balance remains snug with Indian carry-in stocks below 5-year average. Canadian exportable surplus for yellow peas tightening — total bookings tracking 18% above year-ago pace. Australian lentil exportable surplus estimated 900K MT, largely committed to Turkish and Egyptian end-users.",
    "trade_flows": "India imported 380K MT of yellow peas in March (+28% y/y), April pace tracking similarly strong. Bangladesh tendered 50K MT red lentils. China absent from pulse markets for 4th consecutive week. EU red lentil demand steady through Turkish re-export channel.",
    "key_themes": [
        "Indian import demand underpinning Canadian yellow pea and lentil FOB values",
        "Australian chickpea harvest 18% above prior year, limiting near-term price upside",
        "Russian origin maintaining structural $50–55/MT landed cost advantage vs Canadian peas",
        "Dryness across Saskatchewan — early crop premium building in forward positions",
        "INR at 83.7/USD creating mild headwind for Indian import affordability",
    ],
    "risk_factors": [
        "Saskatchewan soil moisture deficit widening — July crop estimate could surprise lower",
        "Potential Indian duty notification changes on chickpeas ahead of kharif season",
        "Black Sea shipping disruptions may temporarily tighten Russian availability",
        "AUD/USD movement could shift Australian origin competitiveness rapidly",
    ],
    "market_commentary": "The spread between Canadian and Russian yellow pea landed costs in India has widened to ~USD 56/MT, the widest since October 2025. This is incentivising Indian buyers to favour Russian origin where possible, though vessel availability and shipment timing constraints are limiting the switch.",
    "outlook": "Near-term bias mildly bullish for Canadian yellow peas (tight supply, strong demand) and Australian nipper lentils (stocks tightening). Red lentils and Russian yellow peas face downward pressure. Key catalysts: Saskatchewan early crop assessment and Indian duty notifications on chickpeas.",
}


def analyze_leftfield_report(text: str, subject: str = "", received_date: str = "") -> dict:
    """Extract structured market intelligence from a Leftfield Capital Research weekly report PDF."""
    if _is_demo_mode():
        logger.info("Demo mode — returning mock leftfield report")
        return dict(_MOCK_LEFTFIELD)

    context = ""
    if subject:
        context += f"Email subject: {subject}\n"
    if received_date:
        context += f"Received date: {received_date}\n"

    prompt = f"""Analyse this weekly agricultural market research report and extract all key data.

{context}
Report content:
{text[:14000]}

Return VALID JSON ONLY with this exact structure:
{{
  "report_date": "YYYY-MM-DD (best estimate from report content or received date)",
  "title": "Report title or series name if identifiable",
  "overview": "2-3 sentence executive summary focused on price direction and key market themes",
  "commodity_prices": [
    {{
      "commodity": "Full commodity name (e.g. Canada Yellow Peas)",
      "price_usd": 285.0,
      "price_basis": "Price basis (e.g. FOB Vancouver)",
      "change_usd": 3.0,
      "direction": "up|down|flat",
      "detail": "Full price description including context and w/w change narrative"
    }}
  ],
  "supply_demand": "Key supply/demand balance observations in 2-3 sentences",
  "trade_flows": "Notable export/import flows, tender activity, key buyer/seller dynamics",
  "key_themes": ["concise theme 1", "concise theme 2", "concise theme 3"],
  "risk_factors": ["risk 1", "risk 2"],
  "market_commentary": "Broader market context, spreads, freight dynamics, or macro factors",
  "outlook": "Forward price direction and key catalysts to watch over the next 4-6 weeks"
}}

Rules:
- price_usd must be a number (null if not found)
- change_usd must be a number (positive = price rose, negative = fell, 0 = flat, null if unknown)
- direction must be "up", "down", or "flat"
- Include all commodities with price data found in the report
- If a section has no data, use [] or "" as appropriate"""

    try:
        client = get_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            system=LEFTFIELD_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Leftfield report analysis error: {e}")
        return {"overview": "Analysis failed — please try again.", "commodity_prices": [], "key_themes": [], "outlook": ""}


def analyze_report(text: str) -> dict:
    """Summarise a weekly market report into structured price/acreage/theme data."""
    if _is_demo_mode():
        logger.info("Demo mode — returning mock report summary")
        return dict(_MOCK_REPORT_SUMMARY)

    prompt = f"""Analyse this agricultural market report and extract key data.

Report text:
{text[:12000]}

Return VALID JSON ONLY with this exact structure:
{{
  "overview": "2-3 sentence executive summary focused on price action and market direction",
  "prices": [
    {{"commodity": "Commodity Name", "detail": "price level, basis, week-on-week change and context"}}
  ],
  "acreages": [
    {{"region": "Region or Country", "detail": "area/production figures, y/y comparison, source if available"}}
  ],
  "supply_demand": "Key supply/demand balance observations in 2-3 sentences",
  "trade_flows": "Notable export/import flows and tender activity in 1-2 sentences",
  "week_on_week": [
    {{"commodity": "Commodity Name", "direction": "up|down|flat", "change": "what changed vs prior week and why"}}
  ],
  "key_themes": ["concise theme 1", "concise theme 2"],
  "outlook": "Forward price direction and key catalysts to watch over the next 4-6 weeks"
}}

Only include sections with data present in the report. Use [] or "" for sections not covered.

For "week_on_week", direction must be "up", "down", or "flat"."""

    try:
        client = get_client()
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=REPORT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Report analysis error: {e}")
        return {"overview": "Analysis failed — please try again.", "prices": [], "acreages": [], "supply_demand": "", "trade_flows": "", "key_themes": [], "outlook": ""}
