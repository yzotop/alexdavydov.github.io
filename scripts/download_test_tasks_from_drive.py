#!/usr/bin/env python3
"""
Download test-task folders from Google Drive links listed in data/test-tasks.v1.json.

Usage:
    python3 scripts/download_test_tasks_from_drive.py           # full download
    python3 scripts/download_test_tasks_from_drive.py --dry-run # preview only

Requires: gdown (pip install gdown)
Output:   ~/data/public/davydov-my/test-tasks/raw/<folder_name>/
Log:      ~/data/public/davydov-my/test-tasks/download.log
"""

import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (relative to repo root)
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = REPO_ROOT / "data" / "test-tasks.v1.json"
DATA_ROOT = Path.home() / "data" / "public" / "davydov-my" / "test-tasks"
OUTPUT_DIR = DATA_ROOT / "raw"
LOG_PATH = DATA_ROOT / "download.log"

# ---------------------------------------------------------------------------
# Company / Position parsing (mirrors JS parseCompanyPosition)
# ---------------------------------------------------------------------------
ROLE_HEADS = {
    "аналитик", "analyst", "scientist", "ds", "engineer",
    "developer", "manager", "lead", "head", "researcher",
}
ROLE_MODS = {
    # RU
    "продуктовый", "продуктовая", "продуктовому", "данных", "дата",
    "маркетинговый", "бизнес", "коммерческий", "игровой", "старший", "ведущий",
    # EN
    "product", "data", "business", "marketing", "bi", "power",
    "web-mobile", "web", "mobile", "fraud", "risk", "reporting",
    "growth", "ml", "sql", "ab", "a/b",
}

DELIMITERS = [" \u2014 ", " - ", " | "]


def parse_company_position(title):
    """Return (company, position) from a title string."""
    if not title:
        return ("", "")
    s = " ".join(title.split())  # trim + collapse whitespace
    if not s:
        return ("", "")

    # Explicit delimiters
    for sep in DELIMITERS:
        idx = s.find(sep)
        if idx > 0:
            co = s[:idx].strip()
            po = s[idx + len(sep):].strip()
            if len(co) < 2:
                return (s, "")
            if len(po) < 2:
                po = ""
            return (co, po)

    # Token heuristic
    tokens = s.split(" ")
    lower = [unicodedata.normalize("NFC", t.lower()) for t in tokens]

    head_idx = -1
    # Bigram: "data scientist"
    for i in range(len(lower) - 1):
        if lower[i] == "data" and lower[i + 1] == "scientist":
            head_idx = i
            break
    # Single heads
    if head_idx == -1:
        for i, w in enumerate(lower):
            if w in ROLE_HEADS:
                head_idx = i
                break
    if head_idx == -1:
        return (s, "")

    sp = head_idx
    while sp > 0 and lower[sp - 1] in ROLE_MODS:
        sp -= 1
    if sp == 0:
        return (s, "")

    co = " ".join(tokens[:sp])
    po = " ".join(tokens[sp:])
    if len(co) < 2:
        return (s, "")
    if len(po) < 2:
        po = ""
    return (co, po)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
_SAFE_RE = re.compile(r"[^\w\s\-().\u2014]", re.UNICODE)


def safe_dirname(title, folder_id):
    """Create a filesystem-safe directory name from title + folder_id prefix."""
    company, position = parse_company_position(
        unicodedata.normalize("NFC", title) if title else ""
    )
    if position:
        base = f"{company} \u2014 {position}"
    else:
        base = company or title or "unknown"
    # Normalize and remove unsafe characters, collapse whitespace
    base = unicodedata.normalize("NFC", base)
    base = _SAFE_RE.sub("", base).strip()
    base = re.sub(r"\s+", " ", base)
    if not base:
        base = "unknown"
    # Append folder_id prefix to avoid name collisions
    suffix = folder_id[:8] if folder_id else "00000000"
    return f"{base} [{suffix}]"


def extract_folder_id(url):
    """Extract Google Drive folder ID from URL."""
    m = re.search(r"/folders/([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def log(path, message):
    """Append a timestamped line to the log file."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {message}\n"
    with open(path, "a", encoding="utf-8") as f:
        f.write(line)


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------
def is_nonempty_dir(p):
    """Return True if p is an existing directory with at least one child."""
    if not p.is_dir():
        return False
    try:
        return next(p.iterdir(), None) is not None
    except OSError:
        return False


def download_folder(url, target_dir, log_path):
    """
    Download a Google Drive folder via gdown.
    Returns (success: bool, detail: str).
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable, "-m", "gdown",
        "--folder", url,
        "--output", str(target_dir),
    ]
    log(log_path, f"RUN  {url}  ->  {target_dir}")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            log(log_path, f"  OK  exit=0  stdout_lines={len(result.stdout.splitlines())}")
            return (True, "ok")
        else:
            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            raw = stderr or stdout or "unknown error"
            if "Cannot retrieve" in raw or "permission" in raw.lower():
                tag = "FAILED_PERMISSION"
            else:
                tag = "FAILED_EXIT_%d" % result.returncode
            log(log_path, "  %s  exit=%d" % (tag, result.returncode))
            log(log_path, "  stderr: %s" % raw[:500])
            return (False, "%s: %s" % (tag, url))
    except subprocess.TimeoutExpired:
        log(log_path, "  FAILED_TIMEOUT  (300s)")
        return (False, "FAILED_TIMEOUT: %s" % url)
    except FileNotFoundError:
        log(log_path, "  FAILED_GDOWN_NOT_FOUND  (is gdown installed?)")
        return (False, "FAILED_GDOWN_NOT_FOUND")


