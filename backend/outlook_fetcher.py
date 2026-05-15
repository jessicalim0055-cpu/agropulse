"""
Microsoft Graph API integration for auto-fetching parity emails from Outlook.

Env vars required:
  AZURE_CLIENT_ID       — Application (client) ID from Azure portal
  AZURE_TENANT_ID       — Directory (tenant) ID from Azure portal
  PARITY_SENDER_EMAIL   — Email address to watch (e.g. priya@supplier.com)
  PARITY_SUBJECT_FILTER — Subject keyword to match (e.g. parity)
"""

import os
import re
import threading
import logging
import requests
import msal

logger = logging.getLogger(__name__)

SCOPES = ["Mail.Read"]
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
CACHE_FILE = os.path.join(os.path.dirname(__file__), "msal_cache.bin")

_token_cache = msal.SerializableTokenCache()
_auth_status: dict = {"status": "idle"}   # idle | pending | authenticated | failed
_active_flow: dict | None = None
_flow_lock = threading.Lock()


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            _token_cache.deserialize(f.read())


def _save_cache():
    if _token_cache.has_state_changed:
        with open(CACHE_FILE, "w") as f:
            f.write(_token_cache.serialize())


def _get_app() -> msal.PublicClientApplication:
    _load_cache()
    return msal.PublicClientApplication(
        client_id=os.getenv("AZURE_CLIENT_ID", ""),
        authority=f"https://login.microsoftonline.com/{os.getenv('AZURE_TENANT_ID', 'common')}",
        token_cache=_token_cache,
    )


# ── Token management ──────────────────────────────────────────────────────────

def get_token() -> str | None:
    """Return a valid access token from cache, silently refreshing if needed."""
    if not os.getenv("AZURE_CLIENT_ID"):
        return None
    app = _get_app()
    accounts = app.get_accounts()
    if not accounts:
        return None
    result = app.acquire_token_silent(SCOPES, account=accounts[0])
    if result and "access_token" in result:
        _save_cache()
        return result["access_token"]
    return None


def is_authenticated() -> bool:
    return get_token() is not None


def get_connected_email() -> str:
    """Return the email of the authenticated account, or empty string."""
    app = _get_app()
    accounts = app.get_accounts()
    if accounts:
        return accounts[0].get("username", "")
    return ""


def disconnect():
    """Remove cached tokens."""
    global _auth_status
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
    _token_cache.deserialize("{}")
    _auth_status = {"status": "idle"}


# ── Device code auth flow ─────────────────────────────────────────────────────

def _run_device_flow(app: msal.PublicClientApplication, flow: dict):
    """Background thread: polls until user completes auth or flow expires."""
    global _auth_status
    result = app.acquire_token_by_device_flow(flow)
    if "access_token" in result:
        _save_cache()
        email = get_connected_email()
        _auth_status = {"status": "authenticated", "email": email}
        logger.info(f"Outlook authenticated as {email}")
    else:
        err = result.get("error_description") or result.get("error") or "Authentication failed"
        _auth_status = {"status": "failed", "error": err}
        logger.error(f"Outlook auth failed: {err}")


def start_device_flow() -> dict:
    """Initiate device code flow. Returns user_code and verification_uri for display."""
    global _auth_status, _active_flow
    app = _get_app()
    if not os.getenv("AZURE_CLIENT_ID"):
        raise RuntimeError("AZURE_CLIENT_ID is not set in .env")

    with _flow_lock:
        flow = app.initiate_device_flow(scopes=SCOPES)
        if "user_code" not in flow:
            raise RuntimeError(flow.get("error_description", "Failed to start device flow"))
        _active_flow = flow
        _auth_status = {"status": "pending"}

    t = threading.Thread(target=_run_device_flow, args=(app, flow), daemon=True)
    t.start()

    return {
        "user_code": flow["user_code"],
        "verification_uri": flow["verification_uri"],
        "expires_in": flow.get("expires_in", 900),
    }


def get_auth_status() -> dict:
    """Return current auth status dict."""
    if _auth_status["status"] == "idle" and is_authenticated():
        return {"status": "authenticated", "email": get_connected_email()}
    return _auth_status


# ── Email fetching ────────────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fetch_parity_emails(already_seen_ids: set[str], days_back: int = 60) -> list[dict]:
    """
    Fetch emails from Graph API matching PARITY_SENDER_EMAIL and PARITY_SUBJECT_FILTER.
    Skips any message IDs already in already_seen_ids.
    Returns list of dicts with: id, subject, from_name, from_email, received, body
    """
    token = get_token()
    if not token:
        logger.warning("Outlook not authenticated — skipping sync")
        return []

    sender = os.getenv("PARITY_SENDER_EMAIL", "").strip()
    subject_kw = os.getenv("PARITY_SUBJECT_FILTER", "").strip().lower()

    if not sender:
        logger.warning("PARITY_SENDER_EMAIL not set — skipping sync")
        return []

    headers = {"Authorization": f"Bearer {token}"}

    # Graph API does not support $orderby with $filter on nested properties like
    # from/emailAddress/address — so we filter client-side and sort ourselves.
    params = {
        "$search": f'"from:{sender}"',
        "$top": 25,
        "$select": "id,subject,from,receivedDateTime,body",
    }

    try:
        resp = requests.get(
            f"{GRAPH_BASE}/me/messages",
            headers={**headers, "ConsistencyLevel": "eventual"},
            params=params,
            timeout=30,
        )
        if resp.status_code == 401:
            logger.error("Outlook token rejected — please re-authenticate")
            disconnect()
            return []
        if not resp.ok:
            logger.error(f"Graph API {resp.status_code}: {resp.text[:300]}")
            return []
    except Exception as e:
        logger.error(f"Graph API request failed: {e}")
        return []

    # Sort newest-first client-side
    messages = sorted(
        resp.json().get("value", []),
        key=lambda m: m.get("receivedDateTime", ""),
        reverse=True,
    )
    results = []

    for msg in messages:
        msg_id = msg.get("id", "")
        if msg_id in already_seen_ids:
            continue

        subject = msg.get("subject", "")
        if subject_kw and subject_kw not in subject.lower():
            continue

        body_obj = msg.get("body", {})
        raw_body = body_obj.get("content", "")
        body_text = _strip_html(raw_body) if body_obj.get("contentType") == "html" else raw_body

        from_obj = msg.get("from", {}).get("emailAddress", {})
        results.append({
            "id": msg_id,
            "subject": subject,
            "from_name": from_obj.get("name", ""),
            "from_email": from_obj.get("address", ""),
            "received": msg.get("receivedDateTime", ""),
            "body": body_text,
        })

    return results


