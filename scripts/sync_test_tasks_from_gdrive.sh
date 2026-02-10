#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Sync test-task folders from Google Drive via rclone.
# Works with private "Shared with me" folders.
# Downloads ONLY documents (pdf/doc/docx/xls/xlsx/csv/ipynb/txt/md/pptx/ppt).
# Videos, images, archives, and other media are excluded.
#
# Usage:
#   bash scripts/sync_test_tasks_from_gdrive.sh                    # download all
#   bash scripts/sync_test_tasks_from_gdrive.sh --dry-run          # preview
#   bash scripts/sync_test_tasks_from_gdrive.sh --start-from 42   # resume from #42
#   bash scripts/sync_test_tasks_from_gdrive.sh --only-failed     # retry failures
#   TT_PROGRESS=1 bash scripts/sync_test_tasks_from_gdrive.sh     # verbose progress
#
# Prerequisites:
#   brew install rclone
#   rclone config   # create remote named "gdrive" (Google Drive)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
JSON_PATH="$REPO_ROOT/data/test-tasks.v1.json"
DATA_ROOT="$HOME/data/public/davydov-my/test-tasks"
OUTPUT_DIR="$DATA_ROOT/raw"
LOG_FILE="$DATA_ROOT/rclone-sync.log"
FAIL_LOG_DIR="$DATA_ROOT/rclone-fails"
REMOTE="gdrive"
SIZE_LIMIT_MB=500

# ── Include filters (shared between probe and copy) ──────────
INCLUDE_FILTERS=(
  --include "*.pdf"
  --include "*.doc"
  --include "*.docx"
  --include "*.xls"
  --include "*.xlsx"
  --include "*.csv"
  --include "*.ipynb"
  --include "*.txt"
  --include "*.md"
  --include "*.pptx"
  --include "*.ppt"
  --exclude "*"
)

# ── CLI args ──────────────────────────────────────────────────
DRY_RUN=false
START_FROM=1
ONLY_FAILED=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)      DRY_RUN=true; shift ;;
    --start-from)   START_FROM="$2"; shift 2 ;;
    --only-failed)  ONLY_FAILED=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--start-from N] [--only-failed]"
      echo ""
      echo "  --dry-run        List folders without downloading"
      echo "  --start-from N   Skip first N-1 tasks (1-based, default: 1)"
      echo "  --only-failed    Retry only FAILED_* entries from previous log"
      echo ""
      echo "Environment:"
      echo "  TT_PROGRESS=1    Show live download progress per folder"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── Preflight checks ─────────────────────────────────────────
if ! command -v rclone &>/dev/null; then
  echo "ERROR: rclone not found. Install with: brew install rclone" >&2
  exit 1
fi

if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:$"; then
  echo "ERROR: rclone remote '$REMOTE' not configured." >&2
  echo "  Run: rclone config" >&2
  exit 1
fi

if [ ! -f "$JSON_PATH" ]; then
  echo "ERROR: $JSON_PATH not found" >&2
  exit 1
fi

# ── Helper: save last 3000 chars of stderr to per-folder fail log ──
save_fail_log() {
  local fid="$1" errfile="$2"
  mkdir -p "$FAIL_LOG_DIR"
  tail -c 3000 "$errfile" > "$FAIL_LOG_DIR/${fid}.log" 2>/dev/null || true
}

