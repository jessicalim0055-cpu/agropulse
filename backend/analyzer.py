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