LEFTFIELD_SENDER = "leftfield@leftfieldcr.com"

_PDF_MAGIC = b"%PDF"


def _find_and_download_pdf(body_html: str, subject: str) -> tuple[bytes | None, str]:
    """
    Parse HTML email body, extract all href links, find and download the PDF.
    Returns (pdf_bytes, filename) or (None, "").
    """
    # Extract all href values from the HTML
    links = re.findall(r'href=["\']([^"\'>\s]+)["\']', body_html, re.IGNORECASE)

    # Deduplicate while preserving order; skip mailto / anchor / tracking pixel urls
    seen_links: set[str] = set()
    external_links: list[str] = []
    for link in links:
        if link in seen_links:
            continue
        seen_links.add(link)
        if not link.startswith("http"):
            continue
        low = link.lower()
        if "unsubscribe" in low or "mailto" in low or "open.php" in low:
            continue
        external_links.append(link)

    # Priority 1: URLs that explicitly end with .pdf (before query string)
    pdf_first = [l for l in external_links if re.search(r"\.pdf($|\?|#)", l, re.IGNORECASE)]
    ordered = pdf_first + [l for l in external_links if l not in pdf_first]

    for url in ordered:
        try:
            resp = requests.get(url, timeout=20, allow_redirects=True,
                                headers={"User-Agent": "Mozilla/5.0"})
            if not resp.ok:
                continue
            content = resp.content
            # Detect PDF by magic bytes or Content-Type
            content_type = resp.headers.get("Content-Type", "").lower()
            if not (content[:4] == _PDF_MAGIC or "pdf" in content_type):
                continue
            # Derive filename from URL or Content-Disposition
            fname = ""
            cd = resp.headers.get("Content-Disposition", "")
            m = re.search(r'filename[^;=\n]*=["\']?([^"\';\n]+)', cd, re.IGNORECASE)
            if m:
                fname = m.group(1).strip()
            if not fname:
                fname = url.split("/")[-1].split("?")[0] or "report.pdf"
                if not fname.lower().endswith(".pdf"):
                    fname += ".pdf"
            logger.info(f"Leftfield: downloaded PDF '{fname}' from {url[:80]}")
            return content, fname
        except Exception as e:
            logger.debug(f"Leftfield link attempt failed ({url[:60]}): {e}")
            continue

    logger.warning(f"Leftfield: no downloadable PDF found in email '{subject}'")
    return None, ""


def fetch_leftfield_emails(already_seen_ids: set[str]) -> list[dict]:
    """
    Fetch emails from leftfield@leftfieldcr.com.
    Extracts the PDF download link from the email body and downloads the report.
    Returns list of dicts: id (prefixed), subject, received, attachment_name, attachment_bytes
    """
    token = get_token()
    if not token:
        logger.warning("Outlook not authenticated — skipping leftfield sync")
        return []

    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "$search": f'"from:{LEFTFIELD_SENDER}"',
        "$top": 25,
        "$select": "id,subject,receivedDateTime,body",
    }

    try:
        resp = requests.get(
            f"{GRAPH_BASE}/me/messages",
            headers={**headers, "ConsistencyLevel": "eventual"},
            params=params,
            timeout=30,
        )
        if resp.status_code == 401:
            logger.error("Outlook token rejected — please re-authenticate")
            disconnect()
            return []
        if not resp.ok:
            logger.error(f"Graph API {resp.status_code}: {resp.text[:300]}")
            return []
    except Exception as e:
        logger.error(f"Leftfield email fetch error: {e}")
        return []

    messages = sorted(
        resp.json().get("value", []),
        key=lambda m: m.get("receivedDateTime", ""),
        reverse=True,
    )

    results = []

    for msg in messages:
        msg_id = msg.get("id", "")
        lf_id = f"leftfield:{msg_id}"
        if lf_id in already_seen_ids:
            continue

        subject = msg.get("subject", "")
        received = msg.get("receivedDateTime", "")

        body_obj = msg.get("body", {})
        body_html = body_obj.get("content", "")
        if not body_html:
            logger.warning(f"Leftfield: empty body for email '{subject}' — skipping")
            continue

        pdf_bytes, fname = _find_and_download_pdf(body_html, subject)
        if pdf_bytes is None:
            continue

        results.append({
            "id": lf_id,
            "subject": subject,
            "received": received,
            "attachment_name": fname,
            "attachment_bytes": pdf_bytes,
        })

    return results


def get_config() -> dict:
    return {
        "configured": bool(os.getenv("AZURE_CLIENT_ID")),
        "sender": os.getenv("PARITY_SENDER_EMAIL", ""),
        "subject_filter": os.getenv("PARITY_SUBJECT_FILTER", ""),
    }
