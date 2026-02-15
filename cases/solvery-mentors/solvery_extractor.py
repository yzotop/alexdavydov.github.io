#!/usr/bin/env python3
"""Solvery mentors extractor.

Reads the detected endpoint from ``detected_endpoint.txt``, automatically
detects the pagination strategy, iterates through all pages to extract every
mentor, normalises the data, performs validation, and saves results to JSON
and CSV.
"""

from __future__ import annotations

import csv
import json
import logging
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final, TypedDict
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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
# Constants — paths
# ---------------------------------------------------------------------------

_PROJECT_DIR: Final[Path] = Path(__file__).resolve().parent

ENDPOINT_FILE: Final[Path] = _PROJECT_DIR / "detected_endpoint.txt"
RAW_JSON_FILE: Final[Path] = _PROJECT_DIR / "solvery_mentors_raw.json"
CSV_FILE: Final[Path] = _PROJECT_DIR / "solvery_mentors.csv"

# ---------------------------------------------------------------------------
# Constants — network
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT: Final[int] = 30
DELAY_MIN: Final[float] = 0.5
DELAY_MAX: Final[float] = 1.0
MAX_RETRIES: Final[int] = 3
RETRY_BACKOFF: Final[float] = 1.0
MAX_EMPTY_STREAK: Final[int] = 3

RETRY_STATUS_CODES: Final[tuple[int, ...]] = (429, 500, 502, 503, 504)

USER_AGENT: Final[str] = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# ---------------------------------------------------------------------------
# Constants — schema
# ---------------------------------------------------------------------------

CSV_COLUMNS: Final[tuple[str, ...]] = (
    "mentor_id",
    "slug",
    "profile_url",
    "name",
    "title",
    "company",
    "city",
    "timezone",
    "price",
    "currency",
    "reviews_count",
    "sessions_count",
    "categories",
    "skills",
)

# ---------------------------------------------------------------------------
# Constants — heuristics
# ---------------------------------------------------------------------------

_MIN_MENTOR_FIELDS_MATCH: Final[int] = 3
_MIN_MENTOR_LIST_LEN: Final[int] = 1  # single-item last pages are valid

_MENTOR_HEURISTIC_KEYS: Final[frozenset[str]] = frozenset(
    {"name", "slug", "id", "title", "price", "skills", "categories"}
)

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
# Pagination detection
# ---------------------------------------------------------------------------


class PaginationType:
    """Supported pagination strategies."""

    PAGE: Final[str] = "page"
    OFFSET_LIMIT: Final[str] = "offset_limit"
    CURSOR: Final[str] = "cursor"


@dataclass(frozen=True)
class PaginationConfig:
    """Detected pagination configuration for the API endpoint."""

    kind: str
    page_param: str = "page"
    offset_param: str = "offset"
    limit_param: str = "limit"
    cursor_param: str = "cursor"
    limit_value: int = 20
    start_page: int = 1
    start_offset: int = 0
    nested_key: str = ""  # If non-empty, pagination params live inside body[nested_key]


def detect_pagination(query_params: dict[str, list[str]]) -> PaginationConfig:
    """Detect pagination type from URL query parameters.

    Checks for cursor-based, offset+limit, and page-based patterns in that
    order, falling back to page-based pagination as default.
    """
    param_keys = {k.lower() for k in query_params}

    # Cursor-based pagination
    cursor_names = {"cursor", "after", "next_cursor", "start_after"}
    if param_keys & cursor_names:
        cursor_key = (param_keys & cursor_names).pop()
        original = next(k for k in query_params if k.lower() == cursor_key)
        return PaginationConfig(kind=PaginationType.CURSOR, cursor_param=original)

    # Offset + limit pagination
    if "offset" in param_keys or "skip" in param_keys:
        offset_key = "offset" if "offset" in param_keys else "skip"
        original_offset = next(k for k in query_params if k.lower() == offset_key)
        original_limit = "limit"
        for candidate in ("limit", "count", "size", "per_page", "pageSize"):
            if candidate.lower() in param_keys:
                original_limit = next(k for k in query_params if k.lower() == candidate.lower())
                break
        limit_val = int(query_params.get(original_limit, ["20"])[0])
        start_offset = int(query_params.get(original_offset, ["0"])[0])
        return PaginationConfig(
            kind=PaginationType.OFFSET_LIMIT,
            offset_param=original_offset,
            limit_param=original_limit,
            limit_value=limit_val,
            start_offset=start_offset,
        )

    # Page-based pagination
    page_names = {"page", "p", "pagenum", "page_num", "pagenumber"}
    if param_keys & page_names:
        page_key = (param_keys & page_names).pop()
        original = next(k for k in query_params if k.lower() == page_key)
        start = int(query_params.get(original, ["1"])[0])
        limit_val = 20
        for candidate in ("limit", "per_page", "pageSize", "size", "count"):
            if candidate.lower() in param_keys:
                lk = next(k for k in query_params if k.lower() == candidate.lower())
                limit_val = int(query_params.get(lk, ["20"])[0])
                break
        return PaginationConfig(
            kind=PaginationType.PAGE,
            page_param=original,
            limit_value=limit_val,
            start_page=start,
        )

    # Default: page-based
    return PaginationConfig(kind=PaginationType.PAGE)