# ── Generate task list via Python ─────────────────────────────
# Output: FOLDER_ID<TAB>URL<TAB>DIRNAME
TASK_LIST=$(python3 - "$JSON_PATH" <<'PYEOF'
import json, re, sys, unicodedata

ROLE_HEADS = {
    "аналитик","analyst","scientist","ds","engineer",
    "developer","manager","lead","head","researcher",
}
ROLE_MODS = {
    "продуктовый","продуктовая","продуктовому","данных","дата",
    "маркетинговый","бизнес","коммерческий","игровой","старший","ведущий",
    "product","data","business","marketing","bi","power",
    "web-mobile","web","mobile","fraud","risk","reporting",
    "growth","ml","sql","ab","a/b",
}
DELIMITERS = [" \u2014 ", " - ", " | "]
_SAFE_RE = re.compile(r"[^\w\s\-().\u2014]", re.UNICODE)

def parse_cp(title):
    if not title: return ("","")
    s = " ".join(title.split())
    if not s: return ("","")
    for sep in DELIMITERS:
        idx = s.find(sep)
        if idx > 0:
            co, po = s[:idx].strip(), s[idx+len(sep):].strip()
            if len(co)<2: return (s,"")
            if len(po)<2: po=""
            return (co, po)
    tokens = s.split(" ")
    lower = [unicodedata.normalize("NFC", t.lower()) for t in tokens]
    hi = -1
    for i in range(len(lower)-1):
        if lower[i]=="data" and lower[i+1]=="scientist": hi=i; break
    if hi == -1:
        for i,w in enumerate(lower):
            if w in ROLE_HEADS: hi=i; break
    if hi == -1: return (s,"")
    sp = hi
    while sp>0 and lower[sp-1] in ROLE_MODS: sp -= 1
    if sp == 0: return (s,"")
    co = " ".join(tokens[:sp]); po = " ".join(tokens[sp:])
    if len(co)<2: return (s,"")
    if len(po)<2: po=""
    return (co, po)

def safe_dirname(title, fid):
    t = unicodedata.normalize("NFC", title) if title else ""
    co, po = parse_cp(t)
    base = ("%s \u2014 %s" % (co, po)) if po else (co or title or "unknown")
    base = unicodedata.normalize("NFC", base)
    base = _SAFE_RE.sub("", base).strip()
    base = re.sub(r"\s+", " ", base)
    if not base: base = "unknown"
    return "%s [%s]" % (base, fid[:8])

with open(sys.argv[1], encoding="utf-8") as f:
    data = json.load(f)
seen = set()
for item in data["items"]:
    url = item.get("url","")
    m = re.search(r"/folders/([A-Za-z0-9_-]+)", url)
    if not m: continue
    fid = m.group(1)
    if fid in seen: continue
    seen.add(fid)
    dirname = safe_dirname(item.get("title",""), fid)
    print("%s\t%s\t%s" % (fid, url, dirname))
PYEOF
)

TOTAL=$(echo "$TASK_LIST" | wc -l | tr -d ' ')