# ---------------------------------------------------------------------------
# Summary (reused for normal finish and KeyboardInterrupt)
# ---------------------------------------------------------------------------
def print_summary(total, ok_count, skipped, failed, interrupted=False):
    print()
    print("=" * 50)
    if interrupted:
        print("*** INTERRUPTED by Ctrl+C ***")
    print("Total folders:   %d" % total)
    print("Downloaded OK:   %d" % ok_count)
    print("Skipped (exist): %d" % skipped)
    print("Failed:          %d" % len(failed))
    if failed:
        print()
        print("Failed folders:")
        for f_item in failed:
            print("  %s" % f_item["title"])
            print("    URL:    %s" % f_item["url"])
            print("    Reason: %s" % f_item["reason"])
    print()
    print("Log: %s" % LOG_PATH)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Download test-task folders from Google Drive")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, don't download")
    parser.add_argument("--start-from", type=int, default=1, metavar="N",
                        help="Skip first N-1 tasks, start from N-th (1-based, default: 1)")
    args = parser.parse_args()

    # Load JSON
    if not JSON_PATH.exists():
        print("ERROR: %s not found" % JSON_PATH, file=sys.stderr)
        sys.exit(1)
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    # Collect tasks with valid folder URLs
    tasks = []
    for item in data["items"]:
        url = item.get("url", "")
        fid = extract_folder_id(url)
        if not fid:
            continue
        dirname = safe_dirname(item.get("title", ""), fid)
        target = OUTPUT_DIR / dirname
        tasks.append({"title": item["title"], "url": url, "folder_id": fid, "target": target})

    # Deduplicate by folder_id
    seen = set()
    unique_tasks = []
    for t in tasks:
        if t["folder_id"] not in seen:
            seen.add(t["folder_id"])
            unique_tasks.append(t)
    tasks = unique_tasks

    # Apply --start-from
    start_idx = max(0, args.start_from - 1)
    if start_idx > 0:
        print("--start-from %d: skipping first %d task(s)" % (args.start_from, start_idx))

    print("Unique Google Drive folders: %d (processing %d..%d)" % (
        len(tasks), start_idx + 1, len(tasks)))
    print("Output directory: %s" % OUTPUT_DIR)
    print()

    work = tasks[start_idx:]

    if args.dry_run:
        show = work[:10]
        print("=== DRY RUN (first %d of %d) ===" % (len(show), len(work)))
        for idx, t in enumerate(show, start_idx + 1):
            if is_nonempty_dir(t["target"]):
                status = "EXISTS (will skip)"
            elif t["target"].exists():
                status = "EMPTY (will retry)"
            else:
                status = "will create"
            print("  #%d  %s" % (idx, t["target"].name))
            print("       url: %s" % t["url"][:80])
            print("       dir: %s  (%s)" % (t["target"], status))
            print()
        remaining = len(work) - len(show)
        if remaining > 0:
            print("  ... and %d more folders" % remaining)
        print()
        print("DRY RUN complete. No files downloaded.")
        return

    # Real download
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log(LOG_PATH, "=" * 60)
    log(LOG_PATH, "Download session started. %d folders (start_from=%d)." % (len(work), start_idx + 1))

    ok_count = 0
    skipped = 0
    failed = []

    try:
        for i, t in enumerate(work, start_idx + 1):
            label = "[%d/%d] %s" % (i, len(tasks), t["title"][:50])
            print(label + "...", end="  ", flush=True)

            # B) Skip already-downloaded (non-empty dir)
            if is_nonempty_dir(t["target"]):
                skipped += 1
                log(LOG_PATH, "SKIPPED_ALREADY_DOWNLOADED  %s  %s" % (t["url"], t["target"]))
                print("SKIP (already downloaded)")
                continue

            success, detail = download_folder(t["url"], t["target"], LOG_PATH)
            if success:
                ok_count += 1
                print("OK")
            else:
                failed.append({"title": t["title"], "url": t["url"], "reason": detail})
                print("FAIL  (%s)" % detail[:70])

    except KeyboardInterrupt:
        print("\n")
        log(LOG_PATH, "INTERRUPTED  last_url=%s  last_target=%s" % (
            t["url"] if t else "?", t["target"] if t else "?"))
        print_summary(len(work), ok_count, skipped, failed, interrupted=True)
        sys.exit(130)

    log(LOG_PATH, "Session finished. ok=%d skipped=%d failed=%d" % (ok_count, skipped, len(failed)))
    log(LOG_PATH, "=" * 60)

    print_summary(len(work), ok_count, skipped, failed)


if __name__ == "__main__":
    main()
