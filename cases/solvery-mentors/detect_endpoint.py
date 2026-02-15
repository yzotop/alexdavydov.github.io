#!/usr/bin/env python3
"""Detect the Solvery mentors API endpoint via Playwright network interception.

Opens the Solvery mentors catalog page, clicks the "Показать еще" button,
intercepts JSON responses containing mentor data, and saves the best
endpoint configuration to ``detected_endpoint.txt``.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final, Optional, TypedDict
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, Response, sync_playwright

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log: Final = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants — network & timing
# ---------------------------------------------------------------------------

CATALOG_URL: Final[str] = "https://solvery.io/ru/mentors"
OUTPUT_FILE: Final[Path] = Path(__file__).resolve().parent / "detected_endpoint.txt"
HEADLESS: Final[bool] = False

PAGE_LOAD_TIMEOUT_MS: Final[int] = 90_000
BUTTON_VISIBILITY_TIMEOUT_MS: Final[int] = 3_000

POST_NAVIGATION_WAIT_MS: Final[int] = 1_500
DYNAMIC_CONTENT_WAIT_S: Final[float] = 3.0
PRE_CLICK_WAIT_S: Final[float] = 0.5
POST_CLICK_WAIT_S: Final[float] = 5.0
SCROLL_WAIT_S: Final[float] = 3.0
FINAL_WAIT_S: Final[float] = 3.0
SCROLL_ATTEMPTS: Final[int] = 3

DEBUG_DUMP_DIR: Final[str] = "debug_json"

USER_AGENT: Final[str] = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Headers to capture from the browser request for replay.
_REPLAY_HEADER_NAMES: Final[tuple[str, ...]] = (
    "content-type",
    "accept",
    "user-agent",
    "origin",
    "referer",
)

# ---------------------------------------------------------------------------
# Constants — heuristics
# ---------------------------------------------------------------------------

_MIN_MENTOR_FIELDS_MATCH: Final[int] = 3
_MIN_MENTOR_LIST_LEN: Final[int] = 2
_MIN_MENTOR_PROFILE_COUNT: Final[int] = 5
_MAX_RECURSION_DEPTH: Final[int] = 12

_MENTOR_HEURISTIC_KEYS: Final[frozenset[str]] = frozenset(
    {"name", "slug", "id", "title", "price", "skills", "categories"}
)

# Keys that identify a mentor profile when found in combination (any 2 of 3 groups).
_PROFILE_NAME_KEYS: Final[frozenset[str]] = frozenset(
    {"name", "fullName", "displayName", "full_name", "firstName"}
)
_PROFILE_SKILL_KEYS: Final[frozenset[str]] = frozenset(
    {"tags", "skills", "categories", "specializations"}
)
_PROFILE_PRICE_KEYS: Final[frozenset[str]] = frozenset(
    {"price", "rate", "pricePerHour", "hourlyRate", "price_per_hour", "services"}
)

LOAD_BUTTON_SELECTORS: Final[tuple[str, ...]] = (
    "text=Показать еще",
    "text=Показать ещё",
    "button:has-text('Показать ещ')",
    "button:has-text('Показать еще')",
    "button:has-text('Show more')",
    "[data-testid='show-more']",
)

_SKIP_URL_PATTERNS: Final[tuple[str, ...]] = (
    "analytics",
    "tracking",
    "google",
    "facebook",
    "hotjar",
    "sentry",
    "segment",
    "amplitude",
    ".js",
    ".css",
    ".svg",
    ".png",
    ".ico",
)

# URL fragments used for positive / negative filtering of candidate endpoints.
_MENTORS_LISTING_URL_FRAGMENT: Final[str] = "/api/mentoring/listing/get"
_COMPANIES_LIST_URL_FRAGMENT: Final[str] = "/api/mentoring/companies/get-list"

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class _EndpointInfoRequired(TypedDict):
    """Required fields of the endpoint configuration file."""

    base_url: str
    full_url: str
    method: str
    query_params: dict[str, list[str]]
    sample_fields: list[str]
    mentor_count_in_response: int
    response_structure: str


class EndpointInfo(_EndpointInfoRequired, total=False):
    """JSON schema for the detected endpoint configuration file.

    ``json_body`` and ``replay_headers`` are optional for backward
    compatibility with endpoint files generated before POST support.
    """

    json_body: dict[str, Any] | None
    replay_headers: dict[str, str]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CandidateEndpoint:
    """A detected candidate API endpoint that returned mentor-like data."""

    url: str
    method: str
    status: int
    mentor_count: int
    sample_fields: list[str]
    query_params: dict[str, list[str]]
    response_structure: str
    json_body: dict[str, Any] | None = None
    replay_headers: dict[str, str] = field(default_factory=dict)

    def base_url(self) -> str:
        """Return the URL stripped of query parameters."""
        parsed = urlparse(self.url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

    def is_mentors_listing(self) -> bool:
        """Return *True* if this URL looks like the primary mentors listing endpoint."""
        return _MENTORS_LISTING_URL_FRAGMENT in self.url


# ---------------------------------------------------------------------------
# Heuristic helpers
# ---------------------------------------------------------------------------


def _looks_like_mentor(obj: dict[str, Any]) -> bool:
    """Return *True* if *obj* has enough keys to resemble a mentor record."""
    return len(_MENTOR_HEURISTIC_KEYS & obj.keys()) >= _MIN_MENTOR_FIELDS_MATCH


def _looks_like_mentor_profile(obj: dict[str, Any]) -> bool:
    """Return *True* if *obj* resembles a mentor profile (broader heuristic).

    Matches if the dict contains a ``mentorProfile`` sub-dict, or if it has
    keys from at least 2 of the 3 profile-key groups (name, skills, price).
    """
    if "mentorProfile" in obj and isinstance(obj["mentorProfile"], dict):
        return True
    groups_matched = sum(
        bool(obj.keys() & group)
        for group in (_PROFILE_NAME_KEYS, _PROFILE_SKILL_KEYS, _PROFILE_PRICE_KEYS)
    )
    return groups_matched >= 2  # noqa: PLR2004


def _count_mentor_profiles(payload: object, *, _depth: int = 0) -> int:
    """Recursively count objects that look like mentor profiles.

    Walks dicts and lists up to ``_MAX_RECURSION_DEPTH`` to avoid runaway
    recursion on deeply nested or cyclic-like structures.
    """
    if _depth > _MAX_RECURSION_DEPTH:
        return 0

    count = 0
    if isinstance(payload, dict):
        if _looks_like_mentor_profile(payload):
            count += 1
        for value in payload.values():
            count += _count_mentor_profiles(value, _depth=_depth + 1)
    elif isinstance(payload, list):
        for item in payload:
            count += _count_mentor_profiles(item, _depth=_depth + 1)
    return count


def _find_mentor_list(payload: object) -> list[dict[str, Any]] | None:
    """Recursively search *payload* for a list of mentor-like dicts."""
    if (
        isinstance(payload, list)
        and len(payload) >= _MIN_MENTOR_LIST_LEN
        and all(isinstance(item, dict) for item in payload[:5])
        and all(_looks_like_mentor(item) for item in payload[:3])
    ):
        return payload
    if isinstance(payload, dict):
        for value in payload.values():
            result = _find_mentor_list(value)
            if result is not None:
                return result
    return None


def _extract_sample_fields(payload: object) -> list[str]:
    """Best-effort extraction of top-level field names from the first entity."""
    if isinstance(payload, dict):
        # Try result.entities[0] path (Solvery listing/get shape)
        result = payload.get("result")
        if isinstance(result, dict):
            entities = result.get("entities")
            if isinstance(entities, list) and entities and isinstance(entities[0], dict):
                return [str(k) for k in entities[0]]
        # Try flat list
        for value in payload.values():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                return [str(k) for k in value[0]]
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        return [str(k) for k in payload[0]]
    return []


def _describe_structure(payload: object, depth: int = 0) -> str:
    """Return a compact string describing the top-level shape of *payload*."""
    max_depth = 2
    max_keys = 10
    if depth > max_depth:
        return "..."
    if isinstance(payload, dict):
        keys = list(payload.keys())[:max_keys]
        return "{" + ", ".join(str(k) for k in keys) + "}"
    if isinstance(payload, list):
        if payload:
            return f"[len={len(payload)}, item={_describe_structure(payload[0], depth + 1)}]"
        return "[]"
    return type(payload).__name__


# ---------------------------------------------------------------------------
# Request metadata extraction
# ---------------------------------------------------------------------------


def _extract_request_json_body(request: Any) -> dict[str, Any] | None:
    """Safely extract the JSON body from a Playwright Request if it is a POST."""
    if request.method.upper() != "POST":
        return None
    try:
        raw = request.post_data
        if raw:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
    except (ValueError, TypeError):
        pass
    return None


def _extract_replay_headers(request: Any) -> dict[str, str]:
    """Extract a small set of browser request headers useful for replay."""
    req_headers: dict[str, str] = request.headers  # Playwright returns lowercase keys
    replay: dict[str, str] = {}
    for hdr in _REPLAY_HEADER_NAMES:
        val = req_headers.get(hdr)
        if val:
            replay[hdr] = val
    return replay


# ---------------------------------------------------------------------------
# Browser helpers
# ---------------------------------------------------------------------------


def _try_click_show_more(page: Page) -> bool:
    """Try several selectors to click the 'Показать еще' button."""
    for selector in LOAD_BUTTON_SELECTORS:
        try:
            btn = page.locator(selector).first
            if btn.is_visible(timeout=BUTTON_VISIBILITY_TIMEOUT_MS):
                log.info("Found button with selector: %s", selector)
                btn.scroll_into_view_if_needed()
                time.sleep(PRE_CLICK_WAIT_S)
                btn.click()
                log.info("Clicked 'Показать еще'. Waiting for response …")
                time.sleep(POST_CLICK_WAIT_S)
                return True
        except PlaywrightError:
            continue
    return False


def _fallback_scroll(page: Page) -> None:
    """Scroll to the page bottom several times to trigger lazy-loading."""
    log.warning("Could not find 'Показать еще' button. Trying scroll-based loading …")
    for _ in range(SCROLL_ATTEMPTS):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(SCROLL_WAIT_S)


# ---------------------------------------------------------------------------
# Core detection
# ---------------------------------------------------------------------------

# (url, method, status, response_body, request_json_body, replay_headers)
_CapturedResponse = tuple[
    str, str, int, object, Optional[dict[str, Any]], dict[str, str]  # noqa: UP045
]


def _dump_captured_responses(captured: list[_CapturedResponse]) -> None:
    """Write every captured JSON response to *DEBUG_DUMP_DIR* for inspection."""
    dump_dir = Path(DEBUG_DUMP_DIR)
    dump_dir.mkdir(parents=True, exist_ok=True)

    index_lines: list[str] = []
    for i, (url, req_method, status, body, req_body, _headers) in enumerate(captured):
        payload: dict[str, object] = {
            "url": url,
            "method": req_method,
            "status": status,
            "request_body": req_body,
            "payload": body,
        }
        file_path = dump_dir / f"resp_{i:03d}.json"
        file_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
        index_lines.append(f"{i:03d}  {req_method}  {url}")

    (dump_dir / "index.txt").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    log.info("Debug dump written to %s/ (%d files).", DEBUG_DUMP_DIR, len(captured))


def _should_skip_url(url: str) -> bool:
    """Return *True* if the response URL should be excluded from candidates."""
    return _COMPANIES_LIST_URL_FRAGMENT in url


def detect_endpoints() -> list[CandidateEndpoint]:
    """Launch a browser, intercept network traffic, and return candidate endpoints."""
    candidates: list[CandidateEndpoint] = []
    captured: list[_CapturedResponse] = []

    def _on_response(response: Response) -> None:
        """Playwright response callback — capture JSON responses."""
        content_type = response.headers.get("content-type", "")
        if "json" not in content_type.lower():
            return
        url = response.url
        if any(pat in url.lower() for pat in _SKIP_URL_PATTERNS):
            return
        try:
            body: object = response.json()
        except (PlaywrightError, ValueError):
            log.debug("Could not parse JSON from %s", url)
            return

        req = response.request
        req_json_body = _extract_request_json_body(req)
        replay_headers = _extract_replay_headers(req)

        captured.append((url, req.method, response.status, body, req_json_body, replay_headers))

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        context = browser.new_context(user_agent=USER_AGENT, locale="ru-RU")
        page: Page = context.new_page()
        page.on("response", _on_response)

        # "networkidle" can hang indefinitely on sites with persistent
        # background connections (analytics, websockets).
        # Use "domcontentloaded" instead.
        log.info("Navigating to %s …", CATALOG_URL)
        page.goto(CATALOG_URL, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT_MS)
        page.wait_for_timeout(POST_NAVIGATION_WAIT_MS)
        log.info("Page loaded. Waiting for dynamic content …")
        time.sleep(DYNAMIC_CONTENT_WAIT_S)

        if not _try_click_show_more(page):
            _fallback_scroll(page)

        time.sleep(FINAL_WAIT_S)
        browser.close()

    log.info("Captured %d JSON responses. Analysing …", len(captured))
    _dump_captured_responses(captured)

    for url, method, status, body, req_json_body, replay_headers in captured:
        if _should_skip_url(url):
            log.debug("Skipping companies-list URL: %s", url)
            continue

        # --- Strategy 1: original flat-list heuristic ---
        mentor_count = 0
        sample: list[str] = []
        mentors = _find_mentor_list(body)
        if mentors is not None:
            mentor_count = len(mentors)
            sample = [str(k) for k in mentors[0]] if mentors else []

        # --- Strategy 2: count nested mentorProfile objects ---
        profile_count = _count_mentor_profiles(body)
        if profile_count > mentor_count:
            mentor_count = profile_count
            if not sample:
                sample = _extract_sample_fields(body)

        if mentor_count < _MIN_MENTOR_LIST_LEN:
            continue

        parsed = urlparse(url)
        candidates.append(
            CandidateEndpoint(
                url=url,
                method=method,
                status=status,
                mentor_count=mentor_count,
                sample_fields=sample,
                query_params=parse_qs(parsed.query),
                response_structure=_describe_structure(body),
                json_body=req_json_body,
                replay_headers=replay_headers,
            )
        )

    return candidates


# ---------------------------------------------------------------------------
# Candidate selection
# ---------------------------------------------------------------------------


def _select_best_candidate(candidates: list[CandidateEndpoint]) -> CandidateEndpoint:
    """Pick the best candidate, preferring the mentors listing endpoint."""
    # Prefer the known mentors listing URL if present among candidates.
    listing_candidates = [c for c in candidates if c.is_mentors_listing()]
    if listing_candidates:
        return max(listing_candidates, key=lambda ep: ep.mentor_count)
    # Fallback: highest mentor count.
    return max(candidates, key=lambda ep: ep.mentor_count)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Detect the Solvery API endpoint and persist the result."""
    candidates = detect_endpoints()

    if not candidates:
        log.error("No mentor endpoints detected.")
        log.error("Try running with HEADLESS=False and manually inspecting the page.")
        sys.exit(1)

    log.info("Detected %d candidate endpoint(s)", len(candidates))

    for i, c in enumerate(candidates, 1):
        log.info(
            "Candidate #%d  URL=%s  base=%s  method=%s  status=%d  "
            "mentors=%d  structure=%s  params=%s  fields=%s",
            i,
            c.url,
            c.base_url(),
            c.method,
            c.status,
            c.mentor_count,
            c.response_structure,
            json.dumps(c.query_params, ensure_ascii=False),
            c.sample_fields[:15],
        )

    best = _select_best_candidate(candidates)
    base = best.base_url()
    log.info("Best endpoint: %s  (full: %s)  method=%s", base, best.url, best.method)
    if best.json_body:
        log.info("POST body keys: %s", list(best.json_body.keys()))

    endpoint_info: EndpointInfo = {
        "base_url": base,
        "full_url": best.url,
        "method": best.method,
        "query_params": best.query_params,
        "sample_fields": best.sample_fields,
        "mentor_count_in_response": best.mentor_count,
        "response_structure": best.response_structure,
        "json_body": best.json_body,
        "replay_headers": best.replay_headers,
    }

    OUTPUT_FILE.write_text(
        json.dumps(endpoint_info, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    log.info("Saved to %s", OUTPUT_FILE)


if __name__ == "__main__":
    main()