# ── --only-failed: filter to previously FAILED_* entries ─────
if $ONLY_FAILED; then
  if [ ! -f "$LOG_FILE" ]; then
    echo "ERROR: log file $LOG_FILE not found. Nothing to retry." >&2
    exit 1
  fi
  # Parse log: find folder_ids whose LAST status is FAILED_*
  FAILED_IDS=$(python3 -c "
import re, sys
statuses = {}
for line in open(sys.argv[1]):
    m = re.match(r'\[[\d: -]+\]\s+(FAILED\S*|COPIED|SKIPPED)\s+(\S+)', line)
    if m:
        status, fid = m.groups()
        statuses[fid] = status
for fid, status in statuses.items():
    if status.startswith('FAILED'):
        print(fid)
" "$LOG_FILE")
  if [ -z "$FAILED_IDS" ]; then
    echo "No FAILED entries in log. Nothing to retry."
    exit 0
  fi
  # Filter task list to only include failed folder_ids
  FILTERED=""
  while IFS=$'\t' read -r FID FURL FDIRNAME; do
    if echo "$FAILED_IDS" | grep -qxF "$FID"; then
      FILTERED="${FILTERED}${FID}$(printf '\t')${FURL}$(printf '\t')${FDIRNAME}"$'\n'
    fi
  done <<< "$TASK_LIST"
  TASK_LIST="${FILTERED%$'\n'}"
  if [ -z "$TASK_LIST" ]; then
    echo "No matching folders for FAILED entries."
    exit 0
  fi
  RETRY_COUNT=$(echo "$TASK_LIST" | wc -l | tr -d ' ')
  echo "--only-failed: retrying $RETRY_COUNT previously failed folder(s)"
  START_FROM=1
fi

# ── Apply --start-from ───────────────────────────────────────
if [ "$START_FROM" -gt 1 ] 2>/dev/null; then
  TASK_LIST=$(echo "$TASK_LIST" | tail -n +"$START_FROM")
  echo "--start-from $START_FROM: skipping first $((START_FROM - 1)) task(s)"
fi

if [ -z "$TASK_LIST" ]; then
  echo "No folders to process."
  exit 0
fi

WORK_COUNT=$(echo "$TASK_LIST" | wc -l | tr -d ' ')

echo "Unique Google Drive folders: $TOTAL (processing: $WORK_COUNT)"
echo "Output directory: $OUTPUT_DIR"
echo "Filter: docs only (pdf/doc/docx/xls/xlsx/csv/ipynb/txt/md/pptx/ppt)"
echo "Size guard: ${SIZE_LIMIT_MB}MB per folder"
echo ""

# ── Dry run ───────────────────────────────────────────────────
if $DRY_RUN; then
  ALREADY_DONE=0
  TO_DOWNLOAD=0
  while IFS=$'\t' read -r _FID _URL DIRNAME; do
    TARGET="$OUTPUT_DIR/$DIRNAME"
    if [ -d "$TARGET" ] && [ "$(ls -A "$TARGET" 2>/dev/null)" ]; then
      ALREADY_DONE=$((ALREADY_DONE + 1))
    else
      TO_DOWNLOAD=$((TO_DOWNLOAD + 1))
    fi
  done <<< "$TASK_LIST"

  echo "=== DRY RUN ==="
  echo "Total: $WORK_COUNT | Already downloaded: $ALREADY_DONE | To download: $TO_DOWNLOAD"
  echo ""
  IDX=0
  while IFS=$'\t' read -r FOLDER_ID URL DIRNAME; do
    IDX=$((IDX + 1))
    if [ "$IDX" -gt 10 ]; then break; fi
    TARGET="$OUTPUT_DIR/$DIRNAME"
    if [ -d "$TARGET" ] && [ "$(ls -A "$TARGET" 2>/dev/null)" ]; then
      STATUS="EXISTS (skip)"
    else
      STATUS="will download"
    fi
    printf "  #%-3d %-55s %s\n" "$IDX" "$DIRNAME" "$STATUS"
    printf "       folder_id: %s\n" "$FOLDER_ID"
  done <<< "$TASK_LIST"

  if [ "$WORK_COUNT" -gt 10 ]; then
    echo ""
    echo "  ... and $((WORK_COUNT - 10)) more"
  fi
  echo ""
  echo "DRY RUN complete. Nothing downloaded."
  exit 0
fi

# ── Real download ─────────────────────────────────────────────
mkdir -p "$OUTPUT_DIR"
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$FAIL_LOG_DIR"

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" >> "$LOG_FILE"
}

log "============================================================"
log "rclone sync session started. $WORK_COUNT folders (start_from=$START_FROM)."

OK=0
SKIPPED=0
FAILED=0
FAIL_LIST=""
IDX=0

# Graceful interrupt handler
interrupted=false
trap 'interrupted=true' INT