def _detect_body_pagination(body: dict[str, Any]) -> PaginationConfig:
    """Detect pagination strategy from POST JSON body keys.

    Inspects the body dict for known pagination key patterns and returns
    a matching ``PaginationConfig``.  Also checks for a nested
    ``pagination`` sub-dict (e.g. Solvery uses ``body.pagination.page``).
    """
    # --- Check for a nested "pagination" sub-dict first ---
    _PAGINATION_WRAPPER_KEYS = ("pagination", "paging", "page_info")  # noqa: N806
    for wrapper_key in _PAGINATION_WRAPPER_KEYS:
        wrapper = body.get(wrapper_key)
        if isinstance(wrapper, dict) and wrapper:
            nested = _detect_flat_pagination_keys(wrapper)
            if nested is not None:
                return PaginationConfig(
                    kind=nested.kind,
                    page_param=nested.page_param,
                    offset_param=nested.offset_param,
                    limit_param=nested.limit_param,
                    cursor_param=nested.cursor_param,
                    limit_value=nested.limit_value,
                    start_page=nested.start_page,
                    start_offset=nested.start_offset,
                    nested_key=wrapper_key,
                )

    # --- Fallback: inspect top-level keys ---
    result = _detect_flat_pagination_keys(body)
    if result is not None:
        return result

    # Default: add a "page" key for pagination
    return PaginationConfig(kind=PaginationType.PAGE, page_param="page")


def _detect_flat_pagination_keys(d: dict[str, Any]) -> PaginationConfig | None:
    """Detect pagination from the keys of a flat dict.

    Returns ``None`` if no recognisable pagination keys are found.
    """
    key_map: dict[str, str] = {k.lower(): k for k in d}
    lower_keys = set(key_map.keys())

    # Cursor-based
    cursor_names = {"cursor", "after", "next_cursor"}
    found = lower_keys & cursor_names
    if found:
        original = key_map[found.pop()]
        return PaginationConfig(kind=PaginationType.CURSOR, cursor_param=original)

    # Offset + limit
    offset_names = {"offset", "skip"}
    found = lower_keys & offset_names
    if found:
        original_offset = key_map[found.pop()]
        original_limit = "limit"
        for cand in ("limit", "count", "size", "perpage", "pagesize"):
            if cand in lower_keys:
                original_limit = key_map[cand]
                break
        raw_limit = d.get(original_limit, 20)
        raw_offset = d.get(original_offset, 0)
        return PaginationConfig(
            kind=PaginationType.OFFSET_LIMIT,
            offset_param=original_offset,
            limit_param=original_limit,
            limit_value=int(raw_limit) if isinstance(raw_limit, (int, float)) else 20,
            start_offset=int(raw_offset) if isinstance(raw_offset, (int, float)) else 0,
        )

    # Page-based
    page_names = {"page", "p", "pagenum", "pagenumber"}
    found = lower_keys & page_names
    if found:
        original = key_map[found.pop()]
        raw_start = d.get(original, 1)
        limit_val: int = 20
        limit_key = "limit"
        for cand in ("limit", "perpage", "pagesize", "size", "count"):
            if cand in lower_keys:
                limit_key = key_map[cand]
                raw_lv = d.get(limit_key, 20)
                limit_val = int(raw_lv) if isinstance(raw_lv, (int, float)) else 20
                break
        return PaginationConfig(
            kind=PaginationType.PAGE,
            page_param=original,
            limit_param=limit_key,
            limit_value=limit_val,
            start_page=int(raw_start) if isinstance(raw_start, (int, float)) else 1,
        )

    return None


