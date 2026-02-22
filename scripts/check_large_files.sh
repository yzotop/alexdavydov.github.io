#!/usr/bin/env bash
# check_large_files.sh — prevent large files from entering the repo
#
# Usage:
#   scripts/check_large_files.sh          # check staged files (pre-commit mode)
#   scripts/check_large_files.sh --all    # audit all tracked files (report mode)
#
# Threshold: 10 MB. Files above this size are blocked unless allowlisted.
set -euo pipefail

THRESHOLD=$((10 * 1024 * 1024))
THRESHOLD_MB=10

ALLOWLIST=(
  "assets/search-index.json"
  "lab/_manifest.json"
)

is_allowed() {
  local f="$1"
  for pattern in "${ALLOWLIST[@]}"; do
    [[ "$f" == "$pattern" ]] && return 0
  done
  return 1
}

format_mb() {
  awk "BEGIN { printf \"%.1f MB\", $1 / 1048576 }"
}

# ── --all mode: audit all files, report top 20 ───────────────────────────
if [[ "${1:-}" == "--all" ]]; then
  echo "=== Repository file size audit ==="
  echo "Threshold: ${THRESHOLD_MB} MB"
  echo ""
  echo "Top 20 files by size:"
  echo ""
  printf "%-10s  %s\n" "Size" "Path"
  printf "%-10s  %s\n" "────" "────"

  find . -not -path './.git/*' -not -name '.DS_Store' -type f \
    -exec stat -f '%z %N' {} \; 2>/dev/null | sort -rn | head -20 | \
  while read -r sz path; do
    rel="${path#./}"
    human=$(format_mb "$sz")
    flag=""
    if (( sz > THRESHOLD )); then
      if is_allowed "$rel"; then
        flag=" (allowlisted)"
      else
        flag=" ⚠"
      fi
    fi
    printf "%-10s  %s%s\n" "$human" "$rel" "$flag"
  done
  echo ""
  exit 0
fi

# ── pre-commit mode: check staged files ──────────────────────────────────
violations=()

while IFS= read -r line; do
  gst="${line:0:1}"
  file="${line:2}"

  [[ "$gst" == "D" ]] && continue

  if [[ ! -f "$file" ]]; then
    continue
  fi

  sz=$(stat -f '%z' "$file" 2>/dev/null || echo 0)

  if (( sz > THRESHOLD )); then
    if ! is_allowed "$file"; then
      human=$(format_mb "$sz")
      violations+=("$human  $file")
    fi
  fi
done < <(git diff --cached --name-status --diff-filter=ACMR 2>/dev/null)

if (( ${#violations[@]} > 0 )); then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  BLOCKED: large file(s) detected (threshold: ${THRESHOLD_MB} MB)   ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  printf "%-10s  %s\n" "Size" "Path"
  printf "%-10s  %s\n" "────" "────"
  for v in "${violations[@]}"; do
    echo "$v"
  done
  echo ""
  echo "Data files should live in ~/data/, not in the site repo."
  echo "If this file truly belongs here, add it to the ALLOWLIST"
  echo "in scripts/check_large_files.sh, or consider git-lfs."
  echo ""
  exit 1
fi

exit 0
