import feedparser
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import time
import logging
import os

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    {"url": "https://www.producer.com/feed/", "source": "Western Producer"},
    {"url": "https://www.graincentral.com/feed/", "source": "Grain Central"},
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml", "source": "BBC Business"},
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml", "source": "BBC World"},
    {"url": "https://www.agweb.com/rss/news", "source": "AgWeb"},
    {"url": "https://www.agriculture.com/rss/news/crops", "source": "Successful Farming"},
    {"url": "https://www.farmprogress.com/rss/news-crops", "source": "Farm Progress"},
    {"url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=rss&category=6511", "source": "CNA Business"},
    {"url": "https://feeds.reuters.com/reuters/businessNews", "source": "Reuters Business"},
    {"url": "https://www.cnbc.com/id/100727362/device/rss/rss.html", "source": "CNBC"},
    {"url": "https://www.usda.gov/rss/home.xml", "source": "USDA"},
    {"url": "https://www.fao.org/news/rss-feeds/en/", "source": "FAO"},
]

AGRI_KEYWORDS = {
    "pea", "peas", "lentil", "lentils", "chickpea", "chickpeas", "pulse", "pulses",
    "grain", "grains", "flaxseed", "flax", "legume", "crop", "harvest",
    "agriculture", "agri", "farm", "commodity", "commodities", "export", "import",
    "canola", "oilseed", "mustard", "mung", "matpe", "pigeon pea", "dal", "dahl",
    "soybean", "wheat", "barley", "canada", "australia", "russia", "ukraine",
    "food", "supply chain", "fertilizer", "drought", "yield",
}


def is_agri_related(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in AGRI_KEYWORDS)


def parse_date(entry) -> datetime:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6])
        except Exception:
            pass
    return datetime.utcnow()


def fetch_rss_feeds() -> list[dict]:
    articles = []
    seen_urls: set[str] = set()
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AgroPulse/1.0)"}

    for feed_cfg in RSS_FEEDS:
        try:
            resp = requests.get(feed_cfg["url"], headers=headers, timeout=8)
            resp.raise_for_status()
            feed = feedparser.parse(resp.content)
            count = 0
            for entry in feed.entries:
                if count >= 15:
                    break
                url = entry.get("link", "").strip()
                title = entry.get("title", "").strip()
                if not url or not title or url in seen_urls:
                    continue

                summary_html = entry.get("summary", "") or entry.get("description", "")
                content_html = ""
                if hasattr(entry, "content") and entry.content:
                    content_html = entry.content[0].get("value", "")

                raw_text = BeautifulSoup(
                    content_html or summary_html, "html.parser"
                ).get_text(" ", strip=True)[:1500]

                if not is_agri_related(title + " " + raw_text):
                    continue

                seen_urls.add(url)
                articles.append({
                    "url": url,
                    "title": title,
                    "source": feed_cfg["source"],
                    "published_at": parse_date(entry),
                    "content": raw_text,
                })
                count += 1
        except Exception as e:
            logger.warning(f"RSS fetch failed [{feed_cfg['source']}]: {e}")
        time.sleep(0.3)

    return articles


def fetch_newsapi(seen_urls: set[str]) -> list[dict]:
    key = os.getenv("NEWS_API_KEY", "")
    if not key:
        return []

    query = (
        '"yellow peas" OR "red lentils" OR "green peas" OR "desi chickpeas" '
        'OR "nipper lentils" OR "flaxseed" OR "pulse crops" OR "lentil market" '
        'OR "chickpea export" OR "pea export"'
    )
    try:
        resp = requests.get(
            "https://newsapi.org/v2/everything",
            params={"q": query, "language": "en", "sortBy": "publishedAt", "pageSize": 30},
            headers={"X-Api-Key": key},
            timeout=15,
        )
        data = resp.json()
        articles = []
        for item in data.get("articles", []):
            url = item.get("url", "")
            title = item.get("title", "")
            if not url or not title or url in seen_urls or "[Removed]" in title:
                continue
            published_str = item.get("publishedAt", "")
            try:
                published = datetime.strptime(published_str, "%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                published = datetime.utcnow()

            content = (item.get("description") or "") + " " + (item.get("content") or "")
            content = content[:1500]
            seen_urls.add(url)
            articles.append({
                "url": url,
                "title": title,
                "source": item.get("source", {}).get("name", "NewsAPI"),
                "published_at": published,
                "content": content,
            })
        return articles
    except Exception as e:
        logger.warning(f"NewsAPI fetch failed: {e}")
        return []


def fetch_all_feeds() -> list[dict]:
    rss_articles = fetch_rss_feeds()
    seen = {a["url"] for a in rss_articles}
    api_articles = fetch_newsapi(seen)
    return rss_articles + api_articles