# ---------------------------------------------------------------------------
# HTTP session with retries
# ---------------------------------------------------------------------------


def build_session() -> requests.Session:
    """Build an HTTP session with retry strategy and standard headers."""
    session = requests.Session()
    retry_strategy = Retry(
        total=MAX_RETRIES,
        backoff_factor=RETRY_BACKOFF,
        status_forcelist=list(RETRY_STATUS_CODES),
        allowed_methods=["GET", "POST"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://solvery.io/ru/mentors",
            "Origin": "https://solvery.io",
        }
    )
    return session


# ---------------------------------------------------------------------------
# Mentor list finder (flat-list heuristic, same as detect_endpoint.py)
# ---------------------------------------------------------------------------


def _looks_like_mentor(obj: dict[str, Any]) -> bool:
    """Return *True* if *obj* has enough keys to resemble a mentor record."""
    return len(_MENTOR_HEURISTIC_KEYS & obj.keys()) >= _MIN_MENTOR_FIELDS_MATCH


def find_mentor_list(payload: object) -> list[dict[str, Any]] | None:
    """Recursively search *payload* for a list of mentor-like dicts."""
    if (
        isinstance(payload, list)
        and len(payload) >= _MIN_MENTOR_LIST_LEN
        and all(isinstance(item, dict) for item in payload[:5])
        and all(_looks_like_mentor(item) for item in payload[: min(3, len(payload))])
    ):
        return payload
    if isinstance(payload, dict):
        for value in payload.values():
            result = find_mentor_list(value)
            if result is not None:
                return result
    return None


# ---------------------------------------------------------------------------
# Normalised-entity helpers (result.entities[*].mentorProfile structure)
# ---------------------------------------------------------------------------


def _extract_entities(data: object) -> list[dict[str, Any]] | None:
    """Extract entities from a Solvery-style ``result.entities`` structure.

    Returns a list of entity dicts or ``None`` if the structure does not match.
    """
    if isinstance(data, dict):
        result = data.get("result")
        if isinstance(result, dict):
            entities = result.get("entities")
            if isinstance(entities, list) and entities:
                return [e for e in entities if isinstance(e, dict)]
    return None


def _flatten_entity(entity: dict[str, Any]) -> dict[str, Any]:
    """Merge entity top-level fields with ``mentorProfile`` sub-dict.

    Profile keys are added to the merged dict only when not already present
    at the top level, preserving entity-level ``id``, ``firstName``, etc.
    The original ``mentorProfile`` key is kept for downstream lookups.
    """
    merged: dict[str, Any] = dict(entity)
    profile = entity.get("mentorProfile")
    if isinstance(profile, dict):
        for k, v in profile.items():
            if k not in merged:
                merged[k] = v
    return merged


# ---------------------------------------------------------------------------
# Cursor / total helpers
# ---------------------------------------------------------------------------


def find_cursor_value(payload: object) -> str | None:
    """Try to find a next-cursor value in *payload*."""
    if isinstance(payload, dict):
        for key in ("cursor", "next_cursor", "after", "nextCursor", "endCursor"):
            if key in payload:
                val = payload[key]
                if val is not None:
                    return str(val)
        for key in ("meta", "pagination", "paging", "page_info", "pageInfo"):
            if key in payload and isinstance(payload[key], dict):
                result = find_cursor_value(payload[key])
                if result is not None:
                    return result
    return None


def find_total_count(payload: object) -> int | None:
    """Try to find a total-count value in *payload*.

    Recurses into common wrapper keys including ``result`` (used by Solvery).
    """
    if isinstance(payload, dict):
        for key in ("total", "totalCount", "total_count", "count", "totalItems"):
            if key in payload and isinstance(payload[key], (int, float)):
                return int(payload[key])
        for key in ("meta", "pagination", "paging", "result"):
            if key in payload and isinstance(payload[key], dict):
                result = find_total_count(payload[key])
                if result is not None:
                    return result
    return None


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------


