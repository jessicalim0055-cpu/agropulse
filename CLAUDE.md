# AgroPulse — Project Context

## Who I am
I am a commodities trader specialising in **agricultural pulses and oilseeds**, with deep domain knowledge of physical commodity markets. My email is jessica.lim@agrocorp.com.sg and I work at AgroCorp.

## What this project is
**AgroPulse** is a personal market intelligence dashboard that:
- Aggregates agriculture news in real time from RSS feeds (Western Producer, Grain Central, BBC, Reuters, CNBC, CNA, USDA, FAO, etc.)
- Uses the **Claude API (claude-sonnet-4-6)** to summarise each article and assign bullish/bearish/neutral sentiment per commodity
- Stores everything in a local SQLite database
- Displays a live React dashboard with sentiment cards, trend charts (1D/1W/1M/1Y), and a filtered news feed

## Commodities tracked (exact keys used in the DB and API)
| Key | Display Name |
|-----|-------------|
| `canada_yellow_peas` | Canada Yellow Peas |
| `canada_red_lentils` | Canada Red Lentils |
| `canada_green_peas` | Canada Green Peas |
| `australia_desi_chickpeas` | Australia Desi Chickpeas |
| `australia_nipper_lentils` | Australia Nipper Lentils |
| `russian_yellow_peas` | Russian Yellow Peas |
| `russian_flax_seeds` | Russian Flax Seeds |

## Tech stack
| Layer | Tech |
|-------|------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite |
| AI | Anthropic SDK (`anthropic`), model `claude-sonnet-4-6` |
| News | `feedparser` (RSS), optional NewsAPI (`NEWS_API_KEY`) |
| Scheduler | APScheduler (auto-refresh every 6h) |
| Frontend | React 18, Vite, Tailwind CSS v3, Recharts, Lucide React |

## Project structure
```
agropulse/
├── backend/
│   ├── main.py          # FastAPI app, all routes, lifespan, refresh logic
│   ├── database.py      # SQLAlchemy models: Article, ArticleSentiment
│   ├── news_fetcher.py  # RSS + NewsAPI aggregation, agri keyword filter
│   ├── analyzer.py      # Claude API: summarise + tag sentiment per commodity
│   ├── requirements.txt
│   └── .env             # ANTHROPIC_API_KEY, NEWS_API_KEY (optional)
└── frontend/
    ├── src/
    │   ├── App.jsx                        # Root: state, polling, data fetching
    │   └── components/
    │       ├── Header.jsx                 # Sticky header, refresh button, stats
    │       ├── SentimentDashboard.jsx     # Grid of 7 commodity cards
    │       ├── SentimentCard.jsx          # Per-commodity sentiment + bar + net score
    │       ├── TrendSection.jsx           # Recharts line chart, period selector
    │       └── NewsFeed.jsx               # Article cards with AI summary + tags
    ├── package.json
    └── vite.config.js   # Proxies /api → localhost:8000
```

## API endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Last refresh time, article counts |
| POST | `/api/refresh` | Trigger a news fetch + analysis cycle |
| GET | `/api/news` | Paginated articles; `?commodity=` filter |
| GET | `/api/sentiment/current` | 7-day sentiment summary per commodity |
| GET | `/api/trends` | Historical net scores; `?period=day\|week\|month\|year` |

## Database schema
- **articles**: id, url (unique), title, source, published_at, content, summary (AI), fetched_at, analyzed
- **article_sentiments**: id, article_id, commodity (key), sentiment, confidence (0–1), reasoning

## How to run
```bash
# Backend (Terminal 1)
cd agropulse/backend
uvicorn main:app --reload       # serves on :8000

# Frontend (Terminal 2)
cd agropulse/frontend
npm run dev                     # serves on :5173
```
Frontend proxies `/api/*` to the backend automatically via Vite.

## Environment variables (backend/.env)
```
ANTHROPIC_API_KEY=sk-ant-...     # required
NEWS_API_KEY=...                  # optional — newsapi.org free tier (100 req/day)
```

## Design decisions & preferences
- Dark professional trading-dashboard aesthetic (slate-900 bg, emerald/red/amber for sentiment)
- Sentiment is determined per-commodity per-article by Claude, not by keyword matching
- Articles are filtered for agriculture relevance before being sent to Claude (saves API cost)
- Sentiment card net score = (bullish − bearish) / total articles, range −1.0 to +1.0
- Frontend polls every 5 minutes; backend auto-refreshes every 6 hours
- SQLite used for simplicity — no external DB server needed
- User does not yet have Anthropic API key; needs to get one from console.anthropic.com

## Future enhancements to consider
- Price data overlay (e.g. CME futures) on trend charts
- Email/Telegram alerts when sentiment flips from bullish to bearish (or vice versa)
- More granular commodity breakdowns (e.g. by origin, grade, crop year)
- Export to CSV/PDF for weekly market reports
- Integration with Pulse Canada or GASC tender data