while IFS=$'\t' read -r FOLDER_ID URL DIRNAME; do
  if $interrupted; then
    break
  fi

  IDX=$((IDX + 1))
  GLOBAL_IDX=$((START_FROM - 1 + IDX))
  TARGET="$OUTPUT_DIR/$DIRNAME"

  printf "[%d/%d] %s  " "$GLOBAL_IDX" "$TOTAL" "${DIRNAME:0:55}"

  # ── Resume: skip non-empty dirs ────────────────────────────
  # In --only-failed mode, clean up incomplete dirs before retry
  if $ONLY_FAILED && [ -d "$TARGET" ]; then
    if [[ "$TARGET" == "$OUTPUT_DIR"/* ]]; then
      rm -rf "$TARGET"
    fi
  fi

  if [ -d "$TARGET" ] && [ "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    SKIPPED=$((SKIPPED + 1))
    log "SKIPPED  $FOLDER_ID  $URL  $DIRNAME"
    echo "SKIP"
    continue
  fi

  # ── Probe: check access + count matching doc files ─────────
  # NOTE: --drive-shared-with-me is intentionally OMITTED here.
  # With it, rclone ignores --drive-root-folder-id and lists ALL shared items.
  # Without it, --drive-root-folder-id works correctly (folders are accessible by ID).
  PROBE_STDERR=$(mktemp)
  PROBE_EXIT=0
  PROBE_OUT=$(rclone lsf "${REMOTE}:" \
    --drive-root-folder-id "$FOLDER_ID" \
    --fast-list \
    --recursive \
    --files-only \
    "${INCLUDE_FILTERS[@]}" \
    --contimeout 15s \
    --timeout 30s \
    2>"$PROBE_STDERR") || PROBE_EXIT=$?

  if [ "$PROBE_EXIT" -ne 0 ]; then
    PROBE_ERR=$(head -c 300 "$PROBE_STDERR")
    save_fail_log "$FOLDER_ID" "$PROBE_STDERR"
    FAILED=$((FAILED + 1))
    FAIL_LIST="${FAIL_LIST}  ${DIRNAME}  (FAILED_PERMISSION)\n"
    log "FAILED_PERMISSION  $FOLDER_ID  $URL  $DIRNAME  exit=$PROBE_EXIT  err: $PROBE_ERR"
    echo "FAIL (no access)"
    rm -f "$PROBE_STDERR"
    continue
  fi
  rm -f "$PROBE_STDERR"

  # Count matching files
  if [ -z "$PROBE_OUT" ]; then
    MATCH_COUNT=0
  else
    MATCH_COUNT=$(echo "$PROBE_OUT" | wc -l | tr -d ' ')
  fi

  if [ "$MATCH_COUNT" -eq 0 ]; then
    FAILED=$((FAILED + 1))
    FAIL_LIST="${FAIL_LIST}  ${DIRNAME}  (FAILED_NO_MATCH)\n"
    log "FAILED_NO_MATCH  $FOLDER_ID  $URL  $DIRNAME  (0 matching doc files)"
    echo "FAIL (no matching docs)"
    continue
  fi

  printf "(%d docs) " "$MATCH_COUNT"

  # ── Copy ────────────────────────────────────────────────────
  mkdir -p "$TARGET"
  RCLONE_STDERR=$(mktemp)

  # NOTE: --drive-shared-with-me is intentionally OMITTED.
  # It overrides --drive-root-folder-id and copies ALL shared content.
  RCLONE_ARGS=(
    "${REMOTE}:" "$TARGET/"
    --drive-root-folder-id "$FOLDER_ID"
    --fast-list
    --transfers 4 --checkers 8 --tpslimit 10
    --retries 3 --low-level-retries 10 --timeout 30s --contimeout 20s
    "${INCLUDE_FILTERS[@]}"
    --stats 5s --stats-one-line --stats-unit bytes
    --log-level INFO
  )

  if [ "${TT_PROGRESS:-}" = "1" ]; then
    # ── Progress mode: foreground (no size guard) ──────────
    RCLONE_EXIT=0
    rclone copy "${RCLONE_ARGS[@]}" --progress 2>"$RCLONE_STDERR" || RCLONE_EXIT=$?
    SIZE_EXCEEDED=false
  else
    # ── Background mode: size guard active ─────────────────
    rclone copy "${RCLONE_ARGS[@]}" 2>"$RCLONE_STDERR" &
    RCLONE_PID=$!

    SIZE_EXCEEDED=false
    while kill -0 "$RCLONE_PID" 2>/dev/null; do
      sleep 5 || true
      if $interrupted; then
        kill "$RCLONE_PID" 2>/dev/null || true
        break
      fi
      if [ -d "$TARGET" ]; then
        SIZE_MB=$(du -sm "$TARGET" 2>/dev/null | awk '{print $1}' || echo "0")
        if [ "${SIZE_MB:-0}" -gt "$SIZE_LIMIT_MB" ]; then
          SIZE_EXCEEDED=true
          kill "$RCLONE_PID" 2>/dev/null || true
          sleep 1 || true
          kill -9 "$RCLONE_PID" 2>/dev/null || true
          break
        fi
      fi
    done

    RCLONE_EXIT=0
    wait "$RCLONE_PID" 2>/dev/null || RCLONE_EXIT=$?
  fi

  # Check if interrupted during copy
  if $interrupted; then
    cat "$RCLONE_STDERR" >> "$LOG_FILE" 2>/dev/null
    log "INTERRUPTED_COPY  $FOLDER_ID  $URL  $DIRNAME"
    rm -f "$RCLONE_STDERR"
    break
  fi

  # Append rclone stderr to main log
  cat "$RCLONE_STDERR" >> "$LOG_FILE" 2>/dev/null

  # ── Evaluate result ─────────────────────────────────────────
  if $SIZE_EXCEEDED; then
    save_fail_log "$FOLDER_ID" "$RCLONE_STDERR"
    FAILED=$((FAILED + 1))
    FAIL_LIST="${FAIL_LIST}  ${DIRNAME}  (FAILED_TOO_LARGE)\n"
    log "FAILED_TOO_LARGE  $FOLDER_ID  $URL  $DIRNAME  size>${SIZE_LIMIT_MB}MB"
    echo "FAIL (>${SIZE_LIMIT_MB}MB — killed)"
  elif [ "$RCLONE_EXIT" -eq 0 ]; then
    if [ "$(ls -A "$TARGET" 2>/dev/null)" ]; then
      OK=$((OK + 1))
      log "COPIED  $FOLDER_ID  $URL  $DIRNAME"
      echo "OK"
    else
      OK=$((OK + 1))
      log "COPIED  $FOLDER_ID  $URL  $DIRNAME  (empty - no matching docs on Drive)"
      echo "OK (empty)"
    fi
  else
    LAST_ERR=$(tail -1 "$RCLONE_STDERR" | head -c 300)
    save_fail_log "$FOLDER_ID" "$RCLONE_STDERR"
    FAILED=$((FAILED + 1))
    FAIL_LIST="${FAIL_LIST}  ${DIRNAME}  (FAILED exit=$RCLONE_EXIT)\n"
    log "FAILED  $FOLDER_ID  $URL  $DIRNAME  exit=$RCLONE_EXIT  err: $LAST_ERR"
    echo "FAIL (exit=$RCLONE_EXIT)"
  fi
  rm -f "$RCLONE_STDERR"

done <<< "$TASK_LIST"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "=================================================="
if $interrupted; then
  echo "*** INTERRUPTED by Ctrl+C ***"
  log "INTERRUPTED at idx=${GLOBAL_IDX:-$IDX}"
fi
echo "Total folders:   $TOTAL"
echo "Processed:       $IDX"
echo "Copied OK:       $OK"
echo "Skipped (exist): $SKIPPED"
echo "Failed:          $FAILED"
if [ -n "$FAIL_LIST" ]; then
  echo ""
  echo "Failed folders:"
  printf "$FAIL_LIST"
fi
if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Retry failed: bash $0 --only-failed"
  echo "Fail logs:    $FAIL_LOG_DIR/"
fi
echo ""
echo "Log: $LOG_FILE"

log "Session finished. ok=$OK skipped=$SKIPPED failed=$FAILED"
log "============================================================"

if $interrupted; then
  exit 130
fi
if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