def safe_get(d: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """Try multiple dot-separated key paths, return the first non-``None`` value."""
    for key in keys:
        parts = key.split(".")
        current: Any = d
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                current = None
                break
        if current is not None:
            return current
    return default


def list_to_csv_string(value: Any) -> str:
    """Convert a list of items (dicts or strings) to a comma-separated string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            if isinstance(item, dict):
                name = item.get("name") or item.get("title") or item.get("label") or str(item)
                items.append(str(name))
            else:
                items.append(str(item))
        return ", ".join(items)
    return str(value)


def _extract_price_and_currency(raw: dict[str, Any]) -> tuple[Any, Any]:
    """Extract price and currency from the raw mentor dict.

    Handles the Solvery ``services.mentoring.rate / currency`` nesting as well
    as simpler top-level ``price`` / ``currency`` patterns.
    """
    # Try Solvery services.mentoring structure first
    services = raw.get("services")
    if isinstance(services, dict):
        mentoring = services.get("mentoring")
        if isinstance(mentoring, dict):
            rate = mentoring.get("rate")
            currency = mentoring.get("currency")
            if rate is not None:
                return rate, currency or ""

    # Try mentorProfile.services path (entity was flattened)
    mp = raw.get("mentorProfile")
    if isinstance(mp, dict):
        mp_services = mp.get("services")
        if isinstance(mp_services, dict):
            mp_mentoring = mp_services.get("mentoring")
            if isinstance(mp_mentoring, dict):
                rate = mp_mentoring.get("rate")
                currency = mp_mentoring.get("currency")
                if rate is not None:
                    return rate, currency or ""

    # Generic fallback
    price_raw = safe_get(
        raw,
        "price",
        "pricePerHour",
        "price_per_hour",
        "hourlyRate",
        "mentorProfile.price",
        default=None,
    )
    if isinstance(price_raw, dict):
        return (
            price_raw.get("amount") or price_raw.get("value") or price_raw.get("price"),
            price_raw.get("currency") or price_raw.get("currencyCode") or "",
        )
    currency = safe_get(raw, "currency", "currencyCode", "price_currency", default="")
    return price_raw, currency


def _extract_statistics(raw: dict[str, Any]) -> tuple[Any, Any]:
    """Extract sessions_count and reviews_count from the statistics sub-dict.

    Handles Solvery ``statistics.sessions.count`` /
    ``statistics.reviews.count`` nesting.
    """
    stats = safe_get(raw, "statistics", "mentorProfile.statistics", default=None)
    if isinstance(stats, dict):
        sessions_sub = stats.get("sessions")
        reviews_sub = stats.get("reviews")
        sessions_count: Any = None
        reviews_count: Any = None
        if isinstance(sessions_sub, dict):
            sessions_count = sessions_sub.get("count")
        if isinstance(reviews_sub, dict):
            reviews_count = reviews_sub.get("count")
        return sessions_count, reviews_count
    return None, None


def normalise_mentor(raw: dict[str, Any]) -> dict[str, Any]:
    """Extract and normalise target fields from a raw mentor dict.

    Handles both flat mentor objects and Solvery's nested entity structure
    (``entity → mentorProfile``).
    """
    mentor_id = safe_get(raw, "id", "mentor_id", "userId", "user_id", default="")
    slug = safe_get(raw, "slug", "username", default="")
    profile_url = f"https://solvery.io/ru/mentor/{slug}" if slug else ""

    # Name: try direct name, then firstName + lastName
    name = safe_get(raw, "name", "displayName", "fullName", "full_name", default="")
    if not name:
        first = safe_get(raw, "firstName", "first_name", default="")
        last = safe_get(raw, "lastName", "last_name", default="")
        if first or last:
            name = f"{first or ''} {last or ''}".strip()

    title = safe_get(
        raw,
        "title",
        "headline",
        "position",
        "jobTitle",
        "mentorProfile.position",
        "mentorProfile.title",
        default="",
    )

    # Company may be a dict with a "name" key (Solvery)
    company_raw = safe_get(
        raw,
        "company",
        "companyName",
        "company_name",
        "organization",
        "mentorProfile.company",
        default="",
    )
    if isinstance(company_raw, dict):
        company: Any = company_raw.get("name") or company_raw.get("title") or ""
    else:
        company = company_raw

    city = safe_get(
        raw,
        "city",
        "location",
        "cityName",
        "city_name",
        "geolocation.city",
        default="",
    )
    timezone = safe_get(
        raw,
        "timezone",
        "tz",
        "timeZone",
        "geolocation.timezone",
        default="",
    )

    # Price + currency
    price, currency = _extract_price_and_currency(raw)

    # Sessions + reviews (prefer statistics sub-dict, then fallback)
    stat_sessions, stat_reviews = _extract_statistics(raw)

    reviews_count: Any = stat_reviews
    if reviews_count is None:
        reviews_count = safe_get(
            raw,
            "reviews_count",
            "reviewsCount",
            "reviewCount",
            "reviews",
            "mentorProfile.reviewsCount",
            default=None,
        )
    if isinstance(reviews_count, list):
        reviews_count = len(reviews_count)
    elif isinstance(reviews_count, dict):
        reviews_count = None

    sessions_count: Any = stat_sessions
    if sessions_count is None:
        sessions_count = safe_get(
            raw,
            "sessions_count",
            "sessionsCount",
            "sessionCount",
            "completedSessions",
            "completed_sessions",
            "mentorProfile.sessionsCount",
            default=None,
        )
    if isinstance(sessions_count, list):
        sessions_count = len(sessions_count)
    elif isinstance(sessions_count, dict):
        sessions_count = None

    # Convert float session counts (e.g. 542.75) to int
    if isinstance(sessions_count, float):
        sessions_count = int(sessions_count)

    categories_raw = safe_get(
        raw,
        "categories",
        "category",
        "mentorProfile.categories",
        default=[],
    )
    skills_raw = safe_get(
        raw,
        "skills",
        "skill",
        "technologies",
        "tech_stack",
        "tags",
        "mentorProfile.tags",
        "mentorProfile.skills",
        default=[],
    )

    return {
        "mentor_id": str(mentor_id) if mentor_id else "",
        "slug": str(slug),
        "profile_url": profile_url,
        "name": str(name) if name else "",
        "title": str(title) if title else "",
        "company": str(company) if company else "",
        "city": str(city) if city else "",
        "timezone": str(timezone) if timezone else "",
        "price": price if price is not None else "",
        "currency": str(currency) if currency else "",
        "reviews_count": reviews_count if reviews_count is not None else "",
        "sessions_count": sessions_count if sessions_count is not None else "",
        "categories": list_to_csv_string(categories_raw),
        "skills": list_to_csv_string(skills_raw),
    }


# ---------------------------------------------------------------------------
# Polite delay helper
# ---------------------------------------------------------------------------


def _polite_delay() -> None:
    """Sleep for a random interval between DELAY_MIN and DELAY_MAX."""
    time.sleep(DELAY_MIN + random.random() * (DELAY_MAX - DELAY_MIN))


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def extract_all_mentors() -> list[dict[str, Any]]:  # noqa: PLR0912, PLR0915
    """Read endpoint config, detect pagination, fetch all pages, return raw mentors.

    Stops after ``MAX_EMPTY_STREAK`` consecutive empty responses or when
    the server-reported total is reached.
    """
    if not ENDPOINT_FILE.exists():
        log.error("Endpoint file not found: %s", ENDPOINT_FILE)
        log.error("Run detect_endpoint.py first.")
        sys.exit(1)

    endpoint_raw: dict[str, Any] = json.loads(ENDPOINT_FILE.read_text(encoding="utf-8"))
    base_url: str = endpoint_raw["base_url"]
    full_url: str = endpoint_raw["full_url"]
    method: str = str(endpoint_raw.get("method", "GET")).upper()
    query_params: dict[str, list[str]] = endpoint_raw.get("query_params", {})

    # New fields persisted by detect_endpoint.py
    json_body_raw: Any = endpoint_raw.get("json_body")
    json_body: dict[str, Any] | None = json_body_raw if isinstance(json_body_raw, dict) else None
    headers_raw: Any = endpoint_raw.get("replay_headers")
    replay_headers: dict[str, str] = headers_raw if isinstance(headers_raw, dict) else {}

    is_post = method == "POST"

    # Fallback: if method is POST but no captured body, use an empty dict
    # so pagination keys can be injected into the POST body.
    if is_post and json_body is None:
        log.info("POST method detected but no json_body captured; using empty body.")
        json_body = {}

    log.info("Base URL:    %s", base_url)
    log.info("Full URL:    %s", full_url)
    log.info("Method:      %s", method)
    log.info("Params:      %s", json.dumps(query_params, ensure_ascii=False))
    if is_post and json_body is not None:
        log.info("POST body:   %s", json.dumps(json_body, ensure_ascii=False)[:200])
    if replay_headers:
        log.info("Replay hdrs: %s", list(replay_headers.keys()))

    # Detect pagination from body (POST) or URL params (GET)
    if is_post and isinstance(json_body, dict):
        pagination = _detect_body_pagination(json_body)
    else:
        pagination = detect_pagination(query_params)
    log.info("Pagination:  %s", pagination.kind)

    session = build_session()
    all_mentors_raw: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    page_num: int = 0
    empty_streak: int = 0

    # For GET: build static params excluding pagination keys
    static_params: dict[str, str] = {}
    if not is_post:
        pagination_keys = {
            pagination.page_param,
            pagination.offset_param,
            pagination.limit_param,
            pagination.cursor_param,
        }
        for k, v_list in query_params.items():
            if k.lower() not in {pk.lower() for pk in pagination_keys}:
                static_params[k] = v_list[0] if v_list else ""

    cursor_value: str | None = None

    while True:
        page_num += 1
        progress = ""
        request_body: dict[str, Any] | None = None
        get_url: str = full_url

        if is_post and isinstance(json_body, dict):
            # ---- POST pagination: apply to JSON body ----
            request_body = json.loads(json.dumps(json_body))  # deep copy

            # Resolve the dict where pagination keys live
            if pagination.nested_key:
                request_body.setdefault(pagination.nested_key, {})
                pag_target: dict[str, Any] = request_body[pagination.nested_key]
            else:
                pag_target = request_body

            if pagination.kind == PaginationType.PAGE:
                current_page = pagination.start_page + page_num - 1
                pag_target[pagination.page_param] = current_page
                if pagination.limit_param in pag_target:
                    pag_target[pagination.limit_param] = pagination.limit_value
                progress = f"page={current_page}"

            elif pagination.kind == PaginationType.OFFSET_LIMIT:
                current_offset = pagination.start_offset + (page_num - 1) * pagination.limit_value
                pag_target[pagination.offset_param] = current_offset
                pag_target[pagination.limit_param] = pagination.limit_value
                progress = f"offset={current_offset}"

            elif pagination.kind == PaginationType.CURSOR:
                if page_num == 1:
                    # Use original body as-is for first request
                    pass
                else:
                    if cursor_value is None:
                        log.info("No more cursor. Stopping.")
                        break
                    pag_target[pagination.cursor_param] = cursor_value
                progress = f"cursor={cursor_value or 'initial'}"

            else:
                progress = f"iter={page_num}"

        else:
            # ---- GET pagination: apply to URL query params ----
            params: dict[str, str] = dict(static_params)

            if pagination.kind == PaginationType.PAGE:
                current_page = pagination.start_page + page_num - 1
                params[pagination.page_param] = str(current_page)
                if pagination.limit_param in query_params:
                    params[pagination.limit_param] = str(pagination.limit_value)
                progress = f"page={current_page}"

            elif pagination.kind == PaginationType.OFFSET_LIMIT:
                current_offset = pagination.start_offset + (page_num - 1) * pagination.limit_value
                params[pagination.offset_param] = str(current_offset)
                params[pagination.limit_param] = str(pagination.limit_value)
                progress = f"offset={current_offset}"

            elif pagination.kind == PaginationType.CURSOR:
                if page_num == 1:
                    if pagination.cursor_param in query_params:
                        params[pagination.cursor_param] = query_params[pagination.cursor_param][0]
                else:
                    if cursor_value is None:
                        log.info("No more cursor. Stopping.")
                        break
                    params[pagination.cursor_param] = cursor_value
                progress = f"cursor={cursor_value or 'initial'}"

            else:
                progress = f"iter={page_num}"

            get_url = f"{base_url}?{urlencode(params)}" if params else base_url

        log.info(
            "Request #%d (%s)  %s %s",
            page_num,
            progress,
            method,
            full_url if is_post else get_url,
        )

        try:
            if is_post and request_body is not None:
                resp = session.post(
                    full_url,
                    json=request_body,
                    headers=replay_headers,
                    timeout=REQUEST_TIMEOUT,
                )
            else:
                resp = session.get(get_url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
        except requests.exceptions.RequestException as exc:
            log.warning("Request failed: %s", exc)
            empty_streak += 1
            if empty_streak >= MAX_EMPTY_STREAK:
                log.warning("%d consecutive failures. Stopping.", MAX_EMPTY_STREAK)
                break
            _polite_delay()
            continue

        try:
            data = resp.json()
        except json.JSONDecodeError:
            log.warning("Non-JSON response. Stopping.")
            break

        # ----- Extract mentors from response -----
        # Strategy 1: Solvery normalised entities (result.entities[*].mentorProfile)
        entities = _extract_entities(data)
        if entities is not None:
            # Keep only entities that have a mentorProfile sub-dict
            with_profile = [
                _flatten_entity(e) for e in entities if isinstance(e.get("mentorProfile"), dict)
            ]
            mentors_page = with_profile or entities
        else:
            # Strategy 2: flat mentor list heuristic
            flat_list = find_mentor_list(data)
            mentors_page = list(flat_list) if flat_list else []

        if not mentors_page:
            empty_streak += 1
            log.info("No mentors found (empty streak: %d/%d)", empty_streak, MAX_EMPTY_STREAK)
            if empty_streak >= MAX_EMPTY_STREAK:
                log.info("Reached end of data.")
                break
            _polite_delay()
            continue

        empty_streak = 0
        new_count = 0
        for mentor in mentors_page:
            mid = str(mentor.get("id", mentor.get("mentor_id", mentor.get("slug", ""))))
            if mid and mid in seen_ids:
                continue
            if mid:
                seen_ids.add(mid)
            all_mentors_raw.append(mentor)
            new_count += 1

        total_count = find_total_count(data)
        total_str = f"/{total_count}" if total_count else ""
        log.info(
            "Got %d mentors, %d new. Total collected: %d%s",
            len(mentors_page),
            new_count,
            len(all_mentors_raw),
            total_str,
        )

        if pagination.kind == PaginationType.CURSOR:
            cursor_value = find_cursor_value(data)
            if cursor_value is None:
                log.info("No next cursor in response. Done.")
                break

        if total_count and len(all_mentors_raw) >= total_count:
            log.info("Reached total (%d). Done.", total_count)
            break

        _polite_delay()

    return all_mentors_raw


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate(mentors: list[dict[str, Any]]) -> None:
    """Print a validation summary for the extracted mentor dataset."""
    total = len(mentors)
    if total == 0:
        log.warning("No mentors to validate.")
        return

    ids = [m["mentor_id"] for m in mentors]
    duplicate_ids = len(ids) - len(set(ids))

    missing_price = sum(1 for m in mentors if m["price"] in ("", None))
    missing_sessions = sum(1 for m in mentors if m["sessions_count"] in ("", None))
    missing_reviews = sum(1 for m in mentors if m["reviews_count"] in ("", None))

    sep = "=" * 60
    report = (
        f"\n{sep}\n"
        f"  DATA VALIDATION REPORT\n"
        f"{sep}\n"
        f"  Total mentors:           {total}\n"
        f"  Duplicate mentor_ids:    {duplicate_ids}\n"
        f"  % missing price:         {missing_price / total * 100:.1f}%"
        f"  ({missing_price}/{total})\n"
        f"  % missing sessions:      {missing_sessions / total * 100:.1f}%"
        f"  ({missing_sessions}/{total})\n"
        f"  % missing reviews:       {missing_reviews / total * 100:.1f}%"
        f"  ({missing_reviews}/{total})\n"
        f"{sep}"
    )
    log.info(report)


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------


def save_results(
    raw_mentors: list[dict[str, Any]],
    normalised: list[dict[str, Any]],
) -> None:
    """Save raw JSON and normalised CSV to disk."""
    RAW_JSON_FILE.write_text(
        json.dumps(raw_mentors, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info("Raw JSON saved to %s  (%d records)", RAW_JSON_FILE, len(raw_mentors))

    with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(CSV_COLUMNS), extrasaction="ignore")
        writer.writeheader()
        for mentor in normalised:
            writer.writerow(mentor)
    log.info("CSV saved to %s  (%d records)", CSV_FILE, len(normalised))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Run the full extraction pipeline: fetch → normalise → save → validate."""
    sep = "=" * 60
    log.info("\n%s\n  Solvery Mentors Extractor\n%s", sep, sep)

    raw_mentors = extract_all_mentors()

    if not raw_mentors:
        log.error("No mentors extracted. Exiting.")
        sys.exit(1)

    log.info("Normalising %d mentors …", len(raw_mentors))
    normalised = [normalise_mentor(m) for m in raw_mentors]

    save_results(raw_mentors, normalised)
    validate(normalised)


if __name__ == "__main__":
    main()
